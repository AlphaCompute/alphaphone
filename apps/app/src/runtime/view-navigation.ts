/** Navigation-only use of the shared completed-action and renderer-claim contracts. */

import {
	NAVIGATE_VIEW_EVENT,
	type NavigateViewDetail,
} from "../../../../.eliza/client-features/packages/core/src/events.ts";
import { createCompletedActionNavigationState } from "../../../../.eliza/client-features/packages/core/src/views/completed-action-navigation.ts";
import { findViewActionHandoff } from "../../../../.eliza/client-features/packages/core/src/views/view-action-handoff.ts";
import { ENABLED_MVP_VIEWS } from "../prototype/mvp-features";
import { AlphaClientError, type ContextEnvelope } from "./alpha-client";

type Request = (
	path: string,
	body: unknown,
	signal: AbortSignal,
) => Promise<unknown>;
export type NavigationAttempt = {
	controller: AbortController;
	current: () => void;
	fence: () => boolean;
};
const object = (value: unknown): Record<string, unknown> => {
	if (!value || typeof value !== "object" || Array.isArray(value))
		throw Error("Navigation reply was not verified");
	return value as Record<string, unknown>;
};
const localView = (id: string) =>
	id === "chat" ? "home" : id === "reminders" ? "calendar" : id;
export class ViewNavigationClient {
	readonly clientId = crypto.randomUUID();
	private disposed = false;
	private attempt?: NavigationAttempt;
	private readonly state;
	constructor(
		private readonly request: Request,
		private readonly currentSession: () => boolean,
		private readonly context: () => ContextEnvelope | null,
	) {
		this.state = createCompletedActionNavigationState(() =>
			JSON.stringify(this.context()),
		);
	}
	metadata(context: ContextEnvelope) {
		return !context.sensitive && this.currentSession() && !this.disposed
			? {
					viewClientId: this.clientId,
					viewDelivery: "completed-action",
					uiView: context.view === "home" ? "chat" : context.view,
				}
			: {};
	}
	capture(context: ContextEnvelope): NavigationAttempt {
		this.cancel();
		const expected = JSON.stringify(context),
			controller = new AbortController();
		const current = () => {
			controller.signal.throwIfAborted();
			if (
				this.disposed ||
				!this.currentSession() ||
				JSON.stringify(this.context()) !== expected ||
				context.sensitive ||
				document.hidden
			)
				throw new AlphaClientError(
					"stale",
					"Navigation cancelled because the screen or connection changed.",
				);
		};
		const attempt = {
			controller,
			current,
			fence: this.state.captureCompletedActionNavigationFence(),
		};
		this.attempt = attempt;
		return attempt;
	}
	cancel() {
		this.attempt?.controller.abort();
		this.attempt = undefined;
	}
	dispose() {
		this.disposed = true;
		this.cancel();
		this.state.dispose();
	}
	async deliver(
		results: readonly unknown[] | undefined,
		attempt: NavigationAttempt,
		navigate: (view: string, current: () => void) => Promise<boolean>,
	): Promise<{ status: "none" | "delivered" | "unknown"; label?: string }> {
		const views = results?.filter((result) => {
			const r = object(result);
			return (
				typeof r.actionName === "string" &&
				r.actionName.toUpperCase() === "VIEWS"
			);
		});
		const handoff = findViewActionHandoff(views);
		if (!handoff?.navigationPrepared || !handoff.navigationBinding)
			return { status: "none" };
		const binding = handoff.navigationBinding,
			target = localView(handoff.viewId);
		if (
			binding.clientId !== this.clientId ||
			handoff.subview ||
			(!["home", "notifications"].includes(target) &&
				!ENABLED_MVP_VIEWS.has(target)) ||
			(handoff.viewPath &&
				![
					`/${handoff.viewId}`,
					`/apps/${handoff.viewId}`,
					...(target === "home" ? ["/"] : []),
				].includes(handoff.viewPath))
		)
			throw new AlphaClientError(
				"proposal-unavailable",
				"That screen is not available.",
			);
		const selected = views
				?.slice()
				.reverse()
				.find(
					(result) =>
						object(object(result).values).completedActionHandoffId ===
						binding.requestId,
				),
			values = object(object(selected).values);
		if (
			Object.keys(values).some(
				(key) =>
					![
						"mode",
						"viewId",
						"viewPath",
						"viewType",
						"label",
						"completedActionDelivered",
						"completedActionHandoffId",
						"navigationPrepared",
						"navigationBinding",
					].includes(key),
			)
		)
			throw Error("Navigation does not accept record parameters");
		attempt.current();
		if (!attempt.fence())
			throw new AlphaClientError(
				"stale",
				"Navigation cancelled because the screen changed.",
			);
		const claimed = object(
			await this.request(
				"/api/views/interact-claim",
				binding,
				attempt.controller.signal,
			),
		);
		if (typeof claimed.claimId !== "string" || !claimed.claimId)
			throw Error("Navigation claim was not verified");
		attempt.current();
		if (!attempt.fence())
			throw new AlphaClientError(
				"stale",
				"Navigation cancelled because the screen changed.",
			);
		let switched = false;
		const received = (event: Event) => {
			const detail = (event as CustomEvent<NavigateViewDetail>).detail;
			if (detail?.completedActionHandoffId !== binding.requestId) return;
			this.state.markCompletedActionNavigationHandled(event, detail);
		};
		window.addEventListener(NAVIGATE_VIEW_EVENT, received);
		try {
			if (
				!this.state.dispatchCompletedActionNavigation({
					viewId: handoff.viewId,
					source: "agent",
					completedActionHandoffId: binding.requestId,
				})
			)
				return { status: "none" };
			// The existing shell executor waits for its React commit, not just setState dispatch.
			switched = await navigate(target, attempt.current);
		} catch {
			switched = false;
		} finally {
			window.removeEventListener(NAVIGATE_VIEW_EVENT, received);
		}
		// Our own view switch retires the chat context; it must not cancel its exact
		// post-effect acknowledgment. A connection/owner/epoch change still refuses it.
		if (this.disposed || !this.currentSession()) return { status: "unknown" };
		switched =
			switched &&
			this.context()?.view === target &&
			!this.context()?.sensitive &&
			!document.hidden;
		const accepted = object(
			await this.request(
				"/api/views/interact-result",
				{
					...binding,
					claimId: claimed.claimId,
					success: switched,
					result: { switched },
				},
				AbortSignal.timeout(5000),
			),
		);
		if (switched && accepted.accepted === true)
			return {
				status: "delivered",
				label:
					target === "home"
						? "Home"
						: typeof values.label === "string"
							? values.label
							: target,
			};
		return { status: "unknown" };
	}
}
