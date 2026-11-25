import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IAP_AUDIENCE, readConfig } from '../../server/config.js';

const base = { DATA_BUCKET: 'b' };

test('production keeps the charity-funding IAP audience and default Firestore database', () => {
  const cfg = readConfig({ ...base, K_SERVICE: 'charity-funding' });
  assert.equal(cfg.iapAudience, IAP_AUDIENCE);
  assert.equal(cfg.firestoreDatabase, '(default)');
});

test('the staging service gets its own IAP audience and Firestore database', () => {
  const cfg = readConfig({ ...base, K_SERVICE: 'charity-funding-staging', FIRESTORE_DATABASE: 'staging' });
  assert.equal(cfg.iapAudience, '/projects/36580608208/locations/europe-west1/services/charity-funding-staging');
  assert.equal(cfg.firestoreDatabase, 'staging');
});

test('an unusable K_SERVICE falls back to the production audience', () => {
  assert.equal(readConfig({ ...base, K_SERVICE: 'Bad/Name' }).iapAudience, IAP_AUDIENCE);
  assert.equal(readConfig({}).iapAudience, IAP_AUDIENCE);
});
