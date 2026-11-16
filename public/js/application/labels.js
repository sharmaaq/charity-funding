// Display text shared by the workspace, the source drawer and the review screen. Browser module (uses ../org/dom.js).
import { formatDate } from '../org/dom.js';
import { formatGroupedNumber, formatPence } from './schema.js';

export const STATUS = Object.freeze({
  missing: { label: 'Missing', mark: '○' },
  review: { label: 'Needs review', mark: '!' },
  confirmed: { label: 'Confirmed', mark: '✓' },
  optional: { label: 'Optional', mark: '' },
});

export const ORIGIN_CHIP = Object.freeze({
  profile: 'Source: organisation profile',
  manager: 'Entered by you',
  'manual-document-excerpt': 'Source: your excerpt from a document',
  'historical-bid': 'Source: past bid',
  'suggested-draft': 'Source: suggested draft',
  'synthetic-demo': 'Source: synthetic demo example',
});
export const NO_SOURCE_CHIP = 'No answer yet';

// A category, never a score. "Suggested" is not "verified".
export const ORIGIN_NOTE = Object.freeze({
  profile: 'Taken from the organisation profile held in this browser. It has not been checked against the funder\'s requirements.',
  manager: 'Typed or chosen by you.',
  'manual-document-excerpt': 'Manager supplied from a document: you pasted this text from a stored document and named where it came from. The app has not read the document itself.',
  'historical-bid': 'Taken from a past bid. A past bid can show structure; it does not establish current facts.',
  'suggested-draft': 'A suggested draft, not verified. It may contain notes written for you that must be replaced before this is used.',
  'synthetic-demo': 'Synthetic demo content. It is fictional and exists only to demonstrate the questionnaire.',
});

export const SOURCE_KIND = Object.freeze({
  profile: 'Organisation profile',
  document: 'Stored document',
  bid: 'Past bid',
  default: 'Built-in suggestion',
  'synthetic-example': 'Worked demo example',
});

export const fmtTime = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }).format(d);
};

export function optionLabel(fd, value) {
  const opts = fd.type === 'yesno'
    ? [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'unknown', label: 'Not sure yet' }]
    : fd.options || [];
  const o = opts.find((x) => x.value === value);
  return o ? o.label : String(value);
}

// Plain-text rendering of an answer value for Review. Rows are shown as tables by the review screen.
export function displayValue(fd, value, ctx = {}) {
  if (value === null || value === undefined || value === '') return null;
  switch (fd.type) {
    case 'money': return formatPence(value);
    case 'integer': return formatGroupedNumber(value);
    case 'date': return formatDate(value);
    case 'enum':
    case 'yesno': return optionLabel(fd, value);
    case 'document': return ctx.docLabel ? ctx.docLabel(value) : String(value);
    default: return String(value);
  }
}
