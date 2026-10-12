import { testMocksEnabled } from '../build-flags';

/** Production currently preserves main's Cloud speech policy. Local/manual requests are
 * test-only. This differs from PRD P-01/P-07 and requires a decision (MVP-01). The legacy
 * route choice, its Cloud credit disclosure and the account-availability probe had no
 * production caller and were removed; restore them with the control MVP-01 decides on. */
// Plain constants and function exports only: Node contract tests evaluate this source directly.
const speakRepliesKey = 'alphaphone:speak-replies:v1';
const voicePreferencesEvent = 'alpha:voice-preferences';
export type VoicePreference = 'default' | 'device' | 'agent' | 'manual';
/**
 * When a spoken turn is sent. 'auto-send' (today's behaviour) sends each finished Cloud
 * conversation transcript as it is; 'review' shows it for editing and an explicit Send first.
 * The choice is an owner decision (MVP-01, A-04, A-10): this constant is the one switch.
 */
export type VoiceSendPolicy = 'auto-send' | 'review';
const VOICE_SEND_POLICY: VoiceSendPolicy = 'auto-send';
let voiceSendPolicyForTests: VoiceSendPolicy | undefined;
export function voiceSendPolicy(): VoiceSendPolicy { return testMocksEnabled && voiceSendPolicyForTests ? voiceSendPolicyForTests : VOICE_SEND_POLICY; }
/** Test-mocks builds only: exercise either policy. A flag-off build always uses the constant. */
export function setVoiceSendPolicyForTests(policy?: VoiceSendPolicy): boolean {
  if (!testMocksEnabled) return false;
  voiceSendPolicyForTests = policy === 'auto-send' || policy === 'review' ? policy : undefined;
  return true;
}

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

/** Opt-in: replies to voice-originated turns are read aloud. Off unless explicitly enabled. */
export function speakRepliesEnabled(): boolean { const value = record(read(speakRepliesKey)); return !!value && value.version === 1 && value.enabled === true; }
/** No Settings control calls this yet (MVP-01); tests use it to seed a retained preference. */
export function setSpeakReplies(enabled: boolean): boolean { return write(speakRepliesKey, { version: 1, enabled: enabled === true }); }

/** Explicit local/manual routes are available only in test-mocks builds. */
export function selectVoiceRoute(preference: 'default' | 'device' | 'agent' | 'manual' = 'default'): 'device' | 'cloud' | 'agent' | 'manual' {
  if (testMocksEnabled && (preference === 'device' || preference === 'manual')) return preference;
  return 'cloud';
}
