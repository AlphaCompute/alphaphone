import fs from "node:fs";
import { createHash } from "node:crypto";
import { verifyPinnedUpstream } from "./pinned-upstream-source.mjs";
const { commit } = verifyPinnedUpstream(process.cwd());
const stampFile = "android/app/src/main/assets/agent/alpha-source.json";
if (fs.existsSync(stampFile)) {
	const stamp = JSON.parse(fs.readFileSync(stampFile, "utf8"));
	const hash = (file) =>
		createHash("sha256").update(fs.readFileSync(file)).digest("hex");
	if (
		stamp.base !== commit ||
		!Array.isArray(stamp.patches) ||
		stamp.patches.length ||
		stamp.lockSha256 !== hash("upstream.lock.json") ||
		stamp.preparerSha256 !== hash("scripts/prepare-local-agent.mjs") ||
		stamp.guardSha256 !== hash("scripts/local-agent-source.mjs")
	)
		throw new Error(
			"Staged runtime does not match the pinned source; prepare and stage it before packaging.",
		);
}
console.log(`Eliza source verified: ${commit}`);
