// Seeds a charity into the configured store. Idempotent.
//   DATA_BUCKET=charity-funding-514818-data npm run seed -- --charity your-place
//   npm run seed -- --charity all
// Uses application default credentials (gcloud auth application-default login) or, when GCLOUD_ACCESS_TOKEN is set,
// that OAuth access token (for example: GCLOUD_ACCESS_TOKEN=$(gcloud auth print-access-token)).
// Without DATA_BUCKET it seeds a throwaway in-memory store (useful only as a dry run).
import { OAuth2Client } from 'google-auth-library';
import { readConfig } from '../server/config.js';
import { createMemoryStore } from '../server/store/memory.js';
import { CHARITIES, seedAll, seedCharity } from '../server/seed/index.js';

const args = process.argv.slice(2);
const i = args.indexOf('--charity');
const which = i >= 0 ? args[i + 1] : null;
if (!which || (which !== 'all' && !CHARITIES[which])) {
  console.error(`Usage: npm run seed -- --charity <${['all', ...Object.keys(CHARITIES)].join('|')}>`);
  process.exit(2);
}
const config = readConfig({ ...process.env, K_SERVICE: '', DEV_USER_EMAIL: '' });
let store;
if (config.dataBucket) {
  const { createGcpStore } = await import('../server/store/gcp.js');
  let authClient;
  if (process.env.GCLOUD_ACCESS_TOKEN) {
    authClient = new OAuth2Client();
    authClient.setCredentials({ access_token: process.env.GCLOUD_ACCESS_TOKEN });
  }
  store = createGcpStore({ projectId: 'charity-funding-514818', bucket: config.dataBucket, authClient });
} else {
  console.log('DATA_BUCKET is not set: seeding an in-memory store (dry run).');
  store = createMemoryStore();
}
const out = which === 'all' ? await seedAll(store) : [await seedCharity(store, which)];
console.log(JSON.stringify(out));
