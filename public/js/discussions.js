// Discussions (REQ-042): a list, a new-discussion form and a thread view that streams the AI's answer.
// Routes: #/discussions, #/discussions/new[?grant=<id>], #/discussions/<threadId>. Renders itself into <main>.
import { renderMarkdown } from './markdown.js';
import { followJob } from './jobs.js';

export const DISCUSSIONS_HOME = '#/discussions';
export const isDiscussionsHash = (hash) => hash === DISCUSSIONS_HOME || hash.startsWith(`${DISCUSSIONS_HOME}/`);

// '#/discussions' -> { view: 'list' }; '#/discussions/new?grant=G-001' -> { view: 'new', grantId }; '#/discussions/<id>' -> { view: 'thread', id }.
export function parseDiscussionsHash(hash) {
  if (hash === DISCUSSIONS_HOME) return { view: 'list' };
  const m = /^#\/discussions\/([A-Za-z0-9._-]{1,100})(?:\?(.*))?$/.exec(hash);
  if (!m) return null;
  if (m[1] === 'new') {
    const g = new URLSearchParams(m[2] || '').get('grant');
    return { view: 'new', grantId: g && /^[A-Za-z0-9._-]{1,100}$/.test(g) ? g : null };
  }
  return { view: 'thread', id: m[1] };
}
export const newDiscussionHash = (grantId) => `${DISCUSSIONS_HOME}/new${grantId ? `?grant=${encodeURIComponent(grantId)}` : ''}`;

const when = (iso) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// deps: { mount, titleEl, cid, api, h, getGrant(id) -> { name } | null, getModel() -> model id, announce(text), announceNext(text), navigate(hash) }
export function createDiscussions(deps) {
  const { mount, titleEl, cid, api, h, getGrant, getModel, announce, announceNext, navigate } = deps;
  const base = `/api/charities/${encodeURIComponent(cid)}`;
  let token = 0; // bumps on every show/hide, so a stream that belongs to a view that has gone stops touching the page
  let visible = false;

  const jobUrl = (jobId) => `${base}/jobs/${encodeURIComponent(jobId)}/events`;
  const fail = (e) => h('p', { class: 'form-error', role: 'alert', 'data-testid': 'discussion-error', text: e && e.message ? e.message : 'Something went wrong. Please try again.' });

  function setTitle(text) {
    titleEl.textContent = text;
    document.title = `${text} - ${document.title.split(' - ').pop()}`;
  }

  // ---------------------------------------------------------------- list
  async function showList(my) {
    setTitle('Discussions');
    mount.replaceChildren(h('p', { text: 'Loading...' }));
    let threads;
    try { threads = (await api(`${base}/threads`)).threads; } catch (e) { if (my === token) mount.replaceChildren(fail(e)); return; }
    if (my !== token) return;
    const ask = h('a', { class: 'btn primary', href: newDiscussionHash(null), 'data-testid': 'ask-funding' }, 'Ask about funding');
    const body = threads.length === 0
      ? h('div', { class: 'empty', 'data-testid': 'empty' }, h('p', null, h('strong', null, 'No discussions yet.')), h('p', null, 'Start one with Ask about funding, or choose Discuss on any grant.'))
      : h('ul', { class: 'threads', 'aria-label': 'Discussions' }, threads.map((t) => {
        const g = t.grantId ? getGrant(t.grantId) : null;
        return h('li', { class: 'thread-item', 'data-id': t.id },
          h('a', { href: `${DISCUSSIONS_HOME}/${encodeURIComponent(t.id)}`, class: 'thread-link', text: t.title }),
          h('span', { class: 'thread-meta', text: `${g ? `${g.name}. ` : ''}${t.messageCount} message${t.messageCount === 1 ? '' : 's'}. Updated ${when(t.updatedAt)}` }));
      }));
    mount.replaceChildren(h('div', { class: 'thread-actions' }, ask), body);
  }

  // ---------------------------------------------------------------- new discussion
  function showNew(my, grantId) {
    const grant = grantId ? getGrant(grantId) : null;
    setTitle(grant ? 'Discuss a grant' : 'Ask about funding');
    const box = h('textarea', { id: 'discussion-text', rows: 5, maxlength: '8000', 'data-testid': 'discussion-input' });
    const err = h('div', { 'data-testid': 'discussion-form-error' });
    const send = h('button', { type: 'button', class: 'btn primary', 'data-testid': 'discussion-send', text: 'Send' });
    send.addEventListener('click', async () => {
      const text = box.value.trim();
      if (!text) { err.replaceChildren(h('p', { class: 'field-error', role: 'alert', text: 'Write a message first.' })); box.focus(); return; }
      err.replaceChildren();
      send.disabled = true;
      try {
        const { thread } = await api(`${base}/threads`, { method: 'POST', json: { grantId: grant ? grantId : null, text, model: getModel() } });
        navigate(`${DISCUSSIONS_HOME}/${encodeURIComponent(thread.id)}`);
      } catch (e) {
        send.disabled = false;
        err.replaceChildren(fail(e));
      }
    });
    mount.replaceChildren(
      h('p', null, h('a', { href: DISCUSSIONS_HOME }, 'Back to Discussions')),
      grant
        ? h('p', { 'data-testid': 'discussion-about' }, 'About: ', h('strong', { text: grant.name }), '. The AI is given this grant, its assessment (if there is one) and your organisation information with your first message.')
        : h('p', null, 'The AI is given your organisation information with your first message.'),
      h('label', { for: 'discussion-text', text: 'Your message' }), box, err, h('div', { class: 'thread-actions' }, send));
    box.focus();
  }

  // ---------------------------------------------------------------- one thread
  async function showThread(my, id) {
    setTitle('Discussion');
    mount.replaceChildren(h('p', { text: 'Loading...' }));
    let data;
    try { data = await api(`${base}/threads/${encodeURIComponent(id)}`); } catch (e) {
      if (my !== token) return;
      mount.replaceChildren(e && e.code === 'not-found' ? h('div', { class: 'empty', 'data-testid': 'empty' }, h('p', null, h('strong', null, 'That discussion was not found.')), h('p', null, h('a', { href: DISCUSSIONS_HOME }, 'Back to Discussions'))) : fail(e));
      return;
    }
    if (my !== token) return;
    let thread = data.thread;
    const grant = thread.grantId ? getGrant(thread.grantId) : null;
    const list = h('div', { class: 'messages', 'aria-live': 'polite', 'data-testid': 'messages' });
    const status = h('p', { class: 'ai-status', role: 'status', 'data-testid': 'discussion-status' });
    const formErr = h('div');
    const box = h('textarea', { id: 'discussion-text', rows: 4, maxlength: '8000', 'data-testid': 'discussion-input' });
    const send = h('button', { type: 'button', class: 'btn primary', 'data-testid': 'discussion-send', text: 'Send' });
    const head = h('div', { class: 'thread-head' });
    let streamEl = null;

    const bubble = (m) => {
      const body = h('div', { class: 'md' });
      if (m.role === 'assistant') body.append(renderMarkdown(m.text)); else body.textContent = m.text;
      return h('div', { class: `message ${m.role}`, 'data-role': m.role },
        h('p', { class: 'who' }, m.role === 'user' ? 'You' : `AI${m.modelLabel ? ` (${m.modelLabel})` : ''}`), body);
    };
    const drawMessages = () => list.replaceChildren(...thread.messages.map(bubble), ...(streamEl ? [streamEl] : []));
    const setBusy = (on) => { send.disabled = on; box.readOnly = on; };

    function drawHead() {
      const title = h('h2', { class: 'thread-title', 'data-testid': 'thread-title', text: thread.title });
      const rename = h('button', { type: 'button', class: 'btn', 'data-testid': 'rename', text: 'Rename' });
      const del = h('button', { type: 'button', class: 'btn quiet', 'data-testid': 'delete', text: 'Delete' });
      rename.addEventListener('click', () => {
        const input = h('input', { type: 'text', value: thread.title, maxlength: '120', 'aria-label': 'Discussion title', 'data-testid': 'rename-input' });
        const save = h('button', { type: 'button', class: 'btn primary', 'data-testid': 'rename-save', text: 'Save title' });
        const cancel = h('button', { type: 'button', class: 'btn', text: 'Cancel', onclick: drawHead });
        const doSave = async () => {
          try {
            thread = (await api(`${base}/threads/${encodeURIComponent(thread.id)}`, { method: 'PATCH', json: { title: input.value } })).thread;
            drawHead();
            announce('Discussion renamed.');
          } catch (e) { head.append(fail(e)); }
        };
        save.addEventListener('click', doSave);
        input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); doSave(); } if (ev.key === 'Escape') drawHead(); });
        head.replaceChildren(input, save, cancel);
        input.focus();
        input.select();
      });
      del.addEventListener('click', async () => {
        if (!window.confirm(`Delete the discussion "${thread.title}"? This cannot be undone.`)) return;
        try {
          await api(`${base}/threads/${encodeURIComponent(thread.id)}`, { method: 'DELETE' });
          announceNext('Discussion deleted.'); // shown after the move to the list
          navigate(DISCUSSIONS_HOME);
        } catch (e) { head.append(fail(e)); }
      });
      head.replaceChildren(h('p', null, h('a', { href: DISCUSSIONS_HOME }, 'Back to Discussions')), title,
        grant ? h('p', { class: 'thread-about', text: `About: ${grant.name}` }) : null, h('div', { class: 'thread-actions' }, rename, del));
    }

    // Follows the running answer: the server replays what was written so far, then continues.
    async function follow(jobId) {
      setBusy(true);
      streamEl = bubble({ role: 'assistant', text: '' });
      const body = streamEl.querySelector('.md');
      let text = '';
      drawMessages();
      status.replaceChildren(h('span', { class: 'spinner', 'aria-hidden': 'true' }), h('span', { text: 'The AI is writing...' }));
      let error = null;
      try {
        await followJob(jobUrl(jobId), (e) => {
          if (my !== token) return;
          if (e.type === 'text') { text += e.text; body.replaceChildren(renderMarkdown(text)); }
        });
      } catch (e) { error = e; }
      if (my !== token) return;
      streamEl = null;
      status.replaceChildren();
      try { thread = (await api(`${base}/threads/${encodeURIComponent(thread.id)}`)).thread; } catch { /* keep what is on screen */ }
      if (my !== token) return;
      drawMessages();
      formErr.replaceChildren(error ? fail(error) : '');
      setBusy(false);
      list.lastElementChild?.scrollIntoView({ block: 'nearest' });
      if (!error) announce('The AI has answered.');
    }

    send.addEventListener('click', async () => {
      const text = box.value.trim();
      if (!text) { formErr.replaceChildren(h('p', { class: 'field-error', role: 'alert', text: 'Write a message first.' })); box.focus(); return; }
      formErr.replaceChildren();
      setBusy(true);
      try {
        const res = await api(`${base}/threads/${encodeURIComponent(thread.id)}/messages`, { method: 'POST', json: { text, model: getModel() } });
        thread = res.thread;
        box.value = '';
        follow(res.jobId);
      } catch (e) {
        setBusy(false);
        formErr.replaceChildren(fail(e));
      }
    });

    drawHead();
    drawMessages();
    mount.replaceChildren(head, list, status, h('label', { for: 'discussion-text', text: 'Your message' }), box, formErr, h('div', { class: 'thread-actions' }, send));
    setTitle(thread.title);
    if (data.jobId) follow(data.jobId);
  }

  return {
    isVisible: () => visible,
    show(route) {
      token += 1;
      visible = true;
      const my = token;
      if (route.view === 'new') showNew(my, route.grantId);
      else if (route.view === 'thread') void showThread(my, route.id);
      else void showList(my);
    },
    hide() { token += 1; visible = false; },
  };
}
