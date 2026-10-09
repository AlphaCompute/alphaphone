/** Eliza app-host REST protocol. Native composition owns network and secure storage.
 * Reference: packages/app/src/api/auth-{pairing,session}-routes.ts and
 * packages/agent/src/api/conversation-routes.ts in elizaOS.
 */
export interface RemoteRequest {
  url: string;
  method: "GET" | "POST";
  headers: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}
export interface RemoteResponse { status: number; body: unknown }
/** Must reject redirects (especially cross-origin) and honor AbortSignal. */
export type RemoteRequester = (request: RemoteRequest) => Promise<RemoteResponse>;
export interface RemoteCredential {
  origin: string;
  token: string;
  identityId: string;
  sessionId: string;
  expiresAt: number;
}
/** Supply a platform secure store, never Web Storage. One record per origin. */
export interface RemoteCredentialStore {
  read(origin: string): Promise<RemoteCredential | null>;
  write(record: RemoteCredential): Promise<void>;
  remove(origin: string): Promise<void>;
}
export interface RemoteIdentity {
  identityId: string;
  displayName: string;
  sessionId: string;
  expiresAt: number;
  role: "OWNER";
  origin: string;
}
export interface RemoteAuthStatus {
  required: boolean;
  authenticated: boolean;
  pairingEnabled: boolean;
  instanceId: string;
  bootstrapRequired: boolean;
  expiresAt: number | null;
}
export interface RemoteConversation { id: string; [key: string]: unknown }
export interface RemoteChatReply {
  text: string;
  actionResults?: readonly unknown[];
  agentName: string;
  interrupted?: boolean;
  noResponseReason?: "ignored";
  failureKind?: unknown;
  terminalFailure?: unknown;
  [key: string]: unknown;
}
export class RemoteProtocolError extends Error {
  constructor(public readonly code: string, public readonly status?: number) {
    // Do not include response bodies: authentication responses can contain secrets.
    super(status ? `${code} (HTTP ${status})` : code);
    this.name = "RemoteProtocolError";
  }
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RemoteProtocolError("invalid_response");
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new RemoteProtocolError("invalid_response");
  return value;
}
function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw new RemoteProtocolError("invalid_response");
  return value;
}
function abort(signal?: AbortSignal): void { signal?.throwIfAborted(); }
// Plain-HTTP loopback agents are a test-mocks surface (ELIZA_DEV_ALLOW_TEST_MOCKS=1).
// Vite replaces import.meta.env at build time, so flag-off bundles fold this to
// false and accept HTTPS only. Node contract tests import this source without Vite.
const developmentOriginsAllowed: boolean = import.meta.env === undefined || import.meta.env.VITE_ELIZA_DEV_ALLOW_TEST_MOCKS === '1';
const developmentLoopbackHosts: readonly string[] = developmentOriginsAllowed ? ["localhost", "127.0.0.1", "[::1]", "10.0.2.2"] : [];
export function normalizeRemoteOrigin(input: string, developmentOrigins: readonly string[] = [], allowDevelopment: boolean = developmentOriginsAllowed): string {
  let url: URL;
  try { url = new URL(input); } catch { throw new RemoteProtocolError("invalid_origin"); }
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new RemoteProtocolError("origin_required");
  const loopback = allowDevelopment && developmentLoopbackHosts.includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback && developmentOrigins.includes(url.origin))) {
    throw new RemoteProtocolError("https_required");
  }
  return url.origin;
}

export class RemoteProtocol {
  readonly origin: string;
  private credential: RemoteCredential | null = null;
  private identity: RemoteIdentity | null = null;
  private generation = 0;
  private authBusy = false;
  constructor(
    origin: string,
    private readonly request: RemoteRequester,
    private readonly store: RemoteCredentialStore,
    options: { developmentOrigins?: readonly string[]; now?: () => number } = {},
  ) {
    this.origin = normalizeRemoteOrigin(origin, options.developmentOrigins);
    this.now = options.now ?? Date.now;
  }
  private readonly now: () => number;
  get session(): RemoteIdentity | null { return this.identity ? { ...this.identity } : null; }
  private async json(path: string, method: "GET" | "POST", body?: unknown, token?: string, signal?: AbortSignal): Promise<unknown> {
    abort(signal);
    const result = await this.request({
      url: this.origin + path, method,
      headers: { Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal,
    });
    abort(signal);
    if (result.status < 200 || result.status >= 300) throw new RemoteProtocolError("remote_request_failed", result.status);
    return result.body;
  }
  async status(signal?: AbortSignal): Promise<RemoteAuthStatus> {
    const value = object(await this.json("/api/auth/status", "GET", undefined, undefined, signal));
    const expires = value.expiresAt;
    if (expires !== null && (typeof expires !== "number" || !Number.isFinite(expires))) throw new RemoteProtocolError("invalid_response");
    return { required: boolean(value.required), authenticated: boolean(value.authenticated), pairingEnabled: boolean(value.pairingEnabled), instanceId: string(value.instanceId), bootstrapRequired: boolean(value.bootstrapRequired), expiresAt: expires as number | null };
  }
  private async verify(token: string, expectedIdentity?: string, signal?: AbortSignal): Promise<RemoteIdentity> {
    const value = object(await this.json("/api/auth/me", "GET", undefined, token, signal));
    const who = object(value.identity), session = object(value.session), access = object(value.access);
    if (access.role !== "OWNER" || who.kind !== "owner" || access.mode !== "session") throw new RemoteProtocolError("owner_session_required");
    const identityId = string(who.id), sessionId = string(session.id);
    if (expectedIdentity && expectedIdentity !== identityId) throw new RemoteProtocolError("identity_changed");
    if (session.kind !== "machine" || sessionId !== token) throw new RemoteProtocolError("machine_session_required");
    if (typeof session.expiresAt !== "number" || !Number.isFinite(session.expiresAt) || session.expiresAt <= this.now()) throw new RemoteProtocolError("session_expired");
    return { identityId, displayName: string(who.displayName), sessionId, expiresAt: session.expiresAt, role: "OWNER", origin: this.origin };
  }
  private async authenticate(operation: () => Promise<RemoteIdentity>): Promise<RemoteIdentity> {
    if (this.authBusy) throw new RemoteProtocolError("authentication_in_progress");
    this.authBusy = true;
    this.generation++;
    this.credential = null;
    this.identity = null;
    try { return await operation(); } finally { this.authBusy = false; }
  }
  private async persist(record: RemoteCredential, signal?: AbortSignal): Promise<void> {
    abort(signal);
    await this.store.write(record);
    // A native storage operation cannot necessarily be interrupted. Authentication
    // remains serialized until its newly written credential has been removed.
    if (signal?.aborted) {
      await this.store.remove(this.origin);
      abort(signal);
    }
  }
  async pair(code: string, signal?: AbortSignal): Promise<RemoteIdentity> {
    return this.authenticate(async () => {
      const current = await this.status(signal);
      if (!current.pairingEnabled || current.bootstrapRequired) throw new RemoteProtocolError("pairing_unavailable");
      const paired = object(await this.json("/api/auth/pair", "POST", { code, instanceId: current.instanceId }, undefined, signal));
      if (paired.instanceId !== current.instanceId || paired.access !== "owner") throw new RemoteProtocolError("pairing_identity_mismatch");
      const token = string(paired.token);
      const identity = await this.verify(token, string(paired.identityId), signal);
      abort(signal);
      const record = { origin: this.origin, token, identityId: identity.identityId, sessionId: identity.sessionId, expiresAt: identity.expiresAt };
      await this.persist(record, signal);
      this.generation++;
      this.credential = record;
      this.identity = identity;
      return { ...identity };
    });
  }
  async restore(signal?: AbortSignal): Promise<RemoteIdentity | null> {
    let restored: RemoteIdentity | null = null;
    await this.authenticate(async () => {
      const saved = await this.store.read(this.origin);
      abort(signal);
      if (!saved) throw new RemoteProtocolError("not_connected");
      if (saved.origin !== this.origin || saved.sessionId !== saved.token || !saved.identityId || !saved.token || !Number.isFinite(saved.expiresAt) || saved.expiresAt <= this.now()) {
        await this.store.remove(this.origin);
        throw new RemoteProtocolError("session_expired");
      }
      try {
        restored = await this.verify(saved.token, saved.identityId, signal);
      } catch (error) {
        if (error instanceof RemoteProtocolError && (error.status === 401 || ["identity_changed", "owner_session_required", "machine_session_required", "session_expired"].includes(error.code))) await this.store.remove(this.origin);
        throw error;
      }
      const record = { ...saved, expiresAt: restored.expiresAt };
      await this.persist(record, signal);
      this.generation++;
      this.credential = record;
      this.identity = restored;
      return { ...restored };
    }).catch(error => { if (!(error instanceof RemoteProtocolError && error.code === "not_connected")) throw error; });
    return restored;
  }
  /** Local disconnect only; server revocation is a separate explicit operation. */
  async disconnect(): Promise<void> {
    if (this.authBusy) throw new RemoteProtocolError("authentication_in_progress");
    this.generation++;
    this.credential = null;
    this.identity = null;
    await this.store.remove(this.origin);
  }
  private async authorized(path: string, method: "GET" | "POST", body?: unknown, signal?: AbortSignal): Promise<unknown> {
    const credential = this.credential, generation = this.generation;
    if (!credential || credential.expiresAt <= this.now()) throw new RemoteProtocolError("not_connected");
    try {
      const result = await this.json(path, method, body, credential.token, signal);
      if (generation !== this.generation) throw new RemoteProtocolError("connection_changed");
      return result;
    } catch (error) {
      if (generation === this.generation && error instanceof RemoteProtocolError && error.status === 401) await this.disconnect();
      throw error;
    }
  }
  async listConversations(signal?: AbortSignal): Promise<RemoteConversation[]> {
    const value = object(await this.authorized("/api/conversations", "GET", undefined, signal));
    if (!Array.isArray(value.conversations)) throw new RemoteProtocolError("invalid_response");
    return value.conversations.map(item => { const conversation = object(item); return { ...conversation, id: string(conversation.id) }; });
  }
  async createConversation(title: string, signal?: AbortSignal): Promise<RemoteConversation> {
    const value = object(await this.authorized("/api/conversations", "POST", { title }, signal));
    const conversation = object(value.conversation);
    return { ...conversation, id: string(conversation.id) };
  }
  async messages(id: string, signal?: AbortSignal): Promise<{ messages: Record<string, unknown>[]; hasMore?: boolean }> {
    const value = object(await this.authorized(`/api/conversations/${encodeURIComponent(string(id))}/messages`, "GET", undefined, signal));
    if (!Array.isArray(value.messages)) throw new RemoteProtocolError("invalid_response");
    return { messages: value.messages.map(object), ...(typeof value.hasMore === "boolean" ? { hasMore: value.hasMore } : {}) };
  }
  async send(id: string, text: string, options: { metadata?: Record<string, unknown>; clientMessageId?: string; signal?: AbortSignal } = {}): Promise<RemoteChatReply> {
    const value = object(await this.authorized(`/api/conversations/${encodeURIComponent(string(id))}/messages`, "POST", {
      text: string(text), channelType: "DM", ...(options.metadata ? { metadata: options.metadata } : {}), ...(options.clientMessageId ? { clientMessageId: options.clientMessageId } : {}),
    }, options.signal));
    if (typeof value.text !== "string" || typeof value.agentName !== "string") throw new RemoteProtocolError("invalid_response");
    // Preserve terminal failures and ignored/interrupted turns for the UI; never synthesize success.
    return value as RemoteChatReply;
  }
}
