package ai.elizaresearch.alphaphone;

import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import androidx.browser.customtabs.CustomTabsClient;
import androidx.browser.customtabs.CustomTabsIntent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;
import org.json.JSONTokener;

/**
 * In-app Eliza Cloud sign-in (owner directive 2026-10-14). Native screens collect an email code or
 * open Google's consent in a Custom Tab; no Eliza Cloud web page is part of the flow. Every
 * secret-bearing request (Steward code exchange or email/MFA verification, mobile App Auth connect,
 * token and ack, Steward logout) is made here with fixed URLs (CloudSignInFlow, ConnectionRoutes).
 * The resulting `eliza_mobile_` key is written to the existing `cloud:<environment>` slot of
 * AlphaCredentialStore before it is acknowledged, so identity, entitlement, redeem and Cerebras
 * inference keep their existing credential path. The renderer receives only non-secret outcome
 * fields. The Steward session and refresh token are kept in local variables for one sign-in and
 * then revoked; they are never stored. Nothing here logs URLs, codes, headers or bodies.
 */
@CapacitorPlugin(name = "AlphaCloudSignIn")
public final class AlphaCloudSignInPlugin extends Plugin {
 /** Native-only namespace (RendererCredentialSlots): the renderer can neither read nor write it. */
 static final String PENDING_SLOT = "cloud-signin:v1:pending";
 static String receiptSlot(CloudSignInFlow.Environment environment) { return "cloud-signin:v1:ack:" + environment.name; }
 private static final int RESPONSE_LIMIT = 256 * 1024;
 private static final long RETURN_GRACE_MS = 1500;

 /** Thrown with a stable, non-secret code the renderer maps to copy. */
 static final class SignInFailure extends Exception {
  final String code;
  SignInFailure(String code) { super(code); this.code = code; }
 }
 /** The one sign-in in progress. One at a time (the renderer's `login-active` rule). */
 private static final class Attempt {
  final String id = UUID.randomUUID().toString();
  final CloudSignInFlow.Environment environment;
  final boolean google;
  volatile boolean cancelled, browserLaunched, browserPaused, callbackReceived;
  volatile HttpURLConnection connection;
  PluginCall waiting;
  String email, mfaType, mfaChallenge;
  long expiresAt, resendAt;
  boolean busy;
  Attempt(CloudSignInFlow.Environment environment, boolean google) { this.environment = environment; this.google = google; }
  void cancel() { cancelled = true; HttpURLConnection current = connection; if (current != null) current.disconnect(); }
 }
 private static final class Response {
  final int status; final JSONObject data;
  Response(int status, JSONObject data) { this.status = status; this.data = data; }
 }
 private final Object lock = new Object();
 private final ExecutorService worker = Executors.newSingleThreadExecutor();
 private final Handler main = new Handler(Looper.getMainLooper());
 private Attempt attempt;
 private volatile boolean destroyed;
 private boolean testMocks() { return BuildConfig.ELIZA_DEV_ALLOW_TEST_MOCKS; }

 @Override public void load() {
  super.load();
  // A return that starts the process (Alpha was stopped while the Custom Tab was open) is matched
  // against the encrypted pending record. A plain start leaves that record alone: it is single use
  // and expires on its own, and a launcher restart must not discard a sign-in still in the browser.
  captureCallback(getActivity().getIntent());
  run(this::resumeAcknowledgements);
 }
 @Override protected void handleOnNewIntent(Intent intent) { super.handleOnNewIntent(intent); captureCallback(intent); }
 @Override protected void handleOnPause() { synchronized (lock) { if (attempt != null && attempt.google && attempt.browserLaunched) attempt.browserPaused = true; } super.handleOnPause(); }
 /**
  * Android delivers a returning App Link with onNewIntent before onResume. Coming back to Alpha
  * after the Custom Tab opened, without a return, means the owner closed it: the attempt ends
  * cancelled (after a short grace for a late intent) and its pending record is burned.
  */
 @Override protected void handleOnResume() {
  super.handleOnResume();
  final Attempt current;
  synchronized (lock) { current = attempt; }
  if (current == null || !current.google || !current.browserPaused) return;
  main.postDelayed(() -> {
   boolean closed;
   synchronized (lock) { closed = attempt == current && !current.callbackReceived && !current.cancelled; }
   if (closed) end(current, "browser-closed");
  }, RETURN_GRACE_MS);
 }
 @Override protected void handleOnDestroy() {
  destroyed = true;
  synchronized (lock) { if (attempt != null) attempt.cancel(); attempt = null; }
  worker.shutdownNow();
  super.handleOnDestroy();
 }
 private void run(Runnable task) {
  try { worker.execute(task); } catch (java.util.concurrent.RejectedExecutionException closed) { /* Activity teardown. */ }
 }
 private AlphaCredentialStore store() {
  return new AlphaCredentialStore(getContext(), () -> { if (destroyed) throw new IllegalStateException("Sign-in closed"); });
 }

 // ── Google: Authorization Code + PKCE, verified App Link return ─────────────────────────────

 @PluginMethod public void startGoogle(PluginCall call) {
  final CloudSignInFlow.Environment environment;
  try { environment = CloudSignInFlow.environment(call.getString("environment"), testMocks()); }
  catch (Exception invalid) { call.reject("Unsupported Cloud environment", "invalid-request"); return; }
  final Attempt next = new Attempt(environment, true);
  synchronized (lock) {
   if (attempt != null) { call.reject("Another sign-in is in progress", "login-active"); return; }
   attempt = next; next.waiting = call;
  }
  final CloudSignInFlow.Pending pending = CloudSignInFlow.Pending.create(environment, System.currentTimeMillis());
  run(() -> {
   try {
    // Encrypted at rest before the browser opens, so a return after process death can be matched.
    store().writeCredentialSlot(PENDING_SLOT, pending.serialize());
    if (next.cancelled) throw new SignInFailure("cancelled");
    final String url = CloudSignInFlow.authorizeUrl(environment, CloudSignInFlow.s256(pending.verifier), pending.state);
    getActivity().runOnUiThread(() -> {
     synchronized (lock) { if (attempt != next || next.cancelled) return; next.browserLaunched = true; }
     if (!openBrowser(url)) end(next, "browser-unavailable");
    });
   } catch (SignInFailure failure) { end(next, failure.code); }
   catch (Exception storage) { end(next, "storage"); }
  });
 }
 /** Custom Tab in a browser that supports it, never an embedded user agent (Google refuses those); plain ACTION_VIEW otherwise. */
 private boolean openBrowser(String url) {
  Uri uri = Uri.parse(url);
  try {
   String browser = CustomTabsClient.getPackageName(getContext(), null);
   if (browser != null && !browser.equals(getContext().getPackageName())) {
    CustomTabsIntent tab = new CustomTabsIntent.Builder().setShowTitle(true).setShareState(CustomTabsIntent.SHARE_STATE_OFF).build();
    tab.intent.setPackage(browser);
    tab.launchUrl(getActivity(), uri);
    return true;
   }
  } catch (RuntimeException unavailable) { /* Fall through to the system browser. */ }
  try {
   Intent view = new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE);
   getActivity().startActivity(view);
   return true;
  } catch (RuntimeException unavailable) { return false; }
 }
 /**
  * Strict App Link capture. Only an exact callback for a supported environment is considered;
  * the intent's data is cleared so a relaunch never replays it. A return that does not match the
  * pending state (unknown, duplicate or expired) burns the pending record and is otherwise ignored.
  */
 private boolean captureCallback(Intent intent) {
  Uri data = intent == null ? null : intent.getData();
  if (data == null || !"https".equals(data.getScheme())) return false;
  CloudSignInFlow.Environment environment = null;
  CloudSignInFlow.Callback callback = null;
  for (CloudSignInFlow.Environment candidate : CloudSignInFlow.Environment.values()) {
   if (candidate == CloudSignInFlow.Environment.STAGING && !testMocks()) continue;
   CloudSignInFlow.Callback parsed = CloudSignInFlow.parseCallback(data.toString(), candidate);
   if (parsed != null) { environment = candidate; callback = parsed; break; }
  }
  if (callback == null) return false;
  intent.setData(null);
  final CloudSignInFlow.Environment returned = environment;
  final CloudSignInFlow.Callback received = callback;
  final Attempt current;
  synchronized (lock) {
   current = attempt != null && attempt.google && !attempt.callbackReceived ? attempt : null;
   if (current != null) current.callbackReceived = true;
  }
  run(() -> {
   CloudSignInFlow.Pending pending = null;
   try {
    AlphaCredentialStore store = store();
    pending = CloudSignInFlow.Pending.parse(store.readCredentialSlot(PENDING_SLOT), testMocks());
    // Single use: the record is burned before any network request, whatever the outcome.
    store.removeCredentialSlot(PENDING_SLOT);
   } catch (Exception storage) { /* Treated as no pending record. */ }
   long now = System.currentTimeMillis();
   if (pending == null || pending.environment != returned || !pending.matches(received, now)) {
    if (current != null) end(current, pending != null && pending.expired(now) ? "expired" : "state-mismatch");
    return;
   }
   // A cold start (process death in the browser) has no attempt object: it completes into storage
   // and the renderer finds the saved sign-in on startup.
   Attempt owner = current != null ? current : new Attempt(returned, true);
   if (current == null) synchronized (lock) { if (attempt == null) attempt = owner; else { return; } }
   if (received.error != null) { end(owner, "mfa_required".equals(received.error) ? "mfa-browser" : "provider-refused"); return; }
   try {
    JSONObject body = new JSONObject().put("code", received.code).put("redirectUri", returned.callback())
     .put("tenantId", CloudSignInFlow.TENANT).put("codeVerifier", pending.verifier);
    Response exchanged = post(owner, "/steward/auth/oauth/exchange", body, null);
    if (exchanged.status != 200) throw new SignInFailure(CloudSignInFlow.failureForStatus("exchange", exchanged.status));
    complete(owner, exchanged.data);
   } catch (SignInFailure failure) { end(owner, failure.code); }
   catch (Exception unexpected) { end(owner, "unavailable"); }
  });
  return true;
 }
 /** Cancelled, ended or consumed: the pending record is never reused. */
 private void burnUnclaimedPending() {
  run(() -> { try { store().removeCredentialSlot(PENDING_SLOT); } catch (Exception ignored) { /* Absent or unreadable. */ } });
 }

 // ── Email code and MFA: fully native ─────────────────────────────────────────────────────────

 @PluginMethod public void startEmail(PluginCall call) {
  final CloudSignInFlow.Environment environment;
  final String email = call.getString("email") == null ? null : call.getString("email").trim().toLowerCase(java.util.Locale.ROOT);
  try { environment = CloudSignInFlow.environment(call.getString("environment"), testMocks()); }
  catch (Exception invalid) { call.reject("Unsupported Cloud environment", "invalid-request"); return; }
  if (!CloudSignInFlow.validEmail(email)) { call.reject("Enter a valid email address", "invalid-email"); return; }
  final Attempt current;
  synchronized (lock) {
   long now = System.currentTimeMillis();
   if (attempt != null && (attempt.google || attempt.busy)) { call.reject("Another sign-in is in progress", "login-active"); return; }
   if (attempt != null && email.equals(attempt.email) && attempt.environment == environment && now < attempt.resendAt) { call.reject("Wait before requesting another code", "cooldown"); return; }
   if (attempt != null) attempt.cancel();
   current = new Attempt(environment, false);
   current.email = email; current.busy = true; attempt = current;
  }
  run(() -> {
   try {
    Response sent = post(current, "/steward/auth/email/send", new JSONObject().put("email", email).put("tenantId", CloudSignInFlow.TENANT), null);
    if (sent.status != 200) throw new SignInFailure(CloudSignInFlow.failureForStatus("send", sent.status));
    JSONObject data = sent.data.optJSONObject("data") != null ? sent.data.optJSONObject("data") : sent.data;
    long now = System.currentTimeMillis(), expiresAt = Math.min(instant(data.opt("expiresAt")), now + 15 * 60 * 1000L);
    if (expiresAt <= now) throw new SignInFailure("unavailable");
    synchronized (lock) {
     if (attempt != current || current.cancelled) throw new SignInFailure("cancelled");
     current.expiresAt = expiresAt; current.resendAt = now + CloudSignInFlow.RESEND_COOLDOWN_MS; current.busy = false;
    }
    call.resolve(new JSObject().put("attemptId", current.id).put("expiresAt", expiresAt).put("resendAt", current.resendAt));
   } catch (SignInFailure failure) { release(current); call.reject(failure.code, failure.code); }
   catch (Exception unexpected) { release(current); call.reject("unavailable", "unavailable"); }
  });
 }
 @PluginMethod public void verifyEmail(PluginCall call) { verify(call, false); }
 @PluginMethod public void verifyMfa(PluginCall call) { verify(call, true); }
 private void verify(PluginCall call, boolean mfa) {
  final String code = call.getString("code");
  if (!CloudSignInFlow.validCode(code)) { call.reject("Enter the six-digit code", "invalid-code"); return; }
  final Attempt current;
  synchronized (lock) {
   current = attempt;
   if (current == null || current.google || !current.id.equals(call.getString("attemptId"))) { call.reject("Sign-in expired. Start again.", "expired"); return; }
   if (current.busy) { call.reject("Another sign-in is in progress", "login-active"); return; }
   if (System.currentTimeMillis() >= current.expiresAt) { attempt = null; call.reject("Sign-in expired. Start again.", "expired"); return; }
   if (mfa != (current.mfaType != null)) { call.reject("Sign-in step changed. Start again.", "expired"); return; }
   if (mfa && !("totp".equals(current.mfaType) || "sms".equals(current.mfaType))) { call.reject("Unsupported verification", "mfa-unsupported"); return; }
   current.busy = true; current.waiting = call;
  }
  run(() -> {
   try {
    Response verified = mfa
     ? post(current, "/steward/auth/mfa/" + current.mfaType + "/complete", new JSONObject().put("challengeId", current.mfaChallenge).put("code", code), null)
     : post(current, "/steward/auth/email/code/verify", new JSONObject().put("email", current.email).put("code", code).put("tenantId", CloudSignInFlow.TENANT), null);
    if (verified.status != 200) throw new SignInFailure(CloudSignInFlow.failureForStatus(mfa ? "mfa" : "verify", verified.status));
    if (Boolean.TRUE.equals(verified.data.opt("mfaRequired")) && !mfa) {
     JSONObject challenge = verified.data.optJSONObject("mfa");
     String type = challenge == null ? null : challenge.optString("type", null), id = challenge == null ? null : challenge.optString("challengeId", null);
     long expiresAt = challenge == null ? 0 : instant(challenge.opt("expiresAt"));
     if (id == null || id.isEmpty() || id.length() > 256 || !("totp".equals(type) || "sms".equals(type) || "passkey".equals(type))) throw new SignInFailure("unavailable");
     synchronized (lock) {
      if (attempt != current || current.cancelled) throw new SignInFailure("cancelled");
      current.mfaType = type; current.mfaChallenge = id; current.expiresAt = Math.min(current.expiresAt, expiresAt); current.busy = false; current.waiting = null;
     }
     call.resolve(new JSObject().put("status", "mfa").put("method", type).put("expiresAt", current.expiresAt));
     return;
    }
    complete(current, verified.data);
   } catch (SignInFailure failure) { if ("invalid-code".equals(failure.code)) { release(current); synchronized (lock) { current.waiting = null; } call.reject(failure.code, failure.code); } else end(current, failure.code); }
   catch (Exception unexpected) { end(current, "unavailable"); }
  });
 }
 private void release(Attempt current) { synchronized (lock) { current.busy = false; if (attempt == current && current.expiresAt == 0) attempt = null; } }

 @PluginMethod public void cancel(PluginCall call) {
  Attempt current;
  synchronized (lock) { current = attempt; attempt = null; }
  if (current != null) { current.cancel(); PluginCall waiting; synchronized (lock) { waiting = current.waiting; current.waiting = null; } if (waiting != null) waiting.reject("cancelled", "cancelled"); }
  burnUnclaimedPending();
  call.resolve();
 }
 @PluginMethod public void status(PluginCall call) {
  synchronized (lock) {
   JSObject out = new JSObject().put("active", attempt != null);
   if (attempt != null) out.put("kind", attempt.google ? "google" : attempt.mfaType != null ? "mfa" : "email");
   call.resolve(out.put("google", true).put("email", true));
  }
 }

 // ── Shared tail: Steward session → eliza_mobile_ key ─────────────────────────────────────────

 private void complete(Attempt current, JSONObject session) throws Exception {
  String token = session.optString("token", null), refresh = session.optString("refreshToken", null);
  if (!CloudSignInFlow.validStewardToken(token)) throw new SignInFailure("unavailable");
  CloudSignInFlow.Environment environment = current.environment;
  try {
   String state = CloudSignInFlow.newState(), verifier = CloudSignInFlow.newVerifier();
   JSONObject binding = new JSONObject().put("clientId", CloudSignInFlow.CLIENT_ID).put("environment", environment.name).put("redirectUri", environment.callback());
   Response connected = post(current, "/api/v1/app-auth/connect", new JSONObject(binding.toString()).put("flow", "mobile_pkce").put("state", state)
    .put("codeChallenge", CloudSignInFlow.s256(verifier)).put("codeChallengeMethod", "S256").put("deviceName", CloudSignInFlow.DEVICE_NAME), token);
   if (connected.status != 200) throw new SignInFailure(CloudSignInFlow.failureForStatus("connect", connected.status));
   String code = connected.data.optString("code", "");
   if (!"mobile_app_auth_code".equals(connected.data.optString("codeType")) || !code.matches("emac_[0-9a-f]{64}")) throw new SignInFailure("unavailable");
   Object created = connected.data.opt("accountCreated");
   JSONObject proof = new JSONObject(binding.toString()).put("code", code).put("state", state).put("codeVerifier", verifier);
   Response minted = post(current, "/api/v1/app-auth/mobile/token", new JSONObject(proof.toString()).put("grantType", "authorization_code"), null);
   if (minted.status != 200) throw new SignInFailure(CloudSignInFlow.failureForStatus("token", minted.status));
   String secret = minted.data.optString("secret", null), credentialId = minted.data.optString("credentialId", null);
   long expiresAt = instant(minted.data.opt("expiresAt")), acknowledgeBy = instant(minted.data.opt("acknowledgeBy"));
   if (!Boolean.TRUE.equals(minted.data.opt("acknowledgementRequired")) || !"Bearer".equals(minted.data.optString("tokenType"))
    || !CloudSignInFlow.validMobileSecret(secret) || !CloudSignInFlow.validUuid(credentialId) || expiresAt <= System.currentTimeMillis() || acknowledgeBy <= System.currentTimeMillis())
    throw new SignInFailure("unavailable");
   synchronized (lock) { if (current.cancelled || attempt != current) throw new SignInFailure("cancelled"); }
   // Durable receipt first (no secret: the key is read back from its slot), then the key itself.
   AlphaCredentialStore receipts = store();
   receipts.writeCredentialSlot(receiptSlot(environment), new JSONObject(proof.toString()).put("credentialId", credentialId).put("acknowledgeBy", acknowledgeBy).toString());
   long intent = AlphaLocalAgentPlugin.reserveCredentialIntent();
   AlphaCredentialStore credentials = new AlphaCredentialStore(getContext(), () -> { if (destroyed) throw new IllegalStateException("Sign-in closed"); AlphaLocalAgentPlugin.requireCredentialIntent(intent); });
   JSONObject saved = new JSONObject().put("credentialId", UUID.randomUUID().toString()).put("token", secret).put("expiresAt", expiresAt).put("serverCredentialId", credentialId);
   credentials.writeCredentialSlot("cloud:" + environment.name, saved.toString());
   // Commit point: the key is stored. Cancelling now cannot unstore it; activation proceeds.
   boolean acknowledged = acknowledge(current, proof, credentialId, secret);
   if (acknowledged) try { receipts.removeCredentialSlot(receiptSlot(environment)); } catch (Exception kept) { /* Retried on next start. */ }
   if (!acknowledged) throw new SignInFailure("activation-pending");
   finish(current, new JSObject().put("status", "authenticated").put("environment", environment.name).put("expiresAt", expiresAt)
    .put("accountCreated", created instanceof Boolean ? created : JSONObject.NULL));
  } finally {
   // The Steward session is not needed past this point: revoke it, best effort, never stored.
   try { JSONObject body = new JSONObject(); if (refresh != null && refresh.length() <= 16384) body.put("refreshToken", refresh); post(null, environment, "/steward/auth/logout", body, token); }
   catch (Exception ignored) { /* Best effort; the session expires on its own. */ }
  }
 }
 /** Bounded retry: ack is idempotent and the key is re-revealed until acknowledgeBy. */
 private boolean acknowledge(Attempt current, JSONObject proof, String credentialId, String secret) throws Exception {
  CloudSignInFlow.Environment environment = current == null ? CloudSignInFlow.environment(proof.getString("environment"), testMocks()) : current.environment;
  for (int round = 0; round < CloudSignInFlow.ACK_ATTEMPTS; round++) {
   if (round > 0) Thread.sleep(CloudSignInFlow.ackBackoffMs(round));
   if (destroyed) return false;
   Response acked;
   try { acked = post(null, environment, "/api/v1/app-auth/mobile/ack", new JSONObject(proof.toString()).put("credentialId", credentialId).put("secret", secret), null); }
   catch (SignInFailure transport) { continue; }
   if (acked.status == 200) return "acknowledged".equals(acked.data.optString("status")) && credentialId.equals(acked.data.optString("credentialId"));
   if (acked.status == 409 && "authorization_complete".equals(acked.data.optString("error"))) return true;
   if (!CloudSignInFlow.ackRetryable(acked.status)) return false;
  }
  return false;
 }
 /** A key stored before an interrupted ack is activated on the next start, while Cloud allows it. */
 private void resumeAcknowledgements() {
  for (CloudSignInFlow.Environment environment : CloudSignInFlow.Environment.values()) {
   if (environment == CloudSignInFlow.Environment.STAGING && !testMocks()) continue;
   try {
    AlphaCredentialStore store = store();
    String raw = store.readCredentialSlot(receiptSlot(environment));
    if (raw == null) continue;
    JSONObject receipt = new JSONObject(raw), proof = new JSONObject();
    for (String key : new String[]{"clientId", "environment", "redirectUri", "code", "state", "codeVerifier"}) proof.put(key, receipt.getString(key));
    String credentialId = receipt.getString("credentialId"), saved = store.readCredentialSlot("cloud:" + environment.name);
    JSONObject credential = saved == null ? null : new JSONObject(saved);
    boolean current = credential != null && credentialId.equals(credential.optString("serverCredentialId")) && environment.name.equals(proof.getString("environment"));
    boolean done = !current || receipt.getLong("acknowledgeBy") <= System.currentTimeMillis()
     || acknowledge(null, proof, credentialId, credential.getString("token"));
    if (done) store.removeCredentialSlot(receiptSlot(environment));
   } catch (Exception unavailable) { /* Kept for the next start; a stale receipt expires with acknowledgeBy. */ }
  }
 }

 // ── Outcomes and transport ───────────────────────────────────────────────────────────────────

 private void finish(Attempt current, JSObject outcome) {
  PluginCall waiting;
  synchronized (lock) { waiting = current.waiting; current.waiting = null; if (attempt == current) attempt = null; }
  if (waiting != null) waiting.resolve(outcome);
  // A return that completed without a waiting renderer call (after process death) is announced,
  // retained until the renderer listens. The outcome carries no secret.
  else notifyListeners("signInCompleted", outcome, true);
 }
 private void end(Attempt current, String code) {
  PluginCall waiting;
  synchronized (lock) { current.cancel(); waiting = current.waiting; current.waiting = null; if (attempt == current) attempt = null; }
  if (current.google) burnUnclaimedPending();
  if (waiting != null) waiting.reject(code, code);
 }
 private static long instant(Object value) {
  if (value instanceof Number) return ((Number) value).longValue();
  if (!(value instanceof String)) return 0;
  try { return Instant.parse((String) value).toEpochMilli(); } catch (Exception invalid) { return 0; }
 }
 private Response post(Attempt current, String path, JSONObject body, String bearer) throws Exception {
  return post(current, current.environment, path, body, bearer);
 }
 /** Fixed sign-in routes only; no redirects, bounded bodies, nothing logged. */
 private Response post(Attempt current, CloudSignInFlow.Environment environment, String path, JSONObject body, String bearer) throws Exception {
  URI url = new URI(environment.api() + path);
  if (!ConnectionRoutes.signInOrigin(url.getScheme(), url.getHost(), url.getPort(), testMocks()) || !ConnectionRoutes.signInRoute(url.getRawPath(), "POST", true) || url.getRawQuery() != null)
   throw new IllegalArgumentException();
  if (current != null && current.cancelled) throw new SignInFailure("cancelled");
  byte[] encoded = body.toString().getBytes(StandardCharsets.UTF_8);
  HttpURLConnection connection = null;
  try {
   connection = (HttpURLConnection) url.toURL().openConnection();
   if (current != null) current.connection = connection;
   connection.setInstanceFollowRedirects(false); connection.setUseCaches(false);
   connection.setConnectTimeout(20000); connection.setReadTimeout(30000); connection.setRequestMethod("POST");
   connection.setRequestProperty("Accept", "application/json"); connection.setRequestProperty("Content-Type", "application/json");
   if (bearer != null) connection.setRequestProperty("Authorization", "Bearer " + bearer);
   connection.setDoOutput(true); connection.setFixedLengthStreamingMode(encoded.length);
   try (java.io.OutputStream output = connection.getOutputStream()) { output.write(encoded); }
   int status = connection.getResponseCode();
   if (status >= 300 && status < 400) throw new SignInFailure("unavailable");
   if (connection.getContentLengthLong() > RESPONSE_LIMIT) throw new SignInFailure("unavailable");
   byte[] bytes;
   try (InputStream input = status >= 400 ? connection.getErrorStream() : connection.getInputStream()) { bytes = readBounded(input); }
   JSONObject data = new JSONObject();
   if (bytes.length > 0) {
    try { Object parsed = new JSONTokener(new String(bytes, StandardCharsets.UTF_8)).nextValue(); if (parsed instanceof JSONObject) data = (JSONObject) parsed; else if (status < 400) throw new SignInFailure("unavailable"); }
    catch (SignInFailure invalid) { throw invalid; }
    catch (Exception invalid) { if (status < 400) throw new SignInFailure("unavailable"); }
   }
   if (current != null && current.cancelled) throw new SignInFailure("cancelled");
   return new Response(status, data);
  } catch (java.net.UnknownHostException | java.net.ConnectException | java.net.NoRouteToHostException offline) {
   throw new SignInFailure(current != null && current.cancelled ? "cancelled" : "offline");
  } catch (java.io.IOException transport) {
   throw new SignInFailure(current != null && current.cancelled ? "cancelled" : "unavailable");
  } finally {
   if (connection != null) connection.disconnect();
   if (current != null) current.connection = null;
  }
 }
 private static byte[] readBounded(InputStream input) throws Exception {
  if (input == null) return new byte[0];
  ByteArrayOutputStream output = new ByteArrayOutputStream(); byte[] buffer = new byte[8192]; int count;
  while ((count = input.read(buffer)) != -1) { if (output.size() + count > RESPONSE_LIMIT) throw new SignInFailure("unavailable"); output.write(buffer, 0, count); }
  return output.toByteArray();
 }
}
