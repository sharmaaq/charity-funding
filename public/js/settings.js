// Settings (REQ-043): the charity's own AI connections. Route: #/settings. Renders itself into <main>.
// A key is pasted once, checked with its provider and saved encrypted on the server; only its last four characters
// are ever shown back. Keys belong to the charity (it pays for its own AI use), so any member can connect or remove one.
export const SETTINGS_HOME = '#/settings';

const HELP = {
  anthropic: 'Lets you pick Claude models. Create a key in your Anthropic Console account.',
  openai: 'Lets you pick ChatGPT models. Create a key in your OpenAI platform account.',
  gemini: 'Optional. Built-in Gemini is always available and is paid for by the platform; a Gemini key of your own moves the Gemini models onto your Google account instead.',
};

// deps: { mount, titleEl, cid, api, h, announce(text), onModels({ default, models }) }
export function createSettings(deps) {
  const { mount, titleEl, cid, api, h, announce, onModels } = deps;
  const base = `/api/charities/${encodeURIComponent(cid)}`;
  let token = 0;

  async function draw(my) {
    let data;
    try { data = await api(`${base}/ai/settings`); } catch (e) {
      if (my === token) mount.replaceChildren(h('p', { class: 'form-error', role: 'alert', text: `Settings could not be loaded. ${e.message}` }));
      return;
    }
    if (my !== token) return;
    const rows = data.providers.map((p) => row(p, data.connections[p.id] || { connected: false }, data.keysAvailable));
    mount.replaceChildren(
      h('p', { class: 'ai-note' }, 'Built-in Gemini needs nothing from you. To use Claude or ChatGPT, connect your charity\'s own key: the AI use is then billed to your account with that provider, not to the platform. Anyone in your charity can connect or remove a key. A key is checked with the provider, then stored encrypted, and only its last four characters are shown again.'),
      data.keysAvailable ? null : h('p', { class: 'form-error', role: 'alert', 'data-testid': 'keys-unavailable', text: 'Connecting your own keys is not available on this service yet.' }),
      h('ul', { class: 'connections', 'aria-label': 'AI connections' }, rows));
  }

  function row(p, c, canConnect) {
    const err = h('p', { class: 'field-error', role: 'alert', 'data-testid': `error-${p.id}`, hidden: true });
    const showError = (msg) => { err.textContent = msg; err.hidden = !msg; };
    const refresh = (res) => { onModels({ default: res.default, models: res.models }); return draw(token); };
    let control;
    if (c.connected) {
      const remove = h('button', { type: 'button', class: 'btn quiet', 'data-testid': `remove-${p.id}`, 'aria-label': `Remove the ${p.label} key` }, 'Remove');
      remove.addEventListener('click', async () => {
        if (!window.confirm(`Remove the ${p.label} key? Its models will stop working until you connect a key again.`)) return;
        remove.disabled = true;
        try {
          const res = await api(`${base}/ai/keys/${p.id}`, { method: 'DELETE' });
          announce(`${p.label} key removed.`);
          await refresh(res);
        } catch (e) { remove.disabled = false; showError(e.message); }
      });
      control = h('div', { class: 'conn-control' }, h('p', { class: 'conn-status', 'data-testid': `status-${p.id}`, text: `Connected, key ending ${c.last4}` }), remove);
    } else {
      const input = h('input', { type: 'password', id: `key-${p.id}`, autocomplete: 'off', spellcheck: 'false', 'data-testid': `key-${p.id}`, 'aria-label': `${p.label} key`, disabled: canConnect ? null : true });
      const connect = h('button', { type: 'button', class: 'btn primary', 'data-testid': `connect-${p.id}`, disabled: canConnect ? null : true }, 'Connect');
      const go = async () => {
        showError('');
        if (!input.value.trim()) { showError('Paste a key first.'); input.focus(); return; }
        connect.disabled = true;
        connect.textContent = 'Checking...';
        try {
          const res = await api(`${base}/ai/keys/${p.id}`, { method: 'PUT', json: { key: input.value } });
          input.value = '';
          announce(`${p.label} connected.`);
          await refresh(res);
        } catch (e) { connect.disabled = false; connect.textContent = 'Connect'; showError(e.message); }
      };
      connect.addEventListener('click', go);
      input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); go(); } });
      control = h('div', { class: 'conn-control' }, h('p', { class: 'conn-status', 'data-testid': `status-${p.id}`, text: 'Not connected' }), h('label', { for: `key-${p.id}`, class: 'sr-only', text: `${p.label} key` }), input, connect);
    }
    return h('li', { class: 'connection', 'data-provider': p.id }, h('h2', { text: p.label }), h('p', { class: 'ai-note', text: HELP[p.id] }), control, err);
  }

  return {
    show() { token += 1; titleEl.textContent = 'Settings'; mount.replaceChildren(h('p', { text: 'Loading...' })); void draw(token); },
    hide() { token += 1; },
  };
}
