// Organisation documents: list, upload, edit details, delete.
import { h, field, uid, formatDate, formatBytes } from '../dom.js';
import { OrgError } from '../db.js';
import {
  ACCEPT_ATTRIBUTE,
  ALLOWED_TYPES_TEXT,
  CATEGORIES,
  FIELD_LIMITS,
  labelOf,
  matchesDocument,
  validateFile,
} from '../validation.js';
import { applyErrors, downloadButton, fileMeta, formErrorBanner, guard, storedBadge, syntheticNote } from './common.js';

function docRow(ctx, d, actions) {
  const detail = [d.period, d.documentDate ? formatDate(d.documentDate) : ''].filter(Boolean).join(' · ');
  return h('li', { class: 'doc-row', 'data-id': d.id },
    h('div', { class: 'c-main' },
      h('h3', { text: d.title }),
      h('p', { class: 'sub', text: fileMeta(d) }),
      d.description ? h('p', { class: 'sub', text: d.description }) : null,
      d.tags.length ? h('p', { class: 'sub', text: `Tags: ${d.tags.join(', ')}` }) : null,
      syntheticNote(d)),
    h('div', { class: 'c-cat' },
      h('span', { class: 'org-badge neutral', text: labelOf(CATEGORIES, d.category) }),
      detail ? h('p', { class: 'sub', text: detail }) : null,
      h('p', { class: 'sub' }, storedBadge())),
    h('div', { class: 'c-added' }, h('span', { class: 'mobile-label', text: 'Added ' }), formatDate(d.uploadedAt.slice(0, 10))),
    h('div', { class: 'c-actions' }, actions));
}

export function documentsPanel(ctx, docs, usage) {
  const root = h('section', { class: 'org-panel', 'aria-labelledby': 'docs-heading' });
  let query = '';

  // ---------- list ----------
  function listView() {
    const uploadBtn = guard(ctx, h('button', { type: 'button', class: 'btn primary', id: 'upload-open', text: '↑ Upload documents', onclick: uploadView }));
    const search = h('input', { type: 'search', id: 'doc-search', 'aria-label': 'Search document details', placeholder: 'Search documents', 'aria-describedby': 'doc-search-hint' });
    const list = h('ul', { class: 'doc-list', 'aria-label': 'Documents' });
    const count = h('p', { class: 'count-line', role: 'status', 'aria-live': 'polite', 'data-testid': 'doc-count' });
    const empty = h('div', { class: 'empty', hidden: true });

    function update() {
      const shown = docs.filter((d) => matchesDocument(d, query));
      list.replaceChildren(...shown.map((d) => docRow(ctx, d, [
        guard(ctx, h('button', { type: 'button', class: 'link-btn', 'aria-label': `Edit details of ${d.filename}`, 'data-action': 'edit', text: 'Edit details', onclick: () => editView(d) })),
        downloadButton(ctx, d),
        guard(ctx, h('button', { type: 'button', class: 'link-btn danger-link', 'aria-label': `Delete ${d.filename}`, text: 'Delete', onclick: (ev) => remove(d, ev.currentTarget) })),
      ])));
      count.textContent = `${shown.length} of ${docs.length} ${docs.length === 1 ? 'document' : 'documents'}`;
      empty.replaceChildren();
      if (docs.length === 0) {
        empty.hidden = false;
        empty.append(h('p', null, h('strong', { text: 'No documents yet.' })),
          h('p', { text: 'Useful files include Charity Commission submissions, Companies House filings, accounts, policies and service or impact evidence.' }));
      } else if (shown.length === 0) {
        empty.hidden = false;
        empty.append(h('p', null, h('strong', { text: 'No documents match.' })),
          h('p', { text: 'Search looks at titles, filenames, descriptions and tags.' }),
          h('button', { type: 'button', class: 'btn', text: 'Clear search', onclick: () => { search.value = ''; query = ''; update(); search.focus(); } }));
      } else empty.hidden = true;
    }
    search.addEventListener('input', () => { query = search.value; update(); });

    const results = ctx.ui.results ? resultsPanel(ctx.ui.results) : null;
    root.replaceChildren(
      h('div', { class: 'panel-top' },
        h('div', null,
          h('h2', { id: 'docs-heading', tabindex: '-1', 'data-focus': '', text: 'Documents' }),
          h('p', { class: 'sub', text: 'Your organisation’s filings, finances and supporting evidence.' })),
        uploadBtn),
      ...(results ? [results] : []),
      h('div', { class: 'tools' }, search),
      h('p', { class: 'field-hint', id: 'doc-search-hint', text: 'Search covers titles, filenames, descriptions and tags only. It does not search inside the files.' }),
      list, empty, count,
      h('p', { class: 'sub', text: `Stored for this charity: ${formatBytes(usage.totalBytes)} of ${formatBytes(usage.maxTotalBytes)} · ${usage.fileCount} ${usage.fileCount === 1 ? 'file' : 'files'} including bid attachments.` }));
    update();
  }

  function resultsPanel(results) {
    const ok = results.filter((r) => r.ok).length;
    const heading = h('h3', { tabindex: '-1', id: 'upload-results-heading', text: `Upload results: ${ok} of ${results.length} uploaded` });
    return h('div', { class: 'upload-results', 'data-testid': 'upload-results', role: 'status' },
      heading,
      h('ul', null, results.map((r) => h('li', { class: r.ok ? 'res ok' : 'res bad', 'data-ok': String(r.ok) },
        h('strong', { text: `${r.ok ? '✓ Uploaded' : '× Not uploaded'}: ` }), r.name, r.ok ? '' : ` — ${r.message}`))),
      h('button', { type: 'button', class: 'link-btn', text: 'Dismiss results', onclick: () => { ctx.ui.results = null; listView(); root.querySelector('#docs-heading').focus(); } }));
  }

  // ---------- upload ----------
  function uploadView() {
    let selected = [];
    let busy = false;
    const input = h('input', { type: 'file', multiple: true, accept: ACCEPT_ATTRIBUTE, class: 'sr-only', tabindex: '-1', 'aria-hidden': 'true', 'data-testid': 'doc-file-input' });
    const choose = h('button', { type: 'button', class: 'btn primary', text: 'Choose files', onclick: () => input.click() });
    const category = field({ name: 'category', label: 'Category for these files', kind: 'select', options: CATEGORIES, value: 'general', hint: 'Optional. You can change details for each document later.' });
    const listEl = h('ul', { class: 'selected-files', 'aria-label': 'Selected files' });
    const status = h('p', { class: 'sub', role: 'status', 'aria-live': 'polite' });
    const go = h('button', { type: 'button', class: 'btn primary', text: 'Upload documents' });
    const cancel = h('button', { type: 'button', class: 'btn', text: 'Cancel' });

    const checks = () => selected.map((file) => ({ file, check: validateFile(file, ctx.repo.limits) }));
    function refresh() {
      const rows = checks();
      const valid = rows.filter((r) => r.check.ok).length;
      listEl.replaceChildren(...rows.map((r) => h('li', { class: 'file', 'data-ok': String(r.check.ok) },
        h('span', { class: 'type', 'aria-hidden': 'true', text: r.check.ok ? r.check.typeLabel : 'X' }),
        h('div', { class: 'file-main' }, h('strong', { text: r.file.name }), h('small', { text: r.check.ok ? `${formatBytes(r.file.size)} · Ready to upload` : r.check.message })))));
      go.textContent = `Upload ${valid} ${valid === 1 ? 'document' : 'documents'}`;
      go.disabled = busy || valid === 0;
      choose.disabled = busy;
      cancel.disabled = busy;
      category.control.disabled = busy;
    }
    input.addEventListener('change', () => {
      selected = selected.concat(Array.from(input.files));
      input.value = '';
      ctx.setDirty(selected.length > 0);
      refresh();
    });
    cancel.addEventListener('click', async () => {
      if (ctx.isDirty() && !(await ctx.confirmDiscard(cancel))) return;
      ctx.setDirty(false);
      listView();
      root.querySelector('#upload-open').focus();
    });
    go.addEventListener('click', async () => {
      if (busy) return;
      busy = true;
      refresh();
      const results = [];
      const rows = checks();
      for (let i = 0; i < rows.length; i++) {
        const { file, check } = rows[i];
        status.textContent = `Uploading ${i + 1} of ${rows.length}: ${file.name}`;
        if (!check.ok) { results.push({ name: file.name, ok: false, message: check.message }); continue; }
        try {
          await ctx.repo.uploadDocument(file, { category: category.control.value });
          results.push({ name: file.name, ok: true });
        } catch (e) {
          const err = e instanceof OrgError ? e : new OrgError('unknown');
          results.push({ name: file.name, ok: false, message: err.fileError ? err.fileError.message : err.message });
        }
      }
      ctx.setDirty(false);
      const stored = results.filter((r) => r.ok).length;
      ctx.announce(`${stored} of ${results.length} ${results.length === 1 ? 'file' : 'files'} uploaded.`);
      ctx.ui.results = results;
      await ctx.rerender({ focus: '#upload-results-heading' });
    });

    root.replaceChildren(
      h('div', { class: 'panel-top' }, h('div', null,
        h('h2', { id: 'docs-heading', tabindex: '-1', text: 'Upload documents' }),
        h('p', { class: 'sub', text: 'Add files now and organise the details later. Titles default to the file name.' }))),
      h('div', { class: 'drop' },
        h('h3', { text: 'Add files from your computer' }),
        h('p', { class: 'sub', text: `Allowed: ${ALLOWED_TYPES_TEXT}. Up to ${formatBytes(ctx.repo.limits.maxFileBytes)} each. Uploading is manual: nothing is fetched from, or checked against, the Charity Commission or Companies House.` }),
        choose, input),
      category.el,
      h('h3', { text: 'Selected files' }),
      listEl, status,
      h('div', { class: 'actions-row' }, go, cancel));
    refresh();
    root.querySelector('#docs-heading').focus();
  }

  // ---------- edit details ----------
  function editView(d) {
    const fields = [
      field({ name: 'title', label: 'Title', value: d.title, required: true, maxlength: FIELD_LIMITS.title, full: true }),
      field({ name: 'category', label: 'Category', kind: 'select', options: CATEGORIES, value: d.category }),
      field({ name: 'period', label: 'Reporting period', value: d.period, maxlength: FIELD_LIMITS.period, hint: 'Optional, for example Year ended 31 March 2026.' }),
      field({ name: 'documentDate', label: 'Document date', type: 'date', value: d.documentDate || '', hint: 'Optional.' }),
      field({ name: 'tags', label: 'Tags', value: d.tags.join(', '), hint: `Optional. Separate with commas. Up to ${FIELD_LIMITS.maxTags} tags of ${FIELD_LIMITS.tag} characters.` }),
      field({ name: 'description', label: 'Description', kind: 'textarea', value: d.description, maxlength: FIELD_LIMITS.description, rows: 4, full: true, hint: 'Optional.' }),
    ];
    const banner = formErrorBanner();
    const save = h('button', { type: 'submit', class: 'btn primary', text: 'Save details' });
    const cancel = h('button', { type: 'button', class: 'btn', text: 'Cancel' });
    const headingId = uid('doc-edit');
    const form = h('form', { class: 'org-form', novalidate: true, 'aria-labelledby': headingId },
      h('h2', { id: headingId, tabindex: '-1', text: 'Document details' }),
      h('p', { class: 'sub', text: `Original file: ${fileMeta(d)}. The file itself is not changed.` }),
      syntheticNote(d),
      banner.el,
      h('div', { class: 'form-grid' }, fields.map((f) => f.el)),
      h('div', { class: 'actions-row' }, save, cancel));
    form.addEventListener('input', () => ctx.setDirty(true));
    form.addEventListener('change', () => ctx.setDirty(true));
    const back = () => {
      listView();
      const btn = root.querySelector(`li[data-id="${CSS.escape(d.id)}"] [data-action="edit"]`);
      (btn || root.querySelector('#docs-heading')).focus();
    };
    cancel.addEventListener('click', async () => {
      if (ctx.isDirty() && !(await ctx.confirmDiscard(cancel))) return;
      ctx.setDirty(false);
      back();
    });
    let saving = false;
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      if (saving) return;
      saving = true;
      save.disabled = true;
      banner.show('');
      try {
        await ctx.repo.updateDocument(d.id, Object.fromEntries(fields.map((f) => [f.name, f.control.value])));
        ctx.setDirty(false);
        ctx.announce(`Details saved for ${d.filename}.`);
        await ctx.rerender({ focus: `li[data-id="${d.id}"] [data-action="edit"]` });
        return;
      } catch (e) {
        const err = e instanceof OrgError ? e : new OrgError('unknown');
        if (err.code === 'invalid') {
          const first = applyErrors(fields, err.errors);
          banner.show('Some details need correcting. Nothing has been saved.');
          if (first) first.focus();
        } else banner.show(`${err.message} Your changes are still in the form.`);
      }
      saving = false;
      save.disabled = false;
    });
    root.replaceChildren(form);
    fields[0].control.focus();
  }

  async function remove(d, trigger) {
    const ok = await ctx.confirm({
      title: 'Delete this document?',
      message: `Delete "${d.filename}"? The stored file and its details are removed for everyone in this charity. This cannot be undone.`,
      confirmLabel: 'Delete document',
      returnFocus: trigger,
    });
    if (!ok) return;
    try {
      await ctx.repo.deleteDocument(d.id);
      ctx.announce(`"${d.filename}" deleted.`);
      await ctx.rerender({ focus: '#upload-open' });
    } catch (e) {
      ctx.announce(`"${d.filename}" was not deleted: ${e.message}`);
    }
  }

  listView();
  return root;
}
