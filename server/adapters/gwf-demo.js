// The demo adapter: drives the controlled test portal in a real browser page using the versioned mapping.
// Deterministic: every control is found by its stable data-field, written, then read back and compared. Zero or more
// than one match stops the run (PORTAL_SCHEMA_CHANGED); nothing is ever chosen by position.
import { ADAPTER_ID } from '../../public/js/application/canonical.js';
import { PAGES, FILE_ROLES, PORTAL_VERSION, MAP_VERSION, reviewText } from './gwf-demo-map.js';

export class RunError extends Error {
  constructor(code, step, message, { fieldPath = null, retryable = false } = {}) {
    super(message);
    this.code = code;
    this.step = step;
    this.fieldPath = fieldPath;
    this.retryable = retryable;
  }
}

const norm = (s) => String(s ?? '').replace(/\r\n?/g, '\n').trim();

async function one(page, selector, step, fieldPath) {
  const loc = page.locator(selector);
  const n = await loc.count();
  if (n !== 1) throw new RunError('PORTAL_SCHEMA_CHANGED', step, n === 0 ? `The portal has no control for ${fieldPath}. The mapping needs an update; nothing was guessed.` : `The portal has ${n} controls for ${fieldPath}. The mapping needs an update; nothing was guessed.`, { fieldPath });
  return loc;
}

// Asserts this is our controlled portal at the expected page before touching anything.
export async function inspect(page, expectedPage, step) {
  const main = page.locator('main[data-portal-version]');
  if (await main.count() !== 1) throw new RunError('PORTAL_SCHEMA_CHANGED', step, 'The page is not the controlled demo portal.');
  const version = await main.getAttribute('data-portal-version');
  if (version !== PORTAL_VERSION) throw new RunError('PORTAL_SCHEMA_CHANGED', step, `The demo portal version is ${version}, but the mapping is for ${PORTAL_VERSION}.`);
  const at = await main.getAttribute('data-page');
  if (at !== expectedPage) {
    const err = await page.locator('[data-portal-error]').first();
    if (await err.count()) {
      const fieldPath = await err.getAttribute('data-error-for');
      throw new RunError('PORTAL_VALIDATION', step, `The demo portal rejected ${fieldPath}: ${norm(await err.textContent())}`, { fieldPath });
    }
    throw new RunError('PORTAL_NAVIGATION', step, `Expected the portal's ${expectedPage} page, but it showed ${at}.`);
  }
  if (await page.locator('[data-portal-banner]').count() !== 1) throw new RunError('PORTAL_SCHEMA_CHANGED', step, 'The demo portal banner is missing.');
  return { version, page: at };
}

async function fillPage(page, def, flat, manifest, check) {
  await inspect(page, def.id, 'fill');
  const mapped = new Set(def.fields.map((f) => f.key));
  // A required control the mapping does not know is a changed form: stop before writing anything.
  const required = await page.locator('main [data-field][required]').evaluateAll((els) => els.map((e) => e.getAttribute('data-field')));
  const unknown = required.filter((k) => !mapped.has(k));
  if (unknown.length) throw new RunError('PORTAL_SCHEMA_CHANGED', 'fill', `The portal asks a new required question (${unknown[0]}). The mapping needs an update; nothing was guessed.`, { fieldPath: unknown[0] });
  for (const f of def.fields) {
    check();
    const v = f.value(flat, manifest);
    if (v === undefined) continue;
    const loc = await one(page, `main [data-field="${f.key}"]`, 'fill', f.key);
    if (!(await loc.isVisible()) || !(await loc.isEnabled())) throw new RunError('PORTAL_SCHEMA_CHANGED', 'fill', `The control for ${f.key} is not available.`, { fieldPath: f.key });
    let got;
    if (f.kind === 'checkbox') { await loc.setChecked(!!v); got = await loc.isChecked(); }
    else if (f.kind === 'select') { await loc.selectOption({ value: v }); got = await loc.inputValue(); }
    else { await loc.fill(v); got = await loc.inputValue(); }
    const ok = f.kind === 'checkbox' ? got === !!v : norm(got) === norm(v);
    if (!ok) throw new RunError('READBACK_MISMATCH', 'fill', `The portal did not keep the value entered for ${f.key}.`, { fieldPath: f.key });
  }
  const next = await one(page, 'main [data-action="next"]', 'fill', 'next');
  await Promise.all([page.waitForLoadState('load'), next.click()]);
  await page.waitForSelector('main[data-page]');
  await inspect(page, def.next, 'fill');
}

export const demoAdapter = {
  describe: () => ({ id: ADAPTER_ID, version: MAP_VERSION, mode: 'demo', readiness: 'available' }),
  inspect,

  // Fills every page and uploads the files. Resolves when the portal's review page is showing.
  async prepare(page, { flat, manifest, files, emit, check }) {
    emit('fill', 'started');
    for (const def of PAGES) await fillPage(page, def, flat, manifest, check);
    emit('fill', 'complete');

    emit('upload', 'started');
    check();
    for (const role of FILE_ROLES) {
      const a = manifest.attachments.find((x) => x.role === role);
      const input = await one(page, `main input[type="file"][data-role="${role}"]`, 'upload', role);
      await input.setInputFiles({ name: a.filename, mimeType: a.mimeType, buffer: Buffer.from(files[role].bytes) }, { timeout: 20000 });
    }
    const upload = await one(page, 'main [data-action="upload"]', 'upload', 'upload');
    await Promise.all([page.waitForLoadState('load'), upload.click({ timeout: 20000 })]);
    await page.waitForSelector('main[data-page]');
    await inspect(page, 'documents', 'upload');
    const rejected = page.locator('[data-upload-error]');
    if (await rejected.count()) throw new RunError('UPLOAD_REJECTED', 'upload', `The demo portal rejected the upload: ${norm(await rejected.textContent())}`);
    for (const role of FILE_ROLES) await one(page, `[data-upload-ack="${role}"]`, 'upload', role);
    emit('upload', 'complete');

    check();
    const next = await one(page, 'main [data-action="next"]', 'upload', 'next');
    await Promise.all([page.waitForLoadState('load'), next.click()]);
    await inspect(page, 'review', 'review');
  },

  // Compares the portal's own review page (built from what it received) with the package.
  async compare(page, { flat, manifest }) {
    for (const def of PAGES) {
      for (const f of def.fields) {
        const v = f.value(flat, manifest);
        if (v === undefined) continue;
        const cell = await one(page, `[data-review="${f.key}"]`, 'review', f.key);
        if (norm(await cell.textContent()) !== norm(reviewText(f, v))) throw new RunError('REVIEW_MISMATCH', 'review', `The portal review shows a different value for ${f.key}.`, { fieldPath: f.key });
      }
    }
    const filesSeen = [];
    for (const a of manifest.attachments) {
      const row = await one(page, `[data-review-file="${a.role}"]`, 'review', a.role);
      const name = norm(await row.locator('[data-file-name]').textContent());
      const size = Number(norm(await row.locator('[data-file-size]').textContent()));
      const sha = norm(await row.locator('[data-file-sha256]').textContent());
      if (name !== a.filename || size !== a.sizeBytes || sha !== a.sha256) throw new RunError('REVIEW_MISMATCH', 'review', `The portal received a different ${a.role} file than the package holds.`, { fieldPath: `attachments.${a.role}` });
      filesSeen.push({ role: a.role, sizeBytes: size, sha256: sha });
    }
    return { files: filesSeen };
  },

  // Clicks submit exactly once (never retried), then reads and verifies the receipt.
  async submit(page, { manifest, emit, check }) {
    check();
    const hash = await one(page, 'main [data-field="reviewedPayloadHash"]', 'submit', 'reviewedPayloadHash');
    await hash.fill(manifest.payloadHash);
    const confirm = await one(page, 'main [data-field="demoTransfer"]', 'submit', 'demoTransfer');
    await confirm.check();
    const button = await one(page, 'main [data-action="submit-demo"]', 'submit', 'submit');
    check();
    emit('submit', 'started');
    try {
      await Promise.all([page.waitForLoadState('load'), button.click({ noWaitAfter: false })]);
      await page.waitForSelector('main[data-page="receipt"]', { timeout: 10000 });
    } catch {
      // The click happened; whether the portal recorded it is unknown. Never click again.
      throw new RunError('SUBMIT_UNCONFIRMED', 'submit', 'The demo portal did not confirm the submission, so the outcome is unknown. It was not retried.');
    }
    emit('submit', 'complete');
    emit('verify', 'started');
    await inspect(page, 'receipt', 'verify');
    const read = async (k) => norm(await (await one(page, `[data-receipt="${k}"]`, 'verify', `receipt.${k}`)).textContent());
    const receipt = { reference: await read('reference'), state: await read('state'), target: await read('target'), payloadHash: await read('payload-hash'), receivedAt: await read('received-at') };
    if (receipt.reference !== `DEMO-${manifest.attemptId}` || receipt.state !== 'received-demo' || receipt.target !== 'controlled-test-portal' || receipt.payloadHash !== manifest.payloadHash) {
      throw new RunError('RECEIPT_MISMATCH', 'verify', 'The demo receipt does not match this package, so the result could not be verified.');
    }
    emit('verify', 'complete');
    return receipt;
  },

  // A demo run has nothing external to reconcile with: an unconfirmed run stays unknown.
  async reconcile() { return { outcome: 'unknown' }; },
};
