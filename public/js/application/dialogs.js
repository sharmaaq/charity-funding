// Native <dialog> panels for Refresh suggestions and Use information from a document.
// They follow the same pattern as org/views/dialog.js: the cancel path has focus first, focus returns to the trigger.
import { h, uid, downloadBlob } from '../org/dom.js';
import { fieldById, SECTIONS, FIELDS, parseInput, validateValue, formatPence } from './schema.js';
import { ORIGIN_CHIP, displayValue } from './labels.js';

function open(dlg, trigger, onClose, focusEl) {
  dlg.addEventListener('close', () => {
    dlg.remove();
    const el = typeof trigger === 'function' ? trigger() : trigger;
    if (el && el.isConnected && typeof el.focus === 'function') el.focus();
    onClose();
  });
  document.body.append(dlg);
  dlg.showModal();
  (focusEl || dlg.querySelector('button')).focus();
}

const sourceText = (a) => {
  if (!a) return 'no answer';
  const label = ORIGIN_CHIP[a.origin] || a.origin;
  const ref = (a.sourceRefs || [])[0];
  return ref && ref.title && a.origin !== 'manager' ? `${label} (${ref.title})` : label;
};

const showValue = (fd, v) => {
  if (v === null || v === undefined) return 'Nothing entered';
  if (fd.type === 'rows-income' || fd.type === 'rows-expense') return `${v.length} rows`;
  const d = displayValue(fd, v);
  return d === null ? 'Nothing entered' : d;
};

// changes: from prefill.diffSuggestions. Resolves to the field ids the manager chose to apply (possibly none).
export function refreshDialog({ changes, trigger }) {
  return new Promise((resolve) => {
    const titleId = uid('rf-title');
    const descId = uid('rf-desc');
    let chosen = [];
    const boxes = new Map();
    const list = changes.map((c) => {
      const fd = fieldById(c.fieldId);
      const id = uid('rf-box');
      const box = h('input', { type: 'checkbox', id, 'data-field': c.fieldId });
      boxes.set(c.fieldId, box);
      const prewrapped = (text) => h('p', { class: 'prewrap change-text', text });
      return h('fieldset', { class: 'change', 'data-change': c.fieldId },
        h('legend', { text: fd.label }),
        c.edited ? h('p', { class: 'sub', text: 'You edited this answer. It is only replaced if you choose to replace it.' }) : null,
        h('p', { class: 'change-label', text: `Your answer now (${sourceText(c.current)})` }),
        prewrapped(showValue(fd, c.current && c.current.value)),
        h('p', { class: 'change-label', text: `Suggestion (${sourceText(c.suggested)})` }),
        prewrapped(showValue(fd, c.suggested.value)),
        h('div', { class: 'check-row' }, box, h('label', { for: id, text: `Use the suggestion for: ${fd.label}` })));
    });
    const keep = h('button', { type: 'button', class: 'btn', text: changes.length ? 'Close without changes' : 'Close', onclick: () => dlg.close() });
    const apply = h('button', { type: 'button', class: 'btn primary', text: 'Apply selected changes', onclick: () => {
      chosen = [...boxes.entries()].filter(([, b]) => b.checked).map(([k]) => k);
      dlg.close();
    } });
    const dlg = h('dialog', { class: 'dialog dialog-wide', 'aria-labelledby': titleId, 'aria-describedby': descId },
      h('h2', { id: titleId, text: 'Refresh suggestions' }),
      h('p', { id: descId, text: changes.length
        ? 'These suggestions differ from your answers. Nothing is changed unless you tick it. Answers you have edited are never replaced unless you choose to.'
        : 'Every answer already matches the current suggestions, or has been edited by you with nothing new to offer. Nothing to change.' }),
      h('div', { class: 'change-list' }, list),
      h('div', { class: 'dialog-actions' }, keep, changes.length ? apply : null));
    open(dlg, trigger, () => resolve(chosen), keep);
  });
}

// docs: catalogue documents. fields: ids of text fields that can take an excerpt. repo: organisation repository (for download).
// Resolves to { doc, excerpt, locator, fieldId } or null.
export function excerptDialog({ docs, trigger, repo, preset }) {
  return new Promise((resolve) => {
    const ids = uid('ex');
    let result = null;
    const mappable = FIELDS.filter((f) => !f.fixed && (f.type === 'textarea' || f.type === 'text'));
    const sel = (name, label, children, extra = {}) => {
      const id = `${ids}-${name}`;
      const c = h('select', { id, ...extra }, ...children);
      return { c, row: h('div', { class: 'field' }, h('label', { for: id, text: label }), c) };
    };
    const docSel = sel('doc', 'Source document', [h('option', { value: '', text: 'Choose a stored document...' }), ...docs.map((d) => h('option', { value: d.id, text: `${d.title} (${d.filename})${d.ownerType === 'bid' ? ' - past bid file' : ''}` }))]);
    const fieldSel = sel('field', 'Use it for this answer', [h('option', { value: '', text: 'Choose an answer...' }), ...SECTIONS.map((s) => h('optgroup', { label: s.label }, mappable.filter((f) => f.section === s.id).map((f) => h('option', { value: f.id, text: f.label }))))]);
    const exId = `${ids}-excerpt`;
    const locId = `${ids}-locator`;
    const excerpt = h('textarea', { id: exId, rows: 5, 'aria-describedby': `${ids}-excerpt-hint` });
    const locator = h('input', { id: locId, type: 'text', maxlength: 200, placeholder: 'For example page 4 or section 2.1' });
    const error = h('p', { class: 'form-error', role: 'alert', hidden: true });
    const dl = h('button', { type: 'button', class: 'link-btn', text: 'Download the document to read it', disabled: true, onclick: async () => {
      const d = docs.find((x) => x.id === docSel.c.value);
      if (!d) return;
      try {
        const blob = await repo.getBlob(d.id);
        if (blob) downloadBlob(blob, d.filename);
        else error.textContent = `The stored file "${d.filename}" could not be found.`, error.hidden = false;
      } catch (e) {
        error.textContent = `"${d.filename}" could not be downloaded: ${e.message}`;
        error.hidden = false;
      }
    } });
    docSel.c.addEventListener('change', () => { dl.disabled = !docSel.c.value; });
    if (preset && preset.fieldId) fieldSel.c.value = preset.fieldId;
    const cancel = h('button', { type: 'button', class: 'btn', text: 'Cancel', onclick: () => dlg.close() });
    const use = h('button', { type: 'button', class: 'btn primary', text: 'Use this text', onclick: () => {
      const doc = docs.find((d) => d.id === docSel.c.value);
      const fieldId = fieldSel.c.value;
      const text = excerpt.value;
      const loc = locator.value.trim();
      const problems = [];
      if (!doc) problems.push('Choose the document the text came from.');
      if (!fieldId) problems.push('Choose which answer to use it for.');
      if (!text.trim()) problems.push('Paste the excerpt from the document.');
      else if (text.length > 4000) problems.push('The excerpt can be at most 4,000 characters.');
      if (!loc) problems.push('Say where in the document the text came from (a page or section).');
      if (fieldId && text.trim()) {
        const fd = fieldById(fieldId);
        const parsed = parseInput(fd, text);
        const v = validateValue(fd, parsed.value, parsed.raw, {});
        // Word minimums are not enforced here: the answer shows its own message and the manager can add to it.
        v.errors.filter((m) => !/^Write at least/.test(m)).forEach((m) => problems.push(m));
      }
      if (problems.length) { error.replaceChildren(...problems.map((p, i) => h('span', null, i ? h('br') : null, p))); error.hidden = false; return; }
      result = { doc, excerpt: text, locator: loc, fieldId };
      dlg.close();
    } });
    const titleId = `${ids}-title`;
    const dlg = h('dialog', { class: 'dialog dialog-wide', 'aria-labelledby': titleId },
      h('h2', { id: titleId, text: 'Use information from a document' }),
      h('p', { class: 'sub', text: 'The app does not read your documents. Open the document, copy the relevant text, paste it here and say where it came from. It will be labelled as manager supplied from a document.' }),
      docs.length ? null : h('p', { class: 'form-error', role: 'status', text: 'No stored documents are available.' }),
      docSel.row, h('div', null, dl),
      fieldSel.row,
      h('div', { class: 'field' }, h('label', { for: exId, text: 'Excerpt from the document' }), h('p', { class: 'field-hint', id: `${ids}-excerpt-hint`, text: 'Pasted text is kept as written, including line breaks.' }), excerpt),
      h('div', { class: 'field' }, h('label', { for: locId, text: 'Page or section' }), locator),
      error,
      h('div', { class: 'dialog-actions' }, cancel, use));
    open(dlg, trigger, () => resolve(result), docSel.c);
  });
}

export { formatPence };
