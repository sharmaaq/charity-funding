import { createMemoryStore } from './memory.js';

export const PROJECT_ID = 'charity-funding-514818';

// Cloud Run and anything with DATA_BUCKET uses Firestore + Cloud Storage; otherwise the in-memory store (dev/tests).
export async function createStore(config) {
  if (config.dataBucket) {
    const { createGcpStore } = await import('./gcp.js');
    return createGcpStore({ projectId: PROJECT_ID, bucket: config.dataBucket, databaseId: config.firestoreDatabase });
  }
  return createMemoryStore();
}
