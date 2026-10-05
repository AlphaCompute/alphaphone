/** Product restart scenarios; upstream owns APK, instrumentation and user lifecycles. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { androidEnv } from "./toolchain.mjs";
import { verifyPinnedUpstream } from "./pinned-upstream-source.mjs";

const repository = path.resolve(import.meta.dirname, "..");
verifyPinnedUpstream(repository);
const { runIsolatedAndroidTest } = await import(
	"../vendor/eliza/packages/app/scripts/lib/isolated-android-test.mjs"
);
const { withIsolatedAndroidUser } = await import(
	"../vendor/eliza/packages/app/scripts/lib/isolated-android-user.mjs"
);
const { acquireDeviceLease } = await import(
	"../vendor/eliza/packages/app/scripts/lib/device-lease.ts"
);
const cases = {
	inbox: {
		testClass: "InboxDraftInstrumentedTest",
		method: "processPhase",
		gate: "inboxPhase",
		runId: "inboxRunId",
		pid: "inboxFixturePid",
		restore: "restore",
		scope:
			"Synthetic Cloud protocol and real encrypted drafts; no mail or provider network",
	},
	notes: {
		testClass: "NotesDocumentInstrumentedTest",
		method: "documentProcessRestartPhase",
		gate: "notesDocumentPhase",
		runId: "notesDocumentRunId",
		pid: "notesDocumentPid",
		restore: "restore",
		scope: "Real SAF grants, exact document bytes and persisted local notes",
	},
	document: {
		testClass: "SelectedDocumentInstrumentedTest",
		method: "documentProcessRestartPhase",
		gate: "documentPhase",
		restore: "verify",
		scope:
			"Real SAF grant restoration and revocation; distinct PID asserted by native test",
	},
};
const [scenario, appApk, testApk, output = "test-results/native-restart"] =
	process.argv.slice(2);
assert.ok(Object.hasOwn(cases, scenario), "Choose inbox, notes, or document");
const selected = cases[scenario],
	runId = crypto.randomUUID();
const phaseArgs = (name) => [
	"-e",
	selected.gate,
	name,
	...(selected.runId ? ["-e", selected.runId, runId] : []),
];
const serial = process.env.ANDROID_SERIAL,
	avd = process.env.ALPHA_NATIVE_TEST_AVD,
	abi = process.env.ALPHA_NATIVE_TEST_ABI;
assert.match(serial ?? "", /^emulator-\d+$/);
assert.match(
	avd ?? "",
	/^[A-Za-z0-9_.-]+$/,
	"Explicit owned AVD name required",
);
assert.ok(
	["x86_64", "arm64-v8a"].includes(abi),
	"Explicit emulator ABI required",
);
assert.ok(appApk && testApk, "Matching archived app/test APK pair required");
const env = androidEnv(),
	adb = path.join(env.ANDROID_HOME, "platform-tools/adb"),
	aapt = path.join(env.ANDROID_HOME, "build-tools/36.0.0/aapt");
const app = JSON.parse(fs.readFileSync("app.config.json")).appId;
assert.equal(app, "ai.elizaresearch.alphaphone");
const apk = path.resolve(appApk),
	test = path.resolve(testApk),
	directory = path.resolve(output);
const hash = (file) =>
	crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const manifest = JSON.parse(
	fs.readFileSync(path.join(path.dirname(apk), "apk-manifest.json")),
);
const variant = path
	.basename(apk)
	.match(/^(standalone|launcher)-debug\.apk$/)?.[1];
assert.ok(
	variant &&
		path.basename(test) === variant + "-androidTest.apk" &&
		path.dirname(apk) === path.dirname(test) &&
		manifest[path.basename(apk)] === hash(apk) &&
		manifest[path.basename(test)] === hash(test),
	"Exact matching archived distribution required",
);
assert.ok(!fs.existsSync(directory), "Use a new evidence directory");
fs.mkdirSync(directory, { recursive: true });
const record = {
	serial,
	avd,
	abi,
	variant,
	scenario,
	runId,
	scope: selected.scope,
	appSha256: hash(apk),
	testSha256: hash(test),
	passed: false,
};
const persist = () =>
	fs.writeFileSync(
		path.join(directory, "result.json"),
		JSON.stringify(record, null, 2) + "\n",
	);
const call = (...args) =>
	execFileSync(adb, ["-s", serial, ...args], {
		env,
		encoding: "utf8",
		timeout: 120000,
		killSignal: "SIGKILL",
		maxBuffer: 4 * 1024 * 1024,
	}).trim();
const cancellation = new AbortController(),
	cancel = () => cancellation.abort();
const lease = await acquireDeviceLease(`android:${serial}`, {
	waitMs: 0,
	ttlMs: Number.MAX_SAFE_INTEGER,
});
let failure;
process.once("SIGINT", cancel);
process.once("SIGTERM", cancel);
try {
	const installed = call(
		"shell",
		"pm",
		"list",
		"packages",
		"-u",
		"--user",
		"all",
	).split(/\r?\n/);
	assert.ok(
		![app, app + ".test"].some((name) => installed.includes("package:" + name)),
		"Existing package registration; refusing replacement",
	);
	await withIsolatedAndroidUser({
		serial,
		deviceLease: lease,
		expectedAvdName: avd,
		homePackage: process.env.ALPHA_TEST_HOME_PACKAGE ?? "com.android.launcher3",
		name: `${scenario}-${variant}-${Date.now()}`,
		signal: cancellation.signal,
		execute: (args) => call(...args),
		record: (state) => {
			record.userLifecycle = state;
			persist();
		},
		run: async ({ user }) => {
			record.user = user;
			try {
				record.result = await runIsolatedAndroidTest({
					serial,
					adb,
					aapt,
					env,
					packageName: app,
					additionalInstrumentationRunners: [
						app + ".WorkflowNoticeProcessRunner",
					],
					testClass: app + "." + selected.testClass,
					testMethod: selected.method,
					expectedTests: 1,
					requiredAbi: abi,
					expectedAvdName: avd,
					androidUser: user,
					deviceLease: lease,
					directory,
					signal: cancellation.signal,
					commandTimeoutMs: 120000,
					instrumentationTimeoutMs: 240000,
					cleanupTimeoutMs: 120000,
					variants: [{ name: variant, apk, testApk: test }],
					runnerArgs: phaseArgs("prepare"),
					evidence:
						selected.scope +
						"; owned secondary emulator user, not physical-device acceptance.",
					collectVariant: async (context) => {
						const stop = () =>
							context.run(
								"shell",
								"am",
								"force-stop",
								"--user",
								String(user),
								app,
							);
						await stop();
						await context.instrumentPhase(
							selected.restore,
							phaseArgs(selected.restore),
						);
						if (selected.pid) {
							const pid = (label) => {
								const log = fs.readFileSync(
									path.join(directory, label),
									"utf8",
								);
								const matches = [
									...log.matchAll(
										new RegExp(
											"^INSTRUMENTATION_RESULT: " +
												selected.pid +
												"=(\\d+)\\r?$",
											"gm",
										),
									),
								];
								assert.equal(
									matches.length,
									1,
									"Exactly one process identity required per phase",
								);
								const value = Number(matches[0][1]);
								assert.ok(
									Number.isSafeInteger(value) && value > 0,
									"Valid process identity required",
								);
								return value;
							};
							record.processes = {
								prepare: pid(variant + ".log"),
								restore: pid(variant + "-phase-" + selected.restore + ".log"),
							};
							assert.notEqual(
								record.processes.prepare,
								record.processes.restore,
								"Process restart not proven",
							);
						}
					},
					cleanupVariant: async (context) => {
						if (!context.instrumentPhase) return; // Partial installation: upstream owns package cleanup.
						await context.run(
							"shell",
							"am",
							"force-stop",
							"--user",
							String(user),
							app,
						);
						await context.instrumentPhase("cleanup", phaseArgs("cleanup"));
					},
				});
			} catch (error) {
				failure = error;
				record.error = error.message;
			}
			let proof;
			try {
				proof = JSON.parse(
					fs.readFileSync(path.join(directory, "verification.json"), "utf8"),
				);
			} catch {
				/* Unproven cleanup retains the fixture user. */
			}
			return {
				cleaned: proof?.cleaned === true,
				cleanupDeferred: proof?.cleanupDeferred === true,
			};
		},
	});
} catch (error) {
	failure ??= error;
	record.error = failure.message;
} finally {
	record.passed = !failure;
	persist();
	process.removeListener("SIGINT", cancel);
	process.removeListener("SIGTERM", cancel);
	lease.release();
}
if (failure) throw failure;
console.log(directory);
