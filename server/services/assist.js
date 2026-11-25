// AI assessment of one grant (REQ-041) and discussions (REQ-042). Per charity, stored server-side, readable by every member.
//   assessments/{grantId}  { id, grantId, text, at, model, modelLabel, by }                one per grant, replaced by Re-assess
//   threads/{threadId}     { id, title, grantId|null, context, messages: [{ role, text, at, model?, modelLabel? }],
//                            createdAt, updatedAt, createdBy }
// A discussion keeps its full history and sends it with each message, so the model can change between messages (D8).
import { randomUUID } from 'node:crypto';
import { ServiceError } from '../errors.js';
import { assessGrantPrompt, organisationBlock, systemPrompt, threadContext, threadOpening } from '../ai/prompts.js';

export const MESSAGE_MAX = 8000;
export const TITLE_MAX = 120;
export const MAX_MESSAGES = 200;
const RUN_TIMEOUT_MS = 5 * 60e3;

const clean = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const summary = (t) => ({ id: t.id, title: t.title, grantId: t.grantId, updatedAt: t.updatedAt, createdAt: t.createdAt, messageCount: t.messages.length });
const publicThread = (t) => ({ id: t.id, title: t.title, grantId: t.grantId, createdAt: t.createdAt, updatedAt: t.updatedAt, createdBy: t.createdBy, messages: t.messages });

export function createAssistService({ store, org, jobs, ai, now = () => new Date(), runTimeoutMs = RUN_TIMEOUT_MS }) {
  async function orgBlock(cid) {
    const [profile, bids, charity] = await Promise.all([org.getProfile(cid), org.listBids(cid), store.getCharity(cid)]);
    return { block: organisationBlock({ ...profile, name: profile.name || charity.name }, bids), charity };
  }
  const grantOf = async (cid, oid) => {
    const g = await store.get(cid, 'opportunities', oid);
    if (!g) throw new ServiceError('not-found');
    return g;
  };
  const call = (charityName, choice, opts) => ai.runAI(choice, { system: systemPrompt(charityName, now()), signal: AbortSignal.timeout(runTimeoutMs), ...opts });

  const svc = {
    // ---------------------------------------------------------------- assessments
    async getAssessment(cid, oid) {
      await grantOf(cid, oid);
      const job = jobs.active(cid, `assess:${oid}`);
      return { assessment: (await store.get(cid, 'assessments', oid)) || null, jobId: job ? job.id : null };
    },
    async startAssessment(cid, oid, email, choice) {
      const grant = await grantOf(cid, oid);
      if (jobs.active(cid, `assess:${oid}`)) throw new ServiceError('conflict', 'An assessment of this grant is already in progress.');
      return jobs.start(cid, `assess:${oid}`, async (emit) => {
        emit({ type: 'status', text: 'Reading the organisation information' });
        const { block, charity } = await orgBlock(cid);
        const out = await call(charity.name, choice, {
          task: 'assess', prompt: assessGrantPrompt(grant, block), web: true,
          onEvent: (e) => { if (e.type === 'text' || e.type === 'status' || e.type === 'tool') emit(e); },
        });
        if (out.isError) throw new Error(out.error || 'The AI model returned an error.');
        const text = String(out.text || '').trim();
        if (!text) throw new Error('The AI model returned no assessment. Try again.');
        const record = { id: oid, grantId: oid, text, at: now().toISOString(), model: choice.model, modelLabel: choice.label || choice.model, by: email };
        await store.tx(cid, async (tx) => { tx.set('assessments', oid, record); });
        return { assessment: record };
      });
    },

    // ---------------------------------------------------------------- discussions
    async listThreads(cid) {
      return (await store.list(cid, 'threads')).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0)).map(summary);
    },
    async getThread(cid, id) {
      const t = await store.get(cid, 'threads', id);
      if (!t) throw new ServiceError('not-found');
      const job = jobs.active(cid, `thread:${id}`);
      return { thread: publicThread(t), jobId: job ? job.id : null };
    },
    async renameThread(cid, id, input) {
      const title = clean(input && input.title);
      if (!title || title.length > TITLE_MAX) throw new ServiceError('invalid', `The title must be 1 to ${TITLE_MAX} characters.`);
      return store.tx(cid, async (tx) => {
        const t = await tx.get('threads', id);
        if (!t) throw new ServiceError('not-found');
        const next = { ...t, title };
        tx.set('threads', id, next);
        return { thread: publicThread(next) };
      });
    },
    async deleteThread(cid, id) {
      if (jobs.active(cid, `thread:${id}`)) throw new ServiceError('conflict', 'This discussion is busy. Delete it when the answer has finished.');
      await store.tx(cid, async (tx) => {
        if (!(await tx.get('threads', id))) throw new ServiceError('not-found');
        tx.delete('threads', id);
      });
      return {};
    },

    // Starts a new discussion with its first message, or adds a message to an existing one. Returns { thread, job }.
    async send(cid, email, choice, { threadId = null, grantId = null, text }) {
      const message = typeof text === 'string' ? text.trim() : '';
      if (!message) throw new ServiceError('invalid', 'Write a message first.');
      if (message.length > MESSAGE_MAX) throw new ServiceError('invalid', `A message can be at most ${MESSAGE_MAX.toLocaleString('en-GB')} characters.`);
      let thread;
      let grant = null;
      if (threadId) {
        thread = await store.get(cid, 'threads', threadId);
        if (!thread) throw new ServiceError('not-found');
        if (thread.messages.length >= MAX_MESSAGES) throw new ServiceError('invalid', 'This discussion is full. Start a new one.');
        if (thread.grantId) grant = await store.get(cid, 'opportunities', thread.grantId);
      } else {
        if (grantId !== null && grantId !== undefined && grantId !== '') grant = await grantOf(cid, grantId);
      }
      const key = threadId || null;
      if (key && jobs.active(cid, `thread:${key}`)) throw new ServiceError('conflict', 'An answer is already being written. Wait for it to finish.');
      const { block, charity } = await orgBlock(cid);
      const at = now().toISOString();
      const userMsg = { role: 'user', text: message, at };
      if (!thread) {
        const assessment = grant ? await store.get(cid, 'assessments', grant.id) : null;
        const title = clean(grant ? grant.name : message).slice(0, 80) || 'Funding discussion';
        thread = { id: randomUUID(), title, grantId: grant ? grant.id : null, context: threadContext({ org: block, grant, assessment }), messages: [], createdAt: at, updatedAt: at, createdBy: email };
      }
      // An earlier question that got no answer (the run failed) stays in the thread; merge it with the next one so roles alternate.
      const history = [];
      thread.messages.forEach((m, i) => {
        const t = i === 0 && m.role === 'user' ? threadOpening(thread.context, m.text) : m.text;
        const last = history[history.length - 1];
        if (last && last.role === m.role) last.text += '\n\n' + t;
        else history.push({ role: m.role, text: t });
      });
      const first = thread.messages.length === 0;
      let prompt = first ? threadOpening(thread.context, message) : message;
      if (history.length && history[history.length - 1].role === 'user') prompt = `${history.pop().text}\n\n${prompt}`; // the last question never got an answer
      const saved = { ...thread, messages: [...thread.messages, userMsg], updatedAt: at };
      await store.tx(cid, async (tx) => { tx.set('threads', saved.id, saved); });
      const tid = saved.id;
      const job = jobs.start(cid, `thread:${tid}`, async (emit) => {
        const out = await call(charity.name, choice, {
          task: 'chat', prompt, history, web: true,
          onEvent: (e) => { if (e.type === 'text' || e.type === 'status' || e.type === 'tool') emit(e); },
        });
        if (out.isError) throw new Error(out.error || 'The AI model returned an error.');
        const reply = String(out.text || '').trim();
        if (!reply) throw new Error('The AI model returned no answer. Try again.');
        const assistant = { role: 'assistant', text: reply, at: now().toISOString(), model: choice.model, modelLabel: choice.label || choice.model };
        await store.tx(cid, async (tx) => {
          const cur = await tx.get('threads', tid);
          if (cur) tx.set('threads', tid, { ...cur, messages: [...cur.messages, assistant], updatedAt: assistant.at });
        });
        return { message: assistant };
      });
      return { thread: publicThread(saved), job };
    },
  };
  return svc;
}
