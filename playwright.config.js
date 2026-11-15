import { defineConfig } from '@playwright/test';

const PORT = 8091;
// Set BASE_URL to run the suite against a deployed site; no local server is started then.
const BASE_URL = process.env.BASE_URL ? process.env.BASE_URL.replace(/\/+$/, '') : null;

const viewport = (width, height) => ({ browserName: 'chromium', viewport: { width, height } });

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL || `http://127.0.0.1:${PORT}`,
  },
  projects: [
    // Storage-heavy tests (10 MiB uploads, transactions) do not depend on the viewport: desktop only.
    { name: 'phone-360', use: viewport(360, 740), testIgnore: /organisation-storage/ },
    { name: 'phone-390', use: viewport(390, 844), testIgnore: /organisation-storage/ },
    { name: 'desktop-1280', use: viewport(1280, 800) },
  ],
  webServer: BASE_URL ? undefined : {
    command: 'node server.js',
    url: `http://127.0.0.1:${PORT}/healthz`,
    env: { PORT: String(PORT) },
    reuseExistingServer: false,
    timeout: 30000,
  },
});
