import { defineConfig } from '@playwright/test';

const PORT = 8091;

const viewport = (width, height) => ({ browserName: 'chromium', viewport: { width, height } });

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
  },
  projects: [
    { name: 'phone-360', use: viewport(360, 740) },
    { name: 'phone-390', use: viewport(390, 844) },
    { name: 'desktop-1280', use: viewport(1280, 800) },
  ],
  webServer: {
    command: 'node server.js',
    url: `http://127.0.0.1:${PORT}/healthz`,
    env: { PORT: String(PORT) },
    reuseExistingServer: false,
    timeout: 30000,
  },
});
