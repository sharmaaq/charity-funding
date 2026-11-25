// Opportunities (the grant cards), the manager's decision per opportunity and the discovery settings, per charity.
// Decisions are separate records so two people deciding on different grants never overwrite each other.
import { ServiceError } from '../errors.js';
import { usableFunderPages } from '../../public/js/funder-pages.js';
import { WORKFLOWS } from '../../public/js/state.js';
import { validateNote } from '../../public/js/notes.js';

const BRIEF_MAX = 10000;

export function createWorkspaceService(store, options = {}) {
  const now = options.now || (() => new Date());

  const svc = {
    // Everything the Discovery and Planning screens need in one read.
    async load(cid) {
      const [opps, pages, decisions, settings, appMeta, noteRecs] = await Promise.all([store.list(cid, 'opportunities'), store.list(cid, 'funderPages'), store.list(cid, 'decisions'), store.get(cid, 'meta', 'discovery'), store.get(cid, 'meta', 'application'), store.list(cid, 'notes')]);
      const order = (o) => (Number.isFinite(o.order) ? o.order : 0);
      const opportunities = opps.sort((a, b) => (order(a) - order(b)) || (a.id < b.id ? -1 : 1)).map(({ order: _o, ...rest }) => rest);
      const grants = {};
      for (const o of opportunities) grants[o.id] = { workflow: 'new', override: false };
      for (const d of decisions) if (grants[d.id]) grants[d.id] = { workflow: d.workflow, override: !!d.override };
      const s = settings || {};
      const funderPages = usableFunderPages(pages.sort((a, b) => (order(a) - order(b)) || (a.id < b.id ? -1 : 1)));
      const notes = {};
      for (const n of noteRecs) if (grants[n.id] && n.text) notes[n.id] = { text: n.text, updatedAt: n.updatedAt, updatedBy: n.updatedBy };
      const out = { opportunities, funderPages, grants, notes, hideUnsuitable: !!s.hideUnsuitable };
      if (typeof s.brief === 'string') out.brief = s.brief;
      if (s.lastRun) out.lastRun = s.lastRun;
      if (appMeta && appMeta.defaults) out.applicationDefaults = appMeta.defaults;
      if (typeof s.freshId === 'string' && grants[s.freshId]) out.freshId = s.freshId;
      return out;
    },

    async setDecision(cid, oid, input) {
      const d = input || {};
      if (!WORKFLOWS.includes(d.workflow) || typeof d.override !== 'boolean') throw new ServiceError('invalid', 'The decision is not in the expected format.');
      if (!(await store.get(cid, 'opportunities', oid))) throw new ServiceError('not-found');
      const record = { id: oid, workflow: d.workflow, override: d.override, updatedAt: now().toISOString() };
      await store.tx(cid, async (tx) => { tx.set('decisions', oid, record); });
      return { workflow: record.workflow, override: record.override };
    },

    // One note per grant. Empty text deletes it. Returns the saved note, or null once deleted.
    async setNote(cid, oid, input, email) {
      const v = validateNote(input && input.text);
      if (!v.ok) throw new ServiceError('invalid', v.message);
      if (!(await store.get(cid, 'opportunities', oid))) throw new ServiceError('not-found');
      if (v.text === '') {
        await store.tx(cid, async (tx) => { tx.delete('notes', oid); });
        return { note: null };
      }
      const record = { id: oid, text: v.text, updatedAt: now().toISOString(), updatedBy: email };
      await store.tx(cid, async (tx) => { tx.set('notes', oid, record); });
      return { note: { text: record.text, updatedAt: record.updatedAt, updatedBy: record.updatedBy } };
    },

    // Partial update of { brief?, hideUnsuitable?, freshId? } (freshId null clears it).
    async updateSettings(cid, input) {
      const i = input || {};
      const patch = {};
      if ('brief' in i) {
        if (typeof i.brief !== 'string' || i.brief.length > BRIEF_MAX) throw new ServiceError('invalid', `The discovery brief must be text of at most ${BRIEF_MAX.toLocaleString('en-GB')} characters.`);
        patch.brief = i.brief;
      }
      if ('hideUnsuitable' in i) {
        if (typeof i.hideUnsuitable !== 'boolean') throw new ServiceError('invalid', 'hideUnsuitable must be true or false.');
        patch.hideUnsuitable = i.hideUnsuitable;
      }
      if ('freshId' in i) {
        if (i.freshId !== null && (typeof i.freshId !== 'string' || !(await store.get(cid, 'opportunities', i.freshId)))) throw new ServiceError('invalid', 'freshId must name an opportunity or be null.');
        patch.freshId = i.freshId;
      }
      await store.tx(cid, async (tx) => {
        const cur = (await tx.get('meta', 'discovery')) || { key: 'discovery' };
        tx.set('meta', 'discovery', { ...cur, ...patch, updatedAt: now().toISOString() });
      });
      return svc.load(cid);
    },
  };
  return svc;
}
