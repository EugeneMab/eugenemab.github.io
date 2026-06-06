import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './src',
  testMatch: /.*\.ui\.test\.ts/,
  use: {
    baseURL: 'http://localhost:7878',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run serve',
    url: 'http://localhost:7878',
    reuseExistingServer: !process.env.CI,
  },
});
