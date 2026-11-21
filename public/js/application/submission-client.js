// Starting a demo run from the browser and following it to an honest outcome (spec sections 7, 8 and 10).
//
// - The attempt lock is taken in one server transaction before anything is sent (repository.acquireAttempt).
// - While a run is in flight this page holds a Web Lock named after the attempt, so another tab can tell a live run
//   from one left behind by a closed or reloaded page. A left-behind run becomes "interrupted, outcome unknown"; it is
//   never retried automatically.
// - The response is read as NDJSON across arbitrary chunk boundaries. Anything other than exactly one well-formed
//   terminal event for this attempt, ending in a receipt that matches this package, is "not confirmed".
// - The final attempt state and the receipt are saved in one transaction. If that save fails the result stays on
//   screen, can be downloaded, and the save can be retried. The run is never repeated to repair local storage.
import { newId } from '../ids.js';
import { ADAPTER_ID, PACKAGE_SCHEMA } from './canonical.js';
import { buildManifest, createEventReader, CAPABILITIES_ENDPOINT, RUN_ENDPOINT, MILESTONES, StreamError } from './run-protocol.js';

export { MILESTONES };
export const TARGET = 'controlled-test-portal';
const LOCK_PREFIX = 'charity-funding.demo-attempt.';
const STALE_WITHOUT_LOCKS_MS = 3 * 60 * 1000;
export const INTERRUPTED_MESSAGE = 'The page was closed or reloaded while the demo run was in progress, so the result was not confirmed. Nothing is retried automatically.';

const runs = new Map(); // snapshotId -> run (this page only)
const listeners = new Set();
const notify = (run) => { for (const fn of [...listeners]) fn(run); };
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const runFor = (snapshotId) => runs.get(snapshotId) || null;
export const activeRunForApplication = (applicationId) => [...runs.values()].find((r) => r.applicationId === applicationId && r.phase === 'running') || null;

let capsPromise = null;
// Resolves { demoAvailable, reason, liveBlockers }. A failed request means automation is unavailable, never success.
export function getCapabilities({ refresh = false } = {}) {
  if (!capsPromise || refresh) {
    capsPromise = (async () => {
      try {
        const res = await fetch(CAPABILITIES_ENDPOINT, { headers: { Accept: 'application/json' }, cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const body = await res.json();
        const a = (body.adapters || []).find((x) => x.grantId === 'G-001' && x.adapterId === ADAPTER_ID);
        if (!a) return { demoAvailable: false, reason: 'The demo runner does not offer this application.', liveBlockers: [] };
        return { demoAvailable: a.demoAvailable === true, reason: a.demoUnavailableReason || null, liveBlockers: a.liveBlockers || [] };
      } catch {
        capsPromise = null; // try again next time
        return { demoAvailable: false, reason: 'The demo runner could not be reached.', liveBlockers: [] };
      }
    })();
  }
  return capsPromise;
}

const locks = () => (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function' ? navigator.locks : null);

// Marks running attempts that no open page holds as interrupted_unknown. Safe to call on every render.
export async function reconcileStale(apps, now = () => new Date()) {
  // Only this user's own running attempts can be judged here: another person's live run is not held by this page.
  const running = (await apps.listAttempts()).filter((a) => a.state === 'running' && (!a.startedBy || !apps.userEmail || a.startedBy === apps.userEmail) && ![...runs.values()].some((r) => r.attempt.id === a.id && r.phase === 'running'));
  if (!running.length) return [];
  let stale;
  const lk = locks();
  if (lk && typeof lk.query === 'function') {
    const held = new Set(((await lk.query()).held || []).map((l) => l.name));
    stale = running.filter((a) => !held.has(LOCK_PREFIX + a.id));
  } else {
    stale = running.filter((a) => now().getTime() - Date.parse(a.startedAt) > STALE_WITHOUT_LOCKS_MS);
  }
  return apps.markInterrupted(stale.map((a) => a.id), INTERRUPTED_MESSAGE);
}

const safeEvent = (e) => ({ seq: e.seq, type: e.type, at: e.at, ...(e.step ? { step: e.step } : {}), ...(e.status ? { status: e.status } : {}), ...(e.code ? { code: e.code } : {}) });

// input: { apps, snapshot, retryId?, nowIso }. Resolves the run object once the attempt lock is held (or rejects with
// the OrgError from the lock). The run then continues in the background; follow it with subscribe().
export async function startDemoRun({ apps, snapshot, retryId = null, nowIso }) {
  const attempt = await apps.acquireAttempt({ applicationId: snapshot.applicationId, snapshotId: snapshot.id, payloadHash: snapshot.payloadHash, retryId });
  const controller = new AbortController();
  const run = {
    snapshotId: snapshot.id, applicationId: snapshot.applicationId, snapshot, attempt, phase: 'running',
    steps: Object.fromEntries(MILESTONES.map((m) => [m.step, { status: 'pending', at: null }])),
    events: [], receipt: null, error: null, saveStarted: false, cancelRequested: false,
    cancel() { run.cancelRequested = true; controller.abort(); },
    retrySave: () => saveFinal(apps, run),
  };
  runs.set(snapshot.id, run);
  notify(run);
  let releaseLock = () => {};
  const lk = locks();
  if (lk) {
    await new Promise((held) => {
      lk.request(LOCK_PREFIX + attempt.id, () => { held(); return new Promise((r) => { releaseLock = r; }); }).catch(() => held());
    });
  }
  (async () => {
    try { await execute(apps, run, controller, nowIso); } finally { releaseLock(); }
  })();
  return run;
}

function stepUpdate(run, e) {
  if (e.type !== 'step' || !run.steps[e.step]) return;
  run.steps[e.step] = { status: e.status === 'complete' ? 'complete' : 'current', at: e.at };
  if (e.step === 'save-draft' && e.status === 'started') run.saveStarted = true;
}

async function execute(apps, run, controller, nowIso) {
  const { snapshot, attempt } = run;
  let outcome = null; // { state, error?, receipt? }
  try {
    const files = await apps.getSnapshotFiles(snapshot.id);
    const form = new FormData();
    form.append('manifest', JSON.stringify(buildManifest(snapshot, attempt.id)));
    for (const a of snapshot.attachments) {
      const f = files.find((x) => x.id === a.fileId);
      if (!f) throw Object.assign(new Error('missing file'), { local: 'The stored copy of a package file could not be read, so nothing was sent.' });
      form.append(a.role, f.blob, f.filename);
    }
    let res;
    try {
      res = await fetch(RUN_ENDPOINT, { method: 'POST', body: form, signal: controller.signal, cache: 'no-store', headers: { 'Idempotency-Key': attempt.id, 'X-Submission-Schema': PACKAGE_SCHEMA } });
    } catch {
      // No response at all. If the request never left, nothing ran; we cannot tell, so say so.
      outcome = run.cancelRequested
        ? { state: 'cancelled', error: { code: 'CANCELLED', message: 'You stopped the demo run before the demo portal received anything.' } }
        : { state: 'interrupted_unknown', error: { code: 'NETWORK', message: 'The connection to the demo runner failed, so the result is not confirmed. You can retry deliberately.' } };
      return;
    }
    if (res.status !== 200 || !/^application\/x-ndjson/.test(res.headers.get('content-type') || '')) {
      let body = null;
      try { body = await res.json(); } catch { /* not JSON */ }
      const busy = res.status === 429;
      outcome = { state: 'failed', error: { code: (body && body.code) || `HTTP_${res.status}`, message: busy ? 'The demo runner is busy with another run. Nothing was sent. Try again in a minute.' : (body && body.message) || 'The demo runner refused the package. Nothing was sent.', retryable: busy || res.status === 503 || !!(body && body.retryable), fieldErrors: (body && body.fieldErrors) || [] } };
      return;
    }
    let terminal = null;
    const reader = createEventReader(attempt.id, (e) => {
      run.events.push(safeEvent(e));
      stepUpdate(run, e);
      notify(run);
    });
    try {
      const body = res.body.getReader();
      for (;;) {
        const { done, value } = await body.read();
        if (done) break;
        reader.push(value);
      }
      terminal = reader.end();
    } catch (e) {
      const before = !run.saveStarted;
      if (run.cancelRequested && before) outcome = { state: 'cancelled', error: { code: 'CANCELLED', message: 'You stopped the demo run before the draft was saved. Nothing was saved on the demo portal, and nothing is ever submitted.' } };
      else outcome = { state: 'interrupted_unknown', error: { code: e instanceof StreamError ? 'STREAM_INVALID' : 'INTERRUPTED', message: e instanceof StreamError ? `${e.message} The result is not confirmed.` : 'The connection was lost before the run finished, so the result is not confirmed. You can retry deliberately.' } };
      return;
    }
    if (!terminal) { outcome = { state: 'interrupted_unknown', error: { code: 'NO_RESULT', message: 'The demo runner stopped without a result, so the outcome is not confirmed.' } }; return; }
    if (terminal.type === 'failed') {
      const unknown = terminal.code === 'DRAFT_UNCONFIRMED' || terminal.code === 'DRAFT_MISMATCH';
      outcome = { state: unknown ? 'interrupted_unknown' : 'failed', error: { code: terminal.code, step: terminal.step, fieldPath: terminal.fieldPath || null, message: terminal.safeMessage, retryable: !!terminal.retryable } };
      if (run.steps[terminal.step]) run.steps[terminal.step] = { status: 'failed', at: terminal.at };
      return;
    }
    const r = terminal.receipt || {};
    if (terminal.mode !== 'demo' || r.reference !== `DEMO-${attempt.id}` || r.payloadHash !== snapshot.payloadHash || r.target !== TARGET) {
      outcome = { state: 'interrupted_unknown', error: { code: 'RECEIPT_MISMATCH', message: 'The receipt returned does not match this package, so verification failed and the outcome is unknown.' } };
      return;
    }
    outcome = {
      state: 'demo_completed',
      receipt: {
        id: newId(), attemptId: attempt.id, applicationId: snapshot.applicationId, snapshotId: snapshot.id, mode: 'demo', kind: 'draft',
        reference: r.reference, confirmedAt: r.confirmedAt, adapterVersion: ADAPTER_ID, payloadHash: r.payloadHash, target: TARGET,
        evidenceSummary: {
          snapshotRevision: snapshot.revision,
          files: snapshot.attachments.map((a) => ({ role: a.role, filename: a.filename, sizeBytes: a.size, sha256: a.sha256 })),
          portalFiles: (terminal.evidence && terminal.evidence.files) || [],
          steps: run.events.filter((e) => e.type === 'step' && e.status === 'complete').map((e) => e.step),
        },
      },
    };
  } catch (e) {
    outcome = { state: 'failed', error: { code: 'LOCAL', message: e.local || 'The demo run could not be started. Nothing was sent.' } };
  } finally {
    run.phase = outcome.state === 'demo_completed' ? 'completed' : outcome.state;
    run.error = outcome.error || null;
    run.receipt = outcome.receipt || null;
    run.attempt = { ...attempt, state: outcome.state, step: lastStep(run), events: run.events, endedAt: nowIso(), error: run.error };
    await saveFinal(apps, run);
  }
}

function lastStep(run) {
  const done = MILESTONES.filter((m) => run.steps[m.step].status !== 'pending');
  return done.length ? done[done.length - 1].step : 'check';
}

async function saveFinal(apps, run) {
  try {
    const saved = await apps.finishAttempt(run.attempt, run.receipt);
    run.attempt = saved.attempt;
    if (saved.receipt) run.receipt = saved.receipt;
    run.saveError = null;
  } catch (e) {
    run.saveError = e;
  }
  notify(run);
  return !run.saveError;
}

export function receiptDocument(receipt, grantTitle) {
  return JSON.stringify({
    notice: 'DEMO draft record from the controlled test portal run by this demo. The draft was saved there only: it was not submitted and nothing was sent to Garfield Weston. This is not an award, a decision or evidence of a real application.',
    funder: 'Garfield Weston Foundation', programme: grantTitle || 'Regular Grants (core costs)',
    ...receipt,
  }, null, 2);
}

export const activeRunForGrant = (grantId) => [...runs.values()].find((r) => r.snapshot.grantId === grantId && r.phase === 'running') || null;
