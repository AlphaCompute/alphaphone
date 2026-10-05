import test from "node:test";
import assert from "node:assert/strict";
import { exercise } from "./fixtures/isolated-native-campaign.mjs";
for (const scenario of ["one-off", "recurrence"]) {
	test(`${scenario} reminder uses exact archived APKs and a fresh isolated user`, () => {
		const r = exercise("pass", scenario);
		assert.equal(r.code, 0, r.stderr);
		assert.equal(r.record.passed, true);
		assert.equal(r.record.userLifecycle.removed, true);
		assert.equal(r.state.user, "0");
		assert.deepEqual(r.state.files, {});
		const permission = r.commands.find((a) => a.includes("grant"));
		assert.equal(permission[permission.indexOf("--user") + 1], "10");
		assert.equal(permission.at(-1), "android.permission.POST_NOTIFICATIONS");
		const invocation = r.commands.find((a) => a.includes("instrument"));
		assert.equal(invocation[invocation.indexOf("--user") + 1], "10");
		assert.equal(
			r.record.result.variants[0].instrumentation.totalTests,
			scenario === "recurrence" ? 2 : 1,
		);
	});
	for (const mode of [
		"summary-only",
		"wrong-class",
		"skipped",
		"archive-pin",
		"existing",
		"stop-failure",
	])
		test(`${scenario} refuses ${mode}`, () => {
			const r = exercise(mode, scenario);
			assert.notEqual(r.code, 0);
			if (["archive-pin", "existing"].includes(mode))
				assert.ok(
					!r.commands.some(
						(a) => a[0] === "install" || a.includes("create-user"),
					),
				);
			if (mode === "stop-failure") {
				assert.equal(r.record.userLifecycle.cleanupDeferred, true);
				assert.equal(r.state.created, true);
				assert.equal(r.state.user, "0");
			}
		});
}

test("reminder runner refuses an APK changed after archive admission", () => {
	const r = exercise("archive-race", "one-off");
	assert.notEqual(r.code, 0);
	assert.match(r.stderr, /App changed after archive admission/);
	assert.ok(!r.commands.some((a) => a[0] === "install"));
	assert.equal(r.state.user, "0");
});
