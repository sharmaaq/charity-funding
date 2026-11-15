// Pure timing logic for the Upcoming / Due soon markers. No DOM access and no clock:
// every function takes "now" (a Date) as a parameter. Calendar dates are Europe/London dates.

const TZ = 'Europe/London';
const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const DAY_MS = 86400000;
const HOUR_MS = 3600000;
const UPCOMING_DAYS = 7;

export function londonParts(date) {
  const out = {};
  for (const p of formatter.formatToParts(date)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return { y: out.year, m: out.month, d: out.day, hh: out.hour, mm: out.minute, ss: out.second };
}

const dateKey = ({ y, m, d }) => y * 10000 + m * 100 + d;

export function parseYmd(text) {
  if (typeof text !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return { y, m: mo, d };
}

export function formatYmd({ y, m, d }) {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function addDays({ y, m, d }, n) {
  const t = new Date(Date.UTC(y, m - 1, d) + n * DAY_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

// Same day next month, clamped to the last day of that month (31 Jan -> 28/29 Feb).
export function addOneMonthClamped({ y, m, d }) {
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return { y: ny, m: nm, d: Math.min(d, last) };
}

// An exact closing instant: ISO-8601 date-time with an explicit offset.
export function parseInstant(text) {
  if (typeof text !== 'string') return null;
  const m = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.exec(text);
  if (!m || !parseYmd(m[1])) return null;
  const t = Date.parse(text);
  return Number.isNaN(t) ? null : new Date(t);
}

const validNow = (now) => now instanceof Date && !Number.isNaN(now.getTime());

function opening(grant) {
  return parseYmd(grant && grant.opensOn);
}

// { date, instant } for the closing, or null when absent or invalid.
function closing(grant) {
  if (!grant) return null;
  if (grant.closesAt !== undefined && grant.closesAt !== null) {
    const instant = parseInstant(grant.closesAt);
    return instant ? { date: londonParts(instant), instant } : null;
  }
  const date = parseYmd(grant.closesOn);
  return date ? { date, instant: null } : null;
}

export function isUpcoming(grant, now) {
  const opens = opening(grant);
  if (!opens || !validNow(now)) return false;
  const today = londonParts(now);
  const k = dateKey(opens);
  return k > dateKey(today) && k <= dateKey(addDays(today, UPCOMING_DAYS));
}

export function isDueSoon(grant, now) {
  const close = closing(grant);
  if (!close || !validNow(now)) return false;
  const today = londonParts(now);
  const k = dateKey(close.date);
  if (k < dateKey(today) || k > dateKey(addOneMonthClamped(today))) return false;
  if (close.instant && close.instant.getTime() <= now.getTime()) return false;
  return true;
}

export function timingMarkers(grant, now) {
  const opens = opening(grant);
  const close = closing(grant);
  if (opens && close && dateKey(opens) > dateKey(close.date)) return [];
  const out = [];
  if (isUpcoming(grant, now)) out.push('upcoming');
  if (isDueSoon(grant, now)) out.push('dueSoon');
  return out;
}

// The next London midnight after "now".
export function nextLondonMidnight(now) {
  const tomorrow = addDays(londonParts(now), 1);
  const guess = Date.UTC(tomorrow.y, tomorrow.m - 1, tomorrow.d);
  for (const offset of [HOUR_MS, 0]) {
    const t = new Date(guess - offset);
    if (dateKey(londonParts(t)) === dateKey(tomorrow)) return t;
  }
  return new Date(guess);
}

// When markers could next change: the next London midnight, or an earlier future closing instant.
export function nextChangeAt(grants, now) {
  let next = nextLondonMidnight(now);
  for (const g of grants) {
    const close = closing(g);
    if (close && close.instant && close.instant.getTime() > now.getTime() && close.instant < next) next = close.instant;
  }
  return next;
}

// Fixture check: returns a list of problems (empty when fine).
export function validateTiming(grants) {
  const problems = [];
  for (const g of grants) {
    for (const f of ['opensOn', 'closesOn']) {
      if (g[f] !== undefined && !parseYmd(g[f])) problems.push(`${g.id} ${f} is not a valid YYYY-MM-DD date`);
    }
    if (g.closesAt !== undefined && !parseInstant(g.closesAt)) problems.push(`${g.id} closesAt is not a valid ISO instant with offset`);
    const opens = opening(g);
    const close = closing(g);
    if (opens && close && dateKey(opens) > dateKey(close.date)) problems.push(`${g.id} opens after it closes`);
  }
  return problems;
}
