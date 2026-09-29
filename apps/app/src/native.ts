import { Capacitor, registerPlugin } from "@capacitor/core";
import { System } from "../../../vendor/eliza/plugins/plugin-native-system/src/index";
export type InstalledApp = { packageName: string; label: string };
export const DeviceApps = registerPlugin<{
  list(): Promise<{ apps: InstalledApp[] }>;
  launch(options: { packageName: string }): Promise<void>;
  buildInfo(): Promise<{ launcher: boolean; version: string }>;
}>("DeviceApps");
export const isAndroid = Capacitor.getPlatform() === "android";
export { System };
