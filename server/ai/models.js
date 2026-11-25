// Which models a charity can run. Built-in Gemini models are always available. Claude and ChatGPT models are available
// once the charity has connected its own key (the charity pays for them); Gemini models switch to the charity's own
// Gemini key if it has connected one. `keys` is { anthropic?, openai?, gemini? } (decrypted, server side only).
import { DEFAULT_MODEL, MODELS, modelsFor } from './ai-core.mjs';
import { ServiceError } from '../errors.js';

export const allModels = (keys = {}) => modelsFor(keys, { builtInClaude: null });
export const availableModels = (keys = {}) => allModels(keys).filter((m) => m.available);

// What the browser sees: never a key.
export const publicModel = (m) => ({ id: m.id, label: m.label, provider: m.provider, available: m.available, note: m.note });

const KEY_OF = { gemini: 'gemini', claude: 'anthropic', openai: 'openai' };

// id: the picker's value ('gemini:gemini-3.8-flash'), or empty for the default. Returns { provider, model, label, key? }.
export function resolveModel(id, keys = {}) {
  const wanted = id || DEFAULT_MODEL;
  const m = availableModels(keys).find((x) => x.id === wanted);
  if (!m) {
    if (MODELS.some((x) => x.id === wanted)) throw new ServiceError('invalid', 'Connect your own key for that model in Settings first.');
    throw new ServiceError('invalid', 'Choose one of the listed AI models.');
  }
  const key = keys[KEY_OF[m.provider]];
  return { provider: m.provider, model: m.model, label: m.label, ...(key ? { key } : {}) };
}

export { DEFAULT_MODEL };
