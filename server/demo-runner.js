// One request-scoped demo run: starts the loopback test portal, a clean headless Chromium, drives the demo adapter,
// and always tears everything down in `finally`. Nothing is written to disk: the files stay in memory.
//
// Draft-only: the runner has no submit action, and its request filter aborts any request to the portal's /submit.
// Network boundary: the browser context routes every request and aborts anything that is not the exact loopback
// origin of this run's portal. Service workers are blocked, downloads refused, popups closed, page JavaScript off.
import { chromium } from 'playwright';
import { startDemoPortal, PORTAL_TARGET } from './demo-portal.js';
import { demoAdapter, RunError } from './adapters/gwf-demo.js';

export const RUN_DEADLINE_MS = 90000;
export const ACTION_TIMEOUT_MS = 10000;
export { RunError };

export const STEPS = Object.freeze(['check', 'prepare', 'open', 'fill', 'upload', 'review', 'save-draft', 'verify']);

const launchOptions = () => ({ headless: true, args: process.platform === 'linux' ? ['--no-sandbox', '--disable-dev-shm-usage'] : [] });

// Launches and closes Chromium once. Resolves { ok, reason? }.
export async function probeBrowser() {
  let browser;
  try {
    browser = await chromium.launch(launchOptions());
    return { ok: true };
  } catch {
    return { ok: false, reason: 'The headless browser could not be started on this server.' };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

// input: { manifest, flat, files, emit(step, status), signal?, deadlineMs?, faults? (tests only), hooks? (tests only) }
// Resolves { receipt, files, metrics } or rejects with RunError. emit is called only for real progress.
export async function runDemo({ manifest, flat, files, emit, signal, deadlineMs = RUN_DEADLINE_MS, faults = {}, hooks = {}, now = () => new Date() }) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), deadlineMs);
  const onOuterAbort = () => controller.abort(signal.reason || 'aborted');
  if (signal) { if (signal.aborted) onOuterAbort(); else signal.addEventListener('abort', onOuterAbort, { once: true }); }
  let step = 'prepare';
  const mark = (s, status) => { step = s; emit(s, status); };
  const check = () => {
    if (!controller.signal.aborted) return;
    const reason = controller.signal.reason;
    throw reason === 'timeout'
      ? new RunError('TIMEOUT', step, `The demo run took longer than ${Math.round(deadlineMs / 1000)} seconds and was stopped.`, { retryable: true })
      : new RunError('ABORTED', step, 'The demo run was stopped before it finished.', { retryable: true });
  };

  let portal = null;
  let browser = null;
  let context = null;
  const blocked = [];
  let peakRss = process.memoryUsage().rss;
  const sampler = setInterval(() => { peakRss = Math.max(peakRss, process.memoryUsage().rss); }, 250);
  const closeAll = () => { if (browser) browser.close().catch(() => {}); };
  controller.signal.addEventListener('abort', closeAll, { once: true });

  try {
    mark('prepare', 'started');
    check();
    portal = await startDemoPortal({ attemptId: manifest.attemptId, payloadHash: manifest.payloadHash, now, faults });
    mark('prepare', 'complete');

    mark('open', 'started');
    try {
      browser = await chromium.launch(launchOptions());
    } catch {
      throw new RunError('RUNNER_UNAVAILABLE', 'open', 'The headless browser could not be started.', { retryable: true });
    }
    check();
    context = await browser.newContext({
      viewport: { width: 1280, height: 900 }, locale: 'en-GB', timezoneId: 'Europe/London',
      serviceWorkers: 'block', acceptDownloads: false, javaScriptEnabled: false,
    });
    await context.route('**/*', (route) => {
      const url = route.request().url();
      let origin = null;
      try { origin = new URL(url).origin; } catch { /* unparsable: block */ }
      let path = '';
      try { path = new URL(url).pathname; } catch { /* unparsable: blocked above */ }
      // Request filter: the portal's final submit endpoint is never reachable from the runner, whatever the page does.
      if (origin === portal.origin && /\/submit\/?$/.test(path)) { blocked.push(`${route.request().method()} ${url.slice(0, 200)}`); return route.abort('blockedbyclient'); }
      if (origin === portal.origin) return route.continue();
      blocked.push(url.slice(0, 200));
      return route.abort('blockedbyclient');
    });
    const page = await context.newPage();
    page.setDefaultTimeout(ACTION_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(ACTION_TIMEOUT_MS);
    context.on('page', (p) => { if (p !== page) p.close().catch(() => {}); });
    if (hooks.afterOpen) await hooks.afterOpen({ browser, context, page, portal });
    await page.goto(portal.startUrl);
    await demoAdapter.inspect(page, 'start', 'open');
    const start = page.locator('main [data-action="next"]');
    await Promise.all([page.waitForLoadState('load'), start.click()]);
    mark('open', 'complete');

    await demoAdapter.prepare(page, { flat, manifest, files, emit: mark, check });
    mark('review', 'started');
    const compared = await demoAdapter.compare(page, { flat, manifest });
    mark('review', 'complete');
    if (hooks.beforeSaveDraft) await hooks.beforeSaveDraft({ browser, context, page, portal });
    const draft = await demoAdapter.saveDraft(page, { manifest, emit: mark, check });
    if (portal.state.submits !== 0) throw new RunError('DRAFT_MISMATCH', 'verify', 'The demo portal recorded a final submission. This must never happen.');
    if (portal.state.drafts !== 1) throw new RunError('DRAFT_MISMATCH', 'verify', 'The demo portal recorded an unexpected number of saved drafts.');
    return {
      receipt: { kind: 'draft', reference: draft.reference, payloadHash: draft.payloadHash, target: PORTAL_TARGET, confirmedAt: draft.receivedAt },
      files: compared.files,
      metrics: { durationMs: Date.now() - started, peakRssBytes: peakRss, blockedRequests: blocked.length },
    };
  } catch (e) {
    if (e instanceof RunError) throw e;
    if (controller.signal.aborted) { try { check(); } catch (abortErr) { throw abortErr; } }
    if (browser && !browser.isConnected()) throw new RunError('BROWSER_CRASHED', step, 'The headless browser stopped unexpectedly.', { retryable: true });
    if (e && e.name === 'TimeoutError') throw new RunError('PORTAL_TIMEOUT', step, 'The demo portal did not respond in time.', { retryable: true });
    const unexpected = new RunError('RUNNER_ERROR', step, 'The demo run failed unexpectedly.', { retryable: true });
    unexpected.cause = e; // kept for server-side diagnosis only; never sent to the client
    throw unexpected;
  } finally {
    clearTimeout(timer);
    clearInterval(sampler);
    if (signal) signal.removeEventListener('abort', onOuterAbort);
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    if (portal) await portal.close().catch(() => {});
    if (hooks.afterCleanup) hooks.afterCleanup({ browser, portal, blocked });
  }
}
