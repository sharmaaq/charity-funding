// The wire format of a demo run, shared by the browser client and the Node tests. PURE MODULE: no DOM, no storage.
//
//   buildManifest(snapshot, attemptId)   the exact manifest the server validates (spec section 8)
//   createEventReader(attemptId, onEvent) an NDJSON decoder that accepts arbitrary chunk boundaries and enforces the
//                                         stream rules: seq goes up by one, attemptId matches, exactly one terminal event
import { ADAPTER_ID, PACKAGE_SCHEMA } from './canonical.js';

export const RUN_ENDPOINT = '/api/submission-demo-runs';
export const CAPABILITIES_ENDPOINT = '/api/submission-capabilities';

// The milestones the manager sees, in order, with the server's step IDs.
export const MILESTONES = Object.freeze([
  { step: 'check', label: 'Checking package' },
  { step: 'prepare', label: 'Preparing documents' },
  { step: 'open', label: 'Opening demo portal' },
  { step: 'fill', label: 'Entering answers' },
  { step: 'upload', label: 'Uploading files' },
  { step: 'review', label: 'Checking portal review' },
  { step: 'submit', label: 'Submitting demo' },
  { step: 'verify', label: 'Verifying receipt' },
]);

function nest(flat) {
  const out = {};
  for (const [id, v] of Object.entries(flat)) {
    const [a, b] = id.split('.');
    (out[a] ||= {})[b] = v;
  }
  return out;
}

export function buildManifest(snapshot, attemptId) {
  return {
    schemaVersion: PACKAGE_SCHEMA,
    adapterId: snapshot.adapter || ADAPTER_ID,
    applicationId: snapshot.applicationId,
    snapshotId: snapshot.id,
    draftRevision: snapshot.revision,
    attemptId,
    mode: 'demo',
    syntheticApplicant: true, // the demo applicant is always the synthetic Your Place identity
    answers: nest(snapshot.answers),
    attachments: snapshot.attachments.map((a) => ({ role: a.role, filename: a.filename, mimeType: a.mime, sizeBytes: a.size, sha256: a.sha256, synthetic: !!a.synthetic })),
    payloadHash: snapshot.payloadHash,
    review: { demoReviewed: true, demoTransfer: true, reviewedPayloadHash: snapshot.payloadHash },
  };
}

export class StreamError extends Error {
  constructor(message) { super(message); this.code = 'STREAM_INVALID'; }
}

// onEvent(event) is called for every valid event except heartbeats. Returns { push(Uint8Array), end() -> terminal|null }.
// Any violation throws StreamError; the caller then treats the run as interrupted, outcome unknown.
export function createEventReader(attemptId, onEvent) {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let buffer = '';
  let lastSeq = 0;
  let terminal = null;
  const line = (text) => {
    if (text.trim() === '') return;
    let ev;
    try { ev = JSON.parse(text); } catch { throw new StreamError('A progress message could not be read.'); }
    if (!ev || typeof ev !== 'object' || ev.seq !== lastSeq + 1) throw new StreamError('Progress messages arrived out of order.');
    if (ev.attemptId !== attemptId) throw new StreamError('A progress message belongs to a different attempt.');
    if (terminal) throw new StreamError('Progress continued after the run had ended.');
    lastSeq = ev.seq;
    if (ev.type === 'completed' || ev.type === 'failed') terminal = ev;
    else if (ev.type !== 'step' && ev.type !== 'heartbeat') throw new StreamError('An unknown progress message arrived.');
    if (ev.type !== 'heartbeat') onEvent(ev);
  };
  return {
    push(chunk) {
      buffer += decoder.decode(chunk, { stream: true });
      let i;
      while ((i = buffer.indexOf('\n')) >= 0) {
        const text = buffer.slice(0, i);
        buffer = buffer.slice(i + 1);
        line(text);
      }
    },
    end() {
      buffer += decoder.decode();
      if (buffer.trim() !== '') line(buffer);
      buffer = '';
      return terminal;
    },
  };
}
