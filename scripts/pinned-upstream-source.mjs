import fs from "node:fs";
import path from "node:path";
import { verifyCommittedWorkspace } from "../vendor/eliza/packages/app/scripts/lib/immutable-workspace-source.mjs";

/** Authenticate vendor bytes before resolving or compiling consumer source. */
export function verifyPinnedUpstream(root) {
	const { commit } = JSON.parse(
		fs.readFileSync(path.join(root, "upstream.lock.json"), "utf8"),
	);
	const directory = path.join(root, "vendor/eliza");
	verifyCommittedWorkspace(directory, commit, {
		// These six Gradle projects are declared in android/settings.gradle. Tracked
		// files are always authenticated, including files inside output directories.
		generatedDirectories: [
			"system",
			"camera",
			"location",
			"network-policy",
			"calendar",
			"reminders",
		].map((name) => `plugins/plugin-native-${name}/android/build`),
	});
	return { directory, commit };
}
