import fs from "node:fs";
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
console.log(`Eliza source verified: ${actual}`);
