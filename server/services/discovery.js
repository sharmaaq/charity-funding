// Real discovery (REQ-040): one AI run per charity at a time, merged into the opportunities without ever touching a
// manager's decisions (S5-001 D5) or deleting anything.
import { ServiceError } from '../errors.js';
import { discoveryPrompt, discoverySchema, normaliseKey, systemPrompt, validateDiscovery, ymd } from '../ai/prompts.js';

const RUN_TIMEOUT_MS = 5 * 60e3;
const MAX_SOURCES_KEPT = 40;
const MAX_CARD_SOURCES = 12;

export function createDiscoveryService({ store, org, jobs, ai, now = () => new Date(), runTimeoutMs = RUN_TIMEOUT_MS }) {
  // Merge validated items into the charity's opportunities. Returns { added: [...ids], updated: [...ids] }.
  async function merge(cid, items) {
    const stamp = ymd(now());
    return store.tx(cid, async (tx) => {
      const existing = await tx.list('opportunities');
      const byId = new Map(existing.map((o) => [o.id, o]));
      const byKey = new Map(existing.map((o) => [normaliseKey(o.funder || '', o.name || ''), o]));
      let order = existing.reduce((m, o) => Math.max(m, Number.isFinite(o.order) ? o.order : 0), 0);
      const added = [];
      const updated = [];
      for (const it of items.slice().sort((a, b) => b.fitScore - a.fitScore)) {
        const cur = byId.get(it.id) || byKey.get(normaliseKey(it.funder, it.name));
        if (cur) {
          const sources = [...(cur.sources || [])];
          for (const s of it.sources) if (!sources.some((x) => x.url === s.url)) sources.push(s);
          if (cur.foundBy === 'ai') {
            const { id: _id, ...fields } = it;
            tx.set('opportunities', cur.id, { ...cur, ...fields, sources: sources.slice(0, MAX_CARD_SOURCES), lastCheckedAt: stamp });
          } else {
            // A card that was already here (the seeded demo grants, for example) keeps its wording and its suitability;
            // the run adds the score, the barriers and any new sources.
            tx.set('opportunities', cur.id, { ...cur, fitScore: it.fitScore, barriers: it.barriers, sources: sources.slice(0, MAX_CARD_SOURCES), lastCheckedAt: stamp });
          }
          updated.push(cur.id);
        } else {
          order += 1;
          tx.set('opportunities', it.id, { ...it, order, foundBy: 'ai', foundAt: stamp });
          byId.set(it.id, it);
          added.push(it.id);
        }
      }
      return { added, updated };
    });
  }

  async function run(cid, email, choice, emit) {
    const started = Date.now();
    emit({ type: 'status', text: 'Reading the organisation information and brief' });
    const [profile, bids, settings, opps] = await Promise.all([org.getProfile(cid), org.listBids(cid), store.get(cid, 'meta', 'discovery'), store.list(cid, 'opportunities')]);
    const charity = await store.getCharity(cid);
    const brief = ((settings && settings.brief) || '').trim();
    const prompt = discoveryPrompt({ profile: { ...profile, name: profile.name || charity.name }, bids, brief, known: opps.map((o) => `${o.funder}: ${o.name}`) });
    const queries = [];
    const sources = new Map();
    const onEvent = (e) => {
      if (e.type === 'tool') { if (e.detail && !queries.includes(e.detail)) queries.push(e.detail); emit({ type: 'tool', name: e.name, detail: e.detail }); }
      else if (e.type === 'source') { if (!sources.has(e.url)) sources.set(e.url, e.title || ''); }
      else if (e.type === 'status') emit({ type: 'status', text: e.text });
      // model text is JSON for the validator, not for the screen
    };
    const call = (extra = '') => ai.runAI(choice, {
      task: 'discover', system: systemPrompt(charity.name, now()), prompt: prompt + extra, schema: discoverySchema, web: true, onEvent, signal: AbortSignal.timeout(runTimeoutMs),
    });
    let out = await call();
    if (out.isError) throw new Error(out.error || 'The AI model returned an error.');
    if (!out.structured) {
      emit({ type: 'status', text: 'The answer was not in the expected format, asking again' });
      out = await call('\n\nYour last answer could not be read. Answer again with ONLY the JSON object.');
      if (out.isError) throw new Error(out.error || 'The AI model returned an error.');
      if (!out.structured) throw new Error('The AI model did not return results in the expected format. Try again.');
    }
    for (const q of out.searches || []) if (!queries.includes(q)) queries.push(q);
    for (const s of out.sources || []) if (!sources.has(s.url)) sources.set(s.url, s.title || '');
    emit({ type: 'status', text: 'Checking the results' });
    const v = validateDiscovery(out.structured, { today: now() });
    for (const it of v.items) for (const src of it.sources) if (!sources.has(src.url)) sources.set(src.url, src.label || '');
    const { added, updated } = await merge(cid, v.items);
    const lastRun = {
      at: now().toISOString(), by: email, model: choice.model, modelLabel: choice.label || choice.model, durationMs: Date.now() - started,
      queries: queries.slice(0, 30), sources: [...sources].slice(0, MAX_SOURCES_KEPT).map(([url, title]) => ({ url, title })),
      counts: { new: added.length, updated: updated.length, dropped: v.dropped.length }, notes: v.notes,
    };
    const fresh = v.items.filter((i) => added.includes(i.id) && i.assessment === 'suitable').sort((a, b) => b.fitScore - a.fitScore)[0];
    await store.tx(cid, async (tx) => {
      const cur = (await tx.get('meta', 'discovery')) || { key: 'discovery' };
      tx.set('meta', 'discovery', { ...cur, lastRun, ...(fresh ? { freshId: fresh.id } : {}), updatedAt: now().toISOString() });
    });
    emit({ type: 'status', text: `Done: ${added.length} new, ${updated.length} updated` });
    return lastRun.counts;
  }

  return {
    active: (cid) => jobs.active(cid, 'discover'),
    // Starts a run. choice: the resolved model { provider, model, label, key? }.
    async start(cid, email, choice) {
      if (jobs.active(cid, 'discover')) throw new ServiceError('conflict', 'A discovery run is already in progress.');
      const settings = await store.get(cid, 'meta', 'discovery');
      if (!settings || typeof settings.brief !== 'string' || settings.brief.trim() === '') throw new ServiceError('invalid', 'Enter your discovery criteria first.');
      // Check again after the await: two requests can pass the first check together.
      if (jobs.active(cid, 'discover')) throw new ServiceError('conflict', 'A discovery run is already in progress.');
      return jobs.start(cid, 'discover', (emit) => run(cid, email, choice, emit));
    },
  };
}
