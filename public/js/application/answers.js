// Pure helpers that build new answer sets. No DOM, no storage. Nothing here mutates its input.
// An answer is { value, raw?, origin, sourceRefs, confirmedAt, editedAt }.
import { fieldById } from './schema.js';

const isEmptyValue = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);

// The manager typed, chose or cleared something. This always wins over any suggestion.
// Typing counts as confirming it, unless it is empty.
export function setManagerAnswer(answers, id, input, nowIso, sourceRefs = []) {
  const value = isEmptyValue(input.value) ? null : input.value;
  const answer = {
    value,
    origin: 'manager',
    sourceRefs,
    confirmedAt: value !== null || input.raw ? nowIso : null,
    editedAt: nowIso,
  };
  if (input.raw) answer.raw = input.raw;
  return { ...answers, [id]: answer };
}

// The manager acknowledges the content as it stands. `refreshedRefs` re-records the sources as they are now,
// which clears a "source changed" flag. Does not change the value or the origin.
export function confirmAnswer(answers, id, nowIso, refreshedRefs) {
  const cur = answers[id];
  if (!cur || isEmptyValue(cur.value)) return answers;
  return { ...answers, [id]: { ...cur, sourceRefs: refreshedRefs || cur.sourceRefs, confirmedAt: nowIso } };
}

// Takes a suggestion the manager explicitly chose. It stays unconfirmed until confirmed or edited.
export function applySuggestion(answers, id, suggestion) {
  return {
    ...answers,
    [id]: { value: suggestion.value, origin: suggestion.origin, sourceRefs: suggestion.sourceRefs || [], confirmedAt: null, editedAt: null },
  };
}

// Text copied from a stored document by the manager: attribution is the manager's excerpt and locator.
export function manualExcerptAnswer(answers, id, { excerpt, ref }, nowIso) {
  return {
    ...answers,
    [id]: { value: excerpt, origin: 'manual-document-excerpt', sourceRefs: [ref], confirmedAt: nowIso, editedAt: nowIso },
  };
}

export const isEdited = (a) => !!(a && a.editedAt);

const same = (x, y) => JSON.stringify(x ?? null) === JSON.stringify(y ?? null);

// Ids of manager-edited answers whose value `incoming` would change.
export function editedAnswersThatWouldChange(answers, incoming) {
  return Object.keys(incoming).filter((id) => {
    const cur = answers[id];
    return isEdited(cur) && !same(cur.value, incoming[id].value);
  });
}

// Replaces exactly the answers in `incoming`; every other answer is left as it is.
export function mergeAnswers(answers, incoming) {
  return { ...answers, ...incoming };
}

export const blankIncomeRow = () => ({ label: '', targetPence: null, securedPence: null, note: '' });
export const blankExpenseRow = () => ({ label: '', amountPence: null, note: '' });

export function labelOfField(id) {
  const f = fieldById(id);
  return f ? f.label : id;
}
