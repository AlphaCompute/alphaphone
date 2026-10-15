import { Capacitor } from "@capacitor/core";
import { BrowserJsonDomainDocument } from "../browser/json-domain-document";
import {
	calendarDocument,
	initialCalendarState,
	prepareCalendarSource,
} from "../browser/calendar-store";
import { browserCalendarSyncPort } from "../browser/calendar-linked-local";
import {
	CalendarSyncController,
	type CalendarSyncReview,
	type CalendarSyncReport,
} from "./calendar-sync-controller";
import { calendarLinkStorage } from "./calendar-linked-storage";
import {
	CalendarLinkedStore,
	type CalendarSyncBinding,
} from "./calendar-linked-store";
import { connectionController } from "./connection-ui";
import { readGoogleCalendarSelection } from "./google-calendar-selection";
const configuration = new BrowserJsonDomainDocument(
	"alpha.browser.calendar-sync-config.v1",
);
type Configuration = {
	version: 1;
	scope: string;
	binding: CalendarSyncBinding;
	enabled: boolean;
};
let destination = { account: "", calendar: "" };
let preparedBinding: CalendarSyncBinding | null = null,
	status = "Sync is off.",
	running = false,
	enabled = false;
const listeners = new Set<() => void>();
const changed = () => {
	for (const listener of listeners) listener();
};
function owner() {
	const state = connectionController.getSnapshot(),
		cloud = connectionController.getCloudClient(),
		account = state.cloudAccount;
	if (!cloud || !account?.organizationId || !state.session)
		throw Error(
			"Connect your Cloud account and agent before enabling Calendar sync.",
		);
	const selection = readGoogleCalendarSelection({
		environment: account.environment,
		userId: account.userId,
		organizationId: account.organizationId,
	});
	if (!selection)
		throw Error("Choose a Google calendar in Google accounts first.");
	return {
		account,
		cloud,
		selection,
		agentId: state.session.agentId,
		agentSession: state.session.sessionId,
	};
}
function identity() {
	try {
		const { account, cloud, selection, agentId, agentSession } = owner();
		return JSON.stringify([
			account.environment,
			account.userId,
			account.organizationId,
			cloud.credentialId,
			cloud.sessionId,
			selection,
			agentId,
			agentSession,
		]);
	} catch {
		return "";
	}
}
async function saved() {
	const value = await configuration.readJson<Configuration>();
	if (
		value !== null &&
		(value.version !== 1 ||
			typeof value.scope !== "string" ||
			!value.binding ||
			typeof value.enabled !== "boolean" ||
			Object.keys(value).sort().join() !== "binding,enabled,scope,version")
	)
		throw Error(
			"Calendar sync settings need recovery. Saved events are retained.",
		);
	return value;
}
const controller = new CalendarSyncController(
	async (signal) => {
		if (Capacitor.isNativePlatform())
			throw Error(
				"Google sync for device calendars is not available in this build.",
			);
		const selected = owner(),
			key = identity(),
			source = await prepareCalendarSource();
		const current = () =>
			!signal.aborted && !document.hidden && identity() === key;
		if (!current())
			throw new DOMException("Calendar sync context changed", "AbortError");
		const raw = (await selected.cloud.client.googleCalendarSync(
			{
				kind: "capabilities",
				selection: {
					grantId: selected.selection.connectionId,
					calendarId: selected.selection.providerCalendarId,
				},
			},
			signal,
		)) as Record<string, unknown>;
		if (!current())
			throw new DOMException("Calendar sync context changed", "AbortError");
		if (
			raw?.version !== 1 ||
			raw.calendarId !== selected.selection.providerCalendarId ||
			typeof raw.accountId !== "string" ||
			!raw.accountId ||
			raw.read !== true ||
			raw.write !== true ||
			raw.conditionalWrites !== true ||
			raw.idempotentCreate !== true ||
			raw.providerExactlyOnce !== false
		)
			throw Error("This Google calendar does not support safe sync.");
		if (
			typeof raw.accountEmail !== "string" ||
			!/^[^\s@]+@[^\s@]+$/.test(raw.accountEmail) ||
			typeof raw.calendarLabel !== "string" ||
			!raw.calendarLabel.trim()
		)
			throw Error(
				"Google account and calendar names could not be verified. Review the connection before syncing.",
			);
		destination = { account: raw.accountEmail, calendar: raw.calendarLabel };
		const binding: CalendarSyncBinding = {
			environment: selected.account.environment,
			userId: selected.account.userId,
			organizationId: selected.account.organizationId!,
			connectionId: selected.selection.connectionId,
			providerAccountId: raw.accountId,
			calendarId: selected.selection.providerCalendarId,
			agentId: selected.agentId,
			localSourceId: source.sourceId,
			localSourceRevision: source.sourceRevision,
		};
		preparedBinding = binding;
		return {
			reviewIdentity: key,
			binding,
			client: selected.cloud.client,
			current,
			local: browserCalendarSyncPort(source.sourceRevision, current),
			storage: calendarLinkStorage,
			events: async () => {
				const data = await calendarDocument.read(initialCalendarState, signal);
				if (!current() || data.sourceRevision !== source.sourceRevision)
					throw new DOMException("Calendar source changed", "AbortError");
				return data.events
					.map((event) => ({ id: event.id, revision: event.revision }))
					.sort((a, b) => a.id.localeCompare(b.id));
			},
		};
	},
	{
		read: async (scope) => {
			const value = await saved();
			enabled = value?.scope === scope && value.enabled === true;
			return enabled;
		},
		write: async (scope, nextEnabled) => {
			const binding = preparedBinding;
			if (!binding) throw Error("Review the Calendar sync destination again.");
			await configuration.editJson<Configuration>(() => ({
				version: 1,
				scope,
				binding: { ...binding },
				enabled: nextEnabled,
			}));
			window.dispatchEvent(new Event("alpha:calendar-sync-config-changed"));
			enabled = nextEnabled;
		},
	},
);
function message(error: unknown) {
	const e = error as { status?: number; name?: string; message?: string };
	if (e?.status === 404)
		return "Calendar sync is not available on this server yet. Check linked events before retrying.";
	if (e?.name === "AbortError")
		return "Sync paused or the selected account changed. Check linked events before retrying.";
	return (
		e?.message ||
		"Sync stopped. Check the selected Google calendar before retrying."
	);
}
async function work<T>(
	action: () => Promise<T>,
	success: (result: T) => string,
) {
	if (running) throw Error("Calendar sync is already running.");
	running = true;
	changed();
	try {
		const result = await action();
		status = success(result);
		return result;
	} catch (error) {
		status = message(error);
		throw error;
	} finally {
		running = false;
		changed();
		window.dispatchEvent(new Event("alpha:calendar-sync-settled"));
	}
}
function report(result: CalendarSyncReport) {
	const warnings = result.conflicted + result.quarantined + result.dirty;
	return warnings
		? `Sync needs review: ${result.conflicted} conflicts, ${result.quarantined} unconfirmed changes, ${result.dirty} refused changes.`
		: `Synced: ${result.pushed} sent to Google, ${result.pulled} received, ${result.clean} unchanged.`;
}
export const calendarSyncHost = {
	subscribe(listener: () => void) {
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	},
	snapshot: () => ({ status, running, enabled }),
	async settings() {
		const config = await saved();
		try {
			const target = owner(),
				b = config?.binding;
			enabled =
				!!config?.enabled &&
				b?.environment === target.account.environment &&
				b?.userId === target.account.userId &&
				b?.organizationId === target.account.organizationId &&
				b?.connectionId === target.selection.connectionId &&
				b?.calendarId === target.selection.providerCalendarId &&
				b?.agentId === target.agentId;
		} catch {
			enabled = false;
		}
		changed();
	},
	async linkedProviderEvents(): Promise<Set<string>> {
		const config = await saved();
		if (!config?.enabled) return new Set();
		const target = owner(),
			b = config.binding,
			key = identity();
		if (
			b.environment !== target.account.environment ||
			b.userId !== target.account.userId ||
			b.organizationId !== target.account.organizationId ||
			b.agentId !== target.agentId ||
			b.connectionId !== target.selection.connectionId ||
			b.calendarId !== target.selection.providerCalendarId
		)
			return new Set();
		const source = await prepareCalendarSource();
		if (source.sourceRevision !== b.localSourceRevision) return new Set();
		const store = await CalendarLinkedStore.open(
			b,
			() => !document.hidden && identity() === key,
			calendarLinkStorage,
		);
		return new Set(
			(await store.list())
				.filter(
					(row) =>
						row.providerEventId &&
						(row.state === "clean" || row.state === "dirty"),
				)
				.map((row) => row.providerEventId!),
		);
	},
	destination: () => ({ ...destination }),
	review: () =>
		work(
			() => controller.review(),
			(review) => `Ready to link ${review.events.length} Alpha events.`,
		),
	enable: async (review: CalendarSyncReview) => {
		await work(
			() => controller.enable(review),
			() => "Sync enabled.",
		);
		return calendarSyncHost.sync();
	},
	sync: () => work(() => controller.sync(), report),
	pause: async () => {
		controller.cancel();
		await configuration.editJson<Configuration>((value) =>
			value ? { ...value, enabled: false } : null,
		);
		window.dispatchEvent(new Event("alpha:calendar-sync-config-changed"));
		enabled = false;
		status = "Sync is off. Saved events and links are retained.";
		changed();
	},
	cancel: () => controller.cancel(),
	async resume() {
		if (running || Capacitor.isNativePlatform() || document.hidden) return;
		try {
			const config = await saved();
			if (!config?.enabled) return;
			const { account, selection, agentId } = owner(),
				binding = config.binding;
			if (
				binding.environment !== account.environment ||
				binding.userId !== account.userId ||
				binding.organizationId !== account.organizationId ||
				binding.connectionId !== selection.connectionId ||
				binding.calendarId !== selection.providerCalendarId ||
				binding.agentId !== agentId
			)
				return;
			await calendarSyncHost.sync();
		} catch (error) {
			status = message(error);
			changed();
		}
	},
};

/** Foreground only: local edits and returning to Calendar refresh retained links; no polling or inference. */
export function startCalendarSyncHost() {
	let pendingLocalChange = false;
	let key = identity(),
		timer: ReturnType<typeof setTimeout> | undefined;
	const changedOwner = () => {
		const next = identity();
		if (next !== key) {
			key = next;
			controller.cancel();
			status =
				"Sync is off for this account or calendar until its saved configuration is checked.";
			changed();
			void calendarSyncHost.resume();
		}
	};
	const localChanged = () => {
		if (!enabled || document.hidden) return;
		if (running) {
			pendingLocalChange = true;
			return;
		}
		clearTimeout(timer);
		timer = setTimeout(() => void calendarSyncHost.resume(), 400);
	};
	const settled = () => {
		if (pendingLocalChange) {
			pendingLocalChange = false;
			localChanged();
		}
	};
	const visible = () => {
		if (document.hidden) {
			clearTimeout(timer);
			controller.cancel();
		} else void calendarSyncHost.resume();
	};
	const channel =
		typeof BroadcastChannel === "undefined"
			? null
			: new BroadcastChannel("alpha.calendar-sync-config.v1");
	if (channel)
		channel.onmessage = () => {
			controller.cancel();
			status = "Sync settings changed in another view.";
			changed();
		};
	const configChanged = () => channel?.postMessage({ changed: true });
	const unsubscribe = connectionController.subscribe(changedOwner);
	window.addEventListener("alpha:google-accounts-changed", changedOwner);
	window.addEventListener(
		"alpha:google-calendar-selection-changed",
		changedOwner,
	);
	window.addEventListener("alpha:calendar-document-changed", localChanged);
	window.addEventListener("alpha:calendar-sync-source-changed", localChanged);
	window.addEventListener("alpha:calendar-sync-settled", settled);
	window.addEventListener("alpha:calendar-sync-config-changed", configChanged);
	document.addEventListener("visibilitychange", visible);
	void calendarSyncHost.resume();
	return () => {
		clearTimeout(timer);
		controller.cancel();
		unsubscribe();
		channel?.close();
		window.removeEventListener("alpha:google-accounts-changed", changedOwner);
		window.removeEventListener(
			"alpha:google-calendar-selection-changed",
			changedOwner,
		);
		window.removeEventListener("alpha:calendar-document-changed", localChanged);
		window.removeEventListener(
			"alpha:calendar-sync-source-changed",
			localChanged,
		);
		window.removeEventListener("alpha:calendar-sync-settled", settled);
		window.removeEventListener(
			"alpha:calendar-sync-config-changed",
			configChanged,
		);
		document.removeEventListener("visibilitychange", visible);
	};
}
