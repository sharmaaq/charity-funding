// SHARED MODULE - the master copy is aifin/shared/ai-core.mjs. Copies live in each app's src/.
// Change the master, then run `node aifin/shared/sync.mjs` to copy it out. `--check` fails if a copy differs.
//
// The parts of the AI layer that every Aifin suite app shares: the model list, which models a user can run,
// the Google token for Vertex AI, checking a user's API key, and parsing JSON from model output.
// Each app keeps its own runners (streaming or not, Agent SDK or plain API) in its own src/ai file.
import { execSync } from 'node:child_process';

export const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || process.env.ANTHROPIC_VERTEX_PROJECT_ID || 'tenders-514907';
export const ON_CLOUD_RUN = !!process.env.K_SERVICE;

export const MODELS = [
  { id: 'gemini:gemini-3.8-flash', provider: 'gemini', model: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (fast, built in)' },
  { id: 'gemini:gemini-4-carbon', provider: 'gemini', model: 'gemini-4-carbon', label: 'Gemini 4 Carbon (strongest Gemini, built in)' },
  { id: 'claude:claude-opus-5-5', provider: 'claude', model: 'claude-opus-5-5', label: 'Claude Opus 5.5' },
  { id: 'claude:claude-sonnet-5-5', provider: 'claude', model: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (faster)' },
  { id: 'openai:gpt-6.2-astra', provider: 'openai', model: 'gpt-6.2-astra', label: 'ChatGPT: GPT-6.2 Astra' },
  { id: 'openai:gpt-6.2-sol', provider: 'openai', model: 'gpt-6.2-sol', label: 'ChatGPT: GPT-6.2 Sol (faster)' },
];
export const DEFAULT_MODEL = 'gemini:gemini-3.8-flash';
export const PROVIDER_NAMES = { gemini: 'Google Gemini', claude: 'Anthropic Claude', openai: 'OpenAI ChatGPT' };

/**
 * Which models this user can run, given the keys they have saved.
 * builtInClaude: a label when the app can run Claude without the user's key (for example 'built in (Vertex AI)'), else null.
 */
export function modelsFor(keys, { builtInClaude = null } = {}) {
  return MODELS.map((m) => {
    let available = true;
    let note = '';
    if (m.provider === 'gemini') note = keys.gemini ? 'your Gemini API key' : 'built in, billed to the project';
    if (m.provider === 'claude') {
      if (keys.anthropic) note = 'your Anthropic API key';
      else if (builtInClaude) note = builtInClaude;
      else { available = false; note = 'connect your Anthropic API key in Settings'; }
    }
    if (m.provider === 'openai') {
      if (keys.openai) note = 'your OpenAI API key';
      else { available = false; note = 'connect your OpenAI API key in Settings'; }
    }
    return { ...m, available, note };
  });
}

/** The first JSON object or array in a model's text answer, or null. */
export function firstJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  for (const cand of [fenced?.[1], text.match(/\{[\s\S]*\}/)?.[0], text.match(/\[[\s\S]*\]/)?.[0]]) {
    if (!cand) continue;
    try { return JSON.parse(cand); } catch {}
  }
  return null;
}

export const schemaNote = (schema) => `\n\nReturn ONLY a JSON object that matches this JSON Schema, with no other text:\n${JSON.stringify(schema)}`;

/** A provider's error message from a failed response. */
export async function failText(res) {
  const t = await res.text();
  try { const j = JSON.parse(t); return j.error?.message || t; } catch { return t.slice(0, 400); }
}

let cachedToken = null;
/** A Google access token: the Cloud Run service account, or the local gcloud login. */
export async function googleToken() {
  if (cachedToken && cachedToken.exp > Date.now() + 60e3) return cachedToken.value;
  if (ON_CLOUD_RUN) {
    const r = await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', { headers: { 'Metadata-Flavor': 'Google' } });
    const j = await r.json();
    cachedToken = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  } else {
    cachedToken = { value: execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim(), exp: Date.now() + 30 * 60e3 };
  }
  return cachedToken.value;
}

/** Check a key works before saving it. provider: anthropic | openai | gemini. Returns null if fine, or an error message. */
export async function testKey(provider, key) {
  try {
    const r = provider === 'openai'
      ? await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${key}` } })
      : provider === 'anthropic'
        ? await fetch('https://api.anthropic.com/v1/models', { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' } })
        : await fetch('https://generativelanguage.googleapis.com/v1beta/models', { headers: { 'x-goog-api-key': key } });
    return r.ok ? null : `The ${PROVIDER_NAMES[provider === 'anthropic' ? 'claude' : provider]} key was rejected (${r.status}): ${(await failText(r)).slice(0, 160)}`;
  } catch (e) {
    return `Could not check the key: ${e.message}`;
  }
}
