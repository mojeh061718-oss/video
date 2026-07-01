import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Some environments pre-install a Chromium binary instead of the
// playwright-managed download; use it when present.
function chromiumPath() {
  const preinstalled = '/opt/pw-browsers/chromium';
  return existsSync(preinstalled) ? { launchOptions: { executablePath: preinstalled } } : {};
}

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5173/video/',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173/video/',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], ...chromiumPath() } },
    // iPad-sized viewport with touch, approximating the primary target device.
    {
      name: 'tablet',
      use: {
        ...devices['iPad (gen 7)'],
        defaultBrowserType: 'chromium',
        browserName: 'chromium',
        ...chromiumPath(),
      },
    },
  ],
});
