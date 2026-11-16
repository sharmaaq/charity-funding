// A real, valid demo package built with the same browser modules the app uses: the worked example answers, the
// generated proposal PDF and the synthetic accounts PDF. Synthetic data only.
import crypto from 'node:crypto';
import { buildExampleAnswers } from '../../public/js/application/example.js';
import { normaliseOutgoingAnswers } from '../../public/js/application/package.js';
import { buildProposal } from '../../public/js/application/proposal.js';
import { buildAccountsExample, ACCOUNTS_EXAMPLE_FILENAME } from '../../public/js/application/accounts-example.js';
import { packageHash, sha256Hex, ADAPTER_ID } from '../../public/js/application/canonical.js';
import { buildManifest } from '../../public/js/application/run-protocol.js';

const NOW = '2026-11-16T09:00:00.000Z';
let cached = null;

export async function examplePackage() {
  if (cached) return cached;
  const answers = buildExampleAnswers(NOW, { id: 'doc-accounts', title: 'Synthetic accounts', filename: ACCOUNTS_EXAMPLE_FILENAME, updatedAt: NOW });
  for (const a of Object.values(answers)) a.confirmedAt = NOW;
  const normalised = normaliseOutgoingAnswers(answers);
  const proposal = (await buildProposal(answers)).bytes;
  const accountsBuilt = await buildAccountsExample();
  const accounts = accountsBuilt.bytes || accountsBuilt;
  const files = { proposal: { filename: 'yor-plc-proposal.pdf', mimeType: 'application/pdf', bytes: proposal }, accounts: { filename: ACCOUNTS_EXAMPLE_FILENAME, mimeType: 'application/pdf', bytes: accounts } };
  const attachments = [];
  for (const role of ['proposal', 'accounts']) attachments.push({ role, filename: files[role].filename, mime: 'application/pdf', size: files[role].bytes.length, sha256: await sha256Hex(files[role].bytes), synthetic: true });
  const payloadHash = await packageHash({ answers: normalised, attachments, adapter: ADAPTER_ID });
  cached = { normalised, files, attachments, payloadHash };
  return cached;
}

// A fresh manifest (new attempt ID) plus the matching flat answers and files.
export async function exampleRun(overrides = {}) {
  const p = await examplePackage();
  const snapshot = { id: crypto.randomUUID(), applicationId: '11111111-2222-4333-8444-555555555555', revision: 3, adapter: ADAPTER_ID, answers: structuredClone(p.normalised), attachments: p.attachments, payloadHash: p.payloadHash };
  const attemptId = overrides.attemptId || crypto.randomUUID();
  const manifest = buildManifest(snapshot, attemptId);
  return { manifest, flat: structuredClone(p.normalised), files: p.files, attemptId, snapshot };
}
