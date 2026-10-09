export class HostedSourceRejected extends Error {
	constructor() {
		super(
			"Source access changed before saving. Refresh accounts and review the source again.",
		);
	}
}
export interface HostedLiveAccount {
	accountId: string;
	accountRevision: string;
	label: string;
	kinds: ("email" | "calendar")[];
	expiresAt?: string;
}
export interface HostedLiveCalendar {
	calendarId: string;
	label: string;
	timeZone: string;
}
export interface HostedLiveSelection {
	provider: "google";
	accountId: string;
	accountRevision: string;
	kind: "email" | "calendar";
	windowHours: number;
	maxItems: number;
	calendarId?: string;
}
function boundedIdentity(value: unknown) {
	if (
		typeof value !== "string" ||
		!value.length ||
		value.length > 256 ||
		Array.from(value).some(
			(c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127,
		)
	)
		throw Error("Invalid live source identity");
	return value;
}
function revision(value: unknown) {
	if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value))
		throw Error("Invalid live source revision");
	return value;
}
function liveSelection(value: unknown): HostedLiveSelection {
	const v = object(value);
	if (
		v.provider !== "google" ||
		!["email", "calendar"].includes(v.kind) ||
		!Number.isInteger(v.windowHours) ||
		v.windowHours < 1 ||
		v.windowHours > 168 ||
		!Number.isInteger(v.maxItems) ||
		v.maxItems < 1 ||
		v.maxItems > 25
	)
		throw Error("Invalid live source");
	return {
		provider: "google",
		accountId: boundedIdentity(v.accountId),
		accountRevision: revision(v.accountRevision),
		kind: v.kind,
		windowHours: v.windowHours,
		maxItems: v.maxItems,
		...(v.kind === "calendar"
			? { calendarId: boundedIdentity(v.calendarId) }
			: {}),
	};
}
export type DigestTemplate = "morning" | "evening";
export interface HostedNativeSelection {provider:'native';ownerId:string;agentId:string;installationId:string;enrollmentId:string;sourceId:string;revision:string}
function nativeSelection(value:unknown):HostedNativeSelection {const v=object(value);if(v.provider!=='native'||Object.keys(v).some(k=>!['provider','ownerId','agentId','installationId','enrollmentId','sourceId','revision'].includes(k)))throw Error('Invalid native source');return {provider:'native',ownerId:boundedIdentity(v.ownerId),agentId:boundedIdentity(v.agentId),installationId:boundedIdentity(v.installationId),enrollmentId:boundedIdentity(v.enrollmentId),sourceId:boundedIdentity(v.sourceId),revision:revision(v.revision)};}
export interface DigestSource {
	id: string;
	revision: string;
	kind: string;
	label: string;
	observedAt: string;
	expiresAt: string;
	revoked: boolean;
	live?: HostedLiveSelection | HostedNativeSelection;
}
export interface DigestSpec {
	version: 1;
	template: DigestTemplate;
	sourceId: string;
	sourceRevision: string;
	timeZone: string;
	localTime: string;
	enabled: boolean;
}
export type DigestSourceState = "current" | "expired" | "revoked";
export interface DigestCapabilities {
	digests: boolean;
	nativeSources: boolean;
	/** Agent accepts evening loops over a native phone source (its own prompt and read window). */
	nativeEvening: boolean;
	/** Agent pauses a loop whose source lapsed (no daily failure briefs) and reports sourceState. */
	sourcePause: boolean;
}
export interface DigestLoop {
	id: string;
	versionId: string;
	name: string;
	active: boolean;
	removed: boolean;
	spec: DigestSpec;
	/** Agents with patched plugin-workflow report why a loop is paused; older agents omit it. */
	sourceState?: DigestSourceState;
}
/** Default and maximum reviewed source lifetime; renewal reviews a new source. */
export const DIGEST_SOURCE_MAX_HOURS = 168;
/** A bound source shows its renewal notice in its final 24 hours. */
export const DIGEST_RENEWAL_WINDOW_MS = 24 * 3600000;
export interface DigestRenewal {
	source: DigestSource;
	state: DigestSourceState | "expiring";
	loops: DigestLoop[];
}
/** Sources that keep a loop running and need renewal now: expired, revoked, or within 24h of expiry. */
export function digestRenewals(sources: DigestSource[], loops: DigestLoop[], now = Date.now()): DigestRenewal[] {
	const out: DigestRenewal[] = [];
	for (const source of sources) {
		const bound = loops.filter((loop) => !loop.removed && loop.spec.enabled && loop.spec.sourceId === source.id);
		if (!bound.length) continue;
		const expiresAt = Date.parse(source.expiresAt);
		const reported = bound.find((loop) => loop.sourceState && loop.sourceState !== "current")?.sourceState;
		const state: DigestRenewal["state"] = source.revoked || reported === "revoked" ? "revoked" : expiresAt <= now || reported === "expired" ? "expired" : expiresAt - now <= DIGEST_RENEWAL_WINDOW_MS ? "expiring" : "current";
		if (state !== "current") out.push({ source, state, loops: bound });
	}
	return out;
}
/** Loop state shown to the owner. Only an agent that advertises pausing is described as paused; an older agent still runs the schedule and records an unavailable result. */
export function digestLoopState(loop: DigestLoop, sources: DigestSource[], now = Date.now(), pauses = false): string {
	if (loop.removed) return "Removed";
	if (!loop.spec.enabled || !loop.active) return "Paused";
	const source = sources.find((s) => s.id === loop.spec.sourceId);
	const suffix = pauses ? " — paused" : " — renew to resume";
	if (loop.sourceState === "revoked" || source?.revoked) return "Source revoked" + suffix;
	if (loop.sourceState === "expired" || !source || Date.parse(source.expiresAt) <= now) return "Source expired" + suffix;
	return "On";
}
export interface RetainedDigestSummary {
	summary: string;
	ranAt: string;
	agent: string;
	status: string;
}
let retained: RetainedDigestSummary | null = null;
const retainedListeners = new Set<() => void>();
/** Latest retained digest of the current connection, for Home. Never a fresh read or a run. */
export function latestRetainedDigest(): RetainedDigestSummary | null {
	return retained;
}
export function subscribeRetainedDigest(listener: () => void): () => void {
	retainedListeners.add(listener);
	return () => retainedListeners.delete(listener);
}
/** Records the newest retained result (by completion, then cursor), or clears it when the connection changes. */
export function rememberRetainedDigests(results: DigestResult[] | null, agent = "Your agent") {
	const latest = (results ?? []).reduce<DigestResult | null>((best, row) => {
		if (!best) return row;
		const a = Date.parse(row.completedAt), b = Date.parse(best.completedAt);
		return a > b || (a === b && row.cursor > best.cursor) ? row : best;
	}, null);
	const next = latest ? { summary: digestSummaryText(latest).slice(0, 2000), ranAt: latest.completedAt, agent: agent.slice(0, 200) || "Your agent", status: latest.status } : null;
	if (JSON.stringify(next) === JSON.stringify(retained)) return;
	retained = next;
	for (const listener of retainedListeners) listener();
	if (typeof window !== "undefined") window.dispatchEvent(new Event("alpha:retained-digest"));
}
export interface DigestResult {
	cursor: number;
	runId: string;
	workflowId: string;
	workflowVersionId: string;
	templateVersion: string;
	scheduledAt: string;
	source: Record<string, unknown>;
	status: string;
	startedAt: string;
	completedAt: string;
	output: unknown;
	error: string | null;
}
export interface DigestStorage {
	read<T>(slot: string): Promise<T | null>;
	write(slot: string, value: unknown): Promise<void>;
	remove(slot: string): Promise<void>;
}
function object(value: unknown): Record<string, any> {
	if (!value || typeof value !== "object" || Array.isArray(value))
		throw Error("Invalid hosted digest response");
	return value as Record<string, any>;
}
function id(value: unknown) {
	if (
		typeof value !== "string" ||
		!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value)
	)
		throw Error("Invalid digest identity");
	return value;
}
function date(value: unknown) {
	if (typeof value !== "string" || !Number.isFinite(Date.parse(value)))
		throw Error("Invalid digest date");
	return value;
}
export function parseDigestResult(value: unknown): DigestResult {
	const v = object(value);
	if (
		!Number.isSafeInteger(v.cursor) ||
		v.cursor < 1 ||
		typeof v.status !== "string" ||
		JSON.stringify(v).length > 200000
	)
		throw Error("Invalid digest result");
	return {
		cursor: v.cursor,
		runId: id(v.runId),
		workflowId: id(v.workflowId),
		workflowVersionId: id(v.workflowVersionId),
		templateVersion: id(v.templateVersion),
		scheduledAt: date(v.scheduledAt),
		source: object(v.source),
		status: v.status,
		startedAt: date(v.startedAt),
		completedAt: date(v.completedAt),
		output: v.output,
		error: typeof v.error === "string" ? v.error : null,
	};
}
/** Display the final summary, not typed-step source payloads or execution metadata. */
export function digestSummaryText(result: Pick<DigestResult,'runId'|'output'|'error'>):string {
 if(result.error)return result.error;
 const output=result.output;if(typeof output==='string')return output;
 if(Array.isArray(output)&&output.length===1){const value=output[0];if(value&&typeof value==='object'&&value.nodeId==='typed-steps'&&value.runId===result.runId&&typeof value.text==='string')return value.text;}
 if(output&&typeof output==='object'&&!Array.isArray(output)){const value=output as Record<string,unknown>;if(typeof value.summary==='string')return value.summary;if(typeof value.text==='string')return value.text;}
 return 'No readable summary was returned. Open execution details to inspect this result.';
}
export class HostedDigestProtocol {
	constructor(
		private request: (
			path: string,
			body: unknown | undefined,
			signal: AbortSignal,
		) => Promise<unknown>,
	) {}
 /** What this agent advertises. Older agents omit the pause and native evening flags, so the app neither offers nor claims them. */
 async capabilities(signal:AbortSignal):Promise<DigestCapabilities>{const v=object(await this.request('/api/workflow/status',undefined,signal));return {digests:v.hostedDigestProtocol===1,nativeSources:v.hostedNativeSourceProtocol===1,nativeEvening:v.hostedNativeSourceProtocol===1&&v.hostedNativeEveningProtocol===1,sourcePause:v.hostedDigestSourcePauseProtocol===1};}
	async available(signal: AbortSignal) {
		return (
			object(await this.request("/api/workflow/status", undefined, signal))
				.hostedDigestProtocol === 1
		);
	}
	async delegation(path: "start"|"complete"|"status"|"cancel"|"revoke"|"revocations",body:Record<string,unknown>,signal:AbortSignal):Promise<Record<string,any>> { return object(await this.request("/api/workflow/hosted/cloud-delegation/"+path,body,signal)); }
	async liveAccounts(
		signal: AbortSignal,
	): Promise<{ accounts: HostedLiveAccount[] }> {
		const v = object(
			await this.request(
				"/api/workflow/hosted/live-accounts",
				undefined,
				signal,
			),
		);
		if (!Array.isArray(v.accounts) || v.accounts.length > 100)
			throw Error("Invalid live accounts");
		return {
			accounts: v.accounts.map((value) => {
				const a = object(value);
				if (
					!Array.isArray(a.kinds) ||
					!a.kinds.length ||
					a.kinds.length > 2 ||
					new Set(a.kinds).size !== a.kinds.length ||
					a.kinds.some((k: unknown) => k !== "email" && k !== "calendar") ||
					typeof a.label !== "string" ||
					!a.label.length ||
					a.label.length > 200 || (a.expiresAt !== undefined && (typeof a.expiresAt !== "string" || !Number.isFinite(Date.parse(a.expiresAt))))
				)
					throw Error("Invalid live account");
				return {
					accountId: boundedIdentity(a.accountId),
					accountRevision: revision(a.accountRevision),
					label: a.label,
					kinds: a.kinds,
					...(typeof a.expiresAt === "string" ? {expiresAt:a.expiresAt}:{}),
				};
			}),
		};
	}
	async liveCalendars(
		account: HostedLiveAccount,
		signal: AbortSignal,
	): Promise<{ calendars: HostedLiveCalendar[]; truncated: boolean }> {
		const v = object(
			await this.request(
				"/api/workflow/hosted/live-calendars",
				{
					accountId: account.accountId,
					accountRevision: account.accountRevision,
				},
				signal,
			),
		);
		if (
			!Array.isArray(v.calendars) ||
			v.calendars.length > 50 ||
			typeof v.truncated !== "boolean"
		)
			throw Error("Invalid live calendars");
		return {
			truncated: v.truncated,
			calendars: v.calendars.map((value) => {
				const c = object(value);
				if (
					typeof c.label !== "string" ||
					!c.label.length ||
					c.label.length > 256 ||
					typeof c.timeZone !== "string" ||
					c.timeZone.length > 100
				)
					throw Error("Invalid live calendar");
				return {
					calendarId: boundedIdentity(c.calendarId),
					label: c.label,
					timeZone: c.timeZone,
				};
			}),
		};
	}
	async sources(signal: AbortSignal): Promise<DigestSource[]> {
		const values = object(
			await this.request("/api/workflow/hosted/sources", undefined, signal),
		).sources;
		if (!Array.isArray(values) || values.length > 1000)
			throw Error("Invalid sources");
		return values.map((value) => {
			const v = object(value);
			return {
				id: id(v.id),
				revision: id(v.revision),
				kind: String(v.kind),
				label: String(v.label).slice(0, 200),
				observedAt: date(v.observedAt),
				expiresAt: date(v.expiresAt),
				revoked: v.revoked === true,
				...(v.live === undefined ? {} : { live: object(v.live).provider==='native' ? nativeSelection(v.live) : liveSelection(v.live) }),
			};
		});
	}
	async loops(signal: AbortSignal): Promise<DigestLoop[]> {
		const values = object(
			await this.request("/api/workflow/hosted/loops", undefined, signal),
		).loops;
		if (!Array.isArray(values) || values.length > 1000)
			throw Error("Invalid loops");
		return values.map((value) => {
			const v = object(value);
			const sourceState = ["current", "expired", "revoked"].includes(v.sourceState) ? (v.sourceState as DigestSourceState) : undefined;
			const { sourceState: _reported, ...rest } = v;
			return { ...rest, id: id(v.id), versionId: id(v.versionId), ...(sourceState ? { sourceState } : {}) } as DigestLoop;
		});
	}
	async mutate(
		path: "sources" | "loops" | "sources/revoke" | "dossier",
		body: unknown,
		signal: AbortSignal,
	) {
		try {
			return object(
				await this.request("/api/workflow/hosted/" + path, body, signal),
			);
		} catch (error) {
			const e = error as {
				status?: number;
				code?: string;
				mutationId?: string;
			};
			if (
				path === "sources" &&
				(e?.status === 409 || e?.status === 400) &&
				e.code === "HOSTED_SOURCE_NOT_SAVED" &&
				e.mutationId === object(body).id
			)
				throw new HostedSourceRejected();
			throw error;
		}
	}
	async results(clientId: string, signal: AbortSignal) {
		const v = object(
			await this.request(
				"/api/workflow/hosted/results?clientId=" +
					encodeURIComponent(id(clientId)),
				undefined,
				signal,
			),
		);
		if (!Array.isArray(v.entries) || v.entries.length > 50)
			throw Error("Invalid result page");
		const entries = v.entries.map(parseDigestResult);
		if (entries.some((e, i) => i > 0 && e.cursor <= entries[i - 1].cursor))
			throw Error("Out of order result page");
		return entries;
	}
	async ack(clientId: string, result: DigestResult, signal: AbortSignal) {
		await this.request(
			"/api/workflow/hosted/results/ack",
			{ clientId, cursor: result.cursor, runId: result.runId },
			signal,
		);
	}
}
/** Serialize callers. Commit exact private results locally before advancing the
 * server cursor. A lost ack simply replays the same IDs, never a workflow run. */
// JSON objects may arrive with a different property order after reconnect.
// Array order and every value remain part of the immutable receipt identity.
function sameResultValue(left: unknown, right: unknown): boolean {
	if (left === right) return true;
	if (left === null || right === null || typeof left !== "object" || typeof right !== "object")
		return false;
	if (Array.isArray(left) || Array.isArray(right))
		return Array.isArray(left) && Array.isArray(right) &&
			left.length === right.length &&
			left.every((value, index) => sameResultValue(value, right[index]));
	const a = left as Record<string, unknown>, b = right as Record<string, unknown>;
	const keys = Object.keys(a);
	return keys.length === Object.keys(b).length &&
		keys.every((key) => Object.hasOwn(b, key) && sameResultValue(a[key], b[key]));
}
const inboxQueues = new Map<string, Promise<unknown>>();
export class DigestInbox {
	constructor(
		private storage: DigestStorage,
		private scope: string,
		private afterCommit?: (
			result: DigestResult,
			signal: AbortSignal,
		) => Promise<void>,
	) {}
	async history() {
		const index = await this.storage.read<{ clientId: string; ids: string[] }>(
			this.scope,
		);
		if (!index) return [];
		const entries = await Promise.all(
			index.ids.map((run) =>
				this.storage.read<DigestResult>(this.scope + ":" + run),
			),
		);
		return entries
			.filter((v): v is DigestResult => v !== null)
			.map(parseDigestResult);
	}
	sync(
		client: HostedDigestProtocol,
		signal: AbortSignal,
	): Promise<DigestResult[]> {
		const work = (inboxQueues.get(this.scope) || Promise.resolve()).then(
			async () => {
				// Cancellation cannot undo a dispatched write; stop before the next
				// operation and let a later replay recover any committed record.
				const guarded = async <T>(operation: () => Promise<T>): Promise<T> => {
					signal.throwIfAborted();
					const value = await operation();
					signal.throwIfAborted();
					return value;
				};
				const storage: DigestStorage = {
					read: <T>(slot: string) => guarded(() => this.storage.read<T>(slot)),
					write: (slot, value) => guarded(() => this.storage.write(slot, value)),
					remove: (slot) => guarded(() => this.storage.remove(slot)),
				};
				let index = await storage.read<{
					clientId: string;
					ids: string[];
					pendingRemoval?: string[];
					pendingNotices?: string[];
				}>(this.scope);
				if (!index) {
					index = { clientId: crypto.randomUUID(), ids: [] };
					await storage.write(this.scope, index);
				}
				// Recover cleanup after a lost ack or process exit; only evicted history is removed.
				for (const run of index.pendingRemoval ?? []) {
					if (!index.ids.includes(run))
						await storage.remove(this.scope + ":" + run);
				}
				index.pendingRemoval = [];
				await storage.write(this.scope, index);
				const drainNotices = async () => {
					if (!this.afterCommit) return;
					for (const run of [...(index!.pendingNotices ?? [])]) {
						signal.throwIfAborted();
						const saved = index!.ids.includes(run)
							? await storage.read<DigestResult>(this.scope + ":" + run)
							: null;
						try {
							if (saved)
								await guarded(() => this.afterCommit!(parseDigestResult(saved), signal));
						} catch {
							signal.throwIfAborted();
							continue;
						}
						index!.pendingNotices = (index!.pendingNotices ?? []).filter(
							(id) => id !== run,
						);
						await storage.write(this.scope, index);
					}
				};
				await drainNotices();
				for (let page = 0; page < 20; page++) {
					signal.throwIfAborted();
					const entries = await guarded(() => client.results(index.clientId, signal));
					if (!entries.length) break;
					for (const entry of entries) {
						const key = this.scope + ":" + entry.runId,
							existing = await storage.read<DigestResult>(key);
						if (existing && !sameResultValue(existing, entry))
							throw Error("Saved digest result changed");
						if (!existing) await storage.write(key, entry);
						if (!index.ids.includes(entry.runId)) {
							index.ids.push(entry.runId);
							index.pendingNotices = [
								...new Set([...(index.pendingNotices ?? []), entry.runId]),
							];
						}
					}
					// The latest 100 full outputs are retained on this phone. Server history is durable.
					const removed = index.ids.splice(
						0,
						Math.max(0, index.ids.length - 100),
					);
					index.pendingNotices = (index.pendingNotices ?? []).filter((run) =>
						index!.ids.includes(run),
					);
					index.pendingRemoval = [
						...new Set([...(index.pendingRemoval ?? []), ...removed]),
					];
					await storage.write(this.scope, index);
					await drainNotices();
					signal.throwIfAborted();
					await guarded(() => client.ack(index.clientId, entries[entries.length - 1], signal));
					for (const run of index.pendingRemoval)
						await storage.remove(this.scope + ":" + run);
					index.pendingNotices = (index.pendingNotices ?? []).filter((run) =>
						index!.ids.includes(run),
					);
					index.pendingRemoval = [];
					await storage.write(this.scope, index);
				}
				return guarded(() => this.history());
			},
		);
		const tail = work.catch(() => {});
		inboxQueues.set(this.scope, tail);
		void tail.finally(() => {
			if (inboxQueues.get(this.scope) === tail) inboxQueues.delete(this.scope);
		});
		return work;
	}
}
