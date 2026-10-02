import { defineConfig } from '@playwright/test';
const port=Number(process.env.ALPHA_BROWSER_TEST_PORT||5317);
export default defineConfig({
  testDir: './test/browser',
  timeout: 30_000,
  workers: 2,
  fullyParallel: true,
  reporter: [['list'], ['html', { outputFolder: 'test-results/browser-report', open: 'never' }]],
  outputDir: 'test-results/browser',
  use: { baseURL: `http://127.0.0.1:${port}`, viewport: { width: 412, height: 915 }, screenshot: 'only-on-failure', trace: 'retain-on-failure', reducedMotion: 'reduce' },
  webServer: { command: `npm run dev -- --port ${port} --strictPort`, url: `http://127.0.0.1:${port}`, reuseExistingServer: false },
});
