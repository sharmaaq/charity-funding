// The synthetic accounts PDF used by the worked example. It is a clearly watermarked illustration of the historical
// income figure in the example, NOT a purported audited or examined document and not a filing. Generated with the same
// vendored pdf-lib as the proposal, in standard Helvetica, and deterministic: the same bytes every time.
import { PDFDocument, StandardFonts, rgb, degrees } from '../../vendor/pdf-lib.esm.min.js';
import { SYNTHETIC_LABEL } from '../org/seed.js';

export const ACCOUNTS_EXAMPLE_FILENAME = 'synthetic-accounts-example.pdf';
export const ACCOUNTS_EXAMPLE_TITLE = 'Synthetic accounts example, year ended 31 March 2026 (not a real filing)';
export const ACCOUNTS_EXAMPLE_PERIOD = 'Year ended 31 March 2026 (synthetic example)';
// Recorded in the document's metadata and shown in its text.
export const ACCOUNTS_EXAMPLE_KIND = 'synthetic-accounts-example';
export const ACCOUNTS_EXAMPLE_EXAMINATION = 'not-real';
export const ACCOUNTS_EXAMPLE_TAG = 'synthetic-accounts-example';
const FIXED_DATE = new Date('2026-01-01T00:00:00.000Z');

export async function buildAccountsExample() {
  const doc = await PDFDocument.create({ updateMetadata: false });
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595.28, 841.89]);
  const ink = rgb(0.1, 0.1, 0.12);
  const text = (t, x, y, size = 12, font = regular, color = ink) => page.drawText(t, { x, y, size, font, color });

  // Diagonal watermark behind the text.
  page.drawText(SYNTHETIC_LABEL, { x: 70, y: 250, size: 22, font: bold, color: rgb(0.78, 0.78, 0.8), rotate: degrees(40), maxWidth: 700, lineHeight: 28 });
  text(SYNTHETIC_LABEL, 56, 800, 11, bold, rgb(0.55, 0.1, 0.1));

  text('Your Place', 56, 750, 22, bold);
  text('Illustrative statement of income', 56, 722, 15, bold);
  text('For the year ended 31 March 2026', 56, 702);
  text('Document kind: synthetic accounts example', 56, 668, 11);
  text('Independent examination: not real (there has been none)', 56, 652, 11);

  text('Total income for the year', 56, 600, 12, bold);
  text('GBP 7,000,000', 380, 600, 12, bold);
  page.drawLine({ start: { x: 56, y: 592 }, end: { x: 539, y: 592 }, thickness: 0.6, color: ink });
  text('This figure exists only to demonstrate how an application is prepared. It is distinct from any', 56, 560, 11);
  text('earlier reference figure shown elsewhere in this demonstration and is not taken from any record.', 56, 545, 11);
  text('It must not be filed, relied on or submitted as real accounts.', 56, 525, 11, bold);

  page.drawLine({ start: { x: 56, y: 90 }, end: { x: 539, y: 90 }, thickness: 0.4, color: ink });
  text(SYNTHETIC_LABEL, 56, 70, 9);
  text('Page 1 of 1', 480, 70, 9);

  doc.setTitle(ACCOUNTS_EXAMPLE_TITLE);
  doc.setAuthor('Your Place demonstration');
  doc.setSubject(SYNTHETIC_LABEL);
  doc.setKeywords([`documentKind=${ACCOUNTS_EXAMPLE_KIND}`, `independentExamination=${ACCOUNTS_EXAMPLE_EXAMINATION}`]);
  doc.setProducer('charity-funding demo (pdf-lib)');
  doc.setCreator('charity-funding demo');
  doc.setCreationDate(FIXED_DATE);
  doc.setModificationDate(FIXED_DATE);
  return doc.save({ useObjectStreams: false });
}
