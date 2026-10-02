import { registerPlugin } from './platform-plugins';
import { Capacitor } from '@capacitor/core';
import type { System as UpstreamSystem } from "../../../vendor/eliza/plugins/plugin-native-system/src/index";
const System = registerPlugin<typeof UpstreamSystem>("ElizaSystem");
export type InstalledApp = { packageName: string; label: string };
export const DeviceApps = registerPlugin<{
  list(): Promise<{ apps: InstalledApp[] }>;
  launch(options: { packageName: string }): Promise<void>;
  buildInfo(): Promise<{ launcher: boolean; version: string }>;
}>("DeviceApps");
export const isAndroid = Capacitor.getPlatform() === "android";
export { System };
