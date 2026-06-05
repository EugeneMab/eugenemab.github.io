import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './src',
  use: {
    baseURL: 'http://localhost:7878',
  },
  webServer: {
    command: 'npm run serve',
    url: 'http://localhost:7878',
    reuseExistingServer: !process.env.CI,
  },
});
