// /api/* on our own Node service (spec section 8). Not a Blackbaud or funder endpoint.
//
//   GET  /api/submission-capabilities   what this instance can do right now
//   POST /api/submission-demo-runs      one request-scoped demo run, streamed back as NDJSON
//
// Everything that can be rejected is rejected before a browser starts. One run at a time per instance (429 otherwise).
// The open response IS the job: there is no queue, no polling endpoint and no work after the response ends.
import { ADAPTER_ID, PACKAGE_SCHEMA } from '../public/js/application/canonical.js';
import { TRANSFER_LIMITS } from '../public/js/application/transfer.js';
import { ManifestError, parseManifest, verifyFiles } from './manifest.js';
import { readMultipart } from './multipart.js';
import { runDemo as defaultRunDemo, probeBrowser as defaultProbe, RunError } from './demo-runner.js';
import { liveAdapter } from './adapters/gwf-live-readiness.js';

export const RECENT_ATTEMPT_MS = 5 * 60 * 1000;
export const HEARTBEAT_MS = 10000;
const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

function sendJson(res, status, body, extra = {}) {
  if (res.headersSent) { res.destroy(); return; }
  res.writeHead(status, { ...JSON_HEADERS, ...extra });
  res.end(JSON.stringify(body));
}
const error = (code, message, retryable = false, fieldErrors = []) => ({ code, message, fieldErrors, retryable });

// Same-origin only (decision R5): the Origin header's host must equal the Host header. The service has two public
// addresses and runs on localhost in development; each is its own origin. No CORS headers are ever sent.
export function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin || !req.headers.host) return false;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}

// options (tests only): { runDemo, probe, now, faults, deadlineMs, log }
export function createApi(options = {}) {
  const runDemo = options.runDemo || defaultRunDemo;
  const probe = options.probe || defaultProbe;
  const now = options.now || (() => new Date());
  const log = options.log || ((line) => console.log(JSON.stringify(line)));
  let probeResult = null;
  let probeAt = 0;
  let busy = false;
  const recent = new Map(); // attemptId -> { payloadHash, running, endedAt }

  async function capability() {
    const fresh = probeResult && (probeResult.ok || Date.now() - probeAt < 60000);
    if (!fresh) { probeResult = await probe(); probeAt = Date.now(); }
    return probeResult;
  }

  function prune() {
    const t = Date.now();
    for (const [id, r] of recent) if (!r.running && t - r.endedAt > RECENT_ATTEMPT_MS) recent.delete(id);
  }

  async function capabilities(res) {
    const cap = await capability();
    sendJson(res, 200, {
      schemaVersion: PACKAGE_SCHEMA,
      adapters: [{
        grantId: 'G-001',
        adapterId: ADAPTER_ID,
        demoAvailable: cap.ok,
        ...(cap.ok ? {} : { demoUnavailableReason: cap.reason }),
        liveAvailable: false,
        liveBlockers: liveAdapter.blockers(),
        maxFiles: 2,
        maxFileBytes: TRANSFER_LIMITS.maxFileBytes,
        maxAggregateFileBytes: TRANSFER_LIMITS.maxTotalBytes,
      }],
    });
  }

  async function run(req, res) {
    if (!sameOrigin(req)) return sendJson(res, 403, error('ORIGIN_REJECTED', 'This endpoint only accepts requests from this application.'));
    if (req.headers['x-submission-schema'] !== PACKAGE_SCHEMA) return sendJson(res, 400, error('MALFORMED', `The X-Submission-Schema header must be ${PACKAGE_SCHEMA}.`));
    if (!/^multipart\/form-data/i.test(req.headers['content-type'] || '')) return sendJson(res, 415, error('UNSUPPORTED_MEDIA', 'The request must be multipart/form-data.'));
    const idempotencyKey = req.headers['idempotency-key'];
    prune();
    const prior = recent.get(idempotencyKey);
    if (prior && prior.running) return sendJson(res, 409, error('ATTEMPT_IN_FLIGHT', 'This demo attempt is already running.'));
    if (busy) return sendJson(res, 429, error('BUSY', 'Another demo run is in progress. Try again in a minute.', true), { 'Retry-After': '30' });
    const cap = await capability();
    if (!cap.ok) return sendJson(res, 503, error('RUNNER_UNAVAILABLE', cap.reason, true));

    busy = true;
    let released = false;
    const release = () => { if (!released) { released = true; busy = false; } };
    let manifest;
    let flat;
    let files;
    try {
      const body = await readMultipart(req);
      ({ manifest, flat } = parseManifest(body.manifestText, { idempotencyKey, schema: req.headers['x-submission-schema'] }));
      const again = recent.get(manifest.attemptId);
      if (again && again.payloadHash !== manifest.payloadHash) throw new ManifestError(409, 'HASH_CONFLICT', 'This attempt was already used for a different package.');
      await verifyFiles(manifest, flat, body.files);
      files = body.files;
    } catch (e) {
      release();
      if (e instanceof ManifestError) return sendJson(res, e.status, e.toJSON(), e.status === 413 ? { Connection: 'close' } : {});
      return sendJson(res, 400, error('MALFORMED', 'The request could not be read.'));
    }

    // Accepted: 200 means the stream started, not that anything was submitted.
    recent.set(manifest.attemptId, { payloadHash: manifest.payloadHash, running: true, endedAt: 0 });
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Accel-Buffering': 'no' });
    res.flushHeaders();
    let seq = 0;
    let finished = false;
    const write = (event) => { if (!res.writableEnded) res.write(`${JSON.stringify({ seq: ++seq, attemptId: manifest.attemptId, ...event, at: now().toISOString() })}\n`); };
    const controller = new AbortController();
    res.on('close', () => { if (!finished) controller.abort('disconnected'); });
    const heartbeat = setInterval(() => write({ type: 'heartbeat' }), HEARTBEAT_MS);
    const started = Date.now();
    write({ type: 'step', step: 'check', status: 'complete' });
    let outcome = 'failed';
    let code = null;
    let metrics = null;
    try {
      const result = await runDemo({
        manifest, flat, files, signal: controller.signal, now,
        emit: (step, status) => write({ type: 'step', step, status }),
        ...(options.faults ? { faults: options.faults } : {}),
        ...(options.deadlineMs ? { deadlineMs: options.deadlineMs } : {}),
      });
      metrics = result.metrics;
      outcome = 'completed';
      write({ type: 'completed', mode: 'demo', receipt: result.receipt, evidence: { files: result.files, adapterId: ADAPTER_ID } });
    } catch (e) {
      const err = e instanceof RunError ? e : new RunError('RUNNER_ERROR', 'unknown', 'The demo run failed unexpectedly.', { retryable: true });
      code = err.code;
      write({ type: 'failed', code: err.code, step: err.step, ...(err.fieldPath ? { fieldPath: err.fieldPath } : {}), retryable: err.retryable, safeMessage: err.message });
    } finally {
      finished = true;
      clearInterval(heartbeat);
      recent.set(manifest.attemptId, { payloadHash: manifest.payloadHash, running: false, endedAt: Date.now() });
      release();
      res.end();
      // Safe metrics only: no answers, file names or contents.
      log({ event: 'demo-run', outcome, code, durationMs: Date.now() - started, peakRssMb: metrics ? Math.round(metrics.peakRssBytes / 1048576) : null, blockedRequests: metrics ? metrics.blockedRequests : null });
    }
    return undefined;
  }

  return async function handle(req, res, pathname) {
    try {
      if (pathname === '/api/submission-capabilities') {
        if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, error('METHOD_NOT_ALLOWED', 'Use GET.'), { Allow: 'GET, HEAD' });
        return await capabilities(res);
      }
      if (pathname === '/api/submission-demo-runs') {
        if (req.method !== 'POST') return sendJson(res, 405, error('METHOD_NOT_ALLOWED', 'Use POST.'), { Allow: 'POST' });
        return await run(req, res);
      }
      return sendJson(res, 404, error('NOT_FOUND', 'Not found.'));
    } catch {
      return sendJson(res, 500, error('SERVER_ERROR', 'Server error.', true));
    }
  };
}
