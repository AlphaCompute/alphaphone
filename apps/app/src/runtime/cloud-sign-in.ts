import type { CloudEnvironment } from './cloud-protocol';

/**
 * In-app Eliza Cloud sign-in port (owner directive 2026-10-14). Sign-in happens on Alpha's own
 * screens: an email code typed into Alpha, or Google's consent in a Custom Tab that returns to a
 * verified App Link. No Eliza Cloud web page is part of the flow.
 *
 * The port's host (AlphaCloudSignInPlugin on Android, the development Cloud bridge in a test-mocks
 * browser build) owns every secret: the Steward session, the PKCE verifiers and states, the
 * authorization codes and the minted `eliza_mobile_` key. It stores the key in the existing
 * `cloud:<environment>` slot before acknowledging it and returns only these non-secret outcomes.
 */
export type CloudSignInFailureCode =
  | 'cancelled' | 'login-active' | 'invalid-email' | 'invalid-code' | 'cooldown' | 'expired' | 'rate-limited'
  | 'offline' | 'unavailable' | 'account-check' | 'state-mismatch' | 'browser-closed' | 'browser-unavailable'
  | 'provider-refused' | 'mfa-browser' | 'mfa-unsupported' | 'activation-pending' | 'storage' | 'rejected' | 'invalid-request';
export interface CloudSignInAuthenticated {
  status: 'authenticated';
  environment: CloudEnvironment;
  expiresAt: number;
  /** True when this sign-in created the Eliza Cloud account; null when Cloud did not say. */
  accountCreated: boolean | null;
}
export interface CloudSignInEmailStarted { attemptId: string; expiresAt: number; resendAt: number }
export interface CloudSignInMfaRequired { status: 'mfa'; method: 'totp' | 'sms' | 'passkey'; expiresAt: number }
export interface CloudSignInPort {
  /** Opens Google's consent in a Custom Tab and resolves once the App Link return is exchanged. */
  startGoogle(input: { environment: CloudEnvironment }): Promise<unknown>;
  startEmail(input: { environment: CloudEnvironment; email: string }): Promise<unknown>;
  verifyEmail(input: { attemptId: string; code: string }): Promise<unknown>;
  verifyMfa(input: { attemptId: string; code: string }): Promise<unknown>;
  /** Ends the attempt and burns any pending Google record. Idempotent. */
  cancel(): Promise<void>;
  /** Which methods this host offers. Hosts without Google (the browser bridge) say so. */
  status?(): Promise<unknown>;
  /** A Google return that completed after Alpha restarted (no waiting call) is announced here. */
  addListener?(event: 'signInCompleted', listener: (outcome: unknown) => void): Promise<unknown>;
}
const CODES = new Set<string>(['cancelled', 'login-active', 'invalid-email', 'invalid-code', 'cooldown', 'expired', 'rate-limited', 'offline', 'unavailable', 'account-check', 'state-mismatch', 'browser-closed', 'browser-unavailable', 'provider-refused', 'mfa-browser', 'mfa-unsupported', 'activation-pending', 'storage', 'rejected', 'invalid-request']);
export class CloudSignInError extends Error {
  readonly code: CloudSignInFailureCode;
  constructor(code: CloudSignInFailureCode) { super(`Eliza Cloud sign-in ${code}`); this.code = code; this.name = 'CloudSignInError'; }
  static from(error: unknown): CloudSignInError {
    if (error instanceof CloudSignInError) return error;
    const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
    return new CloudSignInError(typeof code === 'string' && CODES.has(code) ? code as CloudSignInFailureCode : 'unavailable');
  }
}
/** Owner-facing copy. Never includes server text, codes or addresses. */
export function signInFailureMessage(code: CloudSignInFailureCode): string {
  switch (code) {
    case 'cancelled': return 'Sign-in cancelled.';
    case 'login-active': return 'A sign-in is already in progress. Finish or cancel it first.';
    case 'invalid-email': return 'Enter a valid email address.';
    case 'invalid-code': return 'That code did not work. Check it and try again, or send a new code.';
    case 'cooldown': return 'Wait a minute before sending another code.';
    case 'expired': return 'This sign-in expired. Start again.';
    case 'rate-limited': return 'Too many attempts. Wait a few minutes, then try again.';
    case 'offline': return 'Alpha could not reach Eliza Cloud. Check your connection and try again.';
    case 'account-check': return 'This account needs an extra check that Alpha cannot complete. Use account recovery or contact Eliza Cloud support.';
    case 'state-mismatch': return 'That sign-in return did not match this phone’s request. Start again.';
    case 'browser-closed': return 'Google sign-in was closed before it finished. Start again when you are ready.';
    case 'browser-unavailable': return 'No browser that can show Google sign-in is available. Use your email instead.';
    case 'provider-refused': return 'Google did not complete the sign-in. Try again or use your email.';
    case 'mfa-browser': return 'This account needs a second verification step. Sign in with your email to complete it in Alpha.';
    case 'mfa-unsupported': return 'This account’s second verification method is not available in Alpha yet. Use account recovery or contact Eliza Cloud support.';
    case 'activation-pending': return 'Signed in, but Eliza Cloud has not confirmed this phone yet. Alpha retries when it starts again; you can also sign in again.';
    case 'storage': return 'Alpha could not save the sign-in securely on this phone. Try again.';
    case 'rejected': case 'invalid-request': return 'Eliza Cloud refused this sign-in. Start again.';
    default: return 'Eliza Cloud sign-in is unavailable right now. Try again.';
  }
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CloudSignInError('unavailable');
  return value as Record<string, unknown>;
}
function time(value: unknown): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Date.parse(value) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) throw new CloudSignInError('unavailable');
  return parsed;
}
export function authenticated(value: unknown, environment: CloudEnvironment): CloudSignInAuthenticated {
  const row = object(value);
  if (row.status !== 'authenticated' || row.environment !== environment) throw new CloudSignInError('unavailable');
  for (const key of Object.keys(row)) if (!['status', 'environment', 'expiresAt', 'accountCreated'].includes(key)) throw new CloudSignInError('unavailable');
  return { status: 'authenticated', environment, expiresAt: time(row.expiresAt), accountCreated: typeof row.accountCreated === 'boolean' ? row.accountCreated : null };
}
export function emailStarted(value: unknown): CloudSignInEmailStarted {
  const row = object(value);
  if (typeof row.attemptId !== 'string' || !/^[0-9a-f-]{36}$/i.test(row.attemptId)) throw new CloudSignInError('unavailable');
  return { attemptId: row.attemptId, expiresAt: time(row.expiresAt), resendAt: time(row.resendAt) };
}
export function verified(value: unknown, environment: CloudEnvironment): CloudSignInAuthenticated | CloudSignInMfaRequired {
  const row = object(value);
  if (row.status === 'mfa') {
    if (row.method !== 'totp' && row.method !== 'sms' && row.method !== 'passkey') throw new CloudSignInError('unavailable');
    return { status: 'mfa', method: row.method, expiresAt: time(row.expiresAt) };
  }
  return authenticated(row, environment);
}
export const normalizeSignInCode = (value: string): string | null => { const digits = value.replace(/[\s-]/g, ''); return /^\d{6}$/.test(digits) ? digits : null; };
export const validSignInEmail = (value: string): boolean => value.length <= 320 && /^[^\s@\p{Cc}\p{Cf}]+@[^\s@\p{Cc}\p{Cf}]+\.[^\s@\p{Cc}\p{Cf}]+$/u.test(value.trim());
