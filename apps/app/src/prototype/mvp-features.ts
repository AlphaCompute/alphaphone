import { browserDevProfile } from '../browser/dev-profile';
import { devSurfacesEnabled } from '../build-flags';
// Scope decision: docs/mvp-scope-and-gap-report.md; Wallet: docs/implementation-plan.md AP9.
// Sep 15 notes, paragraph 2283: https://docs.google.com/document/d/1Wgz0wWZh_nvICFzmxPpPa2_H-pvHLAF12FZriMQXf_I/
// Alpha Phone MVP scope: user-provided September 15 biweekly notes defer
// calls/SMS/Contacts. Wallet remains outside the supplied core MVP definition.
// Restore calls/SMS/Contacts only after an approved scope change and native
// permission, recipient, denied-role and return-to-HOME flow acceptance.
// Restore Wallet only after AP9 provider/security decisions and payment acceptance.
// Reference definitions, template, assets and saved user data are deliberately retained.
export const ENABLED_MVP_VIEWS = new Set([
  // "phone", // Deferred: September 15 notes, calls/SMS/Contacts deprioritized.
  // "messages", // Deferred: SMS UI; this does not defer email/Telegram/Discord.
  "inbox", "calendar", "browser", "camera", "photos", "maps", "notes",
  // "contacts", // Deferred: no directory access or Contacts adapter effects.
  "files",
  // "wallet", // Deferred: not in the authoritative core MVP; no payment flow.
  "workflows", "settings",
]);
export const DEFERRED_MVP_VIEWS = new Set(["phone", "messages", "contacts", "wallet"]);
// Development-server fixtures only (devSurfacesEnabled); never a product scope change.
if(devSurfacesEnabled&&browserDevProfile){for(const view of DEFERRED_MVP_VIEWS)ENABLED_MVP_VIEWS.add(view);DEFERRED_MVP_VIEWS.clear();}
export function isMvpView(view: string) { return ENABLED_MVP_VIEWS.has(view); }
export function deferredMvpPrompt(text: unknown) {
  return /^(?:(?:open|show|go to|launch)\s+(?:the\s+)?(?:phone|dialer|sms|messages|contacts|wallet)(?:\b)|(?:call|dial|text|sms|pay)\b|(?:send|write)\s+(?:an?\s+)?(?:sms|text message)\b)/i.test(String(text).trim());
}
