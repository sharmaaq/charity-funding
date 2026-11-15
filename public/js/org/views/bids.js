// Past bids: list, detail, form, not-found.
import { h, field, uid, formatDate, formatDateTime, formatMoney, formatBytes } from '../dom.js';
import { OrgError } from '../db.js';
import {
  ACCEPT_ATTRIBUTE,
  ALLOWED_TYPES_TEXT,
  FIELD_LIMITS,
  OUTCOMES,
  ROLES,
  defaultTitle,
  labelOf,
  matchesBid,
  validateFile,
} from '../validation.js';
import { BIDS_HASH, BID_NEW_HASH, bidEditHash, bidHash } from '../routes.js';
import { applyErrors, downloadButton, fileMeta, formErrorBanner, guard, outcomeBadge, storedBadge, syntheticNote, typeLabel } from './common.js';

// ---------- list ----------
function fundingCell(b) {
  return h('div', { class: 'c-funding' },
    h('p', null, h('strong', { text: formatMoney(b.requestedAmount) }), b.requestedAmount !== null ? h('small', { text: ' requested' }) : null),
    b.outcome === 'successful' && b.awardedAmount !== null ? h('p', null, h('strong', { text: formatMoney(b.awardedAmount) }), h('small', { text: ' awarded' })) : null);
}

function bidRow(b) {
  return h('li', { class: 'bid-row', 'data-id': b.id },
    h('div', { class: 'c-main' },
      h('h3', { text: b.title }),
      h('p', { class: 'sub', text: b.funder }),
      h('p', { class: 'sub', text: `${b.attachmentCount} ${b.attachmentCount === 1 ? 'file' : 'files'} attached` }),
      b.hasBidDocument ? null : h('p', { class: 'flag', 'data-testid': 'bid-missing' }, h('span', { class: 'org-badge wait', text: 'Bid document missing' })),
      syntheticNote(b)),
    h('div', { class: 'c-outcome' }, outcomeBadge(b.outcome)),
    h('div', { class: 'c-date' }, h('span', { class: 'mobile-label', text: 'Submitted ' }), formatDate(b.submissionDate)),
    fundingCell(b),
    h('div', { class: 'c-view' }, h('a', { class: 'link-btn', href: bidHash(b.id), 'aria-label': `View or edit ${b.title}` }, 'View / edit')));
}

export function bidsPanel(ctx, bids) {
  let query = '';
  let outcome = 'all';
  const search = h('input', { type: 'search', id: 'bid-search', 'aria-label': 'Search past bids by title or funder', placeholder: 'Search by bid or funder' });
  const filter = h('select', { id: 'bid-filter', 'aria-label': 'Filter by outcome' },
    h('option', { value: 'all', text: 'All outcomes' }), OUTCOMES.map((o) => h('option', { value: o.value, text: o.label })));
  const list = h('ul', { class: 'bid-list', 'aria-label': 'Past bids' });
  const head = h('div', { class: 'bid-head', 'aria-hidden': 'true' },
    h('span', { text: 'Bid / funder' }), h('span', { text: 'Outcome' }), h('span', { text: 'Submitted' }), h('span', { text: 'Funding' }), h('span'));
  const count = h('p', { class: 'count-line', role: 'status', 'aria-live': 'polite', 'data-testid': 'bid-count' });
  const empty = h('div', { class: 'empty', hidden: true });

  const addBtn = ctx.readOnly
    ? guard(ctx, h('button', { type: 'button', class: 'btn primary', text: '+ Add past bid' }))
    : h('a', { class: 'btn primary', href: BID_NEW_HASH, text: '+ Add past bid' });

  function update() {
    const shown = bids.filter((b) => matchesBid(b, query) && (outcome === 'all' || b.outcome === outcome));
    list.replaceChildren(...shown.map(bidRow));
    head.hidden = shown.length === 0;
    count.textContent = `${shown.length} of ${bids.length} past ${bids.length === 1 ? 'bid' : 'bids'}`;
    empty.replaceChildren();
    if (bids.length === 0) {
      empty.hidden = false;
      empty.append(h('p', null, h('strong', { text: 'No past bids yet.' })),
        h('p', { text: 'Record earlier applications, their outcomes, funder feedback and the original files so they are ready to learn from.' }));
    } else if (shown.length === 0) {
      empty.hidden = false;
      empty.append(h('p', null, h('strong', { text: 'No past bids match.' })),
        h('p', { text: 'Try a different search or outcome.' }),
        h('button', { type: 'button', class: 'btn', text: 'Clear search and filter', onclick: () => { search.value = ''; filter.value = 'all'; query = ''; outcome = 'all'; update(); search.focus(); } }));
    } else empty.hidden = true;
  }
  search.addEventListener('input', () => { query = search.value; update(); });
  filter.addEventListener('change', () => { outcome = filter.value; update(); });

  const root = h('section', { class: 'org-panel', 'aria-labelledby': 'bids-heading' },
    h('div', { class: 'panel-top' },
      h('div', null,
        h('h2', { id: 'bids-heading', tabindex: '-1', 'data-focus': '', text: 'Past bids' }),
        h('p', { class: 'sub', text: 'The application, the outcome and what you learned, together.' })),
      addBtn),
    h('div', { class: 'tools' }, search, filter),
    head, list, empty, count);
  update();
  return root;
}

// ---------- not found ----------
export function bidNotFound() {
  return h('section', { class: 'org-panel', 'aria-labelledby': 'nf-heading' },
    h('h2', { id: 'nf-heading', tabindex: '-1', 'data-focus': '', text: 'Bid not found' }),
    h('p', { text: 'There is no past bid with that address. It may have been deleted, or the link may be wrong.' }),
    h('a', { class: 'btn primary', href: BIDS_HASH, text: 'Back to past bids' }));
}

// ---------- detail ----------
function textPanel(title, text, extraClass = '') {
  return h('div', { class: `panel ${extraClass}`.trim() }, h('h3', { text: title }), h('p', { class: text ? 'prewrap' : 'muted', text: text || 'Not recorded' }));
}

function fileRow(ctx, d) {
  return h('li', { class: 'file', 'data-doc-id': d.id },
    h('span', { class: 'type', 'aria-hidden': 'true', text: typeLabel(d) }),
    h('div', { class: 'file-main' },
      h('strong', { text: d.title }),
      h('small', { text: fileMeta(d) }),
      d.description ? h('small', { text: d.description }) : null,
      h('small', null, storedBadge(), d.synthetic ? ' Synthetic demo example' : '')),
    downloadButton(ctx, d));
}

export function bidDetail(ctx, bid) {
  const groups = [
    ['bid-document', 'Bid documents'],
    ['feedback', 'Feedback files'],
    ['supporting', 'Supporting documents'],
  ];
  const attach = h('div', { class: 'attachments' },
    groups.map(([role, title]) => {
      const items = bid.attachments.filter((d) => d.role === role);
      return h('div', { class: 'file-group', 'data-role': role },
        h('h3', { text: title }),
        items.length ? h('ul', { class: 'files' }, items.map((d) => fileRow(ctx, d)))
          : role === 'bid-document'
            ? h('p', { class: 'flag', 'data-testid': 'bid-missing' }, h('span', { class: 'org-badge wait', text: 'Bid document missing' }), ' Attach the original application. A summary is not a substitute for it.')
            : h('p', { class: 'muted', text: 'No files attached.' }));
    }));

  const del = guard(ctx, h('button', { type: 'button', class: 'btn danger', text: 'Delete bid', onclick: async () => {
    const n = bid.attachments.length;
    const ok = await ctx.confirm({
      title: 'Delete this past bid?',
      message: `Delete "${bid.title}" and its ${n} attached ${n === 1 ? 'file' : 'files'}? This cannot be undone. Organisation documents are not affected.`,
      confirmLabel: 'Delete bid',
      returnFocus: del,
    });
    if (!ok) return;
    del.disabled = true;
    try {
      await ctx.repo.deleteBid(bid.id);
      ctx.announceNext(`Past bid "${bid.title}" deleted.`);
      ctx.navigate(BIDS_HASH);
    } catch (e) {
      del.disabled = false;
      ctx.announce(`The bid was not deleted: ${e.message}`);
    }
  } }));
  const edit = ctx.readOnly
    ? guard(ctx, h('button', { type: 'button', class: 'btn primary', text: 'Edit bid' }))
    : h('a', { class: 'btn primary', href: bidEditHash(bid.id), text: 'Edit bid' });

  return h('section', { class: 'org-panel', 'aria-labelledby': 'bid-heading' },
    h('a', { class: 'link-btn back', href: BIDS_HASH, text: '← Back to past bids' }),
    h('div', { class: 'panel-top' },
      h('div', null,
        h('h2', { id: 'bid-heading', tabindex: '-1', 'data-focus': '', text: bid.title }),
        h('p', { class: 'sub', text: bid.programme ? `${bid.funder} · ${bid.programme}` : bid.funder }),
        syntheticNote(bid)),
      h('div', { class: 'actions-row' }, edit, del)),
    h('p', null, outcomeBadge(bid.outcome)),
    h('dl', { class: 'metrics' },
      h('div', null, h('dt', { text: 'Submitted' }), h('dd', { text: formatDate(bid.submissionDate) })),
      h('div', null, h('dt', { text: 'Decision' }), h('dd', { text: formatDate(bid.decisionDate) })),
      h('div', null, h('dt', { text: 'Requested' }), h('dd', { text: formatMoney(bid.requestedAmount) })),
      h('div', null, h('dt', { text: 'Awarded' }), h('dd', { text: bid.outcome === 'successful' ? formatMoney(bid.awardedAmount) : 'Not applicable' }))),
    h('div', { class: 'two-col' },
      h('div', null,
        textPanel('What we proposed', bid.summary),
        textPanel('Funder feedback', bid.feedback, 'quote'),
        textPanel('Internal learning notes', bid.notes)),
      attach),
    h('p', { class: 'sub', text: `Historical record, not submitted through this application. Created ${formatDateTime(bid.createdAt)}. Updated ${formatDateTime(bid.updatedAt)}.` }));
}

// ---------- form ----------
export function bidForm(ctx, bid) {
  const isEdit = !!bid;
  const b = bid || { title: '', funder: '', programme: '', submissionDate: '', outcome: 'unknown', requestedAmount: null, awardedAmount: null, summary: '', decisionDate: '', feedback: '', notes: '', attachments: [] };
  const money = (n) => (n === null || n === undefined ? '' : String(n));
  const fields = [
    field({ name: 'title', label: 'Bid title', value: b.title, required: true, maxlength: FIELD_LIMITS.title, placeholder: 'Project or application name' }),
    field({ name: 'funder', label: 'Funder', value: b.funder, required: true, maxlength: FIELD_LIMITS.funder, placeholder: 'Funder name' }),
    field({ name: 'programme', label: 'Programme or round', value: b.programme, maxlength: FIELD_LIMITS.programme, hint: 'Optional.' }),
    field({ name: 'submissionDate', label: 'Submission date', type: 'date', value: b.submissionDate || '', hint: 'Optional. Not in the future.' }),
    field({ name: 'outcome', label: 'Outcome', kind: 'select', options: OUTCOMES, value: b.outcome }),
    field({ name: 'decisionDate', label: 'Decision date', type: 'date', value: b.decisionDate || '', hint: 'Optional. Not in the future, and not before the submission date.' }),
    field({ name: 'requestedAmount', label: 'Requested amount (£)', value: money(b.requestedAmount), inputmode: 'decimal', hint: 'Optional. Leave empty if unknown.' }),
    field({ name: 'awardedAmount', label: 'Awarded amount (£)', value: money(b.awardedAmount), inputmode: 'decimal', hint: 'Only for a successful bid.', disabled: b.outcome !== 'successful' }),
    field({ name: 'summary', label: 'Bid summary', kind: 'textarea', value: b.summary, maxlength: FIELD_LIMITS.summary, rows: 5, full: true, hint: 'What the application proposed: beneficiaries, activities and intended results.' }),
    field({ name: 'feedback', label: 'Funder feedback', kind: 'textarea', value: b.feedback, maxlength: FIELD_LIMITS.feedback, rows: 4, full: true, hint: 'What the funder told you. Leave empty if none was given.' }),
    field({ name: 'notes', label: 'Internal learning notes', kind: 'textarea', value: b.notes, maxlength: FIELD_LIMITS.notes, rows: 4, full: true, hint: 'Your own notes, separate from the funder feedback.' }),
  ];
  const by = Object.fromEntries(fields.map((f) => [f.name, f]));
  const banner = formErrorBanner();

  // ---- attachments (existing + staged). Staged files exist only in memory until Save commits them. ----
  const existing = b.attachments.map((d) => ({
    doc: d, removed: false,
    role: field({ name: 'role', label: 'Role', kind: 'select', options: ROLES, value: d.role }),
    title: field({ name: 'title', label: 'Title', value: d.title, maxlength: FIELD_LIMITS.title }),
    description: field({ name: 'description', label: 'Description', value: d.description || '', maxlength: FIELD_LIMITS.description, full: true }),
  }));
  const staged = [];
  const attachBox = h('div', { class: 'attach-list' });
  const attachNotes = h('div', { class: 'attach-notes', role: 'alert', hidden: true });
  const picker = h('input', { type: 'file', multiple: true, accept: ACCEPT_ATTRIBUTE, class: 'sr-only', tabindex: '-1', 'aria-hidden': 'true', 'data-testid': 'bid-file-input' });
  let pickRole = 'bid-document';

  function attachRow(m, isStaged) {
    const name = isStaged ? m.file.name : m.doc.filename;
    const size = isStaged ? m.file.size : m.doc.size;
    const removeBtn = h('button', { type: 'button', class: 'btn quiet', 'aria-label': `Remove ${name}`, text: 'Remove' });
    removeBtn.addEventListener('click', async () => {
      if (isStaged) {
        staged.splice(staged.indexOf(m), 1);
      } else {
        const ok = await ctx.confirm({
          title: 'Remove this file?',
          message: `Remove "${name}" from this bid? It is deleted when you save the bid, and nothing changes if you cancel.`,
          confirmLabel: 'Remove file',
          returnFocus: removeBtn,
        });
        if (!ok) return;
        m.removed = true;
      }
      ctx.setDirty(true);
      renderAttachments();
      (attachBox.querySelector('button, select, input') || addButtons.querySelector('button')).focus();
    });
    return h('li', { class: 'attach-row', role: 'group', 'aria-label': name, 'data-kind': isStaged ? 'staged' : 'saved' },
      h('div', { class: 'attach-head' },
        h('span', { class: 'type', 'aria-hidden': 'true', text: typeLabel({ filename: name }) }),
        h('div', { class: 'file-main' },
          h('strong', { text: name }),
          h('small', { text: `${formatBytes(size)} · ${isStaged ? 'New, saved when you save the bid' : 'Stored'}` })),
        removeBtn),
      h('div', { class: 'form-grid' }, m.role.el, m.title.el, m.description.el));
  }

  function renderAttachments() {
    const items = [];
    for (const m of existing) {
      if (m.removed) {
        const undo = h('button', { type: 'button', class: 'link-btn', text: 'Undo', onclick: () => { m.removed = false; renderAttachments(); undo2().focus(); } });
        const undo2 = () => attachBox.querySelector(`[aria-label="${CSS.escape(m.doc.filename)}"] select`) || attachBox;
        items.push(h('li', { class: 'attach-row removed', 'data-kind': 'removed' }, h('span', null, `"${m.doc.filename}" will be removed when you save. `), undo));
      } else items.push(attachRow(m, false));
    }
    for (const m of staged) items.push(attachRow(m, true));
    attachBox.replaceChildren(items.length ? h('ul', { class: 'attach-items' }, items) : h('p', { class: 'muted', text: 'No files attached yet.' }));
  }

  picker.addEventListener('change', () => {
    const rejected = [];
    for (const file of Array.from(picker.files)) {
      const check = validateFile(file, ctx.repo.limits);
      if (!check.ok) { rejected.push(check.message); continue; }
      staged.push({
        file,
        role: field({ name: 'role', label: 'Role', kind: 'select', options: ROLES, value: pickRole }),
        title: field({ name: 'title', label: 'Title', value: defaultTitle(file.name), maxlength: FIELD_LIMITS.title }),
        description: field({ name: 'description', label: 'Description', value: '', maxlength: FIELD_LIMITS.description, full: true }),
      });
    }
    picker.value = '';
    attachNotes.replaceChildren(...rejected.map((r) => h('p', { text: r })));
    attachNotes.hidden = rejected.length === 0;
    if (staged.length) ctx.setDirty(true);
    renderAttachments();
  });

  const pickButton = (label, role) => guard(ctx, h('button', { type: 'button', class: 'btn', text: label, onclick: () => { pickRole = role; picker.click(); } }));
  const addButtons = h('div', { class: 'actions-row' },
    pickButton('+ Attach bid document', 'bid-document'),
    pickButton('+ Attach feedback', 'feedback'),
    pickButton('+ Attach supporting document', 'supporting'));

  // Changing the outcome away from Successful clears the awarded amount, but only after the user agrees.
  by.outcome.control.addEventListener('change', async () => {
    const aw = by.awardedAmount.control;
    if (by.outcome.control.value === 'successful') { aw.disabled = false; return; }
    if (aw.value.trim() !== '') {
      const ok = await ctx.confirm({
        title: 'Clear the awarded amount?',
        message: `Only a successful bid has an awarded amount. Changing the outcome to ${labelOf(OUTCOMES, by.outcome.control.value)} will clear the recorded amount of £${aw.value.trim()}.`,
        confirmLabel: 'Clear amount',
        cancelLabel: 'Keep Successful',
        returnFocus: by.outcome.control,
      });
      if (!ok) { by.outcome.control.value = 'successful'; return; }
      aw.value = '';
    }
    aw.disabled = true;
    by.awardedAmount.setError('');
  });

  const save = h('button', { type: 'submit', class: 'btn primary', text: isEdit ? 'Save changes' : 'Save past bid' });
  const cancel = h('button', { type: 'button', class: 'btn', text: 'Cancel' });
  const back = isEdit ? bidHash(bid.id) : BIDS_HASH;
  const headingId = uid('bid-form-heading');
  const form = h('form', { class: 'org-form', novalidate: true, 'aria-labelledby': headingId },
    h('a', { class: 'link-btn back', href: back, text: isEdit ? '← Back to the bid' : '← Back to past bids' }),
    h('h2', { id: headingId, tabindex: '-1', 'data-focus': '', text: isEdit ? 'Edit past bid' : 'Add past bid' }),
    isEdit ? syntheticNote(bid) : null,
    banner.el,
    h('div', { class: 'form-grid' }, fields.map((f) => f.el)),
    h('div', { class: 'panel attach-panel' },
      h('h3', { text: 'Bid documents and feedback' }),
      h('p', { class: 'field-hint', text: `Attach the original application and any feedback or supporting files. Allowed: ${ALLOWED_TYPES_TEXT}. Up to ${formatBytes(ctx.repo.limits.maxFileBytes)} each. Files are saved only when you save the bid.` }),
      attachNotes, attachBox, addButtons, picker),
    h('div', { class: 'actions-row' }, guard(ctx, save), cancel));
  renderAttachments();
  form.addEventListener('input', () => ctx.setDirty(true));
  form.addEventListener('change', () => ctx.setDirty(true));

  cancel.addEventListener('click', async () => {
    if (ctx.isDirty() && !(await ctx.confirmDiscard(cancel))) return;
    ctx.setDirty(false);
    ctx.navigate(back);
  });

  let saving = false;
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (saving) return;
    saving = true;
    save.disabled = true;
    cancel.disabled = true;
    save.textContent = 'Saving...';
    banner.show('');
    const live = existing.filter((m) => !m.removed);
    const payload = {
      id: isEdit ? bid.id : null,
      fields: Object.fromEntries(fields.map((f) => [f.name, f.control.value])),
      newFiles: staged.map((m) => ({ file: m.file, role: m.role.control.value, title: m.title.control.value, description: m.description.control.value })),
      attachmentEdits: live.map((m) => ({ id: m.doc.id, role: m.role.control.value, title: m.title.control.value, description: m.description.control.value })),
      removeIds: existing.filter((m) => m.removed).map((m) => m.doc.id),
    };
    try {
      const id = await ctx.repo.saveBid(payload); // resolves only when the transaction has committed
      ctx.setDirty(false);
      ctx.announceNext(isEdit ? 'Past bid saved.' : 'Past bid added.');
      ctx.navigate(bidHash(id));
      return;
    } catch (e) {
      const err = e instanceof OrgError ? e : new OrgError('unknown');
      if (err.code === 'invalid') {
        const first = applyErrors(fields, err.errors);
        const problems = [];
        for (const fe of err.fileErrors || []) {
          if (fe.message) problems.push(fe.message);
          else {
            const target = live.find((m) => m.doc.id === fe.id) || staged.find((m) => m.file.name === fe.name);
            if (target) { target.title.setError((fe.errors || {}).title || ''); target.description.setError((fe.errors || {}).description || ''); }
            problems.push('An attachment needs a title.');
          }
        }
        banner.show(['Some details need correcting. Nothing has been saved.', ...problems].join(' '));
        const firstControl = first || form.querySelector('[aria-invalid="true"]');
        if (firstControl) firstControl.focus();
      } else {
        banner.show(`The bid was not saved. ${err.message} Your entries and chosen files are still here, so you can try again.`);
        banner.el.scrollIntoView({ block: 'nearest' });
      }
    }
    saving = false;
    save.disabled = false;
    cancel.disabled = false;
    save.textContent = isEdit ? 'Save changes' : 'Save past bid';
  });

  return h('section', { class: 'org-panel' }, form);
}
