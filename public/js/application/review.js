// The review screen. Phase A: the full answer set, finance totals and gaps, warnings and missing information as links
// back to the fields. The package, PDF and run controls are not here yet.
//
// Phase B attaches to #review-next: the element with data-testid="review-next" is the single place where the
// attachment list, package hash, proposal download, the two confirmations and the run control are added.
import { h, formatBytes, formatDateTime } from '../org/dom.js';
import { SECTIONS, POLICY_FIELD_IDS, fieldById, fieldsInSection, formatPence, sectionLabel } from './schema.js';
import { ORIGIN_CHIP, STATUS, displayValue } from './labels.js';
import { PLANNING_HASH, appHash, fieldHash } from './routes.js';
import { statusStrip } from './workspace.js';

export const NEXT_UPDATE_TEXT = 'Document preparation and the submission demo arrive in the next update.';

const REASON_SHORT = {
  'suggested-draft': 'Suggested draft: edit or confirm it',
  'synthetic-demo': 'Illustrative demo answer: confirm it',
  profile: 'From the organisation profile: confirm it',
  'historical-bid': 'From a past bid: confirm it',
  unconfirmed: 'Not yet confirmed',
  'unknown-answer': 'Answered "Not sure yet"',
  'source-changed': 'Source changed: confirm or replace',
  'source-removed': 'Source removed: confirm or replace',
  invalid: 'Needs correcting',
};

export function buildReview(sess, api) {
  const gid = sess.grantId;
  const ev = sess.eval;
  const docLabel = (id) => {
    const d = ((sess.catalogue && sess.catalogue.documents) || []).find((x) => x.id === id);
    return d ? `${d.title} (${d.filename})` : 'A document that is no longer stored';
  };
  const parts = [];

  parts.push(h('div', { class: 'app-head' },
    h('h2', { id: 'review-heading', tabindex: '-1', 'data-focus': '', text: 'Review your application' }),
    h('span', { class: 'demo-tag', text: 'Demo' })));
  parts.push(h('p', { class: 'app-intro', text: 'This is everything entered so far, with where each answer came from. Nothing is sent anywhere from this page.' }));
  parts.push(h('div', { class: 'app-bar-main' },
    h('a', { class: 'btn primary', href: appHash(gid), 'data-testid': 'edit-answers', text: 'Edit answers' }),
    h('a', { class: 'btn', href: PLANNING_HASH, text: 'Back to planning' })));
  parts.push(statusStrip(ev.counts));
  parts.push(h('p', { class: 'review-ready', 'data-testid': 'review-ready', 'data-ready': String(ev.ready),
    text: ev.ready
      ? 'Every applicable answer is present and confirmed.'
      : `${ev.counts.missing} ${ev.counts.missing === 1 ? 'answer is' : 'answers are'} missing and ${ev.counts.review} ${ev.counts.review === 1 ? 'needs' : 'need'} review. Incomplete work is saved; fix these when you are ready.` }));

  // ---- missing information, as links back to the fields ----
  const missing = ev.issues.filter((i) => i.kind === 'missing');
  const toReview = ev.issues.filter((i) => i.kind === 'review');
  const link = (i) => h('li', { 'data-field': i.fieldId, 'data-kind': i.kind },
    h('a', { href: fieldHash(gid, i.fieldId), text: i.message }),
    h('span', { class: 'issue-section', text: ` (${sectionLabel(i.section)})` }));
  parts.push(h('section', { class: 'review-block', 'aria-labelledby': 'rv-missing', 'data-testid': 'missing-info' },
    h('h3', { id: 'rv-missing', text: `Missing information (${missing.length})` }),
    missing.length ? h('ul', { class: 'issue-list' }, missing.map(link)) : h('p', { text: 'Nothing is missing.' })));
  const drafts = toReview.filter((i) => i.reasons.includes('suggested-draft'));
  const others = toReview.filter((i) => !i.reasons.includes('suggested-draft'));
  parts.push(h('section', { class: 'review-block', 'aria-labelledby': 'rv-drafts', 'data-testid': 'suggested-drafts' },
    h('h3', { id: 'rv-drafts', text: `Suggested drafts still to edit or confirm (${drafts.length})` }),
    h('p', { class: 'sub', text: 'These paragraphs were suggested by the app and include notes written for you. They stay flagged until you edit or confirm them. Confirming means you accept the wording; it is not external verification.' }),
    drafts.length ? h('ul', { class: 'issue-list' }, drafts.map(link)) : h('p', { text: 'No suggested drafts are waiting.' })));
  parts.push(h('section', { class: 'review-block', 'aria-labelledby': 'rv-review', 'data-testid': 'needs-review' },
    h('h3', { id: 'rv-review', text: `Other answers that need review (${others.length})` }),
    others.length ? h('ul', { class: 'issue-list' }, others.map(link)) : h('p', { text: 'No other answers need review.' })));

  // ---- warnings ----
  parts.push(h('section', { class: 'review-block', 'aria-labelledby': 'rv-warn', 'data-testid': 'warnings' },
    h('h3', { id: 'rv-warn', text: `Warnings (${ev.warnings.length})` }),
    ev.warnings.length ? h('ul', { class: 'issue-list' }, ev.warnings.map((w) => h('li', { 'data-warning': w.id }, h('a', { href: fieldHash(gid, w.fieldId), text: w.message })))) : h('p', { text: 'No warnings.' })));

  // ---- finance ----
  const f = ev.finance;
  const finRows = (label, value) => h('tr', null, h('th', { scope: 'row', text: label }), h('td', { text: value }));
  parts.push(h('section', { class: 'review-block', 'aria-labelledby': 'rv-fin', 'data-testid': 'review-finance' },
    h('h3', { id: 'rv-fin', text: 'Finance totals' }),
    h('table', { class: 'stack-table fin-table' },
      h('thead', null, h('tr', null, h('th', { scope: 'col', text: 'Measure' }), h('th', { scope: 'col', text: 'Amount' }))),
      h('tbody', null,
        finRows('Planned expenditure', f.hasExpense ? formatPence(f.expensePence) : 'No rows yet'),
        finRows('Target income', f.hasIncome ? formatPence(f.targetPence) : 'No rows yet'),
        finRows('Secured income', f.hasIncome ? formatPence(f.securedPence) : 'No rows yet'),
        finRows('Current unsecured gap (expenditure minus secured)', f.complete ? formatPence(f.gapPence) : 'Not available'),
        finRows('Target surplus or shortfall (target minus expenditure)', f.complete ? (f.targetSurplusPence >= 0 ? `${formatPence(f.targetSurplusPence)} surplus` : `${formatPence(-f.targetSurplusPence)} shortfall`) : 'Not available'),
        finRows('Amount requested', f.requestPence !== null ? formatPence(f.requestPence) : (ev.values['request.amountMode'] === 'discretion' ? 'Funder discretion: no amount stated' : 'No amount entered')),
        finRows('Request within the gap', f.requestWithinGap === null ? 'Not checked yet' : f.requestWithinGap ? 'Yes' : 'No')))));

  // ---- answers ----
  const answerRow = (fd) => {
    const e = ev.fields[fd.id];
    if (!e || !e.applicable) return null;
    const a = sess.answers[fd.id] || null;
    const st = STATUS[e.status] || STATUS.optional;
    let body;
    if (fd.type === 'rows-income' || fd.type === 'rows-expense') body = rowsTable(fd, a && a.value);
    else {
      const t = a && a.raw ? a.raw : displayValue(fd, a ? a.value : null, { docLabel });
      body = t === null ? h('p', { class: 'muted', text: 'Not answered' }) : h('p', { class: 'prewrap', text: t });
    }
    const hasValue = a && ((a.value !== null && a.value !== undefined) || a.raw);
    return h('div', { class: 'review-row', 'data-field': fd.id, 'data-status': e.status },
      h('dt', null, h('a', { href: fieldHash(gid, fd.id), text: fd.label })),
      h('dd', null, body,
        h('p', { class: 'review-meta' },
          h('span', { class: 'field-status', 'data-status': e.status }, st.mark ? `${st.mark} ` : '', st.label),
          hasValue ? h('span', { text: ` · ${ORIGIN_CHIP[a.origin] || a.origin}` }) : null,
          sess.stale[fd.id] && hasValue ? h('span', { class: 'stale-flag', text: ` · ${sess.stale[fd.id] === 'removed' ? 'Source removed' : 'Source changed'}` }) : null,
          e.reasons.length ? h('span', { class: 'review-reasons', text: ` · ${e.reasons.filter((r) => r !== 'invalid').map((r) => REASON_SHORT[r]).join('; ')}` }) : null),
        e.errors.length ? h('p', { class: 'field-error', text: e.errors.join(' ') }) : null));
  };
  function rowsTable(fd, rows) {
    if (!Array.isArray(rows) || rows.length === 0) return h('p', { class: 'muted', text: 'Not answered' });
    const income = fd.type === 'rows-income';
    const money = (n, raw) => (raw ? `${raw} (not a valid amount)` : Number.isSafeInteger(n) ? formatPence(n) : 'Missing');
    return h('table', { class: 'stack-table rows-table' },
      h('thead', null, h('tr', null, h('th', { scope: 'col', text: income ? 'Source' : 'Expenditure' }), h('th', { scope: 'col', text: income ? 'Target' : 'Amount' }), income ? h('th', { scope: 'col', text: 'Secured' }) : null, h('th', { scope: 'col', text: 'Note' }))),
      h('tbody', null, rows.map((r) => h('tr', null,
        h('td', { 'data-label': income ? 'Source' : 'Expenditure', text: r.label || 'Missing' }),
        h('td', { 'data-label': income ? 'Target' : 'Amount', text: money(income ? r.targetPence : r.amountPence, income ? r.targetRaw : r.amountRaw) }),
        income ? h('td', { 'data-label': 'Secured', text: money(r.securedPence, r.securedRaw) }) : null,
        h('td', { 'data-label': 'Note', text: r.note || '' })))));
  }

  const policyIds = new Set(POLICY_FIELD_IDS);
  for (const s of SECTIONS) {
    const rows = fieldsInSection(s.id).filter((fd) => !policyIds.has(fd.id)).map(answerRow).filter(Boolean);
    parts.push(h('section', { class: 'review-block', 'aria-labelledby': `rv-${s.id}`, 'data-section': s.id },
      h('h3', { id: `rv-${s.id}`, text: s.label }), h('dl', { class: 'review-list' }, rows)));
  }
  const policyRows = POLICY_FIELD_IDS.map((id) => answerRow(fieldById(id))).filter(Boolean);
  parts.push(h('section', { class: 'review-block policy-block', 'aria-labelledby': 'rv-policy', 'data-testid': 'policy-answers' },
    h('h3', { id: 'rv-policy', text: 'Policy and declaration answers' }),
    h('p', { class: 'sub', text: 'Shown apart from the narrative so they cannot be missed. These are demo answers; they are not real safeguarding, tax or privacy attestations.' }),
    h('dl', { class: 'review-list' }, policyRows)));

  // ---- documents ----
  const acc = ev.values['evidence.accountsId'];
  const doc = acc && ((sess.catalogue && sess.catalogue.documents) || []).find((d) => d.id === acc);
  parts.push(h('section', { class: 'review-block', 'aria-labelledby': 'rv-docs', 'data-testid': 'review-documents' },
    h('h3', { id: 'rv-docs', text: 'Selected documents' }),
    doc
      ? h('ul', { class: 'issue-list' }, h('li', null, h('strong', { text: 'Accounts: ' }), `${doc.title} · ${doc.filename} · ${doc.mime} · ${formatBytes(doc.size)} · version ${formatDateTime(doc.updatedAt)}`))
      : h('p', { text: acc ? 'The selected accounts document is no longer stored.' : 'No accounts document selected.' }),
    h('p', { class: 'sub', text: 'The proposal PDF is generated from confirmed answers in the next update.' })));

  // ---- where the package and run controls attach in the next phase ----
  parts.push(h('section', { class: 'review-block review-next', id: 'review-next', 'data-testid': 'review-next', 'aria-labelledby': 'rv-next' },
    h('h3', { id: 'rv-next', text: 'Package and submission demo' }),
    h('p', { 'data-testid': 'next-update', text: NEXT_UPDATE_TEXT })));

  return h('section', { class: 'org-panel app-review', 'aria-labelledby': 'review-heading', 'data-testid': 'application-review' }, parts);
}
