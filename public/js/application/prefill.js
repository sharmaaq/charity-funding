// Prefill with provenance. Pure: it takes the organisation profile and source catalogue (the shapes returned by the
// organisation repository's getProfile() and catalogue()) and returns plain data. It never writes anything.
//
// Precedence (spec section 5): current explicit manager edit > manager-confirmed imported fact > current organisation
// profile > unconfirmed source suggestion > demo default. Nothing in this file may overwrite an edited answer; refresh
// only OFFERS differences, and the manager chooses each one.
import { FIELDS, fieldById } from './schema.js';

// Wording that depends on the charity. Each charity can supply its own set (Your Place's is part of its seed data on the
// server and arrives with the workspace); a charity without one gets the neutral text below. `{name}`, `{activities}`
// and `{beneficiaries}` are replaced with the organisation's name and its profile entries.
export const GENERIC_DEFAULTS = Object.freeze({
  overview: '{name} is a charity. This description is a starting point: the funding manager should confirm the current services, locations and scale of delivery before using it in an application.',
  requestTitle: 'Core services',
  reason: 'We propose requesting a contribution towards the general operating costs of {name}\'s services for a twelve-month period. The contribution would support the shared resources needed to deliver consistent help to the people the charity supports, rather than fund one named post. The requested amount, funded period and expenditure allocation are illustrative until the funding manager confirms the budget and the organisation\'s priorities.',
  need: 'This draft proposes supporting {name}\'s ongoing work. The application still needs current local evidence, an explanation of the particular barriers faced by the people {name} supports, and a clear account of where existing provision falls short. The funding manager should replace this draft with evidence from the organisation\'s service records and verified local information.',
  activities: '{name}\'s services, as described in its organisation profile, include: {activities}. Core funding would help keep these shared services staffed and available throughout the year, so that people receive consistent support. The funding manager should confirm the current activities, who delivers them and how they are organised before this answer is used.',
  activitiesFallback: 'the services described in the organisation profile',
  beneficiaries: 'The organisation profile describes the people supported as: {beneficiaries}. The funding manager should describe who the services reach in practice, including their circumstances, how they are referred and any groups who are harder to reach.',
  beneficiariesFallback: 'the people the charity supports',
});

const fill = (template, vars) => String(template).replace(/\{(name|activities|beneficiaries)\}/g, (_, k) => vars[k]);

const SUGGESTED_OUTCOMES = 'Suggested measures of success for core support are people sustaining their accommodation, people moving towards independent living and people staying engaged with the support they are offered. No past results are claimed in this draft. The funding manager should add the measures the organisation actually records, how often they are reviewed and who reviews them.';
const SUGGESTED_FUNDRAISING = 'Core support from this funder would form one part of the income needed to run the services. This draft assumes the remaining income would come from existing service contracts, other trusts and foundations, and donations. No funding is described as committed unless it is shown as secured in the budget. The funding manager should replace this with the organisation\'s real plan and timetable for raising the balance.';
const SUGGESTED_FALLBACK = 'If less income is raised than planned, the organisation would protect essential accommodation and safety-critical support first and phase other activities. The funding manager should confirm which services would be protected, which would be reduced and how people already using them would be told.';

export const DEFAULT_START = '2027-06-01';
export const DEFAULT_END = '2028-05-31';

export const profileRef = (profile) => ({
  kind: 'profile',
  recordId: 'profile',
  title: 'Organisation profile',
  updatedAt: profile ? profile.updatedAt || null : null,
  synthetic: !!(profile && profile.synthetic),
});
const defaultRef = () => ({ kind: 'default', recordId: null, title: 'Built-in suggestion for this demo', updatedAt: null, synthetic: false });

const text = (v) => (typeof v === 'string' ? v.trim() : '');
const sentence = (s) => text(s).replace(/[.\s]+$/, '');

// { [fieldId]: { value, origin, sourceRefs } } for every field that has a source-based default.
// Fields with no default (contact details, eligibility, compliance, accounts) are deliberately absent: unknown stays null.
export function buildSuggestions(profile, defaults = null) {
  const d = { ...GENERIC_DEFAULTS, ...(defaults || {}) };
  const name = text(profile && profile.name) || 'The charity';
  const out = {};
  const pRef = profile ? [profileRef(profile)] : [];
  const fromProfile = (id, value) => { if (text(value)) out[id] = { value: text(value), origin: 'profile', sourceRefs: pRef }; };
  const draft = (id, value, refs = [defaultRef()]) => { out[id] = { value, origin: 'suggested-draft', sourceRefs: refs }; };

  fromProfile('org.name', profile && profile.name);
  fromProfile('org.charityNumber', profile && profile.charityNumber); // only what the manager entered; never invented
  fromProfile('org.companyNumber', profile && profile.companyNumber);
  fromProfile('org.website', profile && profile.website);
  fromProfile('org.geography', profile && profile.geography);
  if (text(profile && profile.overview)) fromProfile('org.overview', profile.overview);
  else draft('org.overview', fill(d.overview, { name }));

  draft('request.type', 'core');
  draft('request.title', d.requestTitle);
  draft('request.amountMode', 'specified');
  draft('request.amountPence', 5000000);
  draft('request.start', DEFAULT_START);
  draft('request.end', DEFAULT_END);
  draft('request.reason', fill(d.reason, { name }));
  draft('work.need', fill(d.need, { name }));
  const acts = sentence(profile && profile.activities) || d.activitiesFallback;
  draft('work.activities', fill(d.activities, { name, activities: acts }), [defaultRef(), ...pRef]);
  const ben = sentence(profile && profile.beneficiaries) || d.beneficiariesFallback;
  draft('work.beneficiaries', fill(d.beneficiaries, { name, beneficiaries: ben }), [defaultRef(), ...pRef]);
  draft('work.outcomes', SUGGESTED_OUTCOMES);
  draft('finance.forecastStart', DEFAULT_START);
  draft('finance.forecastEnd', DEFAULT_END);
  draft('finance.fundraising', SUGGESTED_FUNDRAISING);
  draft('finance.fallback', SUGGESTED_FALLBACK);
  return out;
}

// The answer set for a brand-new draft. Fixed fields are confirmed; everything else waits for the manager.
export function initialAnswers(profile, nowIso, defaults = null) {
  const answers = {};
  for (const [id, s] of Object.entries(buildSuggestions(profile, defaults))) {
    const fixed = !!(fieldById(id) && fieldById(id).fixed);
    answers[id] = { value: s.value, origin: s.origin, sourceRefs: s.sourceRefs, confirmedAt: fixed ? nowIso : null, editedAt: null };
  }
  return answers;
}

// ---------- sources and staleness ----------
// The live record a source ref points at, or undefined when it has been deleted. null means "not checkable".
function currentRecord(ref, catalogue) {
  if (!catalogue) return null;
  if (ref.kind === 'profile') return catalogue.profile || undefined;
  if (ref.kind === 'document') return (catalogue.documents || []).find((d) => d.id === ref.recordId);
  if (ref.kind === 'bid') return (catalogue.bids || []).find((b) => b.id === ref.recordId);
  return null; // built-in and synthetic sources have no live record
}

// { [fieldId]: 'changed' | 'removed' } for answers whose recorded source has changed since it was used.
// When the catalogue could not be read at all, nothing is flagged (and nothing is claimed).
export function staleMap(answers, catalogue) {
  const out = {};
  if (!catalogue) return out;
  for (const [id, a] of Object.entries(answers || {})) {
    for (const ref of (a && a.sourceRefs) || []) {
      const cur = currentRecord(ref, catalogue);
      if (cur === null) continue;
      if (cur === undefined) { out[id] = 'removed'; break; }
      if ((cur.updatedAt || null) !== (ref.updatedAt || null)) out[id] = 'changed';
    }
  }
  return out;
}

// The same refs, re-recorded against the sources as they are now (used when the manager confirms a stale answer).
export function refreshedRefs(refs, catalogue) {
  if (!catalogue) return refs;
  return (refs || []).map((ref) => {
    const cur = currentRecord(ref, catalogue);
    return cur ? { ...ref, updatedAt: cur.updatedAt || null } : ref;
  });
}

export function sourceHref(ref) {
  if (!ref) return null;
  if (ref.kind === 'profile') return '#/organisation';
  if (ref.kind === 'document') return '#/organisation/documents';
  if (ref.kind === 'bid' && ref.recordId) return `#/organisation/bids/${encodeURIComponent(ref.recordId)}`;
  return null;
}

export function documentRef(doc, extra = {}) {
  return {
    kind: 'document',
    recordId: doc.id,
    documentId: doc.id,
    title: doc.title || doc.filename,
    updatedAt: doc.updatedAt || null,
    reportingPeriod: doc.period || undefined,
    synthetic: !!doc.synthetic,
    ...extra,
  };
}

// ---------- Refresh suggestions ----------
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// Differences between the current answers and fresh suggestions, for the manager to accept one at a time.
// kind 'new': nothing answered yet. kind 'changed': the answer differs from the suggestion.
// `edited` is true when the manager has edited (or cleared) that answer: such a change is only ever applied if chosen.
// Fixed fields and anything already equal are never listed.
export function diffSuggestions(answers, suggestions) {
  const out = [];
  for (const fd of FIELDS) {
    const s = suggestions[fd.id];
    if (!s || fd.fixed) continue;
    const cur = answers[fd.id];
    const empty = !cur || cur.value === null || cur.value === undefined;
    if (!empty && same(cur.value, s.value)) continue;
    const edited = !!(cur && cur.editedAt);
    if (empty && edited) {
      out.push({ fieldId: fd.id, kind: 'changed', edited: true, current: cur, suggested: s });
    } else if (empty) {
      out.push({ fieldId: fd.id, kind: 'new', edited: false, current: cur || null, suggested: s });
    } else {
      out.push({ fieldId: fd.id, kind: 'changed', edited, current: cur, suggested: s });
    }
  }
  return out;
}

// ---------- accounts documents ----------
export const ACCOUNT_EXTENSIONS = ['pdf', 'docx'];
export const extensionOf = (name) => {
  const s = String(name ?? '');
  const i = s.lastIndexOf('.');
  return i < 0 ? '' : s.slice(i + 1).toLowerCase();
};
export const isAccountsFile = (doc) => ACCOUNT_EXTENSIONS.includes(extensionOf(doc && doc.filename));

// Organisation documents the manager could choose from. TXT and the rest are listed but not selectable.
export function accountsCandidates(catalogue) {
  const docs = ((catalogue && catalogue.documents) || []).filter((d) => d.ownerType === 'organisation');
  return docs.map((d) => ({ doc: d, selectable: isAccountsFile(d), suggested: isAccountsFile(d) && (d.category === 'financial' || /account/i.test(`${d.title} ${d.filename}`)) }));
}
