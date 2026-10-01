import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { localAgentDevBridge } from './scripts/local-agent-dev-bridge.ts';
export default defineConfig({
  root: "apps/app",
  plugins: [react(), localAgentDevBridge()],
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
  server: { fs: { allow: ["."] } },
});
