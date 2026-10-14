import { CloudProtocol, CloudProtocolError, delay, object, string, timestamp, uuid, type CloudCredential, type ObjectValue } from './cloud-protocol.ts';

/**
 * DIAGNOSTIC FALLBACK, ELIZA_DEV_ALLOW_TEST_MOCKS=1 BUILDS ONLY, FOR ONE RELEASE.
 *
 * The browser hand-off sign-in (POST /api/auth/cli-session, then the hosted cli-login page, then
 * polling) is no longer a product path: Alpha signs in on its own screens (cloud-sign-in.ts,
 * AlphaCloudSignInPlugin). connection-ui constructs this class only behind the test-mocks flag, so a
 * flag-off bundle carries none of it (scripts/audit-production-bundle.mjs denies its markers), and
 * the native transport refuses these routes in product builds. Delete it with the next release.
 * Contracts inspected in v3's cloud/api/auth/cli-session.
 */
export interface CloudLoginAttempt { sessionId: string; expiresAt: number; browserUrl: string }
export class LegacyCliLoginProtocol extends CloudProtocol {
  /** Only one poller may claim the server's single-consumption credential. A
   * cancelled/lost claim is not retried automatically; start a fresh login. */
  async login(signal: AbortSignal, onWaiting?: (attempt: CloudLoginAttempt) => void): Promise<void> {
    if (this.activeLogin) throw new CloudProtocolError("login-active");
    signal.throwIfAborted();
    const controller = new AbortController();
    this.activeLogin = controller;
    const abort = () => controller.abort(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      // The server issues the UUID; client-chosen IDs are deliberately ignored.
      const created = await this.call("/api/auth/cli-session", controller.signal, { body: {} });
      const sessionId = uuid(created.sessionId);
      const expiresAt = timestamp(created.expiresAt);
      if (expiresAt <= Date.now()) throw new CloudProtocolError("expired");
      expiryTimer = setTimeout(() => controller.abort(new CloudProtocolError("expired")), Math.min(expiresAt - Date.now(), 2_147_483_647));
      const browserUrl = `${this.authority.web}/auth/cli-login?session=${encodeURIComponent(sessionId)}`;
      onWaiting?.({ sessionId, expiresAt, browserUrl });
      await this.openExternal(browserUrl, controller.signal);
      if (Date.now() >= expiresAt) throw new CloudProtocolError("expired");
      while (true) {
        controller.signal.throwIfAborted();
        if (Date.now() >= expiresAt) throw new CloudProtocolError("expired");
        let response: ObjectValue;
        try { response = await this.call(`/api/auth/cli-session/${sessionId}`, controller.signal, {expiresAt}); }
        catch (error) {
          if (Date.now() >= expiresAt) throw new CloudProtocolError("expired");
          if (error instanceof CloudProtocolError && (error.status === 404 || error.status === 410)) throw new CloudProtocolError("expired");
          throw error;
        }
        if (Date.now() >= expiresAt) throw new CloudProtocolError("expired");
        const data = response.data == null ? response : object(response.data);
        if (data.status === "authenticated") {
          const token = ["token", "accessToken", "stewardToken", "sessionToken", "apiKey"]
            .flatMap(key => [response[key], data[key]]).find(value => typeof value === "string" && value.trim());
          const reference=data.credentialReference ?? response.credentialReference;
          if(!token && !(this.credentials.acceptsReferences && typeof reference==="string" && /^browser-cloud-reference:[0-9a-f-]{36}$/.test(reference)))throw new CloudProtocolError("credential-consumed");
          const credential: CloudCredential = token ? {token:string(token)} : {credentialReference:string(reference)};
          if (data.expiresAt != null) credential.expiresAt = timestamp(data.expiresAt);
          if (credential.expiresAt !== undefined && credential.expiresAt <= Date.now()) throw new CloudProtocolError("expired");
          if (data.userId != null) credential.userId = string(data.userId);
          if (data.organizationId != null) credential.organizationId = string(data.organizationId);
          controller.signal.throwIfAborted();
          if (Date.now() >= expiresAt) throw new CloudProtocolError("expired");
          await this.credentials.write(this.environment, credential, controller.signal);
          return;
        }
        if (data.status === "expired") throw new CloudProtocolError("expired");
        if (data.status !== "pending") throw new CloudProtocolError("invalid-response");
        await delay(Math.min(1500, Math.max(1, expiresAt - Date.now())), controller.signal);
      }
    } finally {
      clearTimeout(expiryTimer);
      signal.removeEventListener("abort", abort);
      if (this.activeLogin === controller) this.activeLogin = null;
    }
  }
}
