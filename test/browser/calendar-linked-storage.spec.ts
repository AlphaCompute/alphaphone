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
