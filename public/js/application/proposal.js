// The proposal PDF: a deterministic A4 document built from the confirmed answers with the vendored pdf-lib.
//
// - Standard Helvetica (decision R3): nothing is embedded and nothing is fetched. Every character is checked against
//   the font's encoding BEFORE anything is drawn, and anything it cannot print blocks the build with a message naming
//   the field and the character. The pound sign and ordinary punctuation are supported.
// - Body text is 11 points and is never shrunk to fit. Wrapping and pagination are explicit (this file measures and
//   breaks lines itself). More than ten pages blocks, naming the sections that are too long.
// - Answers are plain text and are only ever drawn as text: no markup is interpreted, and line breaks inside an answer
//   become line breaks in the page layout. Control characters other than newline and tab are rejected.
// - Deterministic: no clock, no random IDs. The same answers give byte-identical PDFs. Metadata dates are a constant.
import { PDFDocument, StandardFonts, rgb } from '../../vendor/pdf-lib.esm.min.js';
import { EXAMPLE_LABEL } from './example.js';
import { fieldById, financeTotals, formatGroupedNumber, formatPence, outgoingValues } from './schema.js';

export const PAGE = Object.freeze({ width: 595.28, height: 841.89, marginX: 56, top: 62, bottom: 70 });
export const BODY_SIZE = 11;
export const MAX_PAGES = 10;
// The generated proposal's file name: the applicant's name, lower-cased, plus -proposal.pdf (Your Place: your-place-proposal.pdf).
export const PROPOSAL_FILENAME = 'your-place-proposal.pdf';
export function proposalFilename(name) {
  const slug = String(name ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/g, '');
  return `${slug || 'charity'}-proposal.pdf`;
}
const LEAD = 15;
const H1 = 21;
const H2 = 14;
const FOOT = 9;
const FIXED_DATE = new Date('2026-01-01T00:00:00.000Z'); // a constant: never the build time
const CONTENT_W = PAGE.width - 2 * PAGE.marginX;
const USABLE_H = PAGE.height - PAGE.top - PAGE.bottom;

export class ProposalError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProposalError';
    this.code = code;
    Object.assign(this, details);
  }
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const fmtDate = (ymd) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || '');
  return m ? `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}` : 'Not provided';
};
const hex = (cp) => `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;

// Plain text for drawing: CRLF/CR become LF, tabs become spaces. Everything else is left for the encodability check.
const clean = (s) => String(s ?? '').replace(/\r\n?/g, '\n').replace(/\t/g, ' ');

// ---------------------------------------------------------------- content
function describe(values, answers) {
  const v = (id) => values[id];
  const text = (id) => (typeof v(id) === 'string' && v(id).trim() ? v(id) : null);
  const finance = financeTotals(v('finance.incomeRows'), v('finance.expenseRows'));
  const amount = v('request.amountMode') === 'specified' && Number.isSafeInteger(v('request.amountPence'))
    ? formatPence(v('request.amountPence'))
    : 'Funder discretion: no amount is stated (see the funding gap below)';
  const nonePara = (id) => text(id);
  const sections = [];

  sections.push({
    id: 'overview', title: '1. Request overview',
    blocks: [
      { kind: 'facts', rows: [
        ['Applicant', text('org.name') || 'The applicant'],
        ['Request', text('request.title')],
        ['Funding type', 'Operating and core costs'],
        ['Amount requested', amount],
        ['Funding period', `${fmtDate(v('request.start'))} to ${fmtDate(v('request.end'))}`],
        ['People reached (planned)', Number.isSafeInteger(v('request.people')) ? formatGroupedNumber(v('request.people')) : null],
        ['Where we work', text('org.geography')],
      ], fieldIds: ['org.name', 'request.title', 'request.amountPence', 'request.start', 'request.end', 'request.people', 'org.geography'] },
      { kind: 'para', heading: 'About the organisation', text: text('org.overview'), fieldId: 'org.overview' },
      { kind: 'para', heading: 'Why we are asking', text: text('request.reason'), fieldId: 'request.reason' },
    ],
  });
  sections.push({
    id: 'need', title: '2. Need and services',
    blocks: [
      { kind: 'para', heading: 'The need', text: text('work.need'), fieldId: 'work.need' },
      { kind: 'para', heading: 'What we will do', text: text('work.activities'), fieldId: 'work.activities' },
    ],
  });
  sections.push({
    id: 'impact', title: '3. Beneficiaries and impact measurement',
    blocks: [
      { kind: 'para', heading: 'Who benefits', text: text('work.beneficiaries'), fieldId: 'work.beneficiaries' },
      { kind: 'facts', rows: [['People supported in a typical year', Number.isSafeInteger(v('work.annualPeople')) ? formatGroupedNumber(v('work.annualPeople')) : null]], fieldIds: ['work.annualPeople'] },
      { kind: 'para', heading: 'How the numbers were counted', text: text('work.peopleNotes'), fieldId: 'work.peopleNotes', optional: true },
      { kind: 'para', heading: 'What will change, and how we will know', text: text('work.outcomes'), fieldId: 'work.outcomes' },
      { kind: 'para', heading: 'Case study', text: text('work.caseStudy'), fieldId: 'work.caseStudy', optional: true },
    ],
  });
  sections.push({
    id: 'inclusion', title: '4. Inclusion and partnerships',
    blocks: [
      { kind: 'para', heading: 'Inclusion and accessibility', text: text('work.inclusion'), fieldId: 'work.inclusion' },
      { kind: 'para', heading: 'Partnerships and referrals', text: nonePara('work.partnerships'), fieldId: 'work.partnerships' },
    ],
  });
  sections.push({
    id: 'team', title: '5. Team and governance',
    blocks: [{ kind: 'para', text: text('work.leadership'), fieldId: 'work.leadership' }],
  });
  const incomeRows = Array.isArray(v('finance.incomeRows')) ? v('finance.incomeRows') : [];
  const expenseRows = Array.isArray(v('finance.expenseRows')) ? v('finance.expenseRows') : [];
  const label = (r) => (r.note ? `${r.label} (${r.note})` : r.label);
  const money = (n) => (Number.isSafeInteger(n) ? formatPence(n) : 'Not provided');
  sections.push({
    id: 'tables', title: '6. Income and expenditure',
    blocks: [
      { kind: 'para', text: `Forecast period: ${fmtDate(v('finance.forecastStart'))} to ${fmtDate(v('finance.forecastEnd'))}. All amounts are in pounds sterling.`, fieldIds: ['finance.forecastStart', 'finance.forecastEnd'] },
      { kind: 'table', heading: 'Forecast income', fieldId: 'finance.incomeRows', cols: [{ head: 'Source' }, { head: 'Target', right: true }, { head: 'Secured', right: true }],
        rows: incomeRows.map((r) => [label(r), money(r.targetPence), money(r.securedPence)]),
        total: ['Total', formatPence(finance.targetPence), formatPence(finance.securedPence)] },
      { kind: 'table', heading: 'Forecast expenditure', fieldId: 'finance.expenseRows', cols: [{ head: 'Expenditure' }, { head: 'Amount', right: true }],
        rows: expenseRows.map((r) => [label(r), money(r.amountPence)]),
        total: ['Total', formatPence(finance.expensePence)] },
    ],
  });
  const shortfall = finance.targetSurplusPence >= 0 ? `${formatPence(finance.targetSurplusPence)} surplus` : `${formatPence(-finance.targetSurplusPence)} shortfall`;
  sections.push({
    id: 'gap', title: '7. Funding gap and fundraising',
    blocks: [
      { kind: 'facts', rows: [
        ['Planned expenditure', formatPence(finance.expensePence)],
        ['Income secured so far', formatPence(finance.securedPence)],
        ['Current unsecured gap', formatPence(finance.gapPence)],
        ['Target income compared with expenditure', shortfall],
        ['Income in latest accounts', Number.isSafeInteger(v('finance.historicalIncomePence')) ? `${formatPence(v('finance.historicalIncomePence'))} (year ended ${fmtDate(v('finance.reportingEnd'))})` : null],
      ], fieldIds: ['finance.historicalIncomePence', 'finance.reportingEnd'] },
      { kind: 'para', heading: 'How we will raise the rest', text: text('finance.fundraising'), fieldId: 'finance.fundraising' },
      { kind: 'para', heading: 'Reserves', text: text('finance.reserves'), fieldId: 'finance.reserves' },
    ],
  });
  sections.push({
    id: 'contingency', title: '8. If we raise less than planned',
    blocks: [{ kind: 'para', text: text('finance.fallback'), fieldId: 'finance.fallback' }],
  });
  return sections;
}

// ---------------------------------------------------------------- encodability
// Walks every string that will be drawn. Returns issues [{ fieldId, label, char, codePoint }]; empty when printable.
function findUnprintable(sections, title, supported) {
  const issues = [];
  const seen = new Set();
  const check = (str, fieldId, where) => {
    for (const ch of String(str ?? '')) {
      const cp = ch.codePointAt(0);
      if (cp === 10 || cp === 13 || cp === 9) continue;
      if (supported.has(cp) && cp >= 0x20) continue;
      const key = `${fieldId}|${cp}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const fd = fieldById(fieldId);
      issues.push({ fieldId, label: fd ? fd.label : where, char: ch, codePoint: cp });
    }
  };
  check(title, 'request.title', 'Request title');
  for (const s of sections) {
    for (const b of s.blocks) {
      const fid = b.fieldId || (b.fieldIds && b.fieldIds[0]);
      if (b.kind === 'para') check(b.text, fid, s.title);
      if (b.kind === 'facts') for (const [k, val] of b.rows) { check(val, fid, k); }
      if (b.kind === 'table') {
        for (const r of b.rows) r.forEach((cell) => check(cell, fid, b.heading));
      }
    }
  }
  return issues;
}

const describeChar = (i) => (i.codePoint < 0x20 || (i.codePoint >= 0x7f && i.codePoint < 0xa0) ? `a control character (${hex(i.codePoint)})` : `the character "${i.char}" (${hex(i.codePoint)})`);

// ---------------------------------------------------------------- layout
function createLayout(fonts) {
  const pages = [{ ops: [] }];
  let y = PAGE.height - PAGE.top;
  const usage = new Map(); // section id -> points of vertical space used
  let current = null;
  const width = (text, font, size) => fonts[font].widthOfTextAtSize(text, size);
  const room = () => y - PAGE.bottom;
  const newPage = () => { pages.push({ ops: [] }); y = PAGE.height - PAGE.top; };
  const note = (h) => { if (current) usage.set(current, (usage.get(current) || 0) + h); };
  const need = (h) => { if (room() < h) newPage(); };
  const op = (o) => pages[pages.length - 1].ops.push(o);

  // Greedy word wrap with an explicit break for words wider than the line.
  function wrap(text, font, size, maxW) {
    const lines = [];
    for (const para of clean(text).split('\n')) {
      if (para.trim() === '') { lines.push(''); continue; }
      let line = '';
      for (const word of para.split(/ +/).filter(Boolean)) {
        const tryLine = line ? `${line} ${word}` : word;
        if (width(tryLine, font, size) <= maxW) { line = tryLine; continue; }
        if (line) { lines.push(line); line = ''; }
        if (width(word, font, size) <= maxW) { line = word; continue; }
        let chunk = '';
        for (const ch of Array.from(word)) { // a single very long word: break between characters
          if (width(chunk + ch, font, size) > maxW && chunk) { lines.push(chunk); chunk = ''; }
          chunk += ch;
        }
        line = chunk;
      }
      lines.push(line);
    }
    return lines;
  }

  return {
    pages,
    usage,
    usageOf: (id) => usage.get(id) || 0,
    startSection(id) { current = id; },
    heading(text, size, gapBefore, keepWith = 2) {
      need(gapBefore + size + 4 + keepWith * LEAD);
      y -= gapBefore;
      y -= size;
      op({ text, x: PAGE.marginX, y, size, font: 'bold' });
      y -= 6;
      note(gapBefore + size + 6);
    },
    paragraph(text, { font = 'regular', after = 6 } = {}) {
      const lines = wrap(text, font, BODY_SIZE, CONTENT_W);
      lines.forEach((l, i) => {
        need(LEAD);
        y -= LEAD;
        if (l) op({ text: l, x: PAGE.marginX, y, size: BODY_SIZE, font });
        note(LEAD);
        if (i === lines.length - 1) { y -= after; note(after); }
      });
    },
    facts(rows) {
      const labelW = 190;
      for (const [k, val] of rows) {
        const lines = wrap(val === null || val === undefined || val === '' ? 'Not provided' : val, 'regular', BODY_SIZE, CONTENT_W - labelW);
        const keyLines = wrap(k, 'bold', BODY_SIZE, labelW - 8);
        const n = Math.max(lines.length, keyLines.length);
        need(n * LEAD + 2);
        const top = y;
        keyLines.forEach((l, i) => op({ text: l, x: PAGE.marginX, y: top - LEAD * (i + 1), size: BODY_SIZE, font: 'bold' }));
        lines.forEach((l, i) => { if (l) op({ text: l, x: PAGE.marginX + labelW, y: top - LEAD * (i + 1), size: BODY_SIZE, font: 'regular' }); });
        y -= n * LEAD + 2;
        note(n * LEAD + 2);
      }
      y -= 4;
      note(4);
    },
    table(cols, rows, total) {
      const amountW = 112;
      const widths = cols.map((c, i) => (i === 0 ? CONTENT_W - amountW * (cols.length - 1) : amountW));
      const drawRow = (cells, { bold = false, rule = false } = {}) => {
        const wrapped = cells.map((c, i) => wrap(c, bold ? 'bold' : 'regular', BODY_SIZE, widths[i] - 8));
        const n = Math.max(...wrapped.map((w) => w.length));
        const h = n * LEAD + 6;
        return { wrapped, n, h, bold, rule };
      };
      const paint = (r) => {
        const top = y;
        let x = PAGE.marginX;
        r.wrapped.forEach((lines, ci) => {
          lines.forEach((l, i) => {
            if (!l) return;
            const w = width(l, r.bold ? 'bold' : 'regular', BODY_SIZE);
            const tx = cols[ci].right ? x + widths[ci] - 4 - w : x + 4;
            op({ text: l, x: tx, y: top - 3 - LEAD * (i + 1) + 3, size: BODY_SIZE, font: r.bold ? 'bold' : 'regular' });
          });
          x += widths[ci];
        });
        y -= r.h;
        note(r.h);
        op({ rule: true, x1: PAGE.marginX, x2: PAGE.marginX + CONTENT_W, y: y + 1, w: r.rule ? 0.9 : 0.4 });
      };
      const head = drawRow(cols.map((c) => c.head), { bold: true, rule: true });
      const body = rows.map((r) => drawRow(r));
      const foot = drawRow(total, { bold: true, rule: true });
      need(head.h + Math.min(body[0] ? body[0].h : 0, 60) + 2);
      op({ rule: true, x1: PAGE.marginX, x2: PAGE.marginX + CONTENT_W, y: y, w: 0.9 });
      paint(head);
      [...body, foot].forEach((r, i, all) => {
        if (room() < r.h + (i === all.length - 2 ? foot.h : 0)) { // keep the total row with the last data row
          newPage();
          op({ rule: true, x1: PAGE.marginX, x2: PAGE.marginX + CONTENT_W, y, w: 0.9 });
          paint(head);
        }
        paint(r);
      });
      y -= 8;
      note(8);
    },
    title(lines) {
      for (const [text, size, font] of lines) {
        y -= size + 4;
        op({ text, x: PAGE.marginX, y, size, font });
      }
      y -= 10;
    },
    wrap,
  };
}

// ---------------------------------------------------------------- build
// answers: the application's answer set ({ [fieldId]: { value, origin, ... } }). Only values that apply are used.
// options.synthetic overrides the detection of a synthetic example (any answer with origin "synthetic-demo").
// Resolves { bytes: Uint8Array, pageCount, synthetic, filename, sections: [{ id, title, pages }] }
// or rejects with a ProposalError: code "unencodable" (details.issues) or "too-long" (details.sections).
export async function buildProposal(answers, options = {}) {
  const values = outgoingValues(answers || {});
  const synthetic = options.synthetic !== undefined
    ? !!options.synthetic
    : Object.values(answers || {}).some((a) => a && a.origin === 'synthetic-demo');
  const doc = await PDFDocument.create({ updateMetadata: false });
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const boldSet = new Set(bold.getCharacterSet());
  const supported = new Set(regular.getCharacterSet().filter((cp) => boldSet.has(cp))); // both faces must print it

  const sections = describe(values, answers);
  const title = values['request.title'] || 'Application';
  const issues = findUnprintable(sections, title, supported);
  if (synthetic) for (const ch of EXAMPLE_LABEL) if (!supported.has(ch.codePointAt(0))) issues.push({ fieldId: null, label: 'Demo footer', char: ch, codePoint: ch.codePointAt(0) });
  if (issues.length) {
    const list = issues.slice(0, 6).map((i) => `${i.label}: ${describeChar(i)}`).join('; ');
    throw new ProposalError('unencodable', `The proposal could not be built because ${issues.length === 1 ? 'one character' : `${issues.length} characters`} cannot be printed in the PDF font. ${list}${issues.length > 6 ? `; and ${issues.length - 6} more` : ''}. Replace ${issues.length === 1 ? 'it' : 'them'} with plain letters or punctuation and try again.`, { issues });
  }

  const fonts = { regular, bold };
  const lay = createLayout(fonts);
  // The applicant's name, limited to what the PDF font can print.
  const applicant = [...String(values['org.name'] || 'The applicant')].map((c) => (supported.has(c.codePointAt(0)) ? c : '?')).join('');
  lay.title([
    [applicant, H1, 'bold'],
    ...lay.wrap(`Proposal: ${title}`, 'bold', H2, CONTENT_W).map((l) => [l, H2, 'bold']),
    ...lay.wrap(`Operating and core costs, one-year request. Demo proposal prepared in the ${applicant} demonstration application.`, 'regular', BODY_SIZE, CONTENT_W).map((l) => [l, BODY_SIZE, 'regular']),
  ]);
  for (const s of sections) {
    lay.startSection(s.id);
    lay.heading(s.title, H2, 14);
    for (const b of s.blocks) {
      if (b.kind === 'para') {
        if (!b.text && b.optional) continue;
        if (b.heading) lay.heading(b.heading, BODY_SIZE + 1, 4, 2);
        lay.paragraph(b.text || 'Not provided.');
      } else if (b.kind === 'facts') {
        const rows = b.rows.filter(([, val]) => val !== null && val !== undefined && val !== '');
        if (rows.length) lay.facts(rows);
      } else if (b.kind === 'table') {
        lay.heading(b.heading, BODY_SIZE + 1, 4, 2);
        lay.table(b.cols, b.rows, b.total);
      }
    }
  }

  const pageCount = lay.pages.length;
  if (pageCount > MAX_PAGES) {
    const ranked = sections.map((s) => ({ id: s.id, title: s.title, pages: Math.round((lay.usageOf(s.id) / USABLE_H) * 10) / 10 })).sort((a, b) => b.pages - a.pages);
    const worst = ranked.slice(0, 3).map((s) => `${s.title} (about ${s.pages} pages)`).join(', ');
    throw new ProposalError('too-long', `The proposal would be ${pageCount} pages, and the limit is ${MAX_PAGES}. Text is never made smaller to fit. Shorten the longest sections: ${worst}.`, { pageCount, sections: ranked });
  }

  const ink = rgb(0.1, 0.1, 0.12);
  const grey = rgb(0.3, 0.3, 0.34);
  lay.pages.forEach((p, i) => {
    const pdfPage = doc.addPage([PAGE.width, PAGE.height]);
    for (const o of p.ops) {
      if (o.rule) pdfPage.drawLine({ start: { x: o.x1, y: o.y }, end: { x: o.x2, y: o.y }, thickness: o.w, color: grey });
      else pdfPage.drawText(o.text, { x: o.x, y: o.y, size: o.size, font: fonts[o.font], color: ink });
    }
    // footer: demo marking on the left, page number on the right
    const footerY = 34;
    pdfPage.drawLine({ start: { x: PAGE.marginX, y: footerY + 22 }, end: { x: PAGE.marginX + CONTENT_W, y: footerY + 22 }, thickness: 0.4, color: grey });
    pdfPage.drawText(synthetic ? `${applicant} · Demo proposal` : `${applicant} · Demo proposal, not sent to any funder`, { x: PAGE.marginX, y: footerY + 8, size: FOOT, font: regular, color: grey });
    if (synthetic) pdfPage.drawText(EXAMPLE_LABEL, { x: PAGE.marginX, y: footerY - 4, size: FOOT, font: regular, color: grey });
    const label = `Page ${i + 1} of ${pageCount}`;
    pdfPage.drawText(label, { x: PAGE.marginX + CONTENT_W - regular.widthOfTextAtSize(label, FOOT), y: footerY + 8, size: FOOT, font: regular, color: grey });
  });

  doc.setTitle(`${applicant} demo proposal`);
  doc.setAuthor(`${applicant} demonstration`);
  doc.setSubject(synthetic ? EXAMPLE_LABEL : 'Demo proposal');
  doc.setProducer('charity-funding demo (pdf-lib)');
  doc.setCreator('charity-funding demo');
  doc.setCreationDate(FIXED_DATE);
  doc.setModificationDate(FIXED_DATE);
  const bytes = await doc.save({ useObjectStreams: false });
  const usage = sections.map((s) => ({ id: s.id, title: s.title, pages: Math.round((lay.usageOf(s.id) / USABLE_H) * 10) / 10 }));
  return { bytes, pageCount, synthetic, filename: proposalFilename(values['org.name']), sections: usage };
}

// Page count of any PDF, read with pdf-lib. Resolves a number, or rejects with ProposalError('unreadable').
// This reads the page tree only: it does not check fonts, text size or layout, so a file that passes is not "verified".
export async function readPdfPageCount(bytes) {
  try {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    return doc.getPageCount();
  } catch (e) {
    throw new ProposalError('unreadable', 'This file could not be read as a PDF. It may be damaged or password protected.', { cause: e });
  }
}
