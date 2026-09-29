import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
export default defineConfig({
  root: "apps/app",
  plugins: [react()],
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
