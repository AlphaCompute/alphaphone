import {localOcrAssets} from './scripts/local-ocr-assets.ts';
import { browserPdfAssets } from './scripts/browser-pdf-assets.ts';
import { browserFullReload } from './scripts/browser-full-reload.ts';
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { localAgentDevBridge } from './scripts/local-agent-dev-bridge.ts';

// One switch, upstream name (vendor/eliza/packages/app/scripts/dev-ui.ts): "1" opts
// test-only mocks, fixtures and developer surfaces into a build. Anything else is off.
// Only this single key is exposed; envPrefix stays VITE_ so ELIZA_* secrets never reach the bundle.
const flagOn = process.env.ELIZA_DEV_ALLOW_TEST_MOCKS === '1' || process.env.VITE_ELIZA_DEV_ALLOW_TEST_MOCKS === '1';
const appConfig = JSON.parse(readFileSync(fileURLToPath(new URL('./app.config.json', import.meta.url)), 'utf8')) as { version?: unknown };
const appVersion = process.env.ELIZAOS_VERSION_NAME?.trim() || (typeof appConfig.version === 'string' ? appConfig.version : '0.0.0');
const prototypeDirectory = fileURLToPath(new URL('./apps/app/src/prototype/', import.meta.url));
const fixturesModule = path.join(prototypeDirectory, 'fixtures.js');
const emptyFixturesModule = path.join(prototypeDirectory, 'fixtures.empty.js');

// Modules that main.tsx and the connection UI import dynamically behind the flag. A
// dead dynamic import can still emit an orphan chunk, so flag-off builds resolve them
// to an empty module. Their call sites are constant-folded away and never run.
const flaggedDynamicModules = new Set(['./browser/device-controls', './browser/simulated-apps', './runtime/mock-admission', './mock-admission']);
const disabledModule = '\0alpha-test-mocks-disabled';
const srcDirectory = fileURLToPath(new URL('./apps/app/src/', import.meta.url));

/** Production CSP. Dev serve stays relaxed for HMR and the local agent bridge. */
export function productionContentSecurityPolicy(testMocks: boolean): string {
  const connect = ["'self'", 'https:', ...(testMocks ? ['http://10.0.2.2:*', 'http://127.0.0.1:*', 'http://localhost:*'] : [])];
  return [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "worker-src 'self' blob:",
    `connect-src ${connect.join(' ')}`,
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob:",
    "font-src 'self' data:",
    "frame-src 'self' blob: data: https:",
    "style-src 'self' 'unsafe-inline'",
    "object-src 'none'",
    "base-uri 'none'",
  ].join('; ');
}

/** Build-only CSP meta, build-flag record and fixture swap for flag-off builds. */
function productionSurface(): Plugin[] {
  return [
    {
      name: 'alpha-test-mock-fixtures',
      enforce: 'pre',
      async resolveId(source, importer, options) {
        if (flagOn || !/(^|\/)fixtures(\.js)?$/.test(source)) return null;
        const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
        if (!resolved || resolved.external) return null;
        const id = resolved.id.split('?')[0];
        // Tolerates a tree where the fixture module has not been extracted yet.
        if (path.resolve(id) !== fixturesModule || !existsSync(emptyFixturesModule)) return null;
        return emptyFixturesModule;
      },
    },
    {
      name: 'alpha-test-mock-modules',
      enforce: 'pre',
      resolveId(source, importer) {
        if (flagOn || !importer || !flaggedDynamicModules.has(source)) return null;
        const owner = path.relative(srcDirectory, importer.split('?')[0]).split(path.sep).join('/');
        if (owner !== 'main.tsx' && owner !== 'runtime/connection-ui.tsx') return null;
        return disabledModule;
      },
      load(id) { return id === disabledModule ? 'export {};' : null; },
    },
    {
      name: 'alpha-production-csp',
      apply: 'build',
      transformIndexHtml: {
        order: 'pre',
        handler: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: productionContentSecurityPolicy(flagOn) }, injectTo: 'head-prepend' }],
      },
    },
    {
      name: 'alpha-build-flags',
      apply: 'build',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'build-flags.json', source: JSON.stringify({ testMocks: flagOn }) + '\n' });
      },
    },
  ];
}

export default defineConfig({
  root: "apps/app",
  plugins: [productionSurface(), localOcrAssets(), browserPdfAssets(), browserFullReload(), react(), localAgentDevBridge()],
  define: {
    'import.meta.env.VITE_ELIZA_DEV_ALLOW_TEST_MOCKS': JSON.stringify(flagOn ? '1' : ''),
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  resolve: {
    alias: {
      "@eliza-system": fileURLToPath(
        new URL(
          "./vendor/eliza/plugins/plugin-native-system/src/index.ts",
          import.meta.url,
        ),
      ),
    },
  },
  build: { outDir: "../../web-dist", emptyOutDir: true, sourcemap: false },
  server: { fs: { allow: [
    fileURLToPath(new URL('./apps/app', import.meta.url)),
    fileURLToPath(new URL('./.eliza/client-features', import.meta.url)),
    fileURLToPath(new URL('./node_modules', import.meta.url)),
    fileURLToPath(new URL('./vendor/eliza/plugins/plugin-native-system', import.meta.url)),
    fileURLToPath(new URL('./vendor/eliza/plugins/plugin-assistant/src/services/device-actions', import.meta.url)),
  ] } },
});
