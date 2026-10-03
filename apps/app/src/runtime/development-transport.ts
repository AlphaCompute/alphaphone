import { DEVELOPMENT_PROPOSAL_VIEWS } from "./development-view-contract.ts";
import { sanitizePhoneContext } from './phone-context';
import { registerPlugin } from '../platform-plugins';
import type {
  ActionProposal,
  AlphaView,
  ContextEnvelope,
  VerifiedSessionTransport,
} from "./alpha-client";

export type DevelopmentLocalOperation =
  | { type: "create_note"; title: string; body: string }
  | { type: "create_reminder"; title: string; body: string; at: number }
  | { type: "open_view"; view: AlphaView };
export type DevelopmentLocalDispatcher = (
  operation: DevelopmentLocalOperation,
) =>
  | Promise<{ status: "succeeded" | "failed"; summary: string }>
  | { status: "succeeded" | "failed"; summary: string };
export interface DevelopmentAgentStatus {
  available: boolean;
  configured: boolean;
  connected: boolean;
  message?: string;
  mode?: string;
  sessionId?: string;
  model?: string;
  providerOrigin?: string;
}
interface WireProposal extends ActionProposal {
  operation: DevelopmentLocalOperation;
}
const DevelopmentAgent = registerPlugin<{
  status(): Promise<DevelopmentAgentStatus>;
  chat(input: {
    requestId: string;
    text: string;
    context: ContextEnvelope;
  }): Promise<{ text: string; requestId: string; proposals: WireProposal[] }>;
  cancel(input: { requestId: string }): Promise<{ cancelled: boolean }>;
}>("DevelopmentAgent");
const allowedViews = new Set<AlphaView>(DEVELOPMENT_PROPOSAL_VIEWS);
function validateOperation(
  operation: DevelopmentLocalOperation,
): DevelopmentLocalOperation {
  if (
    operation?.type === "create_note" &&
    typeof operation.title === "string" &&
    operation.title.trim() &&
    operation.title.length <= 200 &&
    typeof operation.body === "string" &&
    operation.body.length <= 12000
  ) {
    return {
      type: "create_note",
      title: operation.title,
      body: operation.body,
    };
  }
  if (operation?.type === "create_reminder" &&
      typeof operation.title === "string" && operation.title.trim() && operation.title.length <= 200 &&
      typeof operation.body === "string" && operation.body.length <= 4000 &&
      Number.isSafeInteger(operation.at) && operation.at > Date.now() && operation.at <= 8640000000000000)
    return { type: "create_reminder", title: operation.title.trim(), body: operation.body, at: operation.at };
  if (operation?.type === "open_view" && allowedViews.has(operation.view))
    return { type: "open_view", view: operation.view };
  throw new Error("Unsupported local action proposal.");
}
export async function developmentAgentStatus(): Promise<DevelopmentAgentStatus> {
  try {
    return await DevelopmentAgent.status();
  } catch {
    return {
      available: false,
      configured: false,
      connected: false,
      message:
        "Development agent is available only in a configured Android debug build.",
    };
  }
}

/** Native debug bridge only; credentials never enter JavaScript. Local operations
 * require both a registered dispatcher and approval of the exact retained proposal. */
export async function createDevelopmentTransport(
  dispatch?: DevelopmentLocalDispatcher,
): Promise<VerifiedSessionTransport> {
  const status = await developmentAgentStatus();
  if (
    !status.available ||
    !status.configured ||
    !status.connected ||
    status.mode !== "development" ||
    !status.sessionId ||
    !status.providerOrigin
  ) {
    throw new Error(
      "Start and configure the emulator development agent first.",
    );
  }
  const origin = new URL(status.providerOrigin);
  if (origin.protocol !== "https:" || origin.origin !== status.providerOrigin)
    throw new Error("Invalid development provider metadata.");
  const active = new Set<string>();
  const pending = new Map<
    string,
    { proposal: ActionProposal; operation: DevelopmentLocalOperation }
  >();
  return {
    session: {
      ownerId: "emulator-development-owner",
      agentId: `development:${status.model || "model"}`,
      sessionId: status.sessionId,
      origin: status.providerOrigin,
    },
    async send({ requestId, text, context, signal }) {
      if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
      pending.clear();
      active.add(requestId);
      const cancel = () => {
        void DevelopmentAgent.cancel({ requestId }).catch(() => {});
      };
      signal.addEventListener("abort", cancel, { once: true });
      try {
        const result = await DevelopmentAgent.chat({
          requestId,
          text,
          context: context.selectedObject?.kind.startsWith('map-') ? sanitizePhoneContext(context) : context,
        });
        if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
        if (
          result.requestId !== requestId ||
          typeof result.text !== "string" ||
          !Array.isArray(result.proposals) ||
          result.proposals.length > 4
        )
          throw new Error("Invalid development agent response.");
        const proposals: ActionProposal[] = [];
        for (const wire of result.proposals) {
          const operation = validateOperation(wire.operation);
          if (
            !wire.id ||
            typeof wire.id !== "string" ||
            pending.has(wire.id) ||
            typeof wire.title !== "string" ||
            typeof wire.description !== "string" ||
            !Number.isFinite(wire.expiresAt) ||
            wire.expiresAt <= Date.now() ||
            wire.contextRevision !== context.revision
          )
            throw new Error("Invalid development action binding.");
          // Build the review text from the exact validated action, not model prose.
          const proposal: ActionProposal = {
            id: wire.id,
            expiresAt: wire.expiresAt,
            contextRevision: wire.contextRevision,
            title:
              operation.type === "create_note"
                ? "Create note: " + operation.title
                : operation.type === "create_reminder" ? "Create reminder: " + operation.title : "Open " + operation.view,
            description:
              operation.type === "create_note"
                ? "Save this note only on this device. Title: " +
                  operation.title +
                  "\n\n" +
                  operation.body
                : operation.type === "create_reminder"
                  ? "Schedule one reminder on this device. Time: " + new Date(operation.at).toLocaleString(undefined, { dateStyle: "full", timeStyle: "long" }) +
                    "\nExact instant: " + new Date(operation.at).toISOString() +
                    "\nTitle: " + operation.title + "\n\n" + operation.body +
                    "\n\nNotification permission is required. Android may delay delivery to conserve battery."
                : "Navigate to the " +
                  operation.view +
                  " view in Alpha Phone. No native action will run.",
          };
          pending.set(proposal.id, { proposal, operation });
          proposals.push({ ...proposal });
        }
        return { text: result.text, proposals };
      } finally {
        active.delete(requestId);
        signal.removeEventListener("abort", cancel);
      }
    },
    async execute({ proposal, context, signal }) {
      const stored = pending.get(proposal.id);
      if (
        !stored ||
        !dispatch ||
        signal.aborted ||
        stored.proposal.expiresAt <= Date.now() ||
        stored.proposal.contextRevision !== context.revision ||
        JSON.stringify(stored.proposal) !== JSON.stringify(proposal)
      )
        throw new Error("Local action is not available for approval.");
      pending.delete(proposal.id); // consume before dispatch; never retry an ambiguous write
      const result = await dispatch(validateOperation({ ...stored.operation }));
      if (
        !result ||
        !["succeeded", "failed"].includes(result.status) ||
        typeof result.summary !== "string"
      )
        throw new Error("Local action did not return a verified result.");
      return {
        proposalId: proposal.id,
        status: result.status,
        summary: result.summary,
      };
    },
    close() {
      for (const requestId of active)
        void DevelopmentAgent.cancel({ requestId }).catch(() => {});
      active.clear();
      pending.clear();
    },
  };
}
