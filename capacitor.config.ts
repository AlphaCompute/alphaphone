import type { CapacitorConfig } from "@capacitor/cli";
import identity from "./app.config.json" with { type: "json" };
const config: CapacitorConfig = {
  appId: identity.appId,
  appName: identity.appName,
  webDir: "web-dist",
  loggingBehavior: "none",
  server: { androidScheme: "https" },
  android: { path: "android", allowMixedContent: false },
};
export default config;
