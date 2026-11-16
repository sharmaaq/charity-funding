// The package part of the review screen: attachments, package hash, Download proposal, View source notes, an optional
// manager-supplied proposal PDF, the two unchecked confirmations and the (disabled in this phase) run control.
//
// Rules this file keeps:
//  - Nothing is stored until BOTH confirmations are ticked. Ticking the second one freezes the snapshot in one
//    transaction; "stored" is only shown after that transaction has completed. On any failure both boxes are cleared,
//    the draft is untouched and the message says what to do.
//  - Any change to the attachments (a different proposal PDF, its confirmation) rebuilds the package, recomputes the hash
//    and clears both confirmations. Leaving and returning to the review starts with both boxes clear.
//  - A frozen snapshot is never edited. Editing answers later makes a new draft revision, and a new review.
//
// Phase C: the Run submission demo control, progress, completion and failure states live in the run area below the
// confirmations. The button is enabled only for a frozen package with both boxes ticked, when the server reports the
// demo runner available, and when this package has no receipt and no run in progress.
import { h, formatBytes, downloadBlob, formatDateTime } from '../org/dom.js';
import { getCapabilities, startDemoRun, runFor, subscribe, reconcileStale, receiptDocument, MILESTONES } from './submission-client.js';
import { mapError } from '../org/db.js';
import { ADAPTER_ID, PackageBlocked, REPLACEMENT_CHECK_TEXT, freezeSnapshot, inspectReplacementProposal, preparePackage, sourceNotes } from './package.js';
import { ProposalError } from './proposal.js';
import { ROLE_LABEL } from './transfer.js';
import { ORIGIN_CHIP, SOURCE_KIND } from './labels.js';

export const REVIEW_CHECK_LABEL = 'I have reviewed these demo answers and documents';
export const TRANSFER_CHECK_LABEL = 'Run the demo transfer using this package';
export const EXPLANATION_TEXT = 'The answers and files in this package are processed temporarily by our server only after you start the demo run. Nothing is sent to the real funder, and the originals stay in this browser. These two checks authorise this demo run only. They are not real safeguarding, tax or privacy attestations.';
export const AUTOMATION_UNAVAILABLE_TEXT = 'Automation unavailable. The demo runner cannot be used right now, so the demo transfer cannot be started. Your package is not affected.';
export const BEFORE_RUN_TEXT = 'The demo run takes up to 90 seconds. Keep this page open: closing or reloading it interrupts the run, and the result would then not be confirmed. You can move to other pages of this app while it runs.';
export const COMPLETED_TITLE = 'Demo submission completed — nothing sent to Garfield Weston';
export const RUN_LABEL = 'Run submission demo';

const shortHash = (s) => `${s.slice(0, 12)}…${s.slice(-6)}`;

export function buildPackagePanel(sess, api) {
  const root = h('section', { class: 'review-block review-next', id: 'review-next', 'data-testid': 'review-next', 'aria-labelledby': 'rv-next' },
    h('h3', { id: 'rv-next', text: 'Package and submission demo' }));
  const body = h('div', { 'data-testid': 'package-body' });
  root.append(body);

  const state = { token: 0, phase: 'idle', prep: null, blocked: null, reviewed: false, transfer: false, snapshot: null, created: null, error: null, replacementNote: null, caps: null, receipt: null, lastAttempt: null, runError: null, starting: false };
  let checks = null; // { reviewed, transfer, status, runBtn, note } for the current render
  const runArea = h('div', { class: 'run-area', 'data-testid': 'run-area' });
  getCapabilities().then((caps) => { state.caps = caps; paintRun(); });
  // The run continues if the manager navigates away; a later review of the same package picks it up again.
  const unsubscribe = subscribe((run) => {
    if (!root.isConnected) { unsubscribe(); return; }
    if (state.snapshot && run.snapshotId === state.snapshot.id) { if (run.receipt && !run.saveError) state.receipt = run.receipt; paintChecks(); }
  });

  const setStatus = (kind, message) => {
    if (!checks) return;
    checks.status.textContent = message;
    checks.status.dataset.kind = kind;
    checks.status.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  };
  const paintChecks = () => {
    if (!checks) return;
    const busy = state.phase === 'freezing';
    checks.reviewed.checked = state.reviewed;
    checks.transfer.checked = state.transfer;
    const run = state.snapshot ? runFor(state.snapshot.id) : null;
    const locked = !!(state.receipt || (run && run.phase === 'running'));
    checks.reviewed.disabled = busy || locked || state.phase === 'preparing' || !state.prep;
    checks.transfer.disabled = busy || locked || state.phase === 'preparing' || !state.prep;
    root.dataset.snapshotId = state.snapshot ? state.snapshot.id : '';
    root.dataset.confirmed = String(state.reviewed && state.transfer && !!state.snapshot);
    paintRun();
  };

  // ---------------------------------------------------------------- demo run
  // Coming back to the review of a package that is already running or already has a receipt shows that state, rather
  // than asking for confirmations that can no longer start anything.
  async function adoptExisting(svc, prep, mine) {
    try {
      const snaps = (await svc.apps.listSnapshots(sess.app.id)).filter((s) => s.payloadHash === prep.payloadHash);
      if (mine !== state.token || !snaps.length) return;
      const active = snaps.map((s) => runFor(s.id)).find((r) => r && r.phase === 'running');
      const receipts = await svc.apps.listReceipts();
      const done = snaps.find((s) => receipts.some((r) => r.snapshotId === s.id));
      const snap = active ? active.snapshot : done;
      if (!snap || mine !== state.token) return;
      Object.assign(state, { snapshot: snap, phase: 'frozen', reviewed: true, transfer: true, created: false });
      state.savedMessage = `This package is saved in this browser as snapshot ${snap.id.slice(0, 8)}. Hash ${shortHash(snap.payloadHash)}.`;
      await loadRunHistory();
    } catch { /* no history: the review starts with both boxes clear */ }
  }

  async function loadRunHistory() {
    if (!state.snapshot) return;
    const id = state.snapshot.id;
    try {
      const svc = await api.services();
      await reconcileStale(svc.apps);
      const [receipts, attempts] = await Promise.all([svc.apps.listReceipts(), svc.apps.listAttempts()]);
      if (!state.snapshot || state.snapshot.id !== id) return;
      state.receipt = receipts.find((r) => r.snapshotId === id) || null;
      state.lastAttempt = attempts.filter((a) => a.snapshotId === id).pop() || null;
    } catch { /* history is a convenience here; the attempt lock still protects the run */ }
    paintChecks();
  }

  async function startRun(retryId = null) {
    if (state.starting) return;
    state.starting = true;
    state.runError = null;
    paintRun();
    try {
      const svc = await api.services();
      await reconcileStale(svc.apps);
      await startDemoRun({ apps: svc.apps, snapshot: state.snapshot, retryId, nowIso: api.nowIso });
      api.announce('Demo run started. Keep this page open until it finishes.');
    } catch (e) {
      state.runError = `The demo run was not started. ${mapError(e).message}`;
      await loadRunHistory();
    } finally {
      state.starting = false;
      paintChecks();
    }
  }

  function milestoneList(run) {
    return h('ol', { class: 'milestones', 'data-testid': 'run-progress' }, MILESTONES.map((m) => {
      const st = run.steps[m.step];
      const label = { pending: 'Not started', current: 'In progress', complete: 'Done', failed: 'Failed' }[st.status];
      return h('li', { 'data-step': m.step, 'data-status': st.status },
        h('span', { class: 'ms-label', text: m.label }),
        h('span', { class: 'ms-state', text: st.at && st.status !== 'pending' ? `${label} · ${formatDateTime(st.at)}` : label }));
    }));
  }

  function completion(receipt) {
    const ev = receipt.evidenceSummary || {};
    const row = (dt, dd) => h('div', { class: 'review-row' }, h('dt', { text: dt }), typeof dd === 'string' ? h('dd', { text: dd }) : h('dd', null, dd));
    return h('div', { class: 'run-complete', 'data-testid': 'run-complete' },
      h('h4', { text: COMPLETED_TITLE }),
      h('dl', { class: 'review-list' },
        row('Demo reference', h('code', { 'data-testid': 'receipt-reference', text: receipt.reference })),
        row('Funder and programme', 'Garfield Weston Foundation, Regular Grants (core costs). Transferred only to the controlled test portal run by this demo.'),
        row('Submitted to the test portal', formatDateTime(receipt.confirmedAt)),
        row('Snapshot revision', String(ev.snapshotRevision ?? '')),
        row('Documents transferred', h('ul', { class: 'issue-list' }, (ev.files || []).map((f) => h('li', { text: `${f.filename} · ${formatBytes(f.sizeBytes)} · SHA-256 ${shortHash(f.sha256)}` })))),
        row('Package hash', h('code', { class: 'hash-cell', text: receipt.payloadHash }))),
      h('p', { class: 'sub', text: 'This receipt is evidence of the controlled test portal only. It is not an award or a decision, and no email will follow.' }),
      h('div', { class: 'app-bar-main' },
        h('a', { class: 'btn primary', href: '#/tracking', 'data-testid': 'view-tracking', text: 'View in Tracking' }),
        h('button', { type: 'button', class: 'btn', 'data-testid': 'download-receipt', text: 'Download receipt', onclick: () => downloadBlob(new Blob([receiptDocument(receipt)], { type: 'application/json' }), `${receipt.reference}.json`) }),
        h('button', { type: 'button', class: 'btn quiet', 'data-testid': 'revise-draft', text: 'Create revised draft', onclick: () => api.reviseDraft() })));
  }

  function failure(phase, error, attempt) {
    const title = phase === 'cancelled' ? 'Demo run stopped' : phase === 'interrupted_unknown' ? 'Demo result not confirmed' : 'Demo run failed';
    const retryable = phase === 'interrupted_unknown' || phase === 'cancelled' || (phase === 'failed' && !!error.retryable);
    return h('div', { class: 'form-error run-failed', role: 'alert', 'data-testid': 'run-failed', 'data-state': phase },
      h('h4', { text: title }),
      h('p', { text: error.message || 'The demo run did not finish.' }),
      error.fieldPath ? h('p', { class: 'sub', text: `Field: ${error.fieldPath}` }) : null,
      phase === 'interrupted_unknown' ? h('p', { class: 'sub', text: 'This is a demo, so nothing reached Garfield Weston either way. A deliberate retry reuses the same attempt and so cannot create a second receipt.' }) : null,
      retryable && attempt ? h('button', { type: 'button', class: 'btn primary', 'data-testid': 'retry-run', text: 'Retry demo run', onclick: () => startRun(attempt.id) }) : null);
  }

  function paintRun() {
    if (!checks) return;
    const snap = state.snapshot;
    const run = snap ? runFor(snap.id) : null;
    const caps = state.caps;
    const running = !!(run && run.phase === 'running');
    const receipt = (run && run.receipt) || state.receipt;
    const ready = state.phase === 'frozen' && state.reviewed && state.transfer && !!snap;
    // One attempt per package: after a failed or unconfirmed run only the deliberate Retry (same attempt ID) is offered.
    const tried = !!(run || state.lastAttempt);
    checks.runBtn.disabled = !(ready && caps && caps.demoAvailable && !running && !receipt && !tried && !state.starting);
    checks.note.dataset.available = String(!!(caps && caps.demoAvailable));
    checks.note.textContent = !caps ? 'Checking whether the demo runner is available…'
      : caps.demoAvailable ? BEFORE_RUN_TEXT : `${AUTOMATION_UNAVAILABLE_TEXT}${caps.reason ? ` ${caps.reason}` : ''}`;
    const parts = [];
    if (state.runError) parts.push(h('p', { class: 'form-error', role: 'alert', 'data-testid': 'run-error', text: state.runError }));
    if (run) {
      parts.push(h('h4', { text: running ? 'Demo run in progress' : 'Demo run' }));
      parts.push(milestoneList(run));
      if (running) parts.push(h('button', { type: 'button', class: 'btn quiet', 'data-testid': 'cancel-run', text: 'Stop the demo run', onclick: () => run.cancel() }));
    }
    if (receipt) {
      if (run && run.saveError) {
        parts.push(h('div', { class: 'form-error', role: 'alert', 'data-testid': 'receipt-not-saved' },
          h('p', { text: 'Demo completed; receipt not saved in this browser. Download the receipt now, or retry saving it. The demo run is not repeated.' }),
          h('button', { type: 'button', class: 'btn primary', 'data-testid': 'retry-save', text: 'Retry save', onclick: () => run.retrySave() })));
      }
      parts.push(completion(receipt));
    } else if (run && !running && run.error) {
      parts.push(failure(run.phase, run.error, run.attempt));
    } else if (!run && state.lastAttempt && state.lastAttempt.state === 'running') {
      parts.push(h('p', { class: 'pkg-status', role: 'status', 'data-testid': 'run-elsewhere', text: 'A demo run for this package is in progress in another tab or window. Its result will appear in Tracking when it finishes.' }));
    } else if (!run && state.lastAttempt && state.lastAttempt.state !== 'demo_completed') {
      parts.push(failure(state.lastAttempt.state, state.lastAttempt.error || {}, state.lastAttempt));
    }
    runArea.replaceChildren(...parts);
    root.dataset.runPhase = run ? run.phase : receipt ? 'completed' : '';
  }

  // ---------------------------------------------------------------- preparing
  async function prepare() {
    const mine = ++state.token;
    Object.assign(state, { phase: 'preparing', prep: null, blocked: null, reviewed: false, transfer: false, snapshot: null, created: null, error: null, receipt: null, lastAttempt: null, runError: null });
    render();
    try {
      if (!sess.eval.ready) throw new PackageBlocked('not-ready', 'The package is prepared once every applicable answer is present and confirmed. The missing and unconfirmed answers are listed above as links.');
      if (sess.dirty || sess.saveState !== 'saved') throw new PackageBlocked('unsaved', 'Your latest changes are not saved yet, so no package is prepared from them. Go back to the form, save the draft, then open the review again.');
      const svc = await api.services();
      if (svc.problem || !svc.org) throw new PackageBlocked('store', 'The organisation store could not be read, so the accounts document cannot be copied into a package. Nothing was changed.');
      const prep = await preparePackage({ answers: sess.answers, application: sess.app, catalogue: sess.catalogue, getBlob: (id) => svc.org.getBlob(id), evaluation: sess.eval });
      if (mine !== state.token) return;
      state.prep = prep;
      state.phase = 'ready';
      await adoptExisting(svc, prep, mine);
    } catch (e) {
      if (mine !== state.token) return;
      state.phase = 'blocked';
      if (e instanceof PackageBlocked || e instanceof ProposalError) state.blocked = { message: e.message, sections: e.sections || null, code: e.code };
      else state.blocked = { message: mapError(e).message, sections: null, code: 'error' };
    }
    render();
  }

  // ---------------------------------------------------------------- freezing
  async function freeze() {
    const mine = state.token;
    state.phase = 'freezing';
    paintChecks();
    setStatus('busy', 'Saving the package in this browser…');
    try {
      const svc = await api.services();
      const at = api.nowIso();
      const res = await freezeSnapshot(svc.apps, state.prep, {
        application: { id: sess.app.id, grantId: sess.grantId, draftRevision: sess.app.draftRevision },
        answers: sess.answers,
        confirmations: { reviewedAt: at, transferAt: at },
        capturedAt: at,
      });
      if (mine !== state.token) return;
      state.snapshot = res.snapshot;
      state.created = res.created;
      state.phase = 'frozen';
      sess.app = { ...sess.app, lastSnapshotId: res.snapshot.id };
      state.savedMessage = `${res.created ? 'Package saved' : 'This exact package was already saved'} in this browser as snapshot ${res.snapshot.id.slice(0, 8)}. Hash ${shortHash(res.snapshot.payloadHash)}. It cannot be changed; editing your answers makes a new revision and a new review.`;
      paintChecks();
      loadRunHistory();
      setStatus('ok', state.savedMessage);
      api.announce('Package saved in this browser.');
    } catch (e) {
      if (mine !== state.token) return;
      const err = mapError(e);
      state.phase = 'ready';
      state.reviewed = false;
      state.transfer = false;
      state.error = err;
      paintChecks();
      setStatus('error', `The package was not saved. ${err.message} Your draft is unchanged. Tick both boxes again to retry.`);
    }
  }

  function onCheck() {
    state.reviewed = checks.reviewed.checked;
    state.transfer = checks.transfer.checked;
    if (state.reviewed && state.transfer && state.phase === 'ready') { freeze(); return; }
    paintChecks();
    if (state.phase === 'frozen') {
      if (state.reviewed && state.transfer) setStatus('ok', state.savedMessage);
      else setStatus('info', 'A package with this hash is saved, but both boxes must be ticked before a demo run could use it.');
    }
    else setStatus('info', 'Tick both boxes to save this package. Nothing is saved before then.');
  }

  // ---------------------------------------------------------------- replacement proposal
  async function useReplacement(file) {
    state.replacementNote = null;
    try {
      const rec = await inspectReplacementProposal(file);
      await api.setReplacement(rec);
    } catch (e) {
      state.replacementNote = { kind: 'error', message: e instanceof PackageBlocked ? e.message : mapError(e).message };
    }
    await prepare();
  }
  async function confirmReplacement(checked) {
    const rep = sess.app.proposalReplacement;
    if (!rep) return;
    state.replacementNote = null;
    try {
      await api.setReplacement({ ...rep, managerChecked: checked, checkedAt: checked ? api.nowIso() : null });
    } catch (e) {
      state.replacementNote = { kind: 'error', message: mapError(e).message };
    }
    await prepare();
  }
  async function dropReplacement() {
    state.replacementNote = null;
    try { await api.setReplacement(null); } catch (e) { state.replacementNote = { kind: 'error', message: mapError(e).message }; }
    await prepare();
  }

  // ---------------------------------------------------------------- rendering
  function attachmentTable(prep) {
    return h('table', { class: 'stack-table pkg-table', 'data-testid': 'attachment-list' },
      h('thead', null, h('tr', null, ['Role', 'File name', 'Type', 'Size', 'SHA-256'].map((t) => h('th', { scope: 'col', text: t })))),
      h('tbody', null, prep.attachments.map((a) => h('tr', { 'data-role': a.role },
        h('th', { scope: 'row', text: ROLE_LABEL[a.role] || a.role }),
        h('td', { 'data-label': 'File name', text: a.filename }),
        h('td', { 'data-label': 'Type', text: a.mime }),
        h('td', { 'data-label': 'Size', text: `${formatBytes(a.size)} (${a.size.toLocaleString('en-GB')} bytes)` }),
        h('td', { 'data-label': 'SHA-256', class: 'hash-cell' }, h('code', { 'data-testid': `hash-${a.role}`, text: a.sha256 }))))));
  }

  function notesView(notes) {
    return h('details', { class: 'source-notes', 'data-testid': 'source-notes' },
      h('summary', { text: 'View source notes' }),
      h('p', { class: 'sub', text: 'Where each outgoing answer came from. These notes stay in this browser; they are not part of the proposal and not part of the package hash.' }),
      h('dl', { class: 'review-list' }, notes.map((n) => h('div', { class: 'review-row', 'data-note': n.fieldId },
        h('dt', { text: n.label }),
        h('dd', null,
          h('p', { class: 'review-meta', text: `${ORIGIN_CHIP[n.origin] || n.origin || 'No origin'} · ${n.confirmed ? 'Confirmed' : 'Not confirmed'}` }),
          n.sources.map((s) => h('p', { class: 'review-meta', text: [SOURCE_KIND[s.kind] || s.kind, s.title, s.reportingPeriod, s.locator ? `at ${s.locator}` : null, s.synthetic ? 'synthetic' : null].filter(Boolean).join(' · ') + (s.excerpt ? `: "${s.excerpt}"` : '') })))))));
  }

  function replacementView() {
    const rep = sess.app.proposalReplacement;
    const wrap = h('div', { class: 'replace-proposal', 'data-testid': 'replace-proposal' });
    wrap.append(h('h4', { text: 'Use your own proposal PDF instead' }));
    wrap.append(h('p', { class: 'sub', text: 'Optional. The page count is read from the file. The app does not check its fonts or layout, so a file is never called verified: you confirm it yourself.' }));
    const input = h('input', { type: 'file', id: 'replace-proposal-file', accept: '.pdf,application/pdf', 'data-testid': 'replace-proposal-file', onchange: (ev) => { const f = ev.target.files && ev.target.files[0]; if (f) useReplacement(f); } });
    wrap.append(h('div', { class: 'field' }, h('label', { for: 'replace-proposal-file', text: 'Choose a PDF (up to 10 MB, up to 10 pages)' }), input));
    if (rep) {
      const checkId = 'replace-proposal-check';
      wrap.append(h('p', { 'data-testid': 'replacement-summary', text: `${rep.filename} · ${rep.pageCount} ${rep.pageCount === 1 ? 'page' : 'pages'} (read from the file) · ${formatBytes(rep.size)} · ${rep.managerChecked ? 'Manager checked (not format-verified by this app)' : 'Not checked yet'}` }));
      wrap.append(h('div', { class: 'check-row' },
        h('input', { type: 'checkbox', id: checkId, 'data-testid': 'replacement-check', checked: rep.managerChecked ? true : null, onchange: (ev) => confirmReplacement(ev.target.checked) }),
        h('label', { for: checkId, text: REPLACEMENT_CHECK_TEXT(rep.pageCount) })));
      wrap.append(h('button', { type: 'button', class: 'btn quiet', 'data-testid': 'replacement-remove', text: 'Use the generated proposal instead', onclick: dropReplacement }));
    }
    if (state.replacementNote) wrap.append(h('p', { class: 'form-error', role: 'alert', 'data-testid': 'replacement-error', text: state.replacementNote.message }));
    return wrap;
  }

  function render() {
    const parts = [];
    const prep = state.prep;
    parts.push(h('p', { class: 'sub', 'data-testid': 'package-explanation', text: EXPLANATION_TEXT }));

    if (state.phase === 'preparing') parts.push(h('p', { class: 'loading', role: 'status', text: 'Preparing the package…' }));
    if (state.blocked) {
      const b = state.blocked;
      parts.push(h('div', { class: 'form-error', role: 'alert', 'data-testid': 'package-blocked', 'data-code': b.code },
        h('p', { text: b.message }),
        b.sections ? h('ul', { class: 'issue-list' }, b.sections.map((s) => h('li', { text: `${s.title}: about ${s.pages} ${s.pages === 1 ? 'page' : 'pages'}` }))) : null));
    }
    if (prep) {
      const p = prep.proposal;
      parts.push(h('p', { 'data-testid': 'proposal-summary', text: p.source === 'generated'
        ? `Proposal: generated from your confirmed answers · ${p.pageCount} ${p.pageCount === 1 ? 'page' : 'pages'} · A4${p.synthetic ? ' · marked as a synthetic demo example' : ''}`
        : `Proposal: your own PDF · ${p.pageCount} ${p.pageCount === 1 ? 'page' : 'pages'} · Manager checked (not format-verified by this app)` }));
      parts.push(attachmentTable(prep));
      parts.push(h('p', { class: 'hash-line' }, h('strong', { text: 'Package hash (SHA-256): ' }), h('code', { 'data-testid': 'package-hash', text: prep.payloadHash }),
        h('span', { class: 'sub', text: ` Adapter ${ADAPTER_ID}` })));
      parts.push(h('div', { class: 'app-bar-main' },
        h('button', { type: 'button', class: 'btn', 'data-testid': 'download-proposal', text: 'Download proposal', onclick: () => {
          const a = prep.attachments.find((x) => x.role === 'proposal');
          downloadBlob(new Blob([a.bytes], { type: a.mime }), a.filename);
        } })));
      parts.push(notesView(sourceNotes(sess.answers)));
    }
    if (state.phase !== 'preparing' && (prep || (state.blocked && state.blocked.code !== 'not-ready' && state.blocked.code !== 'unsaved'))) parts.push(replacementView());

    // confirmations
    const reviewed = h('input', { type: 'checkbox', id: 'chk-reviewed', 'data-testid': 'check-reviewed', onchange: onCheck });
    const transfer = h('input', { type: 'checkbox', id: 'chk-transfer', 'data-testid': 'check-transfer', onchange: onCheck });
    const status = h('p', { class: 'pkg-status', 'data-testid': 'package-status', 'aria-live': 'polite' });
    const runBtn = h('button', { type: 'button', class: 'btn primary', 'data-testid': 'run-demo', disabled: true, 'aria-describedby': 'run-unavailable', text: RUN_LABEL, onclick: () => { runBtn.disabled = true; startRun(); } });
    const note = h('p', { id: 'run-unavailable', class: 'sub', 'data-testid': 'automation-unavailable' });
    checks = { reviewed, transfer, status, runBtn, note };
    parts.push(h('fieldset', { class: 'confirm-box', 'data-testid': 'confirmations' },
      h('legend', { text: 'Confirm this demo package' }),
      h('div', { class: 'check-row' }, reviewed, h('label', { for: 'chk-reviewed', text: REVIEW_CHECK_LABEL })),
      h('div', { class: 'check-row' }, transfer, h('label', { for: 'chk-transfer', text: TRANSFER_CHECK_LABEL })),
      status));
    parts.push(h('div', { class: 'app-bar-main' }, runBtn));
    parts.push(note);
    parts.push(runArea);
    parts.push(h('details', { class: 'live-note', 'data-testid': 'live-explanation' },
      h('summary', { text: 'Live submission' }),
      h('p', { text: 'Live submission is not available. It needs a verified, current mapping of the real application portal, authority from the applicant and a reviewed non-synthetic application. None of these exist in this demo, and there is no switch to enable it.' })));

    body.replaceChildren(...parts);
    paintChecks();
    if (state.phase === 'blocked') setStatus('info', 'Both boxes stay unavailable until a package can be prepared.');
    else if (state.phase === 'ready') setStatus('info', 'Tick both boxes to save this package. Nothing is saved before then.');
    else if (state.phase === 'preparing') setStatus('info', '');
    else if (state.phase === 'frozen') setStatus('ok', state.savedMessage);
  }

  root.prepare = prepare;
  prepare();
  return root;
}
