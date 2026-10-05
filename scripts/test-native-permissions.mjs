/** Product permission scenarios; shared lifecycles own the device and temporary user. */
import assert from "node:assert/strict";
import { runNativeFixture } from "./native-test-fixture.mjs";

const cases = {
	camera: {
		testClass: "CameraFlowInstrumentedTest",
		method: "denyingCameraAllowsExplicitRetryWithoutFakePreview",
		gate: "cameraPermissionTest",
		value: "true",
		permissions: [["revoke", "CAMERA"]],
	},
	settings: {
		testClass: "SettingsNativeInstrumentedTest",
		method: "accountsHandoffAndLocationAccuracyReadback",
		gate: "settingsNative",
		value: "1",
		permissions: [
			["revoke", "ACCESS_FINE_LOCATION"],
			["grant", "ACCESS_COARSE_LOCATION"],
		],
	},
	channels: {
		testClass: "NotificationChannelsInstrumentedTest",
		method: "blockedChannelReadbackUserRecoveryAndRealNotification",
		gate: "notificationChannels",
		value: "1",
		permissions: [["grant", "POST_NOTIFICATIONS"]],
	},
};
const [scenario, appApk, testApk, output = "test-results/native-permission"] =
	process.argv.slice(2);
assert.ok(
	Object.hasOwn(cases, scenario),
	"Choose camera, settings, or channels",
);
const selected = cases[scenario];

await runNativeFixture({
	scenario,
	appApk,
	testApk,
	output,
	testClass: selected.testClass,
	testMethod: selected.method,
	runnerArgs: ["-e", selected.gate, selected.value],
	evidence:
		"Permission UI scenario in an owned secondary emulator user. No physical-device acceptance.",
	prepareVariant: async ({ run, androidUser, packageName }) => {
		for (const [operation, name] of selected.permissions) {
			const permission = "android.permission." + name;
			await run(
				"shell",
				"pm",
				operation,
				"--user",
				String(androidUser),
				packageName,
				permission,
			);
			await run(
				"shell",
				"pm",
				"clear-permission-flags",
				"--user",
				String(androidUser),
				packageName,
				permission,
				"user-set",
				"user-fixed",
			);
		}
	},
});
