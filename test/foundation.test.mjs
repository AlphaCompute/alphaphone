import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const hash = (p) =>
  createHash("sha256").update(fs.readFileSync(p)).digest("hex");
test("imported design sources retain their exact bytes", () => {
  for (const item of JSON.parse(fs.readFileSync("design/manifest.json")))
    assert.equal(hash(item.path), item.sha256, item.path);
});
test("native source is pinned and unmodified", () => {
  execFileSync("node", ["scripts/verify-upstream.mjs"]);
});
test("standalone shell does not request HOME while launcher does", () => {
  assert.ok(
    !fs
      .readFileSync("android/app/src/main/AndroidManifest.xml", "utf8")
      .includes("category.HOME"),
  );
  assert.ok(
    fs
      .readFileSync("android/app/src/launcher/AndroidManifest.xml", "utf8")
      .includes("category.HOME"),
  );
});
