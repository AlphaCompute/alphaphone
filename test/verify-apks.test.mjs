// Integration checks of packaging CLIs and archived APK bytes.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { archiveWebPayload, readBuildFlags } from "../scripts/apk.mjs";
const root = path.resolve(import.meta.dirname, "..");
function zip(file, entries) {
  execFileSync("python3", ["-c", "import json,sys,zipfile\nwith zipfile.ZipFile(sys.argv[1],'w') as z:\n for k,v in json.loads(sys.argv[2]).items(): z.writestr(k,v)", file, JSON.stringify(entries)]);
}

test("packaged-runtime verification refuses unpackaged releases unless explicitly allowed", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "alpha-runtime-"));
  try {
    fs.mkdirSync(path.join(dir, "scripts"));
    fs.copyFileSync(path.join(root, "scripts/verify-packaged-runtime.py"), path.join(dir, "scripts/verify-packaged-runtime.py"));
    const release = path.join(dir, "launcher-release-unsigned.apk");
    const debug = path.join(dir, "launcher-debug.apk");
    zip(release, { "classes.dex": "app" });
    zip(debug, { "classes.dex": "app" });
    const run = args => spawnSync("python3", [path.join(dir, "scripts/verify-packaged-runtime.py"), ...args], { encoding: "utf8" });
    const strict = run(["--release", release, debug]);
    assert.equal(strict.status, 3, strict.stderr);
    assert.match(strict.stderr, /not distributable/);
    const report = JSON.parse(strict.stdout);
    assert.equal(report[0].runtime, "NOT_PACKAGED");
    assert.equal(report[0].distributable, false);
    const allowed = run(["--allow-unpackaged-runtime", "--release", release, debug]);
    assert.equal(allowed.status, 0, allowed.stderr);
    assert.equal(JSON.parse(allowed.stdout)[0].distributable, false);
    const debugOnly = run([debug]);
    assert.equal(debugOnly.status, 0, debugOnly.stderr);
    assert.equal(JSON.parse(debugOnly.stdout)[0].runtime, "NOT_PACKAGED");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("AOSP staging refuses test-mocks and non-distributable inputs before any staging", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "alpha-stage-"));
  try {
    fs.copyFileSync(path.join(root, "app.config.json"), path.join(dir, "app.config.json"));
    fs.mkdirSync(path.join(dir, "artifacts/test-mocks"), { recursive: true });
    const stage = args => spawnSync(process.execPath, [path.join(root, "scripts/stage-aosp.mjs"), ...args], { cwd: dir, encoding: "utf8" });
    const flagOn = path.join(dir, "artifacts/test-mocks/launcher-debug.apk");
    zip(flagOn, { "assets/public/build-flags.json": JSON.stringify({ testMocks: true }) });
    let out = stage(["--apk", flagOn, "--development"]);
    assert.notEqual(out.status, 0);
    assert.match(out.stderr, /artifacts\/test-mocks\/ builds are never staged/);
    const copied = path.join(dir, "copied.apk");
    fs.copyFileSync(flagOn, copied);
    out = stage(["--apk", copied, "--development"]);
    assert.match(out.stderr, /built with test mocks enabled/);
    const unflagged = path.join(dir, "old.apk");
    zip(unflagged, { "classes.dex": "app" });
    assert.match(stage(["--apk", unflagged, "--development"]).stderr, /test-mocks flag is unverified/);
    const release = path.join(dir, "artifacts/launcher-release-unsigned.apk");
    zip(release, { "assets/public/build-flags.json": JSON.stringify({ testMocks: false }) });
    const sha256 = createHash("sha256").update(fs.readFileSync(release)).digest("hex");
    fs.writeFileSync(path.join(dir, "artifacts/apk-manifest.json"), JSON.stringify({ testMocks: false, results: [{ file: "artifacts/launcher-release-unsigned.apk", mode: "release", sha256, runtime: "NOT_PACKAGED", distributable: false, signed: false }] }));
    assert.match(stage(["--apk", release, "--development"]).stderr, /not distributable/);
    assert.match(stage(["--apk", release, "--descriptor", "reviewed.json"]).stderr, /not distributable/);
    // Each recorded blocker is named, in development and production staging alike.
    const full = { file: "artifacts/launcher-release-unsigned.apk", mode: "release", sha256, testMocks: false, bundleAudit: "passed", signed: true, runtime: "PACKAGED", runtimeNotices: true,
      releaseAdmission: { failures: [], blockers: [], signerMatches: true }, speechQualification: { byteMatch: true, functionalPassed: true, qualified: true }, licenceBlockers: [] };
    const record = row => fs.writeFileSync(path.join(dir, "artifacts/apk-manifest.json"), JSON.stringify({ testMocks: false, results: [{ ...full, ...row }] }));
    const font = "unresolved-font-licence: Denton typeface (assets/denton.woff2) has no recorded embedding licence";
    record({ distributable: false, licenceBlockers: [font], speechQualification: { byteMatch: true, functionalPassed: false, qualified: false } });
    for (const mode of [["--development"], ["--descriptor", "reviewed.json", "--production"]]) {
      out = stage(["--apk", release, ...mode]);
      assert.notEqual(out.status, 0);
      assert.match(out.stderr, /not distributable[\s\S]*- unqualified speech \(functional acceptance pending or failed\)[\s\S]*- unresolved-font-licence: Denton typeface/);
    }
    // A release flagged distributable whose recorded facts still hold a blocker is not staged either.
    record({ distributable: true, licenceBlockers: [font] });
    assert.match(stage(["--apk", release, "--descriptor", "reviewed.json", "--production"]).stderr, /not distributable[\s\S]*unresolved-font-licence/);
    assert.match(stage(["--apk", release, "--development"]).stderr, /unresolved-font-licence/);
    // Production staging still needs a manifest row: an APK verify-apks never recorded is refused.
    fs.rmSync(path.join(dir, "artifacts/apk-manifest.json"));
    assert.match(stage(["--apk", release, "--descriptor", "reviewed.json", "--production"]).stderr, /Production staging requires a release APK that verify-apks recorded as distributable/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

for (const testMocks of [false, true]) test(`archive retains actual APK web bytes with testMocks=${testMocks}`, t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-archive-web-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const publicDir = path.join(dir, 'assets/public');
  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(path.join(publicDir, 'build-flags.json'), JSON.stringify({ testMocks }));
  fs.writeFileSync(path.join(publicDir, 'index.html'), '<html>Actual APK payload</html>');
  const apkFile = path.join(dir, 'app.apk');
  execFileSync('zip', ['-q', '-r', apkFile, 'assets'], { cwd: dir });
  // Working assets may be restored to a different mode after the APK was built.
  fs.writeFileSync(path.join(publicDir, 'build-flags.json'), JSON.stringify({ testMocks: !testMocks }));
  const archived = path.join(dir, 'archived-web');
  archiveWebPayload(apkFile, archived, { testMocks });
  assert.equal(readBuildFlags(archived).testMocks, testMocks);
  assert.equal(fs.readFileSync(path.join(archived, 'index.html'), 'utf8'), '<html>Actual APK payload</html>');
  assert.throws(() => archiveWebPayload(apkFile, path.join(dir, 'wrong-mode'), { testMocks: !testMocks }), /testMocks/);
  assert.equal(fs.existsSync(path.join(dir, 'wrong-mode')), false);
});
