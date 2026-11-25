// One free-text note per grant per charity (REQ-039). Shared by the browser and the server.

export const NOTE_MAX = 5000;

// Returns { ok: true, text } or { ok: false, message }. An empty note is valid: it deletes the saved one.
export function validateNote(input) {
  if (typeof input !== 'string') return { ok: false, message: 'The note must be text.' };
  if (input.length > NOTE_MAX) return { ok: false, message: `A note can be at most ${NOTE_MAX.toLocaleString('en-GB')} characters.` };
  return { ok: true, text: input };
}
