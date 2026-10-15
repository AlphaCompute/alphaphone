import { test, expect, type Page } from "@playwright/test";
const binding = {
	environment: "production",
	userId: "fixture-owner",
	organizationId: "fixture-org",
	connectionId: "fixture-google",
	calendarId: "primary",
	agentId: "fixture-agent",
	localSourceId: "local",
	localSourceRevision: "fixture-source",
};
async function open(page: Page) {
	await page.goto("/");
	await page.waitForLoadState("domcontentloaded");
}
test("an uncertain Calendar sync checkpoint survives a full browser reload", async ({
	page,
}) => {
	await open(page);
	const saved = await page.evaluate(async (binding) => {
		const { CalendarLinkedStore } = await import(
			"/src/runtime/calendar-linked-store.ts"
		);
		const { calendarLinkStorage } = await import(
			"/src/runtime/calendar-linked-storage.ts"
		);
		const store = await CalendarLinkedStore.open(
				binding,
				() => true,
				calendarLinkStorage,
			),
			link = await store.link("fixture-local-event", "opaque-r1");
		return store.save(link, {
			state: "quarantined",
			pendingOperation: "create",
			lastErrorCode: "OUTCOME_UNKNOWN",
			lastErrorMessage: "Response lost",
		});
	}, binding);
	await page.reload();
	const reopened = await page.evaluate(async (binding) => {
		const { CalendarLinkedStore } = await import(
			"/src/runtime/calendar-linked-store.ts"
		);
		const { calendarLinkStorage } = await import(
			"/src/runtime/calendar-linked-storage.ts"
		);
		const store = await CalendarLinkedStore.open(
			binding,
			() => true,
			calendarLinkStorage,
		);
		return {
			rows: await store.list(),
			same: await store.link("fixture-local-event", "opaque-r2"),
		};
	}, binding);
	expect(reopened.rows).toEqual([saved]);
	expect(reopened.same).toEqual(saved);
});
test("two browser views cannot both commit the same Calendar checkpoint revision", async ({
	page,
	context,
}) => {
	await open(page);
	const saved = await page.evaluate(async (binding) => {
		const { CalendarLinkedStore } = await import(
			"/src/runtime/calendar-linked-store.ts"
		);
		const { calendarLinkStorage } = await import(
			"/src/runtime/calendar-linked-storage.ts"
		);
		return (
			await CalendarLinkedStore.open(binding, () => true, calendarLinkStorage)
		).link("fixture-event", "r1");
	}, binding);
	const other = await context.newPage();
	await open(other);
	const commit = (target: Page, state: "paused" | "local_only") =>
		target.evaluate(
			async ({ binding, saved, state }) => {
				const { CalendarLinkedStore } = await import(
					"/src/runtime/calendar-linked-store.ts"
				);
				const { calendarLinkStorage } = await import(
					"/src/runtime/calendar-linked-storage.ts"
				);
				try {
					await (
						await CalendarLinkedStore.open(
							binding,
							() => true,
							calendarLinkStorage,
						)
					).save(saved, { state });
					return "saved";
				} catch (error) {
					if (
						!(error instanceof Error) ||
						!error.message.includes(
							"Calendar sync checkpoints changed or need recovery",
						)
					)
						throw error;
					return "conflict";
				}
			},
			{ binding, saved, state },
		);
	expect(
		(
			await Promise.all([commit(page, "paused"), commit(other, "local_only")])
		).sort(),
	).toEqual(["conflict", "saved"]);
	await other.close();
});

test("the local sync port updates the actual calendar with revision CAS and preserves local alerts", async ({
	page,
}) => {
	await open(page);
	const result = await page.evaluate(async () => {
		const { calendarDocument, initialCalendarState, prepareCalendarSource } =
			await import("/src/browser/calendar-store.ts");
		const { browserCalendarSyncPort } = await import(
			"/src/browser/calendar-linked-local.ts"
		);
		const source = await prepareCalendarSource();
		await calendarDocument.edit(initialCalendarState, (data) => {
			data.events.push({
				id: "sync-event",
				calendarId: "local",
				title: "Local title",
				body: "Details",
				location: "Here",
				begin: Date.parse("2026-10-16T18:00:00Z"),
				end: Date.parse("2026-10-16T19:00:00Z"),
				timeZone: "UTC",
				revision: "local-r1",
				alert: 10,
			});
		});
		const port = browserCalendarSyncPort(source.sourceRevision, () => true),
			before = await port.get("sync-event");
		const changed = await port.applyProviderEvent(
			"sync-event",
			{
				...before!.event,
				title: "Edited in Google",
				isAllDay: true,
				startAt: "2026-10-17",
				endAt: "2026-10-18",
				timeZone: null,
			},
			before!.revision,
		);
		let stale = false;
		try {
			await port.applyProviderEvent(
				"sync-event",
				before!.event,
				before!.revision,
			);
		} catch (error) {
			stale =
				error instanceof Error && error.message.includes("changed before sync");
		}
		const stored = (await calendarDocument.read(initialCalendarState))
			.events[0];
		await calendarDocument.edit(initialCalendarState, (data) => {
			data.sourceRevision = "replaced-source";
		});
		let replaced = false;
		try {
			await port.get("sync-event");
		} catch (error) {
			replaced = error instanceof DOMException && error.name === "AbortError";
		}
		return { changed, stored, stale, replaced };
	});
	expect(result.changed.revision).not.toBe("local-r1");
	expect(result.stored.title).toBe("Edited in Google");
	expect(result.stored.alert).toBe(10);
	expect(result.stored.id).toBe("sync-event");
	expect(result.stored.allDay).toBe(true);
	expect(result.changed.event.startAt).toBe("2026-10-17");
	expect(result.stale).toBe(true);
	expect(result.replaced).toBe(true);
});

test("a provider deletion keeps the normal Undo window instead of erasing a local event immediately", async ({
	page,
}) => {
	await open(page);
	const result = await page.evaluate(async () => {
		const { calendarDocument, initialCalendarState, prepareCalendarSource } =
			await import("/src/browser/calendar-store.ts");
		const { browserCalendarSyncPort } = await import(
			"/src/browser/calendar-linked-local.ts"
		);
		const { bindBrowserDeletionOwner, browserDeletionOwnerVisible } =
			await import("/src/runtime/deletion-owner.ts");
		const { undoCalendarDeletion } = await import(
			"/src/browser/calendar-deletions.ts"
		);
		bindBrowserDeletionOwner(
			() =>
				"agent:" +
				JSON.stringify([
					"origin",
					"owner",
					"agent",
					"session",
					"build",
					"context",
				]),
		);
		const source = await prepareCalendarSource();
		await calendarDocument.edit(initialCalendarState, (data) => {
			data.events.push({
				id: "sync-delete",
				calendarId: "local",
				title: "Keep until Undo ends",
				body: "",
				location: "",
				begin: Date.parse("2026-10-16T18:00:00Z"),
				end: Date.parse("2026-10-16T19:00:00Z"),
				timeZone: "UTC",
				revision: "r1",
			});
		});
		const port = browserCalendarSyncPort(source.sourceRevision, () => true);
		await port.delete("sync-delete", "r1");
		const pending = await calendarDocument.read(initialCalendarState),
			entry = Object.values(pending.deletions!)[0];
		await calendarDocument.edit(initialCalendarState, (data) =>
			undoCalendarDeletion(data, entry.id, browserDeletionOwnerVisible),
		);
		return {
			retained: pending.events.length,
			phase: entry.phase,
			afterUndo: await port.get("sync-delete"),
		};
	});
	expect(result.retained).toBe(1);
	expect(result.phase).toBe("queued");
	expect(result.afterUndo?.event.title).toBe("Keep until Undo ends");
});

test("unsupported series or contact-id translation is refused without flattening saved data", async ({
	page,
}) => {
	await open(page);
	expect(
		await page.evaluate(async () => {
			const { calendarDocument, initialCalendarState, prepareCalendarSource } =
				await import("/src/browser/calendar-store.ts");
			const { browserCalendarSyncPort } = await import(
				"/src/browser/calendar-linked-local.ts"
			);
			const source = await prepareCalendarSource();
			await calendarDocument.edit(initialCalendarState, (data) => {
				data.events.push({
					id: "series",
					calendarId: "local",
					title: "Daily",
					body: "",
					location: "",
					begin: 1,
					end: 1000,
					revision: "r1",
					repeat: "daily",
				});
			});
			const before = await calendarDocument.readRaw();
			let refused = false;
			try {
				await browserCalendarSyncPort(source.sourceRevision, () => true).get(
					"series",
				);
			} catch (error) {
				refused =
					error instanceof Error &&
					error.message.includes("recurrence or attendee");
			}
			return refused && before === (await calendarDocument.readRaw());
		}),
	).toBe(true);
});
