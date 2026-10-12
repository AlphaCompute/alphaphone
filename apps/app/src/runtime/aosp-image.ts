import { Capacitor } from '@capacitor/core';
/**
 * Alpha AOSP image capability (owner decision P-36, issue #420).
 *
 * Phone, Contacts and SMS exist only on the Alpha AOSP image. The capability is decided by native
 * code from facts an ordinary install cannot produce (see AlphaImageCapability.java): the launcher
 * build preinstalled on a system partition, with the image's own system feature, in a build without
 * test mocks. MainActivity registers the `AlphaTelephony` plugin only then, so the renderer reads the
 * answer from the plugin headers Capacitor injects before any page script runs. Nothing here reads a
 * URL, storage, a build flag or the launcher flavor: a standalone APK, a sideloaded launcher APK, a
 * browser and a test-mocks development server all read `false`, and restored state cannot change it.
 */
export const AOSP_TELEPHONY_PLUGIN = 'AlphaTelephony';
/** The native method whose presence marks the verified capability. */
export const AOSP_IMAGE_METHOD = 'imageCapability';
/** Views the owner decision limits to the Alpha AOSP image. */
export const AOSP_IMAGE_VIEWS: readonly string[] = Object.freeze(['phone', 'messages', 'contacts']);
/**
 * Image views whose in-app surface is backed by a reviewed native adapter. The prototype Phone,
 * Messages and Contacts views simulate calls, messages and a local address book, so none is admitted
 * yet: admitting one requires replacing its simulated actions with the AlphaTelephony contract
 * (aosp-telephony.ts) and on-image acceptance. Until then the views stay closed exactly as on a
 * standalone install. The Home drawer's Phone entry is not one of these views: it opens Android's own
 * dialer with no number, the retained stock dialer and emergency path of the HOME launcher build.
 * Native code resolves it only in the launcher build (DeviceAppsPlugin.roleIntent), so a standalone
 * APK shows no Phone entry. Whether a sideloaded launcher on a stock phone keeps it is an open owner question.
 */
export const ADMITTED_AOSP_VIEW_ADAPTERS: readonly string[] = Object.freeze([]);

type Header = { name?: unknown; methods?: readonly { name?: unknown }[] };
/** True only for an Android bridge whose native side registered the image-only plugin. */
export function detectAospImage(platform: string, headers: unknown): boolean {
  if (platform !== 'android' || !Array.isArray(headers)) return false;
  const header = (headers as Header[]).find(entry => entry?.name === AOSP_TELEPHONY_PLUGIN);
  return !!header && Array.isArray(header.methods) && header.methods.some(method => method?.name === AOSP_IMAGE_METHOD);
}
/** Views available in this install: an image view needs both the image and an admitted adapter. */
export function admittedAospViews(image: boolean, admitted: readonly string[] = ADMITTED_AOSP_VIEW_ADAPTERS): string[] {
  return image ? admitted.filter(view => AOSP_IMAGE_VIEWS.includes(view)) : [];
}

const capacitor = Capacitor as typeof Capacitor & { PluginHeaders?: unknown };
/** Read once at module load; the native registration cannot change while the page lives. */
export const aospImage: boolean = detectAospImage(Capacitor.getPlatform(), capacitor.PluginHeaders);
