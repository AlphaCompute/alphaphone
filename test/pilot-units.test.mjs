// Pilot provisioning/update policy on synthetic inputs; not emulator or device evidence.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { admitUnitApk, packageFacts, parseUnitArgs } from "../scripts/provision-unit.mjs";
import { releaseBlockers } from "../scripts/release-blockers.mjs";
import { releaseDistribution, verdict } from "../scripts/qualify-head.mjs";
import { compareDomains, DOMAIN_SCRIPT, parseDomainInventory, readbackInventory, unitApkMismatch, updateAdmission } from "../scripts/pilot-update.mjs";

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
// Everything verify-apks records for a distributable release.
const DISTRIBUTABLE = { mode: "release", signed: true, signerSha256: SIGNER, distributable: true, runtime: "PACKAGED", runtimeNotices: true,
  speechQualification: { byteMatch: true, functionalPassed: true, qualified: true }, licenceBlockers: [] };
const descriptor = (signerSha256 = SIGNER, versionCode = 4) => ({ schema: 1, signerSha256, lastRelease: { versionCode, versionName: null, recordedAt: null } });

test("unit arguments require an alias that is neither a name nor a serial pattern", () => {
  const options = parseUnitArgs(["--serial", "emulator-5554", "--alias", "unit-01", "--apk-manifest", "m.json"]);
  assert.deepEqual([options.variant, options.build], ["launcher", "release"]);
  for (const alias of ["Unit 1", "", "a".repeat(41)]) assert.throws(() => parseUnitArgs(["--serial", "emulator-5554", "--alias", alias, "--apk-manifest", "m"]));
  assert.throws(() => parseUnitArgs(["--serial", "x;id", "--alias", "u", "--apk-manifest", "m"]));
  assert.throws(() => parseUnitArgs(["--serial", "s", "--alias", "u", "--apk-manifest", "m", "--build", "test-mocks"]));
});

test("a pilot release must be signed by the recorded signer, advance versionCode and pass the audit", t => {
  const ok = admitUnitApk(build(t, DISTRIBUTABLE), { variant: "launcher", build: "release" }, { descriptor: descriptor() });
  assert.equal(ok.distributable, true);
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

test("a pilot or acceptance unit never gets a non-distributable release, and every blocker is named", t => {
  const admit = (row, extra) => admitUnitApk(build(t, { ...DISTRIBUTABLE, ...row }, extra), { variant: "launcher", build: "release" }, { descriptor: descriptor() });
  const refusal = (row, extra) => { try { admit(row, extra); } catch (error) { return error.message; } return assert.fail(`admitted ${JSON.stringify(row)}`); };
  const font = "unresolved-font-licence: Denton typeface (assets/denton.woff2) has no recorded embedding licence; license it or replace it before distribution (owner decision A-21, docs/dependency-audit.md#denton-typeface-mvp-43)";
  // The round-3 gap: signed by the right key, versionCode advances, audit passed, yet a licence blocker is open.
  assert.match(refusal({ distributable: false, licenceBlockers: [font] }), /not distributable[\s\S]*unresolved-font-licence: Denton typeface/);
  // A row whose flag says distributable while its own facts disagree is still refused.
  assert.match(refusal({ licenceBlockers: [font] }), /unresolved-font-licence/);
  assert.match(refusal({ licenceBlockers: undefined }), /font licence check was not recorded/);
  assert.match(refusal({ distributable: false, runtime: "NOT_PACKAGED", runtimeNotices: false }), /unpackaged runtime \(resident runtime NOT_PACKAGED\)/);
  assert.match(refusal({ runtime: undefined }), /unpackaged runtime \(resident runtime not recorded\)/);
  assert.match(refusal({ runtimeNotices: false }), /notices lack the packaged runtime/);
  assert.match(refusal({ speechQualification: { byteMatch: false, functionalPassed: false, qualified: false } }), /unqualified speech \(native bytes not admitted, functional acceptance pending or failed\)/);
  assert.match(refusal({ speechQualification: { byteMatch: true, functionalPassed: true, qualified: false } }), /unqualified speech \(not qualified\)/);
  assert.match(refusal({ speechQualification: undefined }), /unqualified speech \(no qualification recorded\)/);
  assert.match(refusal({ testMocks: true }), /test-mocks build/);
  assert.match(refusal({ bundleAudit: "failed" }), /flag-off bundle audit/);
  assert.match(refusal({ distributable: false }), /verify-apks did not record this release as distributable/);
  assert.match(refusal({ releaseAdmission: { failures: [], blockers: ["release signer is unset in android/release-signer.json"], signerMatches: false } }), /release signer is unset/);
  // All open blockers are listed together, once each.
  const all = refusal({ distributable: false, signed: false, signerSha256: null, runtime: "NOT_PACKAGED", licenceBlockers: [font, font],
    speechQualification: { byteMatch: true, functionalPassed: false, qualified: false } });
  const listed = all.split("\n").filter(line => line.startsWith("  - "));
  assert.deepEqual(listed.map(line => line.slice(4).split(/[:(]/)[0].trim()), ["unsigned release", "unpackaged runtime", "unqualified speech", "unresolved-font-licence"]);
  assert.match(all, /--build debug rehearses the same steps on a disposable emulator/);
  // The documented rehearsal path is unchanged: a debug row is admitted, labelled, and never distributable.
  const rehearsal = admitUnitApk(build(t, { mode: "debug", signed: true }), { variant: "launcher", build: "debug" }, { descriptor: descriptor() });
  assert.deepEqual([rehearsal.rehearsal, rehearsal.distributable], [true, false]);
  // A debug row can never be passed off as the release.
  assert.throws(() => admitUnitApk(build(t, { mode: "debug", signed: true, distributable: true }), { variant: "launcher", build: "release" }, { descriptor: descriptor() }), /no launcher release APK/);
});

test("release blockers are named for staging and head qualification", () => {
  const row = { ...DISTRIBUTABLE, testMocks: false, bundleAudit: "passed", releaseAdmission: { failures: [], blockers: [], signerMatches: true } };
  assert.deepEqual(releaseBlockers(row), []);
  assert.deepEqual(releaseBlockers({ ...row, releaseAdmission: undefined }), ["release signing admission was not recorded"]);
  assert.deepEqual(releaseBlockers({ ...row, releaseAdmission: { failures: [], blockers: [], signerMatches: false } }), ["release signer does not match android/release-signer.json"]);
  assert.deepEqual(releaseBlockers(row, { manifestTestMocks: true }), ["test-mocks build"]);
  assert.deepEqual(releaseBlockers({ ...row, signed: false, releaseAdmission: { failures: [], blockers: ["unsigned release"], signerMatches: false } }), ["unsigned release"]);
  const blocked = { ...row, distributable: false, licenceBlockers: ["unresolved-font-licence: Denton typeface has no recorded embedding licence"] };
  const apks = [{ mode: "debug" }, { mode: "release", distributable: true, distributionBlockers: [] }, { mode: "release", distributable: false, distributionBlockers: releaseBlockers(blocked) }];
  assert.deepEqual(releaseDistribution(apks), { releasesDistributable: false, releaseBlockers: ["unresolved-font-licence: Denton typeface has no recorded embedding licence"] });
  assert.deepEqual(releaseDistribution([apks[1], apks[1]]), { releasesDistributable: true, releaseBlockers: [] });
  // A flag without recorded blockers, a contradicting flag, and a run with no release are all not distributable.
  assert.equal(releaseDistribution([{ mode: "release", distributable: true }]).releasesDistributable, false);
  assert.equal(releaseDistribution([{ mode: "release", distributable: true, distributionBlockers: ["unsigned release"] }]).releasesDistributable, false);
  assert.equal(releaseDistribution([{ mode: "debug" }]).releasesDistributable, false);
  assert.equal(releaseDistribution(undefined).releasesDistributable, false);
  // A test-mocks build can never qualify the head.
  const step = { status: "passed" };
  const browser = { status: "passed", expected: 3, unexpected: 0, flaky: 0, skipped: 0, failures: [] };
  const result = { clean: true, upstream: { matches: true }, verify: step, bundleAudit: step, androidBuild: { ...step, testMocks: false },
    storageSpecs: { chromium: browser, firefox: browser, webkit: browser } };
  assert.equal(verdict(result), true);
  assert.equal(verdict({ ...result, androidBuild: { ...step, testMocks: true } }), false);
  assert.equal(verdict({ ...result, androidBuild: step }), false);
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

test("data readback never mistakes a failed or refused walk for an unchanged inventory", () => {
  // One single-quoted device-shell word: no single quotes inside, patterns double-quoted.
  assert.ok(!DOMAIN_SCRIPT.includes("'"));
  assert.match(DOMAIN_SCRIPT, /! -path "\.\/cache\/\*"/);
  assert.match(DOMAIN_SCRIPT, /echo "READBACK_EXIT=\$\?"$/);
  const ok = readbackInventory(`${"1".repeat(64)}  ./files/a.json\nREADBACK_EXIT=0\n`);
  assert.deepEqual(Object.keys(ok), ["files"]);
  assert.throws(() => readbackInventory("find: ./cache/b: unknown primary or operator\nREADBACK_EXIT=1\n"), /exit 1/);
  assert.throws(() => readbackInventory(""), /exit missing/);
  assert.equal(readbackInventory("\nrun-as: package not debuggable: ai.elizaresearch.alphaphone"), null);
});

test("an update keeps the unit's provisioned variant and build type", () => {
  const unit = { apk: { variant: "launcher", build: "release" } };
  assert.equal(unitApkMismatch(unit, { variant: "launcher", build: "release" }), null);
  assert.match(unitApkMismatch(unit, { variant: "standalone", build: "release" }), /provisioned with the launcher release/);
  assert.match(unitApkMismatch(unit, { variant: "launcher", build: "debug" }), /same --variant and --build/);
  assert.match(unitApkMismatch({}, { variant: "launcher", build: "release" }), /unknown/);
});
