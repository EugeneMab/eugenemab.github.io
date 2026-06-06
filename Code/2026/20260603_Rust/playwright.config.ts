import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './src',
  testMatch: /.*\.ui\.test\.ts/,
  use: {
    baseURL: 'http://localhost:17878',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run serve:test-ui',
    url: 'http://localhost:17878',
    reuseExistingServer: !process.env.CI,
  },
});
