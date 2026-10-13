// Playwright end-to-end tests (prompt 116). Run against a server that is already up:
//   npm run dev            (localhost:3000)
//   npm run test:e2e       (PW_BASE_URL=... to point elsewhere)
// The tests create small standalone test rooms through /create/sessions on the shared
// database, like any visitor would. PW_CHROMIUM_PATH can point at an installed Chrome when
// Playwright's own browser is not downloaded (`npx playwright install chromium` otherwise).
import { defineConfig } from '@playwright/test';

const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: './e2e',
  timeout: 600_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.PW_BASE_URL || 'http://localhost:3000',
    launchOptions: executablePath ? { executablePath } : {},
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'phone', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'tablet', use: { viewport: { width: 820, height: 1180 }, hasTouch: true } },
    { name: 'laptop', use: { viewport: { width: 1280, height: 800 } } },
  ],
});
