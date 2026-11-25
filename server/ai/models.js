// Which models a charity can run. Phase B: the built-in Gemini models only. Claude and ChatGPT arrive with the
// charity's own keys (Phase D), which fill in `keys`.
import { DEFAULT_MODEL, MODELS, modelsFor } from './ai-core.mjs';
import { ServiceError } from '../errors.js';

export function availableModels(keys = {}) {
  return modelsFor(keys, { builtInClaude: null }).filter((m) => m.available);
}

export const publicModel = (m) => ({ id: m.id, label: m.label, provider: m.provider, note: m.note });

// id: the picker's value ('gemini:gemini-3.8-flash'), or empty for the default. Returns { provider, model, label, key? }.
export function resolveModel(id, keys = {}) {
  const wanted = id || DEFAULT_MODEL;
  const m = availableModels(keys).find((x) => x.id === wanted);
  if (!m) {
    if (MODELS.some((x) => x.id === wanted)) throw new ServiceError('invalid', 'That model is not available yet for this charity.');
    throw new ServiceError('invalid', 'Choose one of the listed AI models.');
  }
  return { provider: m.provider, model: m.model, label: m.label };
}

export { DEFAULT_MODEL };
