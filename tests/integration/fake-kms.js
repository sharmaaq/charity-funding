// A fake KMS and key check for tests: reversible, records every call, and never touches the network.
export function createFakeKms() {
  const calls = [];
  return {
    calls,
    async encrypt(text) { calls.push('encrypt'); return `fake:${Buffer.from(text.split('').reverse().join('')).toString('base64')}`; },
    async decrypt(blob) { calls.push('decrypt'); return Buffer.from(blob.slice(5), 'base64').toString('utf8').split('').reverse().join(''); },
  };
}
// A key that starts with "bad" is rejected, as a provider would; anything else passes. Records what it was asked to check.
export const fakeTestKey = Object.assign(async (provider, key) => { fakeTestKey.calls.push([provider, key]); return key.startsWith('bad') ? `The ${provider} key was rejected (401): invalid.` : null; }, { calls: [] });
