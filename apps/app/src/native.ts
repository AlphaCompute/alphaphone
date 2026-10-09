import { registerPlugin } from './platform-plugins';
import { Capacitor } from '@capacitor/core';
import type { System as UpstreamSystem } from "../../../vendor/eliza/plugins/plugin-native-system/src/index";
const System = registerPlugin<typeof UpstreamSystem>("ElizaSystem");
/** One launchable package. `icon` is a small PNG data URL when the platform can render one. */
export type InstalledApp = { packageName: string; label: string; icon?: string };
/** Default-handler roles Alpha hands off to instead of implementing itself. */
export type DefaultAppRole = 'dial';
export type DefaultApp = { role: DefaultAppRole; available: boolean; packageName?: string; label?: string; icon?: string };
export const DeviceApps = registerPlugin<{
  list(options?: { icons?: boolean }): Promise<{ apps: InstalledApp[] }>;
  launch(options: { packageName: string }): Promise<void>;
  /** Resolves, without launching, the handler Android would use for the role. */
  resolveDefault(options: { role: DefaultAppRole }): Promise<DefaultApp>;
  /** Opens the role's handler with no data (an empty dial pad for 'dial'). */
  openDefault(options: { role: DefaultAppRole }): Promise<void>;
  buildInfo(): Promise<{ launcher: boolean; version: string }>;
  /** Device locale (BCP 47) and Android's 24-hour setting. */
  localeInfo(): Promise<{ locale: string; hour24: boolean }>;
}>("DeviceApps");
export const isAndroid = Capacitor.getPlatform() === "android";
export { System };
