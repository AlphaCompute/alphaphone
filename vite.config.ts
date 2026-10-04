import {localOcrAssets} from './scripts/local-ocr-assets.ts';
import { browserPdfAssets } from './scripts/browser-pdf-assets.ts';
import { browserFullReload } from './scripts/browser-full-reload.ts';
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { localAgentDevBridge } from './scripts/local-agent-dev-bridge.ts';
export default defineConfig({
  root: "apps/app",
  plugins: [localOcrAssets(), browserPdfAssets(), browserFullReload(), react(), localAgentDevBridge()],
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
  build: { outDir: "../../web-dist", emptyOutDir: true },
  server: { fs: { allow: [
    fileURLToPath(new URL('./apps/app', import.meta.url)),
    fileURLToPath(new URL('./.eliza/client-features', import.meta.url)),
    fileURLToPath(new URL('./node_modules', import.meta.url)),
    fileURLToPath(new URL('./vendor/eliza/plugins/plugin-native-system', import.meta.url)),
    fileURLToPath(new URL('./vendor/eliza/plugins/plugin-assistant/src/services/device-actions', import.meta.url)),
  ] } },
});
