// Release-policy checks for APK verification, using fabricated aapt dumps.
// These prove the verifier's decisions only; they are not APK build evidence.
import test from "node:test";
import { storageSpecPattern } from "../scripts/storage-specs.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { archiveWebPayload, auditBundle, distributionProblems, manifestFacts, parseSignerDigest, readBuildFlags } from "../scripts/apk.mjs";
import { buildEnv, gradleFlagArgs, outputDirectory, parseBuildArgs, signingRequested, withDistributionWebRestored } from "../scripts/build-android.mjs";
import { parseQualifyArgs, qualifyPlaywrightReport, verdict, ENGINES, STORAGE_SPECS } from "../scripts/qualify-head.mjs";

const root = path.resolve(import.meta.dirname, "..");
const PKG = "ai.elizaresearch.alphaphone";
const bool = value => `(type 0x12)${value ? "0xffffffff" : "0x0"}`;
const str = value => `"${value}" (Raw: "${value}")`;

function component(tag, name, { exported = false, permission, indent = "      " } = {}) {
  return [
    `${indent}E: ${tag} (line=40)`,
    `${indent}  A: android:name(0x01010003)=${str(name)}`,
    `${indent}  A: android:exported(0x01010010)=${bool(exported)}`,
    ...(permission ? [`${indent}  A: android:permission(0x01010006)=${str(permission)}`] : []),
  ];
}

/** A fabricated `aapt dump xmltree` for a clean distribution APK. */
function xmltree({ cleartext = false, networkSecurityConfig = true, allowBackup = false, debuggable = false, extraPermissions = [], extraComponents = [], extraQueries = [], versionCode = "0x1" } = {}) {
  return [
    "N: android=http://schemas.android.com/apk/res/android",
    "  E: manifest (line=2)",
    `    A: android:versionCode(0x0101021b)=(type 0x10)${versionCode}`,
    `    A: android:versionName(0x0101021c)=${str("0.1.0")}`,
    `    A: package=${str(PKG)}`,
    ...["android.permission.INTERNET", "android.permission.CAMERA", "android.permission.RECORD_AUDIO", ...extraPermissions].flatMap(name => [
      "    E: uses-permission (line=3)",
      `      A: android:name(0x01010003)=${str(name)}`,
    ]),
    "    E: queries (line=20)",
    "      E: package (line=22)",
    `        A: android:name(0x01010003)=${str("proton.android.pass")}`,
    ...extraQueries.flatMap(name => ["      E: package (line=23)", `        A: android:name(0x01010003)=${str(name)}`]),
    "    E: application (line=30)",
    `      A: android:label(0x01010001)=@0x7f120020`,
    `      A: android:allowBackup(0x01010280)=${bool(allowBackup)}`,
    ...(debuggable ? [`      A: android:debuggable(0x0101000f)=${bool(true)}`] : []),
    `      A: android:usesCleartextTraffic(0x010104ec)=${bool(cleartext)}`,
    ...(networkSecurityConfig ? ["      A: android:networkSecurityConfig(0x01010527)=@0x7f150002"] : []),
    ...component("service", `${PKG}.ElizaAgentService`),
    ...component("service", `${PKG}.AlphaNotificationListener`, { exported: true, permission: "android.permission.BIND_NOTIFICATION_LISTENER_SERVICE" }),
    ...component("activity", `${PKG}.AlphaAssistActivity`, { exported: true }),
    ...component("activity", `${PKG}.MainActivity`, { exported: true }),
    "        E: intent-filter (line=60)",
    "          E: action (line=60)",
    `            A: android:name(0x01010003)=${str("android.intent.action.MAIN")}`,
    "          E: category (line=60)",
    `            A: android:name(0x01010003)=${str("android.intent.category.LAUNCHER")}`,
    ...component("receiver", "androidx.profileinstaller.ProfileInstallReceiver", { exported: true, permission: "android.permission.DUMP" }),
    ...extraComponents.flatMap(([tag, name, options]) => component(tag, name, options)),
    "",
  ].join("\n");
}
const badging = (code = "1", name = "0.1.0") =>
  `package: name='${PKG}' versionCode='${code}' versionName='${name}' platformBuildVersionName='16' compileSdkVersion='36'\nsdkVersion:'26'\ntargetSdkVersion:'36'\nuses-permission: name='android.permission.CAMERA'\n`;
const NAMES = ["AndroidManifest.xml", "classes.dex", "assets/public/index.html", "assets/public/build-flags.json", "assets/public/licenses/third-party-notices.json", "res/xml/network_security_config.xml"];
const apk = (overrides = {}) => ({ xml: xmltree(), badging: badging(), names: NAMES, dexClasses: [], ...overrides });

test("aapt xmltree parsing extracts application security attributes and exports", () => {
  const facts = manifestFacts(xmltree(), badging());
  assert.equal(facts.packageName, PKG);
  assert.equal(facts.versionCode, 1);
  assert.equal(facts.versionName, "0.1.0");
  assert.equal(facts.application.usesCleartextTraffic, "0x0");
  assert.equal(facts.application.allowBackup, "0x0");
  assert.equal(facts.application.networkSecurityConfig, "@0x7f150002");
  assert.deepEqual(facts.exported.map(c => c.name).sort(), [
    `${PKG}.AlphaAssistActivity`, `${PKG}.AlphaNotificationListener`, `${PKG}.MainActivity`,
    "androidx.profileinstaller.ProfileInstallReceiver",
  ]);
  assert.deepEqual(facts.queriedPackages, ["proton.android.pass"]);
});

test("clean flag-off release and debug inputs pass", () => {
  assert.deepEqual(distributionProblems(apk(), { mode: "release" }).problems, []);
  assert.deepEqual(distributionProblems(apk({ xml: xmltree({ debuggable: true }) }), { mode: "debug" }).problems, []);
});

test("browser speech model assets never ship in an APK", () => {
  for (const mode of ["debug", "release"]) {
    const { problems } = distributionProblems(apk({ names: [...NAMES, "assets/public/browser-speech/manifest.json", "assets/public/browser-speech/ort/ort-wasm-simd-threaded.wasm"] }), { mode });
    assert.ok(problems.some(p => /Browser speech model assets are packaged: assets\/public\/browser-speech\/manifest\.json/.test(p)), problems.join("\n"));
  }
});

test("cleartext-enabled inputs fail in every distribution APK", () => {
  for (const mode of ["debug", "release"]) {
    const { problems } = distributionProblems(apk({ xml: xmltree({ cleartext: true }) }), { mode });
    assert.ok(problems.some(p => /usesCleartextTraffic/.test(p)), `${mode}: ${problems}`);
  }
  const unset = xmltree().replace(/^.*usesCleartextTraffic.*\n/m, "");
  assert.ok(distributionProblems(apk({ xml: unset }), { mode: "release" }).problems.some(p => /usesCleartextTraffic must be false \(found unset\)/.test(p)));
  const devConfig = apk({ names: [...NAMES, "res/xml/development_network_security_config.xml"] });
  assert.ok(distributionProblems(devConfig, { mode: "debug" }).problems.some(p => /Development network security config/.test(p)));
});

test("release without networkSecurityConfig fails", () => {
  const { problems } = distributionProblems(apk({ xml: xmltree({ networkSecurityConfig: false }) }), { mode: "release" });
  assert.ok(problems.some(p => /networkSecurityConfig/.test(p)));
});

test("debug-class inputs fail in manifest or dex", () => {
  const autofill = apk({ xml: xmltree({ extraComponents: [["service", `${PKG}.SyntheticAutofillService`, { exported: true, permission: "android.permission.BIND_AUTOFILL_SERVICE" }]] }) });
  const manifestProblems = distributionProblems(autofill, { mode: "debug" }).problems;
  assert.ok(manifestProblems.some(p => /SyntheticAutofillService is packaged/.test(p)));
  assert.ok(manifestProblems.some(p => /Unexpected exported service .*SyntheticAutofillService/.test(p)));
  const dex = distributionProblems(apk({ dexClasses: ["DevelopmentAgentPlugin"] }), { mode: "release" }).problems;
  assert.ok(dex.some(p => /DevelopmentAgentPlugin is packaged/.test(p)));
  const peer = apk({ xml: xmltree({ extraPermissions: [`${PKG}.peerfixture.permission.CONTROL`], extraQueries: [`${PKG}.peerfixture`] }) });
  assert.ok(distributionProblems(peer, { mode: "debug" }).problems.some(p => /peerfixture/.test(p)));
});

test("mock-string manifest inputs fail", () => {
  const mock = apk({ xml: xmltree({ extraPermissions: ["android.permission.ACCESS_MOCK_LOCATION"], extraComponents: [["service", `${PKG}.MockLocationService`, {}]] }) });
  const { problems } = distributionProblems(mock, { mode: "release" });
  assert.ok(problems.some(p => /Test-only manifest entry android\.permission\.ACCESS_MOCK_LOCATION/.test(p)));
  assert.ok(problems.some(p => /Test-only manifest entry .*MockLocationService/.test(p)));
});

test("test-mocks debug builds may carry development hooks but releases may not", () => {
  const hooks = apk({
    xml: xmltree({ cleartext: true, debuggable: true, extraPermissions: [`${PKG}.peerfixture.permission.CONTROL`], extraComponents: [["service", `${PKG}.SyntheticAutofillService`, { exported: true, permission: "android.permission.BIND_AUTOFILL_SERVICE" }]] }),
    dexClasses: ["DevelopmentAgentPlugin", "SyntheticAutofillService"],
  });
  assert.deepEqual(distributionProblems(hooks, { mode: "debug", testMocks: true }).problems, []);
  assert.ok(distributionProblems(hooks, { mode: "release", testMocks: true }).problems.length > 0);
});

test("backup, exports, storage permission, source maps, licenses and version are enforced", () => {
  const cases = [
    [apk({ xml: xmltree({ allowBackup: true }) }), /allowBackup must be false/],
    [apk({ xml: xmltree({ extraComponents: [["activity", `${PKG}.DebugShortcutActivity`, { exported: true }]] }) }), /Unexpected exported activity/],
    [apk({ xml: xmltree().replace('permission(0x01010006)="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE" (Raw: "android.permission.BIND_NOTIFICATION_LISTENER_SERVICE")', 'permission(0x01010006)="x" (Raw: "x")') }), /AlphaNotificationListener must require/],
    [apk({ xml: xmltree({ extraPermissions: ["android.permission.WRITE_EXTERNAL_STORAGE"] }) }), /WRITE_EXTERNAL_STORAGE/],
    [apk({ names: [...NAMES, "assets/public/assets/index-abc.js.map"] }), /Source maps are packaged/],
    [apk({ names: NAMES.filter(name => !name.includes("licenses")) }), /third-party-notices\.json is missing/],
    [apk({ badging: badging("0") }), /versionCode must be a positive integer \(found 0\)/],
    [apk({ badging: badging("1.5") }), /versionCode must be a positive integer/],
    [apk({ badging: badging("2", "") }), /versionName must be set/],
  ];
  for (const [input, pattern] of cases)
    assert.ok(distributionProblems(input, { mode: "release" }).problems.some(p => pattern.test(p)), String(pattern));
});

test("apksigner certificate digest is parsed and required", () => {
  const digest = "AB".repeat(32);
  assert.equal(parseSignerDigest(`Signer #1 certificate DN: CN=Alpha\nSigner #1 certificate SHA-256 digest: ${digest}\n`), digest.toLowerCase());
  assert.throws(() => parseSignerDigest("DOES NOT VERIFY"), /no SHA-256 signer digest/);
});

test("bundle flags and the shared audit CLI are required", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "alpha-verify-apks-"));
  try {
    assert.throws(() => readBuildFlags(dir), /build-flags\.json is missing/);
    fs.writeFileSync(path.join(dir, "build-flags.json"), JSON.stringify({ testMocks: true }));
    assert.equal(readBuildFlags(dir).testMocks, true);
    assert.throws(() => auditBundle(dir, { script: path.join(dir, "absent.mjs") }), /absent\.mjs is missing/);
    // Stand-in CLI with the contract's exit semantics: non-zero on a denylist hit.
    const cli = path.join(dir, "audit.mjs");
    fs.writeFileSync(cli, `import fs from "node:fs";const [d,...a]=process.argv.slice(2);const hit=fs.readFileSync(d+"/index.js","utf8").includes("mode=mock");if(hit&&!a.includes("--expect-test-mocks")){console.error("denylist: mode=mock");process.exit(1)}`);
    fs.writeFileSync(path.join(dir, "index.js"), "location.search==='?mode=mock'");
    assert.throws(() => auditBundle(dir, { script: cli }), /Production bundle audit failed[\s\S]*denylist: mode=mock/);
    assert.doesNotThrow(() => auditBundle(dir, { script: cli, testMocks: true }));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("shared production bundle audit rejects mock strings when present", { skip: !fs.existsSync(path.join(root, "scripts/audit-production-bundle.mjs")) && "scripts/audit-production-bundle.mjs not merged yet" }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "alpha-audit-"));
  try {
    const script = path.join(root, "scripts/audit-production-bundle.mjs");
    fs.writeFileSync(path.join(dir, "index.html"), "<script src=assets/index.js></script>");
    fs.writeFileSync(path.join(dir, "build-flags.json"), JSON.stringify({ testMocks: false }));
    fs.mkdirSync(path.join(dir, "assets"));
    fs.writeFileSync(path.join(dir, "assets/index.js"), "export const ready=true;");
    assert.doesNotThrow(() => auditBundle(dir, { script }));
    fs.writeFileSync(path.join(dir, "assets/index.js"), "document.body.className='mock-mode-banner';const label='Enter mock mode';");
    assert.throws(() => auditBundle(dir, { script }), /Production bundle audit failed/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("distribution builds strip every form of the flag; --test-mocks sets it and isolates output", () => {
  const base = { PATH: "/bin", ELIZA_DEV_ALLOW_TEST_MOCKS: "1", VITE_ELIZA_DEV_ALLOW_TEST_MOCKS: "1", ORG_GRADLE_PROJECT_ELIZA_DEV_ALLOW_TEST_MOCKS: "1" };
  const off = buildEnv(base, parseBuildArgs([]));
  assert.equal(off.ELIZA_DEV_ALLOW_TEST_MOCKS, undefined);
  assert.equal(off.VITE_ELIZA_DEV_ALLOW_TEST_MOCKS, undefined);
  assert.equal(off.ORG_GRADLE_PROJECT_ELIZA_DEV_ALLOW_TEST_MOCKS, undefined);
  assert.equal(off.PATH, "/bin");
  assert.deepEqual(gradleFlagArgs({ testMocks: false }), ["-PELIZA_DEV_ALLOW_TEST_MOCKS=0"]);
  assert.equal(outputDirectory({ testMocks: false }), "artifacts");
  const on = parseBuildArgs(["--test-mocks"]);
  assert.equal(buildEnv({}, on).ELIZA_DEV_ALLOW_TEST_MOCKS, "1");
  assert.deepEqual(gradleFlagArgs(on), ["-PELIZA_DEV_ALLOW_TEST_MOCKS=1"]);
  assert.equal(outputDirectory(on), "artifacts/test-mocks");
  assert.equal(parseBuildArgs(["--allow-unpackaged-runtime"]).allowUnpackagedRuntime, true);
  assert.throws(() => parseBuildArgs(["--mock"]), /Unknown option/);
  const signing = { ELIZAOS_KEYSTORE_PATH: "k", ELIZAOS_KEYSTORE_PASSWORD: "p", ELIZAOS_KEY_ALIAS: "a", ELIZAOS_KEY_PASSWORD: "q" };
  assert.equal(signingRequested(signing), true);
  assert.equal(signingRequested({ ...signing, ELIZAOS_KEY_PASSWORD: "" }), false);
});

// Build real ZIPs with Python's zipfile (no extra dependencies).
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
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("qualification needs every current step to pass on a clean pinned tree", () => {
  const passed = { status: "passed" };
  const full = {
    clean: true, upstream: { matches: true }, verify: passed, androidBuild: passed, bundleAudit: passed,
    storageSpecs: Object.fromEntries(ENGINES.map(engine => [engine, { ...passed, expected: STORAGE_SPECS.length, unexpected: 0, flaky: 0, skipped: 0, failures: [] }])),
  };
  assert.equal(verdict(full), true);
  for (const incomplete of [{}, { expected: 0 }, { unexpected: 1 }, { flaky: 1 }, { skipped: 1 }, { failures: [{ title: "failed" }] }]) {
    const record = Object.keys(incomplete).length ? { ...full.storageSpecs.chromium, ...incomplete } : passed;
    assert.equal(verdict({ ...full, storageSpecs: { ...full.storageSpecs, chromium: record } }), false);
  }
  assert.equal(verdict({ ...full, clean: false }), false);
  assert.equal(verdict({ ...full, androidBuild: { status: "skipped" } }), false);
  assert.equal(verdict({ ...full, storageSpecs: { chromium: passed } }), false);
  assert.equal(verdict({ ...full, upstream: { matches: false } }), false);
  assert.deepEqual(parseQualifyArgs(["--engines", "firefox"]).engines, ["firefox"]);
  assert.throws(() => parseQualifyArgs(["--engines", "edge"]), /--engines/);

});

test("the storage inventory selects existing specs on both path formats", () => {
  assert.equal(new Set(STORAGE_SPECS).size, STORAGE_SPECS.length);
  for (const file of STORAGE_SPECS) {
    assert.ok(fs.existsSync(path.join(root,file)),file);
    assert.equal(storageSpecPattern.test(file),true);
    assert.equal(storageSpecPattern.test(file.replaceAll("/", "\\")),true);
  }
  assert.equal(storageSpecPattern.test("test/browser/not-storage.spec.ts"),false);
});

function completeBrowserReport() {
  return {
    errors: [],
    stats: { expected: STORAGE_SPECS.length, unexpected: 0, flaky: 0, skipped: 0 },
    suites: STORAGE_SPECS.map(file => ({ file: path.basename(file), specs: [{
      title: "storage contract", tests: [{ status: "expected", expectedStatus: "passed", results: [{ status: "passed" }] }],
    }], suites: [] })),
  };
}

test("browser qualification requires every named storage spec and matching terminal counts", () => {
  const report = completeBrowserReport();
  assert.deepEqual(qualifyPlaywrightReport(report), { ...report.stats, failures: [] });
  const missing = structuredClone(report);
  missing.suites.pop();missing.stats.expected--;
  assert.throws(() => qualifyPlaywrightReport(missing), /spec was not executed/);
  const forged = structuredClone(report);forged.stats.expected++;
  assert.throws(() => qualifyPlaywrightReport(forged), /count disagrees/);
  assert.throws(() => qualifyPlaywrightReport({ stats: report.stats, suites: [] }), /missing results/);
  const errors = structuredClone(report);errors.errors.push({message:"worker crashed"});
  assert.throws(() => qualifyPlaywrightReport(errors), /runner errors/);
  for (const invalid of [
    {status:"skipped",expectedStatus:"skipped",results:[{status:"skipped"}]},
    {status:"expected",expectedStatus:"failed",results:[{status:"failed"}]},
    {status:"expected",expectedStatus:"passed",results:[]},
  ]) {
    const bad = structuredClone(report);bad.suites[0].specs[0].tests=[invalid];
    assert.throws(() => qualifyPlaywrightReport(bad), /did not pass/);
  }
});

test("successful retries remain flaky and cannot qualify Alpha's clean run", () => {
  const report = completeBrowserReport();
  report.stats.expected--;report.stats.flaky++;
  Object.assign(report.suites[0].specs[0].tests[0], {status:"flaky",results:[{status:"failed"},{status:"passed"}]});
  const summary = qualifyPlaywrightReport(report);
  assert.equal(summary.flaky, 1);
  const passed = {status:"passed"};
  assert.equal(verdict({clean:true,upstream:{matches:true},verify:passed,androidBuild:passed,bundleAudit:passed,
    storageSpecs:Object.fromEntries(ENGINES.map(engine=>[engine,{...passed,...summary}]))}),false);
});

// A fake android:sync writes web-dist/build-flags.json from the flag in its environment.
function fakeSync(root, calls) {
  return (cmd, args, extra = {}) => {
    calls.push({ cmd: [cmd, ...args].join(" "), flag: extra.env?.ELIZA_DEV_ALLOW_TEST_MOCKS ?? null });
    fs.mkdirSync(path.join(root, "web-dist"), { recursive: true });
    fs.writeFileSync(path.join(root, "web-dist/build-flags.json"), JSON.stringify({ testMocks: extra.env?.ELIZA_DEV_ALLOW_TEST_MOCKS === "1" }));
  };
}

test("a test-mocks Android build leaves a flag-off web-dist, after success and after failure", () => {
  for (const fails of [false, true]) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "alpha-test-mocks-web-"));
    try {
      const calls = [], run = fakeSync(root, calls);
      const body = () => {
        // The test-mocks build syncs a flag-on bundle first.
        run("npm", ["run", "android:sync"], { env: buildEnv({ PATH: "/bin" }, { testMocks: true }) });
        assert.equal(JSON.parse(fs.readFileSync(path.join(root, "web-dist/build-flags.json"), "utf8")).testMocks, true);
        if (fails) throw new Error("gradle failed");
        return "built";
      };
      const attempt = () => withDistributionWebRestored({ testMocks: true }, { PATH: "/bin", ELIZA_DEV_ALLOW_TEST_MOCKS: "1" }, run, body, { root });
      if (fails) assert.throws(attempt, /gradle failed/); else assert.equal(attempt(), "built");
      assert.deepEqual(calls.map(call => call.flag), ["1", null], "the restore sync runs with the switch removed");
      assert.equal(JSON.parse(fs.readFileSync(path.join(root, "web-dist/build-flags.json"), "utf8")).testMocks, false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test("a distribution Android build does not add a second sync", () => {
  const calls = [];
  assert.equal(withDistributionWebRestored({ testMocks: false }, {}, () => calls.push("sync"), () => "built"), "built");
  assert.deepEqual(calls, []);
});

test("a restore that still records test mocks fails the build", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "alpha-test-mocks-web-"));
  try {
    const stuck = () => { fs.mkdirSync(path.join(root, "web-dist"), { recursive: true }); fs.writeFileSync(path.join(root, "web-dist/build-flags.json"), JSON.stringify({ testMocks: true })); };
    assert.throws(() => withDistributionWebRestored({ testMocks: true }, {}, stuck, () => "built", { root }), /still records testMocks/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
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
