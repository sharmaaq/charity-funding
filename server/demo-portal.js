// The controlled test portal (spec section 9): a simplified model of an online grant application, owned by this
// project. It is NOT a Garfield Weston or Blackbaud service and is never reachable from the internet: each run starts
// its own listener on 127.0.0.1 with an unguessable token, and closes it when the run ends.
//
// It behaves like an ordinary server-rendered form site so the runner exercises real browser behaviour: session cookie,
// CSRF token in every form, normal form POSTs and redirects, multipart file upload, its own validation, a review page
// built from what it actually received (including SHA-256 of the received bytes) and exactly one receipt per attempt.
// The page uses no JavaScript.
//
// `faults` exists only for tests (tests/integration). The public API never passes it.
import http from 'node:http';
import crypto from 'node:crypto';
import busboy from 'busboy';

export const PORTAL_VERSION = 'gwf-demo-v1';
export const PORTAL_TARGET = 'controlled-test-portal';
export const RECEIPT_STATE = 'received-demo';

const YESNO = [['yes', 'Yes'], ['no', 'No']];
// The portal's own form definition. Keys are this portal's stable data-field names (deliberately the canonical IDs).
export const PORTAL_PAGES = Object.freeze([
  { id: 'organisation', title: 'Organisation and contact', next: 'request', fields: [
    { key: 'org.name', label: 'Organisation name', kind: 'text', required: true },
    { key: 'org.type', label: 'Legal status', kind: 'select', required: true, options: [['registered-charity', 'Registered charity'], ['synthetic-registered-charity', 'Registered charity (synthetic demo)'], ['exempt', 'Exempt charity'], ['excepted', 'Excepted charity']] },
    { key: 'org.charityNumber', label: 'Registration number (registered charities)', kind: 'text' },
    { key: 'syntheticApplicant', label: 'This is the synthetic demo applicant', kind: 'checkbox' },
    { key: 'org.address', label: 'Address', kind: 'textarea', required: true },
    { key: 'org.postcode', label: 'Postcode', kind: 'text', required: true },
    { key: 'org.website', label: 'Website', kind: 'text' },
    { key: 'contact.firstName', label: 'Contact first name', kind: 'text', required: true },
    { key: 'contact.lastName', label: 'Contact last name', kind: 'text', required: true },
    { key: 'contact.role', label: 'Contact role', kind: 'text', required: true },
    { key: 'contact.employment', label: 'Contact is', kind: 'select', required: true, options: [['staff', 'Paid staff'], ['volunteer', 'Volunteer']] },
    { key: 'contact.email', label: 'Contact email', kind: 'text', required: true },
    { key: 'contact.phone', label: 'Contact telephone', kind: 'text', required: true },
  ] },
  { id: 'request', title: 'Funding request', next: 'compliance', fields: [
    { key: 'request.type', label: 'Type of funding', kind: 'select', required: true, options: [['core', 'Operating / core costs']] },
    { key: 'request.title', label: 'Request title', kind: 'text', required: true },
    { key: 'request.amountMode', label: 'Amount', kind: 'select', required: true, options: [['specified', 'A specific amount'], ['discretion', 'Funder discretion']] },
    { key: 'request.amountPence', label: 'Amount requested (GBP, pounds)', kind: 'text' },
    { key: 'request.start', label: 'Funding period starts', kind: 'date', required: true },
    { key: 'request.end', label: 'Funding period ends', kind: 'date', required: true },
    { key: 'org.geography', label: 'Where do you work?', kind: 'textarea', required: true },
    { key: 'work.annualPeople', label: 'People supported in a typical year', kind: 'number', required: true },
    { key: 'request.people', label: 'People the funding would reach', kind: 'number', required: true },
    { key: 'finance.historicalIncomePence', label: 'Income in the latest accounts (GBP, pounds)', kind: 'text', required: true },
    { key: 'finance.reportingEnd', label: 'Latest accounts: year ended', kind: 'date', required: true },
  ] },
  { id: 'compliance', title: 'Eligibility and declarations', next: 'documents', fields: [
    { key: 'eligibility.previousApplication', label: 'Applied to this funder before?', kind: 'select', required: true, options: YESNO },
    { key: 'compliance.ukTaxResident', label: 'Resident in the UK for tax purposes?', kind: 'select', required: true, options: YESNO },
    { key: 'compliance.safeguarding', label: 'Safeguarding policy in place?', kind: 'select', required: true, options: YESNO },
    { key: 'compliance.safeguardingExplanation', label: 'If not, why not?', kind: 'textarea' },
    { key: 'compliance.demographics', label: 'Demographic information', kind: 'textarea', required: true },
    { key: 'compliance.contactPermission', label: 'May the funder contact you about other opportunities?', kind: 'select', options: YESNO },
  ] },
]);
const PAGE_IDS = ['start', ...PORTAL_PAGES.map((p) => p.id), 'documents', 'review', 'receipt'];
const FILE_ROLES = [['proposal', 'Proposal (PDF)', [[0x25, 0x50, 0x44, 0x46, 0x2d]]], ['accounts', 'Latest accounts (PDF or Word)', [[0x25, 0x50, 0x44, 0x46, 0x2d], [0x50, 0x4b, 0x03, 0x04]]]];
const MAX_UPLOAD = 10 * 1024 * 1024;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const POUNDS_RE = /^\d{1,9}(\.\d{2})?$/;

// Independent validation: this portal's own rules, not the app's.
function validatePage(page, data) {
  const errors = {};
  for (const f of page.fields) {
    const v = data[f.key];
    if (f.kind === 'checkbox') continue;
    if (f.required && (v === undefined || v === '')) { errors[f.key] = 'This field is required.'; continue; }
    if (v === undefined || v === '') continue;
    if (f.kind === 'select' && !f.options.some(([o]) => o === v)) errors[f.key] = 'Choose one of the options.';
    if (f.kind === 'date' && !isDate(v)) errors[f.key] = 'Enter a date as YYYY-MM-DD.';
    if (f.kind === 'number' && !/^[1-9]\d{0,7}$/.test(v)) errors[f.key] = 'Enter a whole number greater than zero.';
    if (v.length > 4000) errors[f.key] = 'This answer is too long.';
  }
  if (page.id === 'organisation') {
    if (data['contact.email'] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data['contact.email'])) errors['contact.email'] = 'Enter an email address.';
    if (data['org.type'] === 'registered-charity' && data.syntheticApplicant !== 'on' && !/^\d{6,8}$/.test(data['org.charityNumber'] || '')) errors['org.charityNumber'] = 'Enter the registration number.';
    if (data['org.type'] === 'synthetic-registered-charity' && data.syntheticApplicant !== 'on') errors.syntheticApplicant = 'The synthetic status is only for the synthetic demo applicant.';
  }
  if (page.id === 'request') {
    const amount = data['request.amountPence'] || '';
    if (data['request.amountMode'] === 'specified') {
      if (!POUNDS_RE.test(amount) || Number(amount) <= 0) errors['request.amountPence'] = 'Enter an amount in pounds, for example 50000.00.';
      else if (Number(amount) >= 100000) errors['request.amountPence'] = 'Regular Grants are for requests below GBP 100,000.';
    } else if (amount !== '') errors['request.amountPence'] = 'Leave the amount empty when the funder decides it.';
    if (data['finance.historicalIncomePence'] && !POUNDS_RE.test(data['finance.historicalIncomePence'])) errors['finance.historicalIncomePence'] = 'Enter an amount in pounds.';
    if (isDate(data['request.start']) && isDate(data['request.end']) && data['request.end'] <= data['request.start']) errors['request.end'] = 'The period must end after it starts.';
  }
  if (page.id === 'compliance') {
    if (data['compliance.safeguarding'] === 'no' && !data['compliance.safeguardingExplanation']) errors['compliance.safeguardingExplanation'] = 'Explain why there is no safeguarding policy.';
  }
  return errors;
}

// options: { attemptId, payloadHash, now?: () => Date, faults? }
// Resolves { origin, startUrl, close(), state } once listening on 127.0.0.1.
export async function startDemoPortal({ attemptId, payloadHash, now = () => new Date(), faults = {} }) {
  const token = crypto.randomBytes(24).toString('hex');
  const base = `/portal/${token}`;
  const state = { sessionId: null, csrf: null, pages: {}, files: {}, receipt: null, submits: 0, requests: [] };
  const sockets = new Set();

  const layout = (pageId, title, body) => `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>DEMO test portal: ${esc(title)}</title>
<style>body{font:16px/1.4 system-ui,sans-serif;margin:24px;max-width:760px}label{display:block;margin-top:12px;font-weight:600}input,select,textarea{display:block;width:100%;padding:6px;font:inherit}input[type=checkbox]{display:inline;width:auto}.err{color:#a00}.banner{background:#ffe9a8;padding:8px}</style></head>
<body><main data-portal-version="${PORTAL_VERSION}" data-portal-token="${token}" data-page="${pageId}">
<p class="banner" data-portal-banner>DEMO: controlled test portal run by the YOR Plc demo. This is not a Garfield Weston Foundation or Blackbaud service, and nothing entered here is sent to any funder.</p>
<h1>DEMO test portal</h1><h2 data-page-title>${esc(title)}</h2>${body}</main></body></html>`;

  const control = (f, value, error) => {
    const id = `f-${f.key.replace(/\W/g, '-')}`;
    const attrs = `id="${id}" name="${esc(f.key)}" data-field="${esc(f.key)}"${f.required ? ' required' : ''}${error ? ` aria-invalid="true" aria-describedby="${id}-err"` : ''}`;
    let input;
    if (f.kind === 'textarea') input = `<textarea ${attrs} rows="3">${esc(value)}</textarea>`;
    else if (f.kind === 'select') input = `<select ${attrs}><option value="">Choose…</option>${f.options.map(([v, l]) => `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    else if (f.kind === 'checkbox') return `<p><input type="checkbox" ${attrs}${value === 'on' ? ' checked' : ''}> <label for="${id}" style="display:inline">${esc(f.label)}</label>${error ? `<span class="err" id="${id}-err" data-portal-error data-error-for="${esc(f.key)}">${esc(error)}</span>` : ''}</p>`;
    else input = `<input type="${f.kind === 'date' ? 'date' : f.kind === 'number' ? 'number' : 'text'}" ${attrs} value="${esc(value)}">`;
    return `<label for="${id}">${esc(f.label)}</label>${input}${error ? `<p class="err" id="${id}-err" data-portal-error data-error-for="${esc(f.key)}">${esc(error)}</p>` : ''}`;
  };

  const pageFields = (page) => {
    let fields = page.fields.filter((f) => f.key !== faults.missingField);
    const dup = fields.find((f) => f.key === faults.duplicateField);
    if (dup) fields = [...fields, dup];
    if (faults.extraRequiredField && page.id === faults.extraRequiredField.page) fields = [...fields, { key: faults.extraRequiredField.key, label: 'A new required question', kind: 'text', required: true }];
    return fields;
  };

  const formPage = (page, data = {}, errors = {}) => layout(page.id, page.title, `
${Object.keys(errors).length ? `<p class="err" role="alert" data-portal-errors>Correct the highlighted answers.</p>` : ''}
<form method="post" action="${base}/${page.id}"><input type="hidden" name="_csrf" value="${state.csrf}">
${pageFields(page).map((f) => control(f, data[f.key] ?? '', errors[f.key])).join('\n')}
<p><button type="submit" data-action="next">Save and continue</button></p></form>`);

  const documentsPage = (error) => layout('documents', 'Documents', `
${error ? `<p class="err" role="alert" data-upload-error>${esc(error)}</p>` : ''}
<form method="post" action="${base}/documents" enctype="multipart/form-data"><input type="hidden" name="_csrf" value="${state.csrf}">
${FILE_ROLES.map(([role, label]) => `<label for="file-${role}">${esc(label)}</label><input type="file" id="file-${role}" name="${role}" data-role="${role}">`).join('\n')}
<p><button type="submit" data-action="upload">Upload files</button></p></form>
${FILE_ROLES.filter(([r]) => state.files[r]).map(([r]) => `<p data-upload-ack="${r}">Received ${esc(state.files[r].filename)}: ${state.files[r].size} bytes.</p>`).join('\n')}
${FILE_ROLES.every(([r]) => state.files[r]) ? `<p><a href="${base}/review" data-action="next">Continue to review</a></p>` : ''}`);

  const reviewPage = (error) => {
    const rows = PORTAL_PAGES.flatMap((p) => p.fields.map((f) => {
      const v = (state.pages[p.id] || {})[f.key];
      return `<tr><th scope="row">${esc(f.label)}</th><td data-review="${esc(f.key)}">${esc(f.kind === 'checkbox' ? (v === 'on' ? 'yes' : 'no') : v ?? '')}</td></tr>`;
    })).join('\n');
    const files = FILE_ROLES.map(([r, l]) => { const x = state.files[r]; return `<tr data-review-file="${r}"><th scope="row">${esc(l)}</th><td data-file-name>${esc(x ? x.filename : '')}</td><td data-file-size>${x ? x.size : ''}</td><td data-file-sha256>${x ? x.sha256 : ''}</td></tr>`; }).join('\n');
    return layout('review', 'Review your application', `
${error ? `<p class="err" role="alert" data-portal-errors>${esc(error)}</p>` : ''}
<table><tbody>${rows}</tbody></table>
<h3>Files received</h3><table><thead><tr><th>Role</th><th>Name</th><th>Bytes</th><th>SHA-256 computed by this portal</th></tr></thead><tbody>${files}</tbody></table>
<form method="post" action="${base}/submit"><input type="hidden" name="_csrf" value="${state.csrf}">
<label for="f-hash">Reviewed package hash</label><input type="text" id="f-hash" name="reviewedPayloadHash" data-field="reviewedPayloadHash" required>
<p><input type="checkbox" id="f-transfer" name="demoTransfer" data-field="demoTransfer"> <label for="f-transfer" style="display:inline">Submit this demo application to the test portal</label></p>
<p><button type="submit" data-action="submit-demo">Submit demo application</button></p></form>`);
  };

  const receiptPage = () => {
    const r = state.receipt;
    const hash = faults.receiptHashWrong ? sha256(`${r.payloadHash}x`) : r.payloadHash;
    return layout('receipt', 'Demo application received', `
<dl><dt>Reference</dt><dd data-receipt="reference">${esc(r.reference)}</dd>
<dt>Status</dt><dd data-receipt="state">${RECEIPT_STATE}</dd>
<dt>Target</dt><dd data-receipt="target">${PORTAL_TARGET}</dd>
<dt>Package hash</dt><dd data-receipt="payload-hash">${esc(hash)}</dd>
<dt>Received at</dt><dd data-receipt="received-at">${esc(r.receivedAt)}</dd></dl>
<p>This receipt comes from the controlled test portal only. Nothing was sent to Garfield Weston.</p>`);
  };

  const send = (res, status, html, headers = {}) => { res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'", Connection: 'close', ...headers }); res.end(html); };
  const redirect = (res, to, headers = {}) => { res.writeHead(303, { Location: `${base}/${to}`, 'Cache-Control': 'no-store', Connection: 'close', ...headers }); res.end(); };
  const cookieOf = (req) => (/(?:^|;\s*)demo_sid=([0-9a-f]{48})/.exec(req.headers.cookie || '') || [])[1];

  function readForm(req) {
    return new Promise((resolve, reject) => {
      let s = '';
      req.setEncoding('utf8');
      req.on('data', (c) => { s += c; if (s.length > 200000) { reject(new Error('too large')); req.destroy(); } });
      req.on('end', () => resolve(Object.fromEntries(new URLSearchParams(s))));
      req.on('error', reject);
    });
  }
  function readUpload(req) {
    return new Promise((resolve, reject) => {
      const fields = {};
      const files = {};
      let bb;
      try { bb = busboy({ headers: req.headers, limits: { files: 2, fileSize: MAX_UPLOAD, fields: 2 } }); } catch (e) { reject(e); return; }
      bb.on('field', (n, v) => { fields[n] = v; });
      bb.on('file', (name, stream, info) => {
        const chunks = [];
        let truncated = false;
        stream.on('data', (c) => chunks.push(c));
        stream.on('limit', () => { truncated = true; });
        stream.on('close', () => { if (info.filename) files[name] = { filename: info.filename, mimeType: info.mimeType, buf: Buffer.concat(chunks), truncated }; });
      });
      bb.on('close', () => resolve({ fields, files }));
      bb.on('error', reject);
      req.pipe(bb);
    });
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      state.requests.push(`${req.method} ${url.pathname.replace(token, ':token')}`);
      if (!url.pathname.startsWith(`${base}/`)) { send(res, 404, 'Not found'); return; }
      const pageId = url.pathname.slice(base.length + 1);
      if (!PAGE_IDS.includes(pageId) && pageId !== 'submit') { send(res, 404, 'Not found'); return; }
      if (faults.hangOn === pageId) return; // test only: never answer
      if (pageId === 'start' && req.method === 'GET') {
        if (!state.sessionId) { state.sessionId = crypto.randomBytes(24).toString('hex'); state.csrf = crypto.randomBytes(24).toString('hex'); }
        send(res, 200, layout('start', 'Start a demo application', `<p>Regular Grants: core costs (demo). Answer each page, upload two documents, review and submit.</p><p><a href="${base}/organisation" data-action="next">Start</a></p>`),
          { 'Set-Cookie': `demo_sid=${state.sessionId}; HttpOnly; SameSite=Strict; Path=${base}` });
        return;
      }
      if (!state.sessionId || cookieOf(req) !== state.sessionId) { send(res, 403, layout('error', 'Session required', '<p data-portal-errors>Start the application first.</p>')); return; }

      const page = PORTAL_PAGES.find((p) => p.id === pageId);
      if (page) {
        if (req.method === 'GET') { send(res, 200, formPage(page, state.pages[page.id])); return; }
        const data = await readForm(req);
        if (data._csrf !== state.csrf) { send(res, 403, layout('error', 'Form expired', '<p data-portal-errors>The form token is not valid.</p>')); return; }
        delete data._csrf;
        const allowed = new Set(pageFields(page).map((f) => f.key));
        for (const k of Object.keys(data)) if (!allowed.has(k)) delete data[k];
        const errors = validatePage({ ...page, fields: pageFields(page) }, data);
        if (Object.keys(errors).length) { send(res, 422, formPage(page, data, errors)); return; }
        state.pages[page.id] = data;
        redirect(res, page.next);
        return;
      }
      if (pageId === 'documents') {
        if (req.method === 'GET') { send(res, 200, documentsPage()); return; }
        const { fields, files } = await readUpload(req);
        if (fields._csrf !== state.csrf) { send(res, 403, layout('error', 'Form expired', '<p data-portal-errors>The form token is not valid.</p>')); return; }
        if (faults.rejectUpload) { send(res, 422, documentsPage('The demo portal could not accept these files.')); return; }
        for (const [role, label, magics] of FILE_ROLES) {
          const f = files[role];
          if (!f) { send(res, 422, documentsPage(`${label} is required.`)); return; }
          if (f.truncated || f.buf.length === 0) { send(res, 422, documentsPage(`${label} must be between 1 byte and 10 MB.`)); return; }
          if (!magics.some((m) => m.every((b, i) => f.buf[i] === b))) { send(res, 422, documentsPage(`${label} is not a PDF or Word file.`)); return; }
        }
        for (const [role] of FILE_ROLES) state.files[role] = { filename: files[role].filename, size: files[role].buf.length, sha256: sha256(files[role].buf) };
        redirect(res, 'documents');
        return;
      }
      if (pageId === 'review' && req.method === 'GET') { send(res, 200, reviewPage()); return; }
      if (pageId === 'submit' && req.method === 'POST') {
        const data = await readForm(req);
        if (data._csrf !== state.csrf) { send(res, 403, layout('error', 'Form expired', '<p data-portal-errors>The form token is not valid.</p>')); return; }
        state.submits += 1;
        const missing = PORTAL_PAGES.filter((p) => !state.pages[p.id] || Object.keys(validatePage(p, state.pages[p.id])).length).map((p) => p.title);
        if (missing.length) { send(res, 422, reviewPage(`These pages are incomplete: ${missing.join(', ')}.`)); return; }
        if (!FILE_ROLES.every(([r]) => state.files[r])) { send(res, 422, reviewPage('Both documents are required.')); return; }
        if (data.demoTransfer !== 'on') { send(res, 422, reviewPage('Tick the box to submit the demo application.')); return; }
        if (data.reviewedPayloadHash !== payloadHash) { send(res, 422, reviewPage('The reviewed package hash does not match this application.')); return; }
        if (state.receipt) {
          if (state.receipt.payloadHash !== payloadHash) { send(res, 409, reviewPage('This attempt was already submitted with a different package.')); return; }
        } else {
          state.receipt = { reference: `DEMO-${attemptId}`, payloadHash, receivedAt: now().toISOString(), files: { ...state.files } };
        }
        if (faults.dropSubmitResponse) { req.socket.destroy(); return; } // test only: the receipt exists but the answer is lost
        redirect(res, 'receipt');
        return;
      }
      if (pageId === 'receipt' && req.method === 'GET') {
        if (!state.receipt) { send(res, 404, layout('error', 'No receipt', '<p data-portal-errors>Nothing has been submitted.</p>')); return; }
        send(res, 200, receiptPage());
        return;
      }
      send(res, 405, 'Method not allowed');
    } catch {
      if (!res.headersSent) send(res, 500, 'Server error');
      else res.destroy();
    }
  });
  server.on('connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  return {
    origin,
    startUrl: `${origin}${base}/start`,
    state,
    async close() {
      for (const s of sockets) s.destroy();
      await new Promise((r) => server.close(() => r()));
    },
  };
}
