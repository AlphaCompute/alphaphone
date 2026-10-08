// Pilot provisioning/update policy on synthetic inputs; not emulator or device evidence.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { admitUnitApk, packageFacts, parseUnitArgs } from "../scripts/provision-unit.mjs";
import { compareDomains, parseDomainInventory, updateAdmission } from "../scripts/pilot-update.mjs";

const sha = text => createHash("sha256").update(text).digest("hex");
const SIGNER = "a".repeat(64);

function build(t, row, extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "alpha-pilot-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const name = row.mode === "release" ? "launcher-release.apk" : "launcher-debug.apk";
  fs.writeFileSync(path.join(dir, name), "apk bytes");
  fs.writeFileSync(path.join(dir, "apk-manifest.json"), JSON.stringify({ testMocks: false, ...extra,
    results: [{ variant: "launcher", file: `artifacts/${name}`, sha256: sha("apk bytes"), versionCode: 5, versionName: "0.5.0", testMocks: false, bundleAudit: "passed", ...row }] }));
  return path.join(dir, "apk-manifest.json");
}
const descriptor = (signerSha256 = SIGNER, versionCode = 4) => ({ schema: 1, signerSha256, lastRelease: { versionCode, versionName: null, recordedAt: null } });

test("unit arguments require an alias that is neither a name nor a serial pattern", () => {
  const options = parseUnitArgs(["--serial", "emulator-5554", "--alias", "unit-01", "--apk-manifest", "m.json"]);
  assert.deepEqual([options.variant, options.build], ["launcher", "release"]);
  for (const alias of ["Unit 1", "", "a".repeat(41)]) assert.throws(() => parseUnitArgs(["--serial", "emulator-5554", "--alias", alias, "--apk-manifest", "m"]));
  assert.throws(() => parseUnitArgs(["--serial", "x;id", "--alias", "u", "--apk-manifest", "m"]));
  assert.throws(() => parseUnitArgs(["--serial", "s", "--alias", "u", "--apk-manifest", "m", "--build", "test-mocks"]));
});

test("a pilot release must be signed by the recorded signer, advance versionCode and pass the audit", t => {
  const ok = admitUnitApk(build(t, { mode: "release", signed: true, signerSha256: SIGNER, distributable: true }), { variant: "launcher", build: "release" }, { descriptor: descriptor() });
  assert.equal(ok.signed, true);
  assert.equal(ok.rehearsal, false);
  assert.throws(() => admitUnitApk(build(t, { mode: "release", signed: false }), { variant: "launcher", build: "release" }, { descriptor: descriptor() }), /unsigned/);
  assert.throws(() => admitUnitApk(build(t, { mode: "release", signed: true, signerSha256: "b".repeat(64) }), { variant: "launcher", build: "release" }, { descriptor: descriptor() }), /does not match/);
  assert.throws(() => admitUnitApk(build(t, { mode: "release", signed: true, signerSha256: SIGNER }), { variant: "launcher", build: "release" }, { descriptor: descriptor("unset") }), /unset/);
  assert.throws(() => admitUnitApk(build(t, { mode: "release", signed: true, signerSha256: SIGNER }), { variant: "launcher", build: "release" }, { descriptor: descriptor(SIGNER, 5) }), /not greater/);
  assert.throws(() => admitUnitApk(build(t, { mode: "release", signed: true, signerSha256: SIGNER }, { testMocks: true }), { variant: "launcher", build: "release" }, { descriptor: descriptor() }), /test-mocks/);
  const rehearsal = admitUnitApk(build(t, { mode: "debug", signed: true }), { variant: "launcher", build: "debug" }, { descriptor: descriptor("unset") });
  assert.equal(rehearsal.rehearsal, true);
  const changed = build(t, { mode: "debug", signed: true });
  fs.writeFileSync(path.join(path.dirname(changed), "launcher-debug.apk"), "other");
  assert.throws(() => admitUnitApk(changed, { variant: "launcher", build: "debug" }, { descriptor: descriptor() }), /does not match/);
});

test("package facts, update admission and data-domain readback", () => {
  const facts = packageFacts("Packages:\n  Package [ai.elizaresearch.alphaphone] (1a2b):\n    userId=10123\n    versionCode=7 minSdk=26 targetSdk=36\n    versionName=0.7.0\n    firstInstallTime=2026-10-08 10:00:00\n    lastUpdateTime=2026-10-08 11:00:00\n");
  assert.deepEqual(facts, { versionCode: 7, versionName: "0.7.0", firstInstallTime: "2026-10-08 10:00:00", lastUpdateTime: "2026-10-08 11:00:00", userId: "10123" });
  assert.deepEqual(updateAdmission({ installedVersionCode: 7, installedSigner: SIGNER, newVersionCode: 8, newSigner: SIGNER }), []);
  assert.match(updateAdmission({ installedVersionCode: 7, installedSigner: SIGNER, newVersionCode: 7, newSigner: SIGNER }).join(), /greater/);
  assert.match(updateAdmission({ installedVersionCode: 7, installedSigner: SIGNER, newVersionCode: 8, newSigner: "c".repeat(64) }).join(), /differs/);
  const before = parseDomainInventory(`${"1".repeat(64)}  ./files/notes.json\n${"2".repeat(64)}  ./no_backup/credential slot.bin\n${"3".repeat(64)}  ./shared_prefs/a.xml\nnoise\n`);
  assert.deepEqual(Object.keys(before).sort(), ["files", "no_backup", "shared_prefs"]);
  assert.ok("no_backup/credential slot.bin" in before.no_backup, "paths with spaces are kept");
  assert.deepEqual(compareDomains(before, before), []);
  const after = structuredClone(before);
  delete after.files["files/notes.json"];
  after.shared_prefs["shared_prefs/a.xml"] = "4".repeat(64);
  after.databases = { "databases/new.db": "5".repeat(64) };
  assert.deepEqual(compareDomains(before, after), ["databases/new.db appeared", "files/notes.json was lost", "shared_prefs/a.xml changed"]);
});
