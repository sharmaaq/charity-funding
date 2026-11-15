// Timing preview (?preview=timing): synthetic dates so the markers can be seen at any time.
// Used for marker computation only; it never changes displayed timing text or saved data.
import { addDays, formatYmd, londonParts } from './timing.js';

export function isTimingPreview(search) {
  return new URLSearchParams(search || '').get('preview') === 'timing';
}

export function withPreviewTiming(grant, now) {
  const today = londonParts(now);
  const at = (n) => formatYmd(addDays(today, n));
  switch (grant.id) {
    case 'G-001':
      return { ...grant, opensOn: at(3), closesOn: undefined, closesAt: undefined };
    case 'G-002':
      return { ...grant, opensOn: at(2), closesOn: at(20), closesAt: undefined };
    case 'G-003':
      return { ...grant, opensOn: undefined, closesOn: at(10), closesAt: undefined };
    default:
      return grant;
  }
}
