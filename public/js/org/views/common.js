// Pieces shared by the organisation views.
import { h, formatBytes, downloadBlob } from '../dom.js';
import { FILE_TYPES, fileExtension, labelOf, OUTCOMES } from '../validation.js';
import { SYNTHETIC_LABEL } from '../seed.js';

export const STORAGE_NOTICE = 'Files are stored in this browser only. Keep your originals. AI processing is not connected in this demo.';
export const READ_ONLY_ID = 'org-readonly-note';

export const typeLabel = (doc) => (FILE_TYPES[fileExtension(doc.filename)] || { label: 'FILE' }).label;

export function syntheticNote(record) {
  return record && record.synthetic ? h('p', { class: 'synthetic', text: SYNTHETIC_LABEL }) : null;
}

const OUTCOME_CLASS = { successful: 'ok', unsuccessful: 'bad', awaiting: 'wait', withdrawn: 'neutral', unknown: 'neutral' };
const OUTCOME_MARK = { successful: '✓', unsuccessful: '×', awaiting: '◷', withdrawn: '–', unknown: '?' };

export function outcomeBadge(outcome) {
  return h('span', { class: `org-badge ${OUTCOME_CLASS[outcome] || 'neutral'}`, 'data-outcome': outcome },
    h('span', { 'aria-hidden': 'true', text: OUTCOME_MARK[outcome] || '?' }), ' ', labelOf(OUTCOMES, outcome));
}

export const storedBadge = () => h('span', { class: 'org-badge neutral stored', text: 'Stored' });

// Disables a mutating control and points it at the read-only explanation.
export function guard(ctx, el) {
  if (ctx.readOnly) {
    el.disabled = true;
    el.setAttribute('aria-describedby', READ_ONLY_ID);
  }
  return el;
}

export function downloadButton(ctx, doc, label = 'Download') {
  return h('button', {
    type: 'button',
    class: 'link-btn',
    'aria-label': `${label} ${doc.filename}`,
    onclick: async () => {
      try {
        const blob = await ctx.repo.getBlob(doc.id);
        if (!blob) {
          ctx.announce(`The stored file "${doc.filename}" could not be found.`);
          return;
        }
        downloadBlob(blob, doc.filename);
      } catch (e) {
        ctx.announce(`"${doc.filename}" could not be downloaded: ${e.message}`);
      }
    },
  }, label);
}

export function fileMeta(doc) {
  return `${doc.filename} · ${typeLabel(doc)} · ${formatBytes(doc.size)}`;
}

// Shows field errors from an OrgError('invalid') on a list of { name, setError } fields. Returns the first invalid control.
export function applyErrors(fields, errors) {
  let first = null;
  for (const f of fields) {
    const msg = errors && errors[f.name];
    f.setError(msg || '');
    if (msg && !first) first = f.control;
  }
  return first;
}

export function formErrorBanner() {
  const el = h('div', { class: 'form-error', role: 'alert', hidden: true });
  return {
    el,
    show(message) { el.textContent = message; el.hidden = !message; },
  };
}
