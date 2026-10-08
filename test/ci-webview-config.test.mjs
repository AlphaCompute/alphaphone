import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { main } from "../scripts/prepare-ci-webview.mjs";

const hosted = {
	GITHUB_ACTIONS: "true",
	RUNNER_ENVIRONMENT: "github-hosted",
	ANDROID_SERIAL: "emulator-5554",
};
test("product CLI requires its explicit disposable-fixture switch before SDK lookup", async () => {
	await assert.rejects(main({ environment: {} }), /Disposable GitHub-hosted/);
	await assert.rejects(
		main({ environment: hosted }),
		/Explicit disposable provider fixture/,
	);
});

test("product package exclusions reject preinstalled Alpha-family system apps before provisioning", async (t) => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "alpha-provider-config-"));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));
	const responses = {
		"emu avd name": "test\nOK",
		"shell getprop ro.kernel.qemu": "1",
		"shell getprop ro.build.type": "userdebug",
		"shell am get-current-user": "0",
		"shell pm list users": "UserInfo{0:Owner:4c13}",
		"shell getprop ro.build.version.sdk": "35",
		"shell getprop ro.product.cpu.abi": "x86_64",
		"shell getprop ro.build.flavor": "sdk_phone64_x86_64-userdebug",
		"shell pm list packages -3": "",
	};
	for (const packageName of [
		"ai.elizaresearch.alphaphone",
		"ai.elizaresearch.otherproduct",
	]) {
		const calls = [];
		const execute = (file, args) => {
			assert.equal(path.basename(file), "adb");
			assert.deepEqual(args.slice(0, 2), ["-s", "emulator-5554"]);
			const key = args.slice(2).join(" ");
			calls.push(key);
			if (key === "shell pm list packages") return `package:${packageName}`;
			assert.ok(Object.hasOwn(responses, key), `Unexpected command ${key}`);
			return responses[key];
		};
		await assert.rejects(
			main({
				environment: {
					...hosted,
					ALPHA_DISPOSABLE_WEBVIEW_FIXTURE: "api35-default-x86_64",
				},
				sdkEnvironment: { ANDROID_HOME: "/fixture-sdk" },
				outputDirectory: path.join(root, packageName),
				execute,
			}),
			/Not a fresh default AOSP provider fixture/,
		);
		assert.ok(calls.length > 0);
		assert.ok(
			calls.every(
				(command) =>
					command.startsWith("emu avd name") ||
					/^shell (getprop|am get-current-user|pm list)/.test(command),
			),
		);
	}
});
