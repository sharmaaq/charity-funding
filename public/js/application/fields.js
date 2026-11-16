// One questionnaire field as a widget: label, control, status, source chip, errors. User text only ever enters the
// page as a value or text node, never as markup.
import { h, uid } from '../org/dom.js';
import {
  codePoints, countWords, fieldById, financeTotals, formatGroupedNumber, formatPence, formatPenceInput, parseInput, parseMoney,
  LIMITS,
} from './schema.js';
import { blankExpenseRow, blankIncomeRow } from './answers.js';
import { accountsCandidates, documentRef } from './prefill.js';
import { NO_SOURCE_CHIP, ORIGIN_CHIP, STATUS, optionLabel } from './labels.js';

const YES_NO = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'unknown', label: 'Not sure yet' }];
const clone = (v) => JSON.parse(JSON.stringify(v));

function inputText(fd, a) {
  if (!a) return '';
  if (a.raw) return a.raw;
  const v = a.value;
  if (v === null || v === undefined) return '';
  if (fd.type === 'money') return formatPenceInput(v);
  if (fd.type === 'integer') return formatGroupedNumber(v);
  return String(v);
}

const INPUT_MODE = { money: 'decimal', integer: 'numeric', email: 'email', phone: 'tel', url: 'url' };

// api: { session, edit(id, input, refs?), confirm(id), openSource(id, trigger), flush(), touch(id) }
export function buildField(fd, api) {
  const sess = api.session;
  const cid = uid('app-' + fd.id.replace(/\./g, '-'));
  const hintId = `${cid}-hint`;
  const countId = `${cid}-count`;
  const errId = `${cid}-err`;
  const answer = () => sess.answers[fd.id] || null;
  const describedBy = [fd.hint ? hintId : null, fd.type === 'textarea' ? countId : null, errId].filter(Boolean).join(' ');

  const statusEl = h('span', { class: 'field-status', 'data-status': '' });
  const labelId = `${cid}-label`;
  const isRows = fd.type === 'rows-income' || fd.type === 'rows-expense';
  const labelEl = h('label', isRows ? { id: labelId } : { id: labelId, for: cid }, fd.label,
    fd.required !== false ? h('span', { class: 'req', 'aria-hidden': 'true', text: ' *' }) : null);
  const head = h('div', { class: 'field-head' }, labelEl, statusEl);
  const hint = fd.hint ? h('p', { class: 'field-hint', id: hintId, text: fd.hint }) : null;
  const err = h('p', { class: 'field-error', id: errId, hidden: true });
  const countEl = fd.type === 'textarea' ? h('p', { class: 'field-count', id: countId }) : null;
  const chip = h('button', { type: 'button', class: 'source-chip', 'aria-expanded': 'false', onclick: () => api.openSource(fd.id, chip) });
  const confirmBtn = h('button', { type: 'button', class: 'link-btn confirm-btn', hidden: true, 'aria-label': `Confirm answer: ${fd.label}`, text: 'Confirm answer', onclick: () => api.confirm(fd.id) });
  const extras = h('div', { class: 'field-extras' });
  const foot = h('div', { class: 'field-foot' }, chip, confirmBtn);

  let control = null;
  let rowsBox = null;
  let rowsTotals = null;
  let rowsRender = null;

  const common = { id: cid, name: fd.id, 'aria-describedby': describedBy };
  const fire = () => api.edit(fd.id, parseInput(fd, control.value));
  const blur = () => { api.touch(fd.id); api.flush(); };

  if (fd.type === 'textarea') {
    control = h('textarea', { ...common, rows: fd.rows || 6, value: inputText(fd, answer()) });
    control.addEventListener('input', fire);
  } else if (fd.type === 'enum' || fd.type === 'yesno') {
    const opts = fd.type === 'yesno' ? YES_NO : fd.options;
    control = h('select', common, h('option', { value: '', text: 'Choose...' }), opts.map((o) => h('option', { value: o.value, text: o.label })));
    control.value = answer() && answer().value !== null ? answer().value : '';
    control.addEventListener('change', () => api.edit(fd.id, { value: control.value || null }));
  } else if (fd.type === 'document') {
    control = h('select', common);
    const fill = () => {
      const cands = accountsCandidates(sess.catalogue);
      const cur = answer() && answer().value;
      control.replaceChildren(h('option', { value: '', text: 'Choose a stored document...' }));
      for (const c of cands) {
        control.append(h('option', { value: c.doc.id, disabled: c.selectable ? null : true, text: c.selectable ? `${c.doc.title} (${c.doc.filename})` : `${c.doc.title} (${c.doc.filename}) - not a PDF or DOCX, cannot be used` }));
      }
      if (cur && !cands.some((c) => c.doc.id === cur)) control.append(h('option', { value: cur, text: 'Selected document (no longer stored)' }));
      control.value = cur || '';
      extras.replaceChildren();
      if (!sess.catalogue) {
        extras.append(h('p', { class: 'field-hint', text: 'The document store could not be read, so no documents can be chosen right now.' }));
        return;
      }
      const hints = cands.filter((c) => c.suggested && c.doc.id !== cur);
      hints.forEach((c) => extras.append(h('div', { class: 'doc-suggest' },
        h('span', { text: `Suggested: ${c.doc.title}${c.doc.period ? ` (${c.doc.period})` : ''}. It is only a suggestion until you choose it. ` }),
        h('button', { type: 'button', class: 'link-btn', 'aria-label': `Use ${c.doc.title} as the accounts document`, text: 'Use this document', onclick: () => { api.edit(fd.id, { value: c.doc.id }, [documentRef(c.doc)]); fill(); } }))));
      if (!cands.some((c) => c.selectable)) {
        extras.append(h('p', { class: 'field-hint', text: 'No PDF or DOCX document is stored yet. A text file cannot be used as accounts. Upload the accounts on the ' }, h('a', { href: '#/organisation/documents', text: 'Organisation documents page' }), '.'));
      }
    };
    control.addEventListener('change', () => {
      const id = control.value || null;
      const doc = id && ((sess.catalogue && sess.catalogue.documents) || []).find((d) => d.id === id);
      api.edit(fd.id, { value: id }, doc ? [documentRef(doc)] : []);
      fill();
    });
    fill();
  } else if (isRows) {
    rowsBox = h('div', { class: 'rows-editor ' + (fd.type === 'rows-income' ? 'income' : 'expense'), role: 'group', 'aria-labelledby': labelId, 'aria-describedby': describedBy, id: cid });
    rowsTotals = h('p', { class: 'rows-total', 'data-testid': `${fd.id}-total` });
  } else {
    const type = fd.type === 'date' ? 'date' : 'text';
    control = h('input', { ...common, type, value: inputText(fd, answer()), inputmode: INPUT_MODE[fd.type], autocomplete: 'off', readonly: fd.fixed ? true : null });
    control.addEventListener('input', fire);
    if (fd.type === 'money' || fd.type === 'integer') {
      control.addEventListener('blur', () => {
        const a = answer();
        if (a && !a.raw) control.value = inputText(fd, a);
      });
    }
  }
  if (control) {
    if (fd.fixed) { control.disabled = fd.type === 'enum' ? true : null; if (fd.type !== 'enum') control.readOnly = true; }
    control.addEventListener('blur', blur);
  }

  // ---- rows editor (forecast income and expenditure) ----
  if (isRows) {
    const income = fd.type === 'rows-income';
    const what = income ? 'income' : 'expenditure';
    const rows = () => clone((answer() && answer().value) || []);
    const commitRows = (list) => api.edit(fd.id, { value: list.length ? list : null });
    rowsRender = (focusIndex) => {
      const list = rows();
      rowsBox.replaceChildren(
        h('div', { class: 'rows-head', 'aria-hidden': 'true' },
          h('span', { text: income ? 'Income source' : 'Expenditure' }),
          h('span', { text: income ? 'Target (GBP)' : 'Amount (GBP)' }),
          income ? h('span', { text: 'Secured (GBP)' }) : null,
          h('span', { text: 'Note' }), h('span', { text: '' })),
        ...list.map((r, i) => {
          const n = i + 1;
          const rid = `${cid}-r${n}`;
          const rowErr = h('p', { class: 'field-error row-error', id: `${rid}-err`, hidden: true });
          const cell = (cls, label, input) => h('div', { class: `cell ${cls}` }, h('label', { for: input.id }, label), input);
          const mk = (key, rawKey, labelText, extra = {}) => {
            const val = r[rawKey] ? r[rawKey] : (key === 'label' || key === 'note') ? (r[key] || '') : formatPenceInput(r[key]);
            const inp = h('input', { id: `${rid}-${key}`, type: 'text', value: val, autocomplete: 'off', 'aria-describedby': `${rid}-err`, ...extra });
            inp.addEventListener('input', () => {
              const cur = rows();
              const row = cur[i];
              if (key === 'label' || key === 'note') row[key] = inp.value;
              else {
                const p = parseMoney(inp.value);
                row[key] = p.ok ? p.value : null;
                if (p.ok) delete row[rawKey]; else row[rawKey] = inp.value;
              }
              commitRows(cur);
            });
            inp.addEventListener('blur', () => { rowEl.classList.add('touched'); api.touch(fd.id); api.flush(); updateRowsErrors(); });
            return inp;
          };
          const rowEl = h('div', { class: 'rows-row', 'data-row': String(n) },
            cell('c-label', income ? `Income source ${n}` : `Expenditure ${n}`, mk('label', null, 'Name', { maxlength: undefined })),
            income ? cell('c-amount', `Target for row ${n} (GBP)`, mk('targetPence', 'targetRaw', 'Target', { inputmode: 'decimal' })) : cell('c-amount', `Amount for row ${n} (GBP)`, mk('amountPence', 'amountRaw', 'Amount', { inputmode: 'decimal' })),
            income ? cell('c-amount', `Secured for row ${n} (GBP)`, mk('securedPence', 'securedRaw', 'Secured', { inputmode: 'decimal' })) : null,
            cell('c-note', `Note for row ${n}`, mk('note', null, 'Note')),
            h('div', { class: 'cell c-remove' }, h('button', { type: 'button', class: 'link-btn danger-link', 'aria-label': `Remove ${what} row ${n}`, text: 'Remove', onclick: () => { const cur = rows(); cur.splice(i, 1); commitRows(cur); rowsRender(Math.max(0, i - 1)); } })),
            rowErr);
          return rowEl;
        }),
        h('div', { class: 'rows-actions' }, h('button', { type: 'button', class: 'btn', text: income ? 'Add income row' : 'Add expenditure row', onclick: () => { const cur = rows(); cur.push(income ? blankIncomeRow() : blankExpenseRow()); commitRows(cur); rowsRender(cur.length - 1); } })));
      if (typeof focusIndex === 'number') {
        const target = rowsBox.querySelector(`.rows-row[data-row="${focusIndex + 1}"] input`);
        if (target) target.focus();
      }
      updateRowsErrors();
    };
    const updateRowsErrors = () => {
      const ev = sess.eval.fields[fd.id] || {};
      const showAll = sess.validated.has(fd.section);
      rowsBox.querySelectorAll('.rows-row').forEach((rowEl, i) => {
        const e = (ev.rowErrors && ev.rowErrors[i]) || {};
        const msgs = Object.values(e);
        const p = rowEl.querySelector('.row-error');
        const show = msgs.length && (showAll || rowEl.classList.contains('touched'));
        p.textContent = show ? msgs.join(' ') : '';
        p.hidden = !show;
        rowEl.querySelectorAll('input').forEach((inp) => {
          const key = inp.id.split('-').pop();
          if (show && e[key]) inp.setAttribute('aria-invalid', 'true'); else inp.removeAttribute('aria-invalid');
        });
      });
    };
    rowsBox._updateErrors = updateRowsErrors;
    rowsRender();
  }

  // ---- "None recorded" shortcut ----
  let noneBtn = null;
  if (fd.none) {
    noneBtn = h('button', { type: 'button', class: 'btn none-btn', text: fd.none.replace(/\.$/, ''), onclick: () => { control.value = fd.none; api.edit(fd.id, parseInput(fd, fd.none)); control.focus(); } });
  }

  const root = h('div', { class: 'app-field', 'data-field': fd.id, 'data-status': '' },
    head, hint, isRows ? rowsBox : control, rowsTotals, countEl, noneBtn, extras, err, foot);

  function update() {
    const ev = sess.eval.fields[fd.id];
    if (!ev || !ev.applicable) return;
    const a = answer();
    const st = STATUS[ev.status] || STATUS.optional;
    root.dataset.status = ev.status;
    statusEl.dataset.status = ev.status;
    statusEl.replaceChildren(h('span', { 'aria-hidden': 'true', text: st.mark ? st.mark + ' ' : '' }), st.label);
    // source chip
    const hasValue = a && ((a.value !== null && a.value !== undefined) || a.raw);
    const chipText = hasValue ? ORIGIN_CHIP[a.origin] || 'Source unknown' : NO_SOURCE_CHIP;
    chip.textContent = chipText;
    chip.setAttribute('aria-label', `Source for ${fd.label}: ${chipText}. Show details`);
    chip.dataset.origin = hasValue ? a.origin : 'none';
    if (hasValue && sess.stale[fd.id]) chip.dataset.stale = sess.stale[fd.id]; else delete chip.dataset.stale;
    chip.classList.toggle('stale', !!(hasValue && sess.stale[fd.id]));
    // confirm button: only for a valid answer that waits for confirmation or has a changed source
    const needsConfirm = ev.status === 'review' && hasValue && !ev.reasons.includes('invalid') && !fd.fixed;
    confirmBtn.hidden = !needsConfirm;
    // errors and missing prompt
    const lines = [...ev.errors];
    if (ev.status === 'missing' && (sess.touched.has(fd.id) || sess.validated.has(fd.section))) lines.push('This needs an answer.');
    if (a && sess.stale[fd.id] && hasValue) lines.push(sess.stale[fd.id] === 'removed' ? 'The source for this answer was removed. Confirm the answer as it stands, or replace it.' : 'The source for this answer changed after it was filled in. Check it, then confirm or replace it.');
    const showLines = isRows ? lines.filter((l) => !/^Row \d/.test(l)) : lines;
    err.replaceChildren(...showLines.map((l, i) => h('span', { class: 'err-line' }, i ? h('br') : null, l)));
    err.hidden = showLines.length === 0;
    const invalid = ev.errors.length > 0 || (ev.status === 'missing' && sess.validated.has(fd.section));
    if (control) { if (invalid && showLines.length) control.setAttribute('aria-invalid', 'true'); else control.removeAttribute('aria-invalid'); }
    if (countEl) {
      const v = a && a.value ? String(a.value) : '';
      const w = countWords(v);
      const parts = [`${w} ${w === 1 ? 'word' : 'words'}`];
      if (fd.minWords || fd.maxWords) parts.push(`${fd.minWords ? `minimum ${fd.minWords}` : ''}${fd.minWords && fd.maxWords ? ', ' : ''}${fd.maxWords ? `maximum ${fd.maxWords}` : ''}`);
      const max = fd.maxChars || LIMITS.narrative;
      parts.push(`${codePoints(v)} of ${max.toLocaleString('en-GB')} characters`);
      countEl.textContent = parts.join(' · ');
    }
    if (isRows) {
      const t = financeTotals(incomeNow(), expenseNow());
      rowsTotals.textContent = fd.type === 'rows-income'
        ? `Total target ${formatPence(t.targetPence)} · Total secured ${formatPence(t.securedPence)}`
        : `Total expenditure ${formatPence(t.expensePence)}`;
      if (rowsBox._updateErrors) rowsBox._updateErrors();
    }
  }
  function incomeNow() { return (sess.answers['finance.incomeRows'] || {}).value || []; }
  function expenseNow() { return (sess.answers['finance.expenseRows'] || {}).value || []; }

  function focus() {
    const el = control || rowsBox.querySelector('input');
    if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); }
  }

  update();
  return { el: root, update, focus, id: fd.id, control };
}

export { fieldById, optionLabel };
