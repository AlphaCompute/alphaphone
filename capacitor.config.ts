import type { CapacitorConfig } from "@capacitor/cli";
import identity from "./app.config.json" with { type: "json" };
const config: CapacitorConfig = {
  appId: identity.appId,
  appName: identity.appName,
  webDir: "web-dist",
  loggingBehavior: "none",
  plugins: { SystemBars: { style: "LIGHT", insetsHandling: "disable" } },
  server: { androidScheme: "https" },
  android: { path: "android", allowMixedContent: false },
};
export default config;
