import test from "node:test";
import assert from "node:assert/strict";
import { exercise } from "./fixtures/isolated-native-campaign.mjs";
for (const kind of ["inbox", "notes", "document"]) {
	test(`${kind} restart owns its user and APKs and executes prepare, restore and cleanup`, () => {
		const r = exercise("pass", kind);
		assert.equal(r.code, 0, r.stderr);
		assert.equal(r.record.passed, true);
		assert.equal(r.record.userLifecycle.removed, true);
		assert.equal(r.state.created, false);
		assert.equal(r.state.user, "0");
		assert.deepEqual(r.state.files, {});
		const calls = r.commands.filter((a) => a.includes("instrument"));
		assert.equal(calls.length, 3);
		assert.ok(calls.every((a) => a[a.indexOf("--user") + 1] === "10"));
		const gate = {
			inbox: "inboxPhase",
			notes: "notesDocumentPhase",
			document: "documentPhase",
		}[kind];
		assert.deepEqual(
			calls.map((a) => a[a.indexOf(gate) + 1]),
			["prepare", kind === "document" ? "verify" : "restore", "cleanup"],
		);
		if (kind !== "document")
			assert.deepEqual(r.record.processes, { prepare: 100, restore: 200 });
	});
	for (const mode of [
		"summary-only",
		"wrong-method",
		"wrong-terminal",
		"skipped",
		"existing",
		"archive-pin",
	])
		test(`${kind} restart refuses ${mode}`, () => {
			const r = exercise(mode, kind);
			assert.notEqual(r.code, 0);
			if (["existing", "archive-pin"].includes(mode))
				assert.ok(
					!r.commands.some(
						(a) => a[0] === "install" || a.includes("create-user"),
					),
				);
			else {
				assert.equal(r.record.passed, false);
				assert.equal(r.record.userLifecycle.cleanupDeferred, true);
				assert.equal(r.state.created, true);
				assert.equal(r.state.user, "0");
			}
		});
}
for (const kind of ["inbox", "notes"])
	for (const mode of ["same-pid", "missing-pid", "duplicate-pid"])
		test(`${kind} requires unambiguous different process identities: ${mode}`, () => {
			const r = exercise(mode, kind);
			assert.notEqual(r.code, 0);
			assert.equal(r.record.passed, false);
			assert.equal(r.state.created, false);
			assert.equal(
				r.commands.filter((a) => a.includes("instrument")).length,
				3,
			);
		});
test("restart retains the fixture user when owned process termination is uncertain", () => {
	const r = exercise("stop-failure", "inbox");
	assert.notEqual(r.code, 0);
	assert.equal(r.record.userLifecycle.cleanupDeferred, true);
	assert.equal(r.state.created, true);
	assert.ok(!r.commands.some((a) => a[0] === "uninstall"));
});

for (const kind of ["inbox", "notes", "document"])
	test(`${kind} failed preparation still runs verified cleanup`, () => {
		const r = exercise("prepare-failure", kind);
		assert.notEqual(r.code, 0);
		assert.equal(r.record.passed, false);
		assert.equal(r.state.created, false);
		assert.equal(r.record.userLifecycle.removed, true);
		assert.equal(r.commands.filter((a) => a.includes("instrument")).length, 2);
	});
