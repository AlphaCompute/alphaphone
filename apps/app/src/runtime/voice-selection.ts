import { browserDevProfile } from '../browser/dev-profile';
import { connectionController } from './connection-ui';

/**
 * Speech route policy. On-device speech is the default everywhere. Eliza Cloud speech
 * (billed to the signed-in account) is used only after the user explicitly chose it with
 * the credit disclosure, and that choice is the persisted `voice-route:v1` preference.
 * A signed-in Cloud session alone never selects Cloud.
 */
// Plain constants and function exports only: Node contract tests evaluate this source directly.
const voiceRouteKey = 'alphaphone:voice-route:v1';
const speakRepliesKey = 'alphaphone:speak-replies:v1';
const voicePreferencesEvent = 'alpha:voice-preferences';
/** Storage keys and the change event, for Settings and diagnostics. */
export function voicePreferenceKeys() { return { route: voiceRouteKey, speakReplies: speakRepliesKey, event: voicePreferencesEvent }; }
export type VoiceRouteChoice = 'device' | 'cloud';
export type VoicePreference = 'default' | 'device' | 'agent' | 'manual';

function storage(): Storage | undefined { try { return globalThis.localStorage; } catch { return undefined; } }
function read(key: string): unknown { try { const raw = storage()?.getItem(key); return raw == null ? null : JSON.parse(raw); } catch { return null; } }
function write(key: string, value: object): boolean {
  const text = JSON.stringify(value);
  try { const store = storage(); if (!store) return false; store.setItem(key, text); if (store.getItem(key) !== text) return false; }
  catch { return false; }
  try { if (typeof window !== 'undefined' && typeof Event === 'function') window.dispatchEvent(new Event(voicePreferencesEvent)); } catch { /* Notification is advisory. */ }
  return true;
}
const record = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

/** The persisted route. Anything but a complete, disclosed Cloud record reads as on-device. */
export function voiceRoutePreference(): VoiceRouteChoice {
  const value = record(read(voiceRouteKey));
  return value && value.version === 1 && value.route === 'cloud' && value.disclosed === 'cloud-speech-uses-credits' && Number.isFinite(value.chosenAt) ? 'cloud' : 'device';
}
/**
 * Persist an explicit route choice. Cloud requires the caller to have shown the credit
 * disclosure. Returns false when the choice could not be confirmed in storage; the
 * route then stays on-device.
 */
export function chooseVoiceRoute(route: VoiceRouteChoice, disclosure?: { disclosed: 'cloud-speech-uses-credits' }): boolean {
  if (route === 'cloud' && disclosure?.disclosed !== 'cloud-speech-uses-credits') return false;
  return write(voiceRouteKey, route === 'cloud' ? { version: 1, route, disclosed: disclosure!.disclosed, chosenAt: Date.now() } : { version: 1, route: 'device', chosenAt: Date.now() });
}
/** Disclosure shown wherever Cloud speech can be chosen. */
export function cloudSpeechDisclosure() { return 'Eliza Cloud speech uploads recordings and reply text to your Cloud account and uses its credits.'; }

/** Opt-in: replies to voice-originated turns are read aloud. Off unless explicitly enabled. */
export function speakRepliesEnabled(): boolean { const value = record(read(speakRepliesKey)); return !!value && value.version === 1 && value.enabled === true; }
export function setSpeakReplies(enabled: boolean): boolean { return write(speakRepliesKey, { version: 1, enabled: enabled === true }); }

/** A usable Cloud speech account is signed in for this renderer. */
export function cloudVoiceAvailable(): boolean {
  return !browserDevProfile && connectionController.getCloudEnvironment() !== null && connectionController.getCloudClient() !== null;
}

/**
 * Explicit device/manual choices win. `agent` is an explicit in-session request for the
 * selected agent's voice (Cloud when a Cloud account is signed in). `default` is
 * on-device unless the persisted preference chose Cloud and Cloud is signed in.
 */
export function selectVoiceRoute(preference: VoicePreference = 'default'): 'device' | 'cloud' | 'agent' | 'manual' {
  if (preference === 'device' || preference === 'manual') return preference;
  const cloud = cloudVoiceAvailable();
  if (preference === 'agent') return cloud ? 'cloud' : 'agent';
  return cloud && voiceRoutePreference() === 'cloud' ? 'cloud' : 'device';
}
