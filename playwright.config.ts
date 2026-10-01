import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './test/browser',
  timeout: 30_000,
  workers: 2,
  fullyParallel: true,
  reporter: [['list'], ['html', { outputFolder: 'test-results/browser-report', open: 'never' }]],
  outputDir: 'test-results/browser',
  use: { baseURL: 'http://127.0.0.1:5317', viewport: { width: 412, height: 915 }, screenshot: 'only-on-failure', trace: 'retain-on-failure', reducedMotion: 'reduce' },
  webServer: { command: 'npm run dev -- --port 5317 --strictPort', url: 'http://127.0.0.1:5317', reuseExistingServer: false },
});
