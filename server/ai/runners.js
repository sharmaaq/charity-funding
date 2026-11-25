// One entry point for every AI model: runAI(choice, opts). Plain REST calls, no SDK (S5-001 D1).
//   gemini  Gemini on Vertex AI in the platform's Google Cloud project, with the Cloud Run service account. If the
//           charity has its own Gemini key (Phase D), the Gemini API is used instead, billed to the charity.
//   claude  Anthropic Messages API with the charity's own key (Phase D).
//   openai  OpenAI Responses API with the charity's own key (Phase D).
// choice: { provider, model, label?, key? }. opts: { system, prompt, history, schema, web, onEvent, signal }.
// Returns { text, structured, isError, error, provider, model, searches, sources }.
// onEvent receives { type: 'status' | 'text' | 'tool' | 'source', ... }.
import { PROJECT, firstJson, schemaNote, failText, googleToken } from './ai-core.mjs';

async function* sse(res) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true }).replace(/\r\n/g, '\n');
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const data = chunk.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('\n');
      if (data && data !== '[DONE]') { try { yield JSON.parse(data); } catch { /* skip a broken event */ } }
    }
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function runGemini(choice, opts) {
  const { system, prompt, history = [], schema, web = true, onEvent = () => {}, signal } = opts;
  const url = choice.key
    ? `https://generativelanguage.googleapis.com/v1beta/models/${choice.model}:streamGenerateContent?alt=sse`
    : `https://aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/global/publishers/google/models/${choice.model}:streamGenerateContent?alt=sse`;
  const headers = { 'Content-Type': 'application/json', ...(choice.key ? { 'x-goog-api-key': choice.key } : { Authorization: `Bearer ${await googleToken()}` }) };
  const contents = [
    ...history.map((h) => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.text }] })),
    { role: 'user', parts: [{ text: prompt + (schema ? schemaNote(schema) : '') }] },
  ];
  const body = {
    systemInstruction: { parts: [{ text: system || '' }] },
    contents,
    ...(web ? { tools: [{ googleSearch: {} }] } : {}),
    ...(schema && !web ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
  };
  onEvent({ type: 'status', text: `${choice.label || choice.model} is working` });
  let res;
  for (const wait of [0, 3000, 8000, 15000]) {
    if (wait) { onEvent({ type: 'status', text: `Model busy, retrying in ${wait / 1000}s` }); await sleep(wait); }
    res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal });
    if (res.status !== 429 && res.status !== 503) break;
  }
  if (!res.ok) return { text: '', isError: true, error: `Gemini: ${await failText(res)}`, searches: [], sources: [] };
  let text = '';
  const searches = [];
  const sources = new Map();
  let finish = null;
  for await (const ev of sse(res)) {
    const c = ev.candidates?.[0];
    for (const p of c?.content?.parts || []) {
      if (p.text && !p.thought) { text += p.text; onEvent({ type: 'text', text: p.text }); }
    }
    for (const q of c?.groundingMetadata?.webSearchQueries || []) {
      if (!searches.includes(q)) { searches.push(q); onEvent({ type: 'tool', name: 'Google Search', detail: q }); }
    }
    for (const g of c?.groundingMetadata?.groundingChunks || []) {
      const uri = g.web?.uri;
      if (uri && !sources.has(uri)) { sources.set(uri, g.web.title || ''); onEvent({ type: 'source', url: uri, title: g.web.title || '' }); }
    }
    if (c?.finishReason) finish = c.finishReason;
  }
  const bad = finish && !['STOP', 'MAX_TOKENS'].includes(finish);
  return { text, isError: Boolean(bad && !text), error: bad ? `Gemini stopped: ${finish}` : null, searches, sources: [...sources].map(([url, title]) => ({ url, title })) };
}

export async function runClaude(choice, opts) {
  const { system, prompt, history = [], schema, web = true, onEvent = () => {}, signal } = opts;
  const messages = [
    ...history.map((h) => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.text })),
    { role: 'user', content: prompt + (schema ? schemaNote(schema) : '') },
  ];
  const body = {
    model: choice.model,
    max_tokens: 16000,
    system: system || undefined,
    messages,
    stream: true,
    ...(web ? { tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 8 }] } : {}),
  };
  onEvent({ type: 'status', text: `${choice.label || choice.model} is working` });
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': choice.key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) return { text: '', isError: true, error: `Claude: ${await failText(res)}`, searches: [], sources: [] };
  let text = '';
  let error = null;
  const searches = [];
  const sources = new Map();
  const blocks = new Map(); // index -> { search: true, json: '' }
  for await (const ev of sse(res)) {
    if (ev.type === 'content_block_start' && ev.content_block?.type === 'server_tool_use') blocks.set(ev.index, { json: '' });
    else if (ev.type === 'content_block_start' && ev.content_block?.type === 'web_search_tool_result' && Array.isArray(ev.content_block.content)) {
      for (const r of ev.content_block.content) if (r.url && !sources.has(r.url)) { sources.set(r.url, r.title || ''); onEvent({ type: 'source', url: r.url, title: r.title || '' }); }
    } else if (ev.type === 'content_block_delta') {
      if (ev.delta?.type === 'text_delta') { text += ev.delta.text; onEvent({ type: 'text', text: ev.delta.text }); }
      else if (ev.delta?.type === 'input_json_delta' && blocks.has(ev.index)) blocks.get(ev.index).json += ev.delta.partial_json || '';
    } else if (ev.type === 'content_block_stop' && blocks.has(ev.index)) {
      try {
        const q = JSON.parse(blocks.get(ev.index).json || '{}').query;
        if (q && !searches.includes(q)) { searches.push(q); onEvent({ type: 'tool', name: 'Web search', detail: q }); }
      } catch { /* no query */ }
      blocks.delete(ev.index);
    } else if (ev.type === 'error') error = ev.error?.message || 'Claude request failed';
  }
  return { text, isError: Boolean(error && !text), error, searches, sources: [...sources].map(([url, title]) => ({ url, title })) };
}

export async function runOpenAI(choice, opts) {
  const { system, prompt, history = [], schema, web = true, onEvent = () => {}, signal } = opts;
  const input = [
    ...history.map((h) => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.text })),
    { role: 'user', content: prompt },
  ];
  const body = {
    model: choice.model,
    instructions: system || undefined,
    input,
    stream: true,
    ...(web ? { tools: [{ type: 'web_search' }] } : {}),
    ...(schema ? { text: { format: { type: 'json_schema', name: 'result', schema, strict: false } } } : {}),
  };
  onEvent({ type: 'status', text: `${choice.label || choice.model} is working` });
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${choice.key}` },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) return { text: '', isError: true, error: `OpenAI: ${await failText(res)}`, searches: [], sources: [] };
  let text = '';
  let error = null;
  const searches = [];
  for await (const ev of sse(res)) {
    if (ev.type === 'response.output_text.delta') { text += ev.delta; onEvent({ type: 'text', text: ev.delta }); }
    else if ((ev.type === 'response.output_item.added' || ev.type === 'response.output_item.done') && ev.item?.type === 'web_search_call') {
      const q = ev.item.action?.query;
      if (q && !searches.includes(q)) { searches.push(q); onEvent({ type: 'tool', name: 'Web search', detail: q }); }
    } else if (ev.type === 'error' || ev.type === 'response.failed') error = ev.error?.message || ev.response?.error?.message || 'OpenAI request failed';
  }
  return { text, isError: Boolean(error && !text), error, searches, sources: [] };
}

// The real runner. Tests and local development pass a fake with the same shape (see ./fake-runner.js).
export async function runAI(choice, opts) {
  const run = { gemini: runGemini, claude: runClaude, openai: runOpenAI }[choice.provider];
  if (!run) throw new Error(`Unknown AI provider ${choice.provider}`);
  const out = await run(choice, opts);
  if (opts.schema && !out.structured && out.text) out.structured = firstJson(out.text);
  return { ...out, provider: choice.provider, model: choice.model };
}
