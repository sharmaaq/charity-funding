// In-memory job registry with event replay (as Research's startJob). A job runs on the server whether or not anyone is
// watching; a browser can attach to it, or re-attach after a reload, and gets every event so far.
// A job belongs to one charity. One discovery job per charity at a time (kind 'discover').
import { randomUUID } from 'node:crypto';

const KEEP_MS = 6 * 3600e3;

export function createJobs({ keepMs = KEEP_MS } = {}) {
  const jobs = new Map();

  function start(cid, kind, fn) {
    const id = randomUUID();
    const job = { id, cid, kind, events: [], listeners: new Set(), done: false, result: null, error: null, startedAt: new Date().toISOString() };
    jobs.set(id, job);
    const emit = (e) => {
      job.events.push(e);
      for (const l of job.listeners) l(e);
    };
    Promise.resolve()
      .then(() => fn(emit))
      .then((r) => { job.result = r ?? null; emit({ type: 'done', result: job.result }); })
      .catch((e) => { job.error = String((e && e.message) || e); emit({ type: 'error', error: job.error }); })
      .finally(() => {
        job.done = true;
        job.finishedAt = new Date().toISOString();
        const t = setTimeout(() => jobs.delete(id), keepMs);
        t.unref?.();
      });
    return job;
  }

  return {
    start,
    // A job of this charity, or undefined (another charity's job is "not found" too).
    get: (cid, id) => { const j = jobs.get(id); return j && j.cid === cid ? j : undefined; },
    active: (cid, kind) => [...jobs.values()].find((j) => j.cid === cid && j.kind === kind && !j.done),
  };
}
