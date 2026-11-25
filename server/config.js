// Runtime configuration, read from the environment. No secret and no email address is ever committed here.
// ADMIN_EMAILS, DATA_BUCKET, FIRESTORE_DATABASE, GEMINI_MODEL and GEMINI_LOCATION are set on the Cloud Run service by the deploy command.

export const PROJECT_NUMBER = '36580608208';
export const SERVICE_REGION = 'europe-west1';
export const SERVICE_NAME = 'charity-funding';
// The IAP JWT audience for a Cloud Run service behind IAP. The staging copy runs as another service
// (charity-funding-staging), so the audience follows K_SERVICE, the name Cloud Run gives the running service.
export const iapAudienceFor = (service) => `/projects/${PROJECT_NUMBER}/locations/${SERVICE_REGION}/services/${service}`;
export const IAP_AUDIENCE = iapAudienceFor(SERVICE_NAME);
const SERVICE_RE = /^[a-z][a-z0-9-]{0,62}$/;

export const normaliseEmail = (e) => String(e ?? '').trim().toLowerCase();
const EMAIL_RE = /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/;
export const isEmail = (e) => typeof e === 'string' && e.length <= 254 && EMAIL_RE.test(e);

// env: process.env (tests pass their own object).
// Throws when the configuration is unsafe: a development identity on Cloud Run, or no data bucket on Cloud Run.
export function readConfig(env = process.env) {
  const onCloudRun = Boolean(env.K_SERVICE);
  const devEmail = normaliseEmail(env.DEV_USER_EMAIL);
  if (onCloudRun && devEmail) throw new Error('DEV_USER_EMAIL must not be set on Cloud Run.');
  if (onCloudRun && !env.DATA_BUCKET) throw new Error('DATA_BUCKET must be set on Cloud Run.');
  const admins = new Set(String(env.ADMIN_EMAILS ?? '').split(/[,\s;]+/).map(normaliseEmail).filter(isEmail));
  return Object.freeze({
    onCloudRun,
    devUserEmail: devEmail || null,
    admins,
    dataBucket: env.DATA_BUCKET || null,
    kmsKey: env.KMS_KEY || null,
    geminiModel: env.GEMINI_MODEL || null,
    geminiLocation: env.GEMINI_LOCATION || null,
    firestoreDatabase: env.FIRESTORE_DATABASE || '(default)',
    iapAudience: SERVICE_RE.test(String(env.K_SERVICE ?? '')) ? iapAudienceFor(env.K_SERVICE) : IAP_AUDIENCE,
  });
}
