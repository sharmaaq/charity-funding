// Seeding. Idempotent, run by an admin (npm run seed, or POST /api/admin/charities/:cid/seed), never on a user request.
//
// Your Place: the demo charity with all the existing demonstration content (profile, synthetic past bids and documents,
// the six grants, the default discovery brief).
// Our Time: name, website and default theme only. No invented profile data, bids, documents or opportunities.
import { randomUUID } from 'node:crypto';
import { ServiceError } from '../errors.js';
import { SEED_BIDS, SEED_DOCUMENTS, SEED_PROFILE } from './your-place-org.js';
import { FIXTURES } from './your-place-grants.js';
import { YOUR_PLACE_BRIEF } from './your-place-brief.js';
import { YOUR_PLACE_APPLICATION_DEFAULTS } from './your-place-application.js';

export const DEFAULT_THEME = Object.freeze({ preset: 'default' });
export const SEED_MARKER_KEY = 'seed';

const GENERIC_NOTICE = Object.freeze({
  title: 'Draft-only workspace',
  text: 'Assessments are recommendations only. Nothing is ever submitted automatically; check every detail on the funder\'s own site before relying on it.',
});

export const CHARITIES = Object.freeze({
  'your-place': Object.freeze({
    id: 'your-place',
    name: 'Your Place',
    website: '',
    theme: DEFAULT_THEME,
    notice: Object.freeze({
      title: 'Demo discovery - 15 November 2026 snapshot',
      text: 'Assessments are demo recommendations for Your Place, a demo charity. They are not verified eligibility or a funding promise.',
    }),
  }),
  'our-time': Object.freeze({
    id: 'our-time',
    name: 'Our Time',
    website: 'https://ourtimecharity.org.uk',
    theme: DEFAULT_THEME,
    notice: GENERIC_NOTICE,
  }),
});

export const GENERIC_CHARITY_NOTICE = GENERIC_NOTICE;

// Creates the charity record if it does not exist yet. Existing members and theme are never touched.
export async function ensureCharity(store, def, { now = () => new Date(), createdBy = 'seed' } = {}) {
  const existing = await store.getCharity(def.id);
  if (existing) return { charity: existing, created: false };
  try {
    const charity = await store.createCharity({
      id: def.id, name: def.name, website: def.website, theme: { ...def.theme }, notice: { ...def.notice },
      members: [], createdAt: now().toISOString(), createdBy,
    });
    return { charity, created: true };
  } catch (e) {
    if (e instanceof ServiceError && e.code === 'exists') return { charity: await store.getCharity(def.id), created: false };
    throw e;
  }
}

async function seedYourPlace(store, now) {
  const cid = 'your-place';
  const stamp = (offset = 0) => new Date(now().getTime() - offset).toISOString();
  const marker = await store.get(cid, 'meta', SEED_MARKER_KEY);
  if (marker) return { seeded: false };
  const files = [];
  const profile = { key: 'profile', name: 'Your Place', ...SEED_PROFILE, synthetic: true, updatedAt: stamp() };
  const bids = [];
  const documents = [];
  SEED_BIDS.forEach((s) => {
    const id = randomUUID();
    bids.push({
      id, title: s.title, funder: s.funder, programme: s.programme, submissionDate: s.submissionDate, outcome: s.outcome,
      requestedAmount: s.requestedAmount, awardedAmount: s.awardedAmount, summary: s.summary, decisionDate: s.decisionDate,
      feedback: s.feedback, notes: s.notes, createdAt: stamp(), updatedAt: stamp(), synthetic: true,
    });
    s.files.forEach((f, i) => {
      const bytes = Buffer.from(f.text, 'utf8');
      const docId = randomUUID();
      files.push({ id: docId, bytes });
      documents.push({
        id: docId, ownerType: 'bid', ownerId: id, role: f.role, category: null, filename: f.filename, mime: 'text/plain', size: bytes.length,
        title: f.title, description: '', documentDate: null, period: '', tags: [], uploadedAt: stamp(i * 1000), updatedAt: stamp(i * 1000), synthetic: true,
      });
    });
  });
  SEED_DOCUMENTS.forEach((s, i) => {
    const bytes = Buffer.from(s.text, 'utf8');
    const docId = randomUUID();
    files.push({ id: docId, bytes });
    documents.push({
      id: docId, ownerType: 'organisation', ownerId: 'organisation', role: null, category: s.category, filename: s.filename, mime: 'text/plain', size: bytes.length,
      title: s.title, description: s.description, documentDate: null, period: s.period, tags: [...s.tags], uploadedAt: stamp(i * 1000), updatedAt: stamp(i * 1000), synthetic: true,
    });
  });
  for (const f of files) await store.files.put(cid, 'files', f.id, f.bytes, 'text/plain');
  await store.tx(cid, async (tx) => {
    if (await tx.get('meta', SEED_MARKER_KEY)) return;
    tx.set('meta', 'profile', profile);
    bids.forEach((b) => tx.set('bids', b.id, b));
    documents.forEach((d) => tx.set('documents', d.id, d));
    FIXTURES.forEach((g, i) => {
      tx.set('opportunities', g.id, { ...g, order: i });
      tx.set('decisions', g.id, { id: g.id, workflow: 'new', override: false, updatedAt: stamp() });
    });
    tx.set('meta', 'discovery', { key: 'discovery', brief: YOUR_PLACE_BRIEF, hideUnsuitable: false, updatedAt: stamp() });
    tx.set('meta', 'application', { key: 'application', defaults: { ...YOUR_PLACE_APPLICATION_DEFAULTS }, updatedAt: stamp() });
    tx.set('meta', SEED_MARKER_KEY, { key: SEED_MARKER_KEY, completedAt: stamp() });
  });
  return { seeded: true };
}

// Seeds one of the two demo charities (creating its record first). Safe to run repeatedly.
export async function seedCharity(store, cid, options = {}) {
  const now = options.now || (() => new Date());
  const def = CHARITIES[cid];
  if (!def) throw new ServiceError('not-found', `There is no seed for "${cid}".`);
  const { created } = await ensureCharity(store, def, { now });
  if (cid === 'your-place') return { charity: cid, created, ...(await seedYourPlace(store, now)) };
  // Our Time: record only.
  return { charity: cid, created, seeded: false };
}

export async function seedAll(store, options = {}) {
  const out = [];
  for (const cid of Object.keys(CHARITIES)) out.push(await seedCharity(store, cid, options));
  return out;
}
