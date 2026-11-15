// DOM helpers for the organisation views. All user text goes in as text nodes or textContent, never as markup.
import { formatBytes } from './validation.js';

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'value') el.value = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

let counter = 0;
export const uid = (prefix) => `${prefix}-${++counter}`;

const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const dateTimeFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });

export function formatDate(ymd) {
  if (!ymd) return 'Not recorded';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  return m ? dateFmt.format(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))) : String(ymd);
}
export function formatDateTime(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : dateTimeFmt.format(d);
}
const moneyWhole = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const moneyPence = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const formatMoney = (n) => (typeof n === 'number' ? (Number.isInteger(n) ? moneyWhole : moneyPence).format(n) : 'Not recorded');
export { formatBytes };

// Downloads the exact stored bytes through an object URL on a temporary link, then revokes the URL.
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.hidden = true;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// Form field: label, control, hint and inline error, wired with aria-describedby.
// kind: 'input' | 'textarea' | 'select'. Returns { el, control, setError, value }.
export function field({ name, label, kind = 'input', type = 'text', value = '', required = false, maxlength, hint, rows = 4, options, full = false, inputmode, placeholder, disabled = false }) {
  const id = uid('f-' + name);
  const hintId = hint ? id + '-hint' : null;
  const errId = id + '-error';
  const attrs = { id, name, required: required || null, maxlength, inputmode, placeholder, disabled: disabled || null };
  let control;
  if (kind === 'textarea') control = h('textarea', { ...attrs, rows, value });
  else if (kind === 'select') {
    control = h('select', attrs, options.map((o) => h('option', { value: o.value, text: o.label })));
    control.value = value;
  } else control = h('input', { ...attrs, type, value });
  const err = h('p', { class: 'field-error', id: errId, hidden: true });
  const describedBy = [hintId].filter(Boolean);
  if (describedBy.length) control.setAttribute('aria-describedby', describedBy.join(' '));
  const el = h('div', { class: 'field' + (full ? ' full' : '') },
    h('label', { for: id }, label, required ? h('span', { class: 'req', 'aria-hidden': 'true', text: ' *' }) : null),
    hint ? h('p', { class: 'field-hint', id: hintId, text: hint }) : null,
    control,
    err);
  return {
    el,
    control,
    name,
    setError(message) {
      err.textContent = message || '';
      err.hidden = !message;
      if (message) {
        control.setAttribute('aria-invalid', 'true');
        control.setAttribute('aria-describedby', [...describedBy, errId].join(' '));
      } else {
        control.removeAttribute('aria-invalid');
        if (describedBy.length) control.setAttribute('aria-describedby', describedBy.join(' '));
        else control.removeAttribute('aria-describedby');
      }
    },
    get value() { return control.value; },
  };
}
