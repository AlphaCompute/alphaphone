import fs from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const pin = JSON.parse(fs.readFileSync("upstream.lock.json"));
const actual = execFileSync(
  "git",
  ["-C", "vendor/eliza", "rev-parse", "HEAD"],
  { encoding: "utf8" },
).trim();
if (pin.commit !== actual)
  throw new Error(`Eliza pin mismatch: expected ${pin.commit}, got ${actual}`);
const dirty = execFileSync(
  "git",
  ["-C", "vendor/eliza", "status", "--porcelain", "--untracked-files=normal"],
  { encoding: "utf8" },
).trim();
if (dirty)
  throw new Error(
    "Eliza checkout has uncommitted source changes; commit and pin a reviewed upstream change.",
  );
const stampFile = "android/app/src/main/assets/agent/alpha-source.json";
if (fs.existsSync(stampFile)) {
  const stamp = JSON.parse(fs.readFileSync(stampFile, "utf8"));
  const hash = file => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  if (stamp.base !== pin.commit || !Array.isArray(stamp.patches) || stamp.patches.length ||
      stamp.lockSha256 !== hash("upstream.lock.json") ||
      stamp.preparerSha256 !== hash("scripts/prepare-local-agent.mjs") ||
      stamp.guardSha256 !== hash("scripts/local-agent-source.mjs"))
    throw new Error("Staged runtime does not match the pinned source; prepare and stage it before packaging.");
}
console.log(`Eliza source verified: ${actual}`);
