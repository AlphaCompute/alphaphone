/** Browser-safe boundary. The composition root supplies an authenticated transport;
 * this module neither invents endpoints nor handles credentials. */
export type AlphaView =
  | "home"
  | "assistant"
  | "apps"
  | "maps"
  | "camera"
  | "photos"
  | "notes"
  | "calendar"
  | "notifications"
  | "reminders"
  | "workflows"
  | "files"
  | "inbox"
  | "browser"
  | "phone"
  | "messages"
  | "contacts"
  | "passwords"
  | "settings";
export interface ViewContext {
  view: AlphaView;
  timeZone?: string;
  /** Opaque provider IDs only. Never put document bodies or credentials here. */
  selectedObject?: {
    kind: string;
    id: string;
    revision?: string;
    accountId?: string;
    sourceRevision?: string;
    occurrenceId?: string;
  };
  /** Credential and unlock surfaces suspend observation. */
  sensitive?: boolean;
}
export interface VerifiedSession {
  ownerId: string;
  agentId: string;
  sessionId: string;
  /** Display-only canonical origin, verified by the supplied auth adapter. */
  origin: string;
}
export interface ContextEnvelope extends ViewContext {
  revision: number;
}
export interface ActionProposal {
  id: string;
  title: string;
  /** Human-readable exact target/action review. Must contain no secret values. */
  description: string;
  expiresAt: number;
  contextRevision: number;
}
export interface AgentReply {
  text: string;
  proposals?: ActionProposal[];
}
export interface OperationReceipt {
  proposalId: string;
  status: "succeeded" | "denied" | "cancelled" | "failed" | "unknown";
  summary: string;
}
export interface VerifiedSessionTransport {
  /** Must be server-verified, not derived from a user-entered owner ID. */
  readonly session: VerifiedSession;
  send(input: {
    requestId: string;
    text: string;
    context: ContextEnvelope;
    signal: AbortSignal;
    onText?:(text:string)=>void;
  }): Promise<AgentReply>;
  /** Server must revalidate ownership, context/preconditions, approval and dedupe. */
  execute(input: {
    requestId: string;
    proposal: ActionProposal;
    context: ContextEnvelope;
    signal: AbortSignal;
  }): Promise<OperationReceipt>;
  /** Abort is best effort; an already-dispatched write may have unknown outcome. */
  close?(): void;
}
export type AlphaClientState = {
  connection: "unconfigured" | "ready";
  pending: boolean;
  session: VerifiedSession | null;
  context: ContextEnvelope;
};
export class AlphaClientError extends Error {
  constructor(
    readonly code:
      | "unconfigured"
      | "busy"
      | "cancelled"
      | "stale"
      | "sensitive"
      | "invalid-response"
      | "transport-failed"
      | "proposal-unavailable",
    message: string,
  ) {
    super(message);
    this.name = "AlphaClientError";
  }
}
const copyContext = (
  context: ViewContext,
  revision: number,
): ContextEnvelope => ({
  view: context.view,
  sensitive: context.sensitive === true,
  ...(context.timeZone === undefined ? {} : {timeZone:context.timeZone}),
  ...(context.selectedObject
    ? { selectedObject: { ...context.selectedObject } }
    : {}),
  revision,
});

export class AlphaClient {
  private transport: VerifiedSessionTransport | null = null;
  private epoch = 0;
  private context = copyContext({ view: "home" }, 0);
  private active: AbortController | null = null;
  private proposals = new Map<string, ActionProposal>();
  private consumed = new Set<string>();
  private listeners = new Set<() => void>();
  getState(): AlphaClientState {
    return {
      connection: this.transport ? "ready" : "unconfigured",
      pending: !!this.active,
      session: this.transport ? { ...this.transport.session } : null,
      context: copyContext(this.context, this.context.revision),
    };
  }
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private emit(): void {
    for (const listener of this.listeners) listener();
  }
  /** Trusted composition-root API, never exposed to arbitrary remote web content. */
  attachVerifiedTransport(transport: VerifiedSessionTransport, options: { developmentOrigin?: string } = {}): void {
    const session = transport.session;
    let origin: URL;
    try {
      origin = new URL(session.origin);
    } catch {
      throw new Error("Invalid verified session origin");
    }
    const development = origin.protocol === "http:" &&
      ["127.0.0.1", "10.0.2.2", "localhost", "[::1]"].includes(origin.hostname) &&
      options.developmentOrigin === origin.origin;
    if (
      (origin.protocol !== "https:" && !development) ||
      origin.origin !== session.origin ||
      !session.ownerId ||
      !session.agentId ||
      !session.sessionId
    ) {
      throw new Error("Invalid verified session metadata");
    }
    this.disconnect();
    this.transport = transport;
    this.emit();
  }
  disconnect(): void {
    this.epoch++;
    this.active?.abort();
    this.active = null;
    const old = this.transport;
    this.transport = null;
    this.proposals.clear();
    this.consumed.clear();
    try {
      old?.close?.();
    } finally {
      this.emit();
    }
  }
  setViewContext(context: ViewContext): void {
    const next = copyContext(context, this.context.revision);
    if (JSON.stringify(next) === JSON.stringify(this.context)) return;
    this.context = copyContext(context, this.context.revision + 1);
    this.proposals.clear();
    this.active?.abort();
    this.active = null;
    this.emit();
  }
  cancel(): void {
    this.active?.abort();
    this.active = null;
    this.proposals.clear();
    this.emit();
  }
  private async run<T>(
    operation: (
      transport: VerifiedSessionTransport,
      context: ContextEnvelope,
      signal: AbortSignal,
    ) => Promise<T>,
  ): Promise<T> {
    const transport = this.transport;
    if (!transport)
      throw new AlphaClientError(
        "unconfigured",
        "Agent connection is not configured.",
      );
    if (this.context.sensitive)
      throw new AlphaClientError(
        "sensitive",
        "Agent observation is paused on this screen.",
      );
    if (this.active)
      throw new AlphaClientError(
        "busy",
        "Wait for the current request or cancel it.",
      );
    const epoch = this.epoch,
      revision = this.context.revision;
    const controller = new AbortController();
    this.active = controller;
    this.emit();
    let abortListener: (() => void) | undefined;
    try {
      const aborted = new Promise<never>((_, reject) => {
        abortListener = () =>
          reject(
            new AlphaClientError(
              "cancelled",
              "Request cancelled. A dispatched action may still need status reconciliation.",
            ),
          );
        controller.signal.addEventListener("abort", abortListener, {
          once: true,
        });
      });
      const result = await Promise.race([
        operation(
          transport,
          copyContext(this.context, revision),
          controller.signal,
        ),
        aborted,
      ]);
      if (controller.signal.aborted)
        throw new AlphaClientError("cancelled", "Request cancelled.");
      if (
        epoch !== this.epoch ||
        revision !== this.context.revision ||
        transport !== this.transport
      ) {
        throw new AlphaClientError(
          "stale",
          "The account or view changed. Request again from the current view.",
        );
      }
      return result;
    } catch (error) {
      if (error instanceof AlphaClientError) throw error;
      // Never show untrusted adapter errors which can contain URLs or tokens.
      throw new AlphaClientError(
        "transport-failed",
        "The agent request failed. Check connection and action history before sending another request.",
      );
    } finally {
      if (abortListener)
        controller.signal.removeEventListener("abort", abortListener);
      if (this.active === controller) {
        this.active = null;
        this.emit();
      }
    }
  }
  async send(text: string, onText?:(text:string)=>void): Promise<AgentReply> {
    if (!text.trim()) throw new Error("Enter a message.");
    return this.run(async (transport, context, signal) => {
      let accepting=true;let result:AgentReply;
      try { result = await transport.send({
        requestId: crypto.randomUUID(),
        text: text.trim(),
        context,
        signal,
        onText:value=>{if(!accepting||signal.aborted)return;if(typeof value!=='string'||value.length>200000)throw new AlphaClientError('invalid-response','Invalid streamed reply.');onText?.(value);},
      }); } finally {accepting=false;}
      if (signal.aborted)
        throw new AlphaClientError("cancelled", "Request cancelled.");
      if (
        !result ||
        typeof result.text !== "string" ||
        (result.proposals !== undefined && !Array.isArray(result.proposals))
      ) {
        throw new AlphaClientError(
          "invalid-response",
          "The agent returned an invalid response.",
        );
      }
      const next = new Map<string, ActionProposal>();
      for (const proposal of result.proposals ?? []) {
        if (
          !proposal ||
          typeof proposal.id !== "string" ||
          !proposal.id ||
          typeof proposal.title !== "string" ||
          typeof proposal.description !== "string" ||
          !Number.isFinite(proposal.expiresAt) ||
          proposal.expiresAt <= Date.now() ||
          proposal.contextRevision !== context.revision ||
          next.has(proposal.id) ||
          this.consumed.has(proposal.id)
        ) {
          throw new AlphaClientError(
            "invalid-response",
            "The agent returned an invalid action proposal.",
          );
        }
        next.set(proposal.id, { ...proposal });
      }
      this.proposals = next;
      return {
        text: result.text,
        proposals: [...next.values()].map((p) => ({ ...p })),
      };
    });
  }
  /** Call only after the user reviews and explicitly approves this exact proposal. */
  async approve(proposalId: string): Promise<OperationReceipt> {
    const proposal = this.proposals.get(proposalId);
    if (
      !proposal ||
      proposal.expiresAt <= Date.now() ||
      proposal.contextRevision !== this.context.revision ||
      this.consumed.has(proposalId)
    ) {
      throw new AlphaClientError(
        "proposal-unavailable",
        "This action is expired or no longer matches the current view.",
      );
    }
    return this.run(async (transport, context, signal) => {
      this.consumed.add(proposalId);
      this.proposals.delete(proposalId);
      // Keep consumed even on failure/cancel: never replay a possibly dispatched write.
      const receipt = await transport.execute({
        requestId: crypto.randomUUID(),
        proposal: { ...proposal },
        context,
        signal,
      });
      if (
        !receipt ||
        receipt.proposalId !== proposalId ||
        !["succeeded", "denied", "cancelled", "failed", "unknown"].includes(
          receipt.status,
        ) ||
        typeof receipt.summary !== "string"
      ) {
        throw new AlphaClientError(
          "invalid-response",
          "Action status could not be verified. Check history before trying again.",
        );
      }
      return { ...receipt };
    });
  }
}
export const alphaClient = new AlphaClient();
