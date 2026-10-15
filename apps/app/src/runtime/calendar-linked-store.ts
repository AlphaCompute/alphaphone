import type {
	LinkedCalendarCheckpointStore,
	LinkedCalendarEventRecord,
} from "../../../../.eliza/client-features/packages/contracts/src/calendar-linked-sync";

export type CalendarSyncBinding = {
	environment: "production" | "staging";
	userId: string;
	organizationId: string;
	connectionId: string;
	calendarId: string;
	agentId: string;
	localSourceId: string;
	localSourceRevision: string;
};
export interface CalendarLinkStorage {
	read(slot: string): Promise<unknown | null>;
	compareExchange(
		slot: string,
		expected: unknown | null,
		value: unknown,
	): Promise<{ status: "saved" | "conflict" }>;
}
type Link = LinkedCalendarEventRecord<string>;
type Document = { version: 1; owner: string; links: Link[] };
const fields = [
	"id",
	"agentId",
	"localEventId",
	"connectorAccountId",
	"providerCalendarId",
	"providerEventId",
	"providerEtag",
	"localRevision",
	"lastCommonSemanticHash",
	"state",
	"pendingOperation",
	"idempotencyKey",
	"lastErrorCode",
	"lastErrorMessage",
	"createdAt",
	"updatedAt",
]
	.sort()
	.join();
const states = [
	"clean",
	"dirty",
	"conflicted",
	"quarantined",
	"paused",
	"local_only",
];
const text = (value: unknown, max = 1024): value is string =>
	typeof value === "string" &&
	value.length > 0 &&
	value.length <= max &&
	!/[\u0000-\u001f\u007f]/.test(value);
const nullable = (value: unknown, max = 1024) =>
	value === null || text(value, max);
const errorText = (value: unknown) =>
	value === null || (typeof value === "string" && value.length <= 4096);
const timestamp = (value: unknown) =>
	typeof value === "string" && Number.isFinite(Date.parse(value));
const refuse = () =>
	Error(
		"Calendar sync checkpoints changed or need recovery. Existing data is retained.",
	);

/** Durable owner/source-bound checkpoints. Provider effects stay in the shared reconciler. */
export class CalendarLinkedStore
	implements LinkedCalendarCheckpointStore<string>
{
	private constructor(
		readonly scope: string,
		private binding: CalendarSyncBinding,
		private current: () => boolean,
		private storage: CalendarLinkStorage,
	) {}
	static async open(
		binding: CalendarSyncBinding,
		current: () => boolean,
		storage: CalendarLinkStorage,
	) {
		binding = { ...binding };
		if (
			!["production", "staging"].includes(binding.environment) ||
			Object.keys(binding).sort().join() !==
				[
					"environment",
					"userId",
					"organizationId",
					"connectionId",
					"calendarId",
					"agentId",
					"localSourceId",
					"localSourceRevision",
				]
					.sort()
					.join() ||
			Object.values(binding).some((value) => !text(value))
		)
			throw refuse();
		const identity = [
			"environment",
			"userId",
			"organizationId",
			"connectionId",
			"calendarId",
			"agentId",
			"localSourceId",
			"localSourceRevision",
		].map((key) => binding[key as keyof CalendarSyncBinding]);
		const scope = Array.from(
			new Uint8Array(
				await crypto.subtle.digest(
					"SHA-256",
					new TextEncoder().encode(JSON.stringify(identity)),
				),
			),
			(byte) => byte.toString(16).padStart(2, "0"),
		).join("");
		const store = new CalendarLinkedStore(
			scope,
			{ ...binding },
			current,
			storage,
		);
		store.check();
		await store.read();
		return store;
	}
	private slot() {
		return "calendar-linked-sync:v1:" + this.scope;
	}
	private check() {
		if (!this.current())
			throw new DOMException("Calendar sync connection changed", "AbortError");
	}
	private validateLink(value: unknown): Link {
		if (!value || typeof value !== "object" || Array.isArray(value))
			throw refuse();
		const link = value as Link;
		if (
			Object.keys(link).sort().join() !== fields ||
			!text(link.id) ||
			!text(link.localEventId) ||
			link.agentId !== this.binding.agentId ||
			link.connectorAccountId !== this.binding.connectionId ||
			link.providerCalendarId !== this.binding.calendarId ||
			!text(link.localRevision) ||
			!nullable(link.providerEventId) ||
			!nullable(link.providerEtag) ||
			!nullable(link.lastErrorCode) ||
			!errorText(link.lastErrorMessage) ||
			!states.includes(link.state) ||
			!["create", "update", "delete", null].includes(link.pendingOperation) ||
			(link.lastCommonSemanticHash !== null &&
				!/^[a-f0-9]{64}$/.test(link.lastCommonSemanticHash)) ||
			link.idempotencyKey !== `alpha-calendar-sync:${this.scope}:${link.id}` ||
			!timestamp(link.createdAt) ||
			!timestamp(link.updatedAt)
		)
			throw refuse();
		return link;
	}
	private async read(): Promise<Document | null> {
		this.check();
		const value = await this.storage.read(this.slot());
		this.check();
		if (value === null) return null;
		if (!value || typeof value !== "object" || Array.isArray(value))
			throw refuse();
		const document = value as Document;
		if (
			Object.keys(document).sort().join() !== "links,owner,version" ||
			document.version !== 1 ||
			document.owner !== this.scope ||
			!Array.isArray(document.links) ||
			document.links.length > 2000 ||
			new TextEncoder().encode(JSON.stringify(document)).length >
				4 * 1024 * 1024
		)
			throw refuse();
		const ids = new Set<string>(),
			events = new Set<string>();
		for (const row of document.links) {
			const link = this.validateLink(row);
			if (ids.has(link.id) || events.has(link.localEventId)) throw refuse();
			ids.add(link.id);
			events.add(link.localEventId);
		}
		return structuredClone(document);
	}
	async list() {
		return (await this.read())?.links || [];
	}
	async link(localEventId: string, localRevision: string): Promise<Link> {
		if (!text(localEventId) || !text(localRevision)) throw refuse();
		const before = await this.read(),
			existing = before?.links.find((row) => row.localEventId === localEventId);
		if (existing) return existing;
		if ((before?.links.length || 0) >= 2000) throw refuse();
		const now = new Date().toISOString(),
			id = crypto.randomUUID();
		const row: Link = {
			id,
			agentId: this.binding.agentId,
			localEventId,
			connectorAccountId: this.binding.connectionId,
			providerCalendarId: this.binding.calendarId,
			providerEventId: null,
			providerEtag: null,
			localRevision,
			lastCommonSemanticHash: null,
			state: "dirty",
			pendingOperation: "create",
			idempotencyKey: `alpha-calendar-sync:${this.scope}:${id}`,
			lastErrorCode: null,
			lastErrorMessage: null,
			createdAt: now,
			updatedAt: now,
		};
		const next: Document = {
			version: 1,
			owner: this.scope,
			links: [...(before?.links || []), row],
		};
		this.check();
		const result = await this.storage.compareExchange(
			this.slot(),
			before,
			next,
		);
		this.check();
		if (result.status !== "saved") {
			const concurrent = (await this.read())?.links.find(
				(link) => link.localEventId === localEventId,
			);
			if (concurrent) return concurrent;
			throw refuse();
		}
		return structuredClone(row);
	}
	async save(
		expected: Link,
		patch: Partial<Omit<Link, "id" | "agentId" | "localEventId" | "createdAt">>,
		now = new Date(),
	): Promise<Link> {
		expected = structuredClone(this.validateLink(expected));
		patch = structuredClone(patch);
		if (
			Object.keys(patch).some(
				(key) =>
					![
						"providerEventId",
						"providerEtag",
						"localRevision",
						"lastCommonSemanticHash",
						"state",
						"pendingOperation",
						"lastErrorCode",
						"lastErrorMessage",
					].includes(key),
			)
		)
			throw refuse();
		const before = await this.read(),
			actual = before?.links.find((row) => row.id === expected.id);
		if (!before || JSON.stringify(actual) !== JSON.stringify(expected))
			throw refuse();
		const next = {
			...expected,
			...patch,
			updatedAt: new Date(
				Math.max(now.getTime(), Date.parse(expected.updatedAt) + 1),
			).toISOString(),
		};
		this.validateLink(next);
		const document: Document = {
			...before,
			links: before.links.map((row) => (row.id === expected.id ? next : row)),
		};
		this.check();
		if (
			(await this.storage.compareExchange(this.slot(), before, document))
				.status !== "saved"
		)
			throw refuse();
		this.check();
		return structuredClone(next);
	}
}
