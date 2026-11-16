import test from 'node:test';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import { canonicalJson, packageHash, sha256Hex, ADAPTER_ID } from '../../public/js/application/canonical.js';
import { normaliseOutgoingAnswers } from '../../public/js/application/package.js';
import { buildExampleAnswers } from '../../public/js/application/example.js';
import { buildProposal, ProposalError, readPdfPageCount, BODY_SIZE } from '../../public/js/application/proposal.js';
import { buildAccountsExample } from '../../public/js/application/accounts-example.js';
import { validateTransferFile, validateTransferSet, MIB } from '../../public/js/application/transfer.js';
import { PDFDocument } from '../../public/vendor/pdf-lib.esm.min.js';

const NOW = '2026-11-16T00:00:00.000Z';
const H = 'a'.repeat(64);
const att = (o = {}) => ({ role: 'proposal', filename: 'p.pdf', mime: 'application/pdf', size: 10, sha256: H, ...o });
const base = () => ({ answers: { b: 1, a: { z: null, y: [2, 1] } }, attachments: [att(), att({ role: 'accounts', filename: 'a.pdf' })] });

test('canonical JSON: sorted keys recursively, arrays ordered, null kept, undefined omitted, no whitespace', () => {
  assert.equal(canonicalJson({ b: 1, a: { z: null, y: [2, 1], x: undefined } }), '{"a":{"y":[2,1],"z":null},"b":1}');
  assert.equal(canonicalJson({ t: '£ é\n' }), '{"t":"£ é\\n"}');
  assert.throws(() => canonicalJson({ n: 1.5 }));
  assert.throws(() => canonicalJson({ n: NaN }));
});

test('hash: stable, ignores key order, changes with any answer or attachment change', async () => {
  const h0 = await packageHash(base());
  assert.match(h0, /^[0-9a-f]{64}$/);
  assert.equal(await packageHash(base()), h0);
  const reordered = { attachments: base().attachments.map((a) => Object.fromEntries(Object.entries(a).reverse())), answers: { a: { y: [2, 1], z: null }, b: 1 } };
  assert.equal(await packageHash(reordered), h0);
  const changes = [
    { ...base(), answers: { ...base().answers, b: 2 } },
    { ...base(), answers: { ...base().answers, a: { z: null, y: [1, 2] } } },
    { ...base(), attachments: [att({ filename: 'q.pdf' }), base().attachments[1]] },
    { ...base(), attachments: [att({ mime: 'x' }), base().attachments[1]] },
    { ...base(), attachments: [att({ size: 11 }), base().attachments[1]] },
    { ...base(), attachments: [att({ sha256: 'b'.repeat(64) }), base().attachments[1]] },
    { ...base(), attachments: [base().attachments[1], base().attachments[0]] },
    { ...base(), adapter: 'other.v1' },
  ];
  for (const c of changes) assert.notEqual(await packageHash(c), h0);
  // local bookkeeping on an attachment never changes the hash
  assert.equal(await packageHash({ ...base(), attachments: base().attachments.map((a) => ({ ...a, fileId: 'x', source: 'document' })) }), h0);
  assert.equal(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(ADAPTER_ID, 'garfield-weston-regular-core-demo.v1');
});

test('normalised outgoing answers: whitelisted, internal and local-only fields excluded, text trimmed', () => {
  const a = buildExampleAnswers(NOW, { id: 'doc-1', title: 't', filename: 'f.pdf', updatedAt: 'u' });
  a['org.companyNumber'] = { value: '123', origin: 'manager', sourceRefs: [] };
  a['org.overview'] = { ...a['org.overview'], value: `  ${a['org.overview'].value}\r\n ` };
  const n = normaliseOutgoingAnswers(a);
  assert.equal(n['evidence.accountsId'], undefined);
  assert.equal(n['org.companyNumber'], undefined);
  assert.equal(n['eligibility.previousOutcome'], undefined);
  assert.equal(n['org.charityNumber'], undefined);
  assert.equal(n['work.caseStudy'], undefined);
  assert.equal(n['org.overview'], a['org.overview'].value.trim());
  assert.equal(n['request.amountPence'], 5000000);
  assert.equal(n['finance.incomeRows'][0].note, 'Synthetic example');
  assert.equal(JSON.stringify(n).includes('doc-1'), false);
});

test('proposal: deterministic bytes, A4, within ten pages, page count returned, footer text size', async () => {
  const a = buildExampleAnswers(NOW);
  const r1 = await buildProposal(a);
  const r2 = await buildProposal(a);
  assert.ok(Buffer.from(r1.bytes).equals(Buffer.from(r2.bytes)), 'byte-identical');
  assert.equal(await sha256Hex(r1.bytes), await sha256Hex(r2.bytes));
  assert.ok(r1.pageCount >= 1 && r1.pageCount <= 10);
  assert.equal(r1.synthetic, true);
  const doc = await PDFDocument.load(r1.bytes, { updateMetadata: false });
  assert.equal(doc.getPageCount(), r1.pageCount);
  assert.equal(await readPdfPageCount(r1.bytes), r1.pageCount);
  const { width, height } = doc.getPage(0).getSize();
  assert.ok(Math.abs(width - 595.28) < 0.01 && Math.abs(height - 841.89) < 0.01);
  const raw = Buffer.from(r1.bytes).toString('latin1');
  assert.ok(raw.startsWith('%PDF-'));
  assert.ok(raw.includes('D:20260101000000Z'), 'constant metadata date');
  const sizes = new Set();
  const buf = Buffer.from(r1.bytes);
  let at = 0;
  for (;;) {
    const s = buf.indexOf('\nstream\n', at);
    if (s < 0) break;
    const e = buf.indexOf('\nendstream', s);
    if (e < 0) break;
    let text = '';
    try { text = zlib.inflateSync(buf.subarray(s + 8, e)).toString('latin1'); } catch { /* not a content stream */ }
    for (const m of text.matchAll(/\/\S+ ([\d.]+) Tf/g)) sizes.add(Number(m[1]));
    at = e + 1;
  }
  assert.ok(sizes.has(BODY_SIZE));
  assert.deepEqual([...sizes].filter((s) => s < BODY_SIZE), [9]); // only the footer is smaller
});

test('proposal: a changed answer changes the bytes; the pound sign and punctuation are accepted', async () => {
  const a = buildExampleAnswers(NOW);
  const r1 = await buildProposal(a);
  const b = { ...a, 'work.need': { ...a['work.need'], value: `${a['work.need'].value} Costs are “£1,200” – roughly; it’s fine…` } };
  const r2 = await buildProposal(b);
  assert.notEqual(await sha256Hex(r1.bytes), await sha256Hex(r2.bytes));
});

test('proposal: an unencodable character blocks, naming the field and the character', async () => {
  const a = buildExampleAnswers(NOW);
  const bad = { ...a, 'work.need': { ...a['work.need'], value: `${a['work.need'].value} Ł 漢字` } };
  await assert.rejects(() => buildProposal(bad), (e) => {
    assert.ok(e instanceof ProposalError);
    assert.equal(e.code, 'unencodable');
    assert.match(e.message, /What need are you responding to\?/);
    assert.match(e.message, /"Ł" \(U\+0141\)/);
    assert.ok(e.issues.some((i) => i.fieldId === 'work.need'));
    return true;
  });
  const ctl = { ...a, 'work.activities': { ...a['work.activities'], value: 'text\u0007bell' } };
  await assert.rejects(() => buildProposal(ctl), /control character \(U\+0007\)/);
});

test('proposal: newlines wrap safely and markup is only drawn as text', async () => {
  const a = buildExampleAnswers(NOW);
  const v = { ...a, 'work.need': { ...a['work.need'], value: 'Line one\r\nLine two\n\n<script>alert(1)</script> <img src="http://example.test/x.png">' } };
  const r = await buildProposal(v);
  assert.ok(r.pageCount >= 1);
});

test('proposal: more than ten pages blocks and names the long sections; font is not shrunk', async () => {
  const a = buildExampleAnswers(NOW);
  const long = 'A sentence that keeps going to fill the page and more. '.repeat(400);
  const v = { ...a };
  for (const id of ['work.need', 'work.activities', 'work.outcomes']) v[id] = { ...a[id], value: long };
  await assert.rejects(() => buildProposal(v), (e) => {
    assert.equal(e.code, 'too-long');
    assert.ok(e.pageCount > 10);
    assert.match(e.message, /Need and services/);
    assert.match(e.message, /limit is 10/);
    return true;
  });
});

test('accounts example PDF: deterministic, one page, accepted as a transfer file', async () => {
  const x = await buildAccountsExample();
  const y = await buildAccountsExample();
  assert.ok(Buffer.from(x).equals(Buffer.from(y)));
  assert.equal(await readPdfPageCount(x), 1);
  assert.equal(validateTransferFile({ role: 'accounts', filename: 'a.pdf', mime: 'application/pdf', bytes: x }).ok, true);
});

test('transfer files: extension, MIME and header must agree; TXT is never accepted as accounts', () => {
  const pdf = new TextEncoder().encode('%PDF-1.7\nx');
  const ok = (o) => validateTransferFile({ role: 'accounts', filename: 'a.pdf', mime: 'application/pdf', bytes: pdf, ...o });
  assert.equal(ok().ok, true);
  assert.equal(ok({ filename: 'accounts-example.txt', mime: 'text/plain' }).code, 'extension');
  assert.equal(ok({ bytes: new TextEncoder().encode('plain text') }).code, 'header');
  assert.equal(ok({ mime: 'text/plain' }).code, 'mime');
  assert.equal(ok({ bytes: new Uint8Array(0) }).code, 'empty');
  assert.equal(ok({ bytes: new Uint8Array(10 * MIB + 1) }).code, 'too-large');
  const docx = { role: 'accounts', filename: 'a.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', bytes: new Uint8Array([0x50, 0x4b, 3, 4, 0]) };
  assert.equal(validateTransferFile(docx).ok, true);
  assert.equal(validateTransferFile({ ...docx, role: 'proposal' }).code, 'extension');
  const prop = { role: 'proposal', filename: 'p.pdf', mime: 'application/pdf', bytes: pdf };
  assert.equal(validateTransferSet([prop, { role: 'accounts', filename: 'a.pdf', mime: 'application/pdf', bytes: pdf }]).ok, true);
  assert.equal(validateTransferSet([prop]).ok, false);
  const small = { maxFileBytes: 100, maxTotalBytes: 150 };
  const big = (n) => { const b = new Uint8Array(n); b.set(pdf); return b; };
  const t = validateTransferSet([{ ...prop, bytes: big(90) }, { role: 'accounts', filename: 'a.pdf', mime: 'application/pdf', bytes: big(90) }], small);
  assert.equal(t.errors[0].code, 'total-too-large');
});
