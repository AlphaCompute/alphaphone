package ai.elizaresearch.alphaphone;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Pure policy for the in-app Eliza Cloud sign-in (no Android classes, so it runs on a plain JVM).
 *
 * Google: Authorization Code + PKCE through Eliza Cloud's Steward. Alpha opens a Custom Tab at
 * {api}/steward/auth/oauth/google/authorize with its own S256 challenge and state; Steward returns
 * to the verified App Link {@link Environment#callback} with a one-time Steward code and the state
 * in the URL fragment. Email: the six-digit code is typed into Alpha and verified natively. Either
 * Steward session is exchanged once for an `eliza_mobile_` Cloud key through the first-party mobile
 * App Auth routes (a second, independent state and PKCE pair), and the Steward session is dropped.
 *
 * Nothing here logs, and nothing here reads or writes storage.
 */
final class CloudSignInFlow {
 private CloudSignInFlow() {}
 static final String TENANT = "elizacloud";
 static final String CLIENT_ID = "ai.elizaresearch.alphaphone";
 static final String DEVICE_NAME = "Alpha Phone";
 /** A pending Google sign-in is single use and expires after ten minutes. */
 static final long PENDING_TTL_MS = 10 * 60 * 1000L;
 /** Ack is idempotent and the token route re-reveals the same key until acknowledgeBy. */
 static final int ACK_ATTEMPTS = 3;
 /** Steward rate-limits sends per address; the client waits a minute between sends. */
 static final long RESEND_COOLDOWN_MS = 60 * 1000L;
 static final String CALLBACK_PATH = "/alphaphone/auth/callback";

 /** Fixed authorities. Staging exists only in ELIZA_DEV_ALLOW_TEST_MOCKS=1 builds. */
 enum Environment {
  PRODUCTION("production", "api.eliza.app", "eliza.app"),
  STAGING("staging", "api-staging.eliza.app", "staging.eliza.app");
  final String name, apiHost, callbackHost;
  Environment(String name, String apiHost, String callbackHost) { this.name = name; this.apiHost = apiHost; this.callbackHost = callbackHost; }
  String api() { return "https://" + apiHost; }
  /** The verified App Link Steward returns to; also the mobile App Auth binding string. */
  String callback() { return "https://" + callbackHost + CALLBACK_PATH; }
 }
 static Environment environment(String name, boolean testMocks) {
  if ("production".equals(name)) return Environment.PRODUCTION;
  if (testMocks && "staging".equals(name)) return Environment.STAGING;
  throw new IllegalArgumentException("Unsupported Cloud environment");
 }

 private static final SecureRandom RANDOM = new SecureRandom();
 private static String random(int bytes) {
  byte[] value = new byte[bytes]; RANDOM.nextBytes(value);
  return Base64.getUrlEncoder().withoutPadding().encodeToString(value);
 }
 /** 48 random bytes: a 64-character RFC 7636 verifier. */
 static String newVerifier() { return random(48); }
 /** 32 random bytes: a 43-character base64url state, also a valid mobile App Auth state. */
 static String newState() { return random(32); }
 static String s256(String verifier) {
  try {
   byte[] digest = MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.US_ASCII));
   return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
  } catch (Exception unavailable) { throw new IllegalStateException("SHA-256 unavailable"); }
 }
 static boolean validVerifier(String value) { return value != null && value.matches("[A-Za-z0-9._~-]{43,128}"); }
 static boolean validState(String value) { return value != null && value.matches("[A-Za-z0-9_-]{43}"); }

 /** The exact Steward authorize URL. Parameters are base64url or fixed ASCII, so none needs escaping. */
 static String authorizeUrl(Environment environment, String challenge, String state) {
  if (!validState(state) || challenge == null || !challenge.matches("[A-Za-z0-9_-]{43}")) throw new IllegalArgumentException();
  return environment.api() + "/steward/auth/oauth/google/authorize?response_type=code&tenant_id=" + TENANT
   + "&redirect_uri=" + percent(environment.callback()) + "&code_challenge=" + challenge
   + "&code_challenge_method=S256&state=" + state;
 }
 private static String percent(String value) {
  StringBuilder out = new StringBuilder();
  for (byte b : value.getBytes(StandardCharsets.UTF_8)) {
   char c = (char) (b & 0xff);
   if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '-' || c == '_' || c == '.' || c == '~') out.append(c);
   else out.append('%').append(String.format("%02X", b & 0xff));
  }
  return out.toString();
 }

 /** A validated Steward return. Exactly one of code and error is set. */
 static final class Callback {
  final String state, code, error;
  Callback(String state, String code, String error) { this.state = state; this.code = code; this.error = error; }
 }
 /**
  * Strict App Link validation: exact https scheme, host and path for the environment, no port and
  * no userinfo. Steward's success redirect puts `code` and `state` in the URL fragment
  * (setRedirectFragment), so a code is accepted only from the fragment with no query. Steward's
  * failure page links back with `error` and `state` in the query, so {error,state} is accepted from
  * either, never both. Each parameter appears once and nothing else is present; anything else
  * returns null and is ignored.
  */
 static Callback parseCallback(String text, Environment environment) {
  if (text == null || text.length() > 8192) return null;
  URI uri;
  try { uri = new URI(text); } catch (Exception invalid) { return null; }
  if (!"https".equals(uri.getScheme()) || !environment.callbackHost.equals(uri.getHost()) || uri.getPort() != -1
   || uri.getRawUserInfo() != null || !CALLBACK_PATH.equals(uri.getRawPath())) return null;
  String fragment = uri.getRawFragment(), query = uri.getRawQuery();
  if ((fragment == null) == (query == null)) return null;
  boolean fromFragment = fragment != null;
  String source = fromFragment ? fragment : query;
  if (source.isEmpty()) return null;
  Map<String, String> values = new LinkedHashMap<>();
  for (String part : source.split("&", -1)) {
   int equals = part.indexOf('=');
   if (equals <= 0) return null;
   String name = part.substring(0, equals), value = part.substring(equals + 1);
   // Steward emits base64url codes, base64url state and a short error code: no escaping is legitimate.
   if (!name.matches("[a-z_]{1,16}") || value.isEmpty() || !value.matches("[A-Za-z0-9_.~-]{1,4096}")) return null;
   if (values.put(name, value) != null) return null;
  }
  String state = values.get("state");
  if (!validState(state)) return null;
  if (values.size() != 2) return null;
  if (values.containsKey("code")) return fromFragment ? new Callback(state, values.get("code"), null) : null;
  if (values.containsKey("error") && values.get("error").matches("[a-z_]{1,64}")) return new Callback(state, null, values.get("error"));
  return null;
 }

 /** The one Google attempt this phone waits for. Single use: any matching or mismatching return burns it. */
 static final class Pending {
  final Environment environment; final String state, verifier; final long expiresAt;
  Pending(Environment environment, String state, String verifier, long expiresAt) {
   if (!validState(state) || !validVerifier(verifier)) throw new IllegalArgumentException();
   this.environment = environment; this.state = state; this.verifier = verifier; this.expiresAt = expiresAt;
  }
  static Pending create(Environment environment, long now) { return new Pending(environment, newState(), newVerifier(), now + PENDING_TTL_MS); }
  boolean expired(long now) { return now >= expiresAt; }
  /** Constant-time state comparison; an expired record never matches. */
  boolean matches(Callback callback, long now) {
   if (callback == null || expired(now)) return false;
   return MessageDigest.isEqual(state.getBytes(StandardCharsets.US_ASCII), callback.state.getBytes(StandardCharsets.US_ASCII));
  }
  /** Encrypted at rest by AlphaCredentialStore. Every field is base64url or a number: '.' cannot occur. */
  String serialize() { return "v1." + environment.name + "." + state + "." + verifier + "." + expiresAt; }
  static Pending parse(String value, boolean testMocks) {
   if (value == null) return null;
   String[] parts = value.split("\\.", -1);
   if (parts.length != 5 || !"v1".equals(parts[0])) return null;
   try { return new Pending(environment(parts[1], testMocks), parts[2], parts[3], Long.parseLong(parts[4])); }
   catch (Exception invalid) { return null; }
  }
 }

 static boolean validEmail(String value) {
  return value != null && value.length() <= 320 && value.matches("[^\\s@\\p{Cc}\\p{Cf}]+@[^\\s@\\p{Cc}\\p{Cf}]+\\.[^\\s@\\p{Cc}\\p{Cf}]+");
 }
 static boolean validCode(String value) { return value != null && value.matches("[0-9]{6}"); }
 static boolean validMobileSecret(String value) { return value != null && value.length() >= 20 && value.length() <= 512 && value.startsWith("eliza_mobile_") && value.matches("[\\x21-\\x7e]+"); }
 static boolean validStewardToken(String value) { return value != null && value.length() >= 20 && value.length() <= 16384 && value.matches("[\\x21-\\x7e]+"); }
 static boolean validUuid(String value) { return value != null && value.matches("(?i)[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"); }

 /** Stable, non-secret failure codes shown to the renderer. Never derived from a response body. */
 static String failureForStatus(String stage, int status) {
  if (status == 429) return "rate-limited";
  if (status == 410) return "expired";
  if (status == 403) return "account-check";
  if ((status == 400 || status == 401) && ("verify".equals(stage) || "mfa".equals(stage))) return "invalid-code";
  if ((status == 400 || status == 401) && "exchange".equals(stage)) return "expired";
  if (status >= 500 || status == 408) return "unavailable";
  return "rejected";
 }
 /** Ack is retried only for a transport failure or a retryable server status. */
 static boolean ackRetryable(int status) { return status == -1 || status == 408 || status == 429 || status >= 500; }
 static long ackBackoffMs(int attempt) { return attempt <= 0 ? 0 : Math.min(4000L, 1000L << (attempt - 1)); }
}
