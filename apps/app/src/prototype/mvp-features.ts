import { browserDevProfile } from '../browser/dev-profile';
// Approved October 12 scope: docs/implementation-plan.md and issue #422.
// Wallet is removed from MVP, including AOSP: no payment/provider activation.
// #420: Phone/SMS/Contacts require an admitted Alpha AOSP image and real adapters.
// Adapters remain unimplemented; launcher flavor, HOME role and test mocks confer no image capability.
// Reference definitions and saved user data are retained; development fixtures are non-product.
export const ENABLED_MVP_VIEWS = new Set([
  // "phone", // AOSP-only; Telecom adapter pending.
  // "messages", // AOSP-only SMS adapter pending; email/Telegram/Discord are separate.
  "inbox", "calendar", "browser", "camera", "photos", "maps", "notes",
  // "contacts", // AOSP-only; Contacts adapter pending.
  "files",
  // "wallet", // Removed from MVP in both distributions and AOSP; no payment flow.
  "workflows", "settings",
]);
export const DEFERRED_MVP_VIEWS = new Set(["phone", "messages", "contacts", "wallet"]);
// Development-server fixtures only (browserDevProfile requires devSurfacesEnabled); never a product scope change.
if(browserDevProfile){for(const view of DEFERRED_MVP_VIEWS)ENABLED_MVP_VIEWS.add(view);DEFERRED_MVP_VIEWS.clear();}
export function isMvpView(view: string) { return ENABLED_MVP_VIEWS.has(view); }
export function deferredMvpPrompt(text: unknown) {
  return /^(?:(?:open|show|go to|launch)\s+(?:the\s+)?(?:phone|dialer|sms|messages|contacts|wallet)(?:\b)|(?:call|dial|text|sms|pay)\b|(?:send|write)\s+(?:an?\s+)?(?:sms|text message)\b)/i.test(String(text).trim());
}
