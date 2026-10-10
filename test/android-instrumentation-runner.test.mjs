// Runner policy and result parsing on synthetic `am instrument` output. Not emulator evidence.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { instrumentationClassResults, listedInstrumentationTests, writeInstrumentationRecord } from "../scripts/instrumentation-result.mjs";
import { admitApks, classIsolationCommands, CLASS_REGISTRY, DEFAULT_CLASSES, instrumentArgs, parseInstrumentationArgs, PACKAGE } from "../scripts/android-instrumentation.mjs";

const C = name => `${PACKAGE}.${name}InstrumentedTest`;
const block = (cls, method, code, numtests = 1) =>
  `INSTRUMENTATION_STATUS: class=${cls}\nINSTRUMENTATION_STATUS: current=1\nINSTRUMENTATION_STATUS: id=AndroidJUnitRunner\nINSTRUMENTATION_STATUS: numtests=${numtests}\nINSTRUMENTATION_STATUS: test=${method}\nINSTRUMENTATION_STATUS_CODE: ${code}\n`;
const done = (summary = "OK (1 test)") => `INSTRUMENTATION_RESULT: stream=\n\nTime: 1\n\n${summary}\n\nINSTRUMENTATION_CODE: -1\n`;

test("per-class results keep going past a failing class and never count skips as passes", () => {
  const output = block(C("Shell"), "a", 1, 4) + block(C("Shell"), "a", 0, 4)
    + block(C("NoMockProduct"), "b", 1, 4) + block(C("NoMockProduct"), "b", -2, 4)
    + block(C("TextScale"), "c", 1, 4) + block(C("TextScale"), "c", 0, 4)
    + block(C("TextScale"), "d", 1, 4) + block(C("TextScale"), "d", -4, 4)
    + block(C("BrowserFlow"), "e", 1, 4) + block(C("BrowserFlow"), "e", -4, 4)
    + done("FAILURES!!!\nTests run: 4,  Failures: 1");
  const { results, runFailure } = instrumentationClassResults(output, [C("Shell"), C("NoMockProduct"), C("TextScale"), C("BrowserFlow"), C("Rotation")]);
  assert.equal(runFailure, false);
  const status = Object.fromEntries(results.map(row => [row.class.split(".").pop(), row.status]));
  assert.deepEqual(status, {
    BrowserFlowInstrumentedTest: "skipped", NoMockProductInstrumentedTest: "failed", RotationInstrumentedTest: "missing",
    ShellInstrumentedTest: "passed", TextScaleInstrumentedTest: "passed",
  });
  assert.deepEqual(results.find(row => row.class === C("TextScale")).ignored, ["d"]);
});

test("a crash or missing terminal result fails the class that was running", () => {
  const crashed = block(C("Shell"), "a", 1) + "INSTRUMENTATION_RESULT: shortMsg=Process crashed.\nINSTRUMENTATION_CODE: 0\n";
  const { results, crashedIn } = instrumentationClassResults(crashed, [C("Shell")]);
  assert.equal(crashedIn, C("Shell"));
  assert.equal(results[0].status, "failed");
  assert.equal(instrumentationClassResults(block(C("Shell"), "a", 1) + block(C("Shell"), "a", 0), [C("Shell")]).results[0].status, "failed", "no INSTRUMENTATION_CODE");
  assert.throws(() => instrumentationClassResults("", ["bad class"]));
});

test("log-only listing enumerates tests without executing them", () => {
  const listed = listedInstrumentationTests(block(C("Shell"), "a", 1) + block(C("Shell"), "a", 0) + block(C("Shell"), "b", 1) + block(C("Shell"), "b", 0) + done());
  assert.deepEqual(listed, [`${C("Shell")}#a`, `${C("Shell")}#b`]);
});

test("records bind commit and APK hashes, are emulator class E and refuse overwrite", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "alpha-instr-"));
  try {
    const file = path.join(dir, "results.json");
    const apks = [{ variant: "standalone", role: "app", sha256: "a".repeat(64) }, { variant: "standalone", role: "test", sha256: "b".repeat(64) }];
    const classes = [{ variant: "standalone", class: C("Shell"), status: "passed" }, { variant: "standalone", class: C("BrowserFlow"), status: "skipped" }];
    assert.throws(() => writeInstrumentationRecord(file, { commit: "abc", apks, classes }), /commit/);
    assert.throws(() => writeInstrumentationRecord(file, { commit: "c".repeat(40), apks: [{ variant: "x", role: "app", sha256: "z" }], classes }), /SHA-256/);
    const body = writeInstrumentationRecord(file, { commit: "c".repeat(40), apks, classes });
    assert.equal(body.evidenceClass, "E");
    assert.ok(body.notEvidenceFor.includes("physical-device acceptance"));
    assert.equal(body.passed, false, "a skipped class is not a pass");
    assert.throws(() => writeInstrumentationRecord(file, { commit: "c".repeat(40), apks, classes }), /EEXIST/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("argument policy: short names, campaigns refused with their runner, clock and test-mocks gates", () => {
  const options = parseInstrumentationArgs(["--owned-emulator", "--avd", "a", "--classes", "NoMockProduct,Shell,StartupReadiness"]);
  assert.deepEqual(options.classes, [C("NoMockProduct"), C("Shell"), C("StartupReadiness")]);
  assert.equal(options.apkDir, "artifacts");
  assert.deepEqual(options.variants, ["standalone", "launcher"]);
  assert.equal(parseInstrumentationArgs([]).classes.length, DEFAULT_CLASSES.length);
  assert.equal(parseInstrumentationArgs(["--test-mocks"]).apkDir, "artifacts/test-mocks");
  for (const name of ["ResidentEgressRedaction", "ReminderTapProcessDeath", "WorkflowNoticeProcessDeath", "NotificationChannels"])
    assert.throws(() => parseInstrumentationArgs(["--classes", name]), /own campaign/);
  assert.throws(() => parseInstrumentationArgs(["--classes", "RealClock"]), /clock-exclusive/);
  assert.equal(parseInstrumentationArgs(["--classes", "RealClock", "--clock-exclusive"]).classes[0], C("RealClock"));
  assert.throws(() => parseInstrumentationArgs(["--classes", "BrowserAutofill"]), /test-mocks/);
  assert.throws(() => parseInstrumentationArgs(["--all", "--classes", "Shell"]));
  assert.throws(() => parseInstrumentationArgs(["--variants", "standalone,standalone"]));
  assert.throws(() => parseInstrumentationArgs(["--classes", "Shell;id"]));
  assert.throws(() => parseInstrumentationArgs(["--bogus"]));
  const args = instrumentArgs(C("StartupReadiness"));
  assert.deepEqual(args.slice(-6, -1), ["startupReadiness", "1", "-e", "class", C("StartupReadiness")]);
  assert.ok(args.includes("startupReadiness") && args.at(-1) === `${PACKAGE}.test/androidx.test.runner.AndroidJUnitRunner`);
  assert.deepEqual(CLASS_REGISTRY.HostedProcessRestart.phases.length, 3);
});

test("APK admission binds the app to the verify-apks manifest and the test APK to its recorded hash", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "alpha-instr-apk-"));
  try {
    const sha = bytes => createHash("sha256").update(bytes).digest("hex");
    fs.mkdirSync(path.join(dir, "instrumentation"));
    fs.writeFileSync(path.join(dir, "standalone-debug.apk"), "app");
    fs.writeFileSync(path.join(dir, "instrumentation/standalone-androidTest.apk"), "test");
    const manifest = { testMocks: false, results: [{ variant: "standalone", mode: "debug", sha256: sha("app"), versionCode: 7 }], instrumentation: { standalone: { sha256: sha("test") } } };
    fs.writeFileSync(path.join(dir, "apk-manifest.json"), JSON.stringify(manifest));
    const [app, testApk] = admitApks(dir, "standalone", { testMocks: false });
    assert.equal(app.sha256, sha("app"));
    assert.equal(testApk.sha256, sha("test"));
    assert.throws(() => admitApks(dir, "standalone", { testMocks: true }), /testMocks/);
    // A test APK the manifest does not record is not bound to this app build.
    fs.writeFileSync(path.join(dir, "apk-manifest.json"), JSON.stringify({ ...manifest, instrumentation: {} }));
    assert.throws(() => admitApks(dir, "standalone", { testMocks: false }), /instrumentation APK recorded/);
    fs.writeFileSync(path.join(dir, "apk-manifest.json"), JSON.stringify(manifest));
    fs.writeFileSync(path.join(dir, "standalone-debug.apk"), "changed");
    assert.throws(() => admitApks(dir, "standalone", { testMocks: false }), /does not match/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("restart runner keeps the bookmark phase wired", () => {
  const source = fs.readFileSync("scripts/test-native-restart.mjs", "utf8");
  // P-04 sign-in persistence: the phase the test class documents must have a runner case with its gate.
  assert.match(source, /signin: \{\n\t\ttestClass: "BrowserSigninsInstrumentedTest",\n\t\tmethod: "signinProcessRestartPhase",\n\t\tgate: "signinPhase"/);
  const signins = fs.readFileSync("android/app/src/androidTest/java/ai/elizaresearch/alphaphone/BrowserSigninsInstrumentedTest.java", "utf8");
  assert.match(signins, /void signinProcessRestartPhase\(\)/);
  for (const phase of ["prepare", "verify", "cleanup"]) assert.ok(signins.includes(`"${phase}"`), `sign-in restart phase ${phase}`);
  assert.ok(signins.includes('getString("signinPhase")'));
  assert.match(source, /bookmark: \{\n\t\ttestClass: "BrowserContinuityInstrumentedTest",\n\t\tmethod: "bookmarkProcessRestartPhase",\n\t\tgate: "bookmarkPhase"/);
  assert.equal(JSON.parse(fs.readFileSync("package.json", "utf8")).scripts["test:android:instrumentation"], "node scripts/android-instrumentation.mjs");
});

test("every registered class exists in the app's instrumentation sources and declares the gates the runner passes", () => {
  const roots = ["android/app/src/androidTest/java/ai/elizaresearch/alphaphone", "android/app/src/testMocks/androidTest/java/ai/elizaresearch/alphaphone"];
  for (const [name, spec] of Object.entries(CLASS_REGISTRY)) {
    const found = roots.map(root => path.join(root, `${name}InstrumentedTest.java`)).filter(file => fs.existsSync(file));
    assert.equal(found.length, 1, `${name} must be exactly one class in the app instrumentation sources`);
    assert.equal(found[0].includes("testMocks"), spec.testMocks === true, `${name} test-mocks flag must match its source set`);
    const source = fs.readFileSync(found[0], "utf8");
    for (const [gate, value] of Object.entries(spec.args ?? {}))
      assert.ok(source.includes(`"${value}".equals(InstrumentationRegistry.getArguments().getString("${gate}")`), `${name} does not read gate ${gate}=${value}`);
    for (const method of spec.phases ?? []) assert.match(source, new RegExp(`void ${method}\\(`), `${name} has no phase ${method}`);
  }
  // A core-loop class with a gate runs its gated methods instead of reporting them skipped.
  assert.deepEqual(instrumentArgs(C("ClockHandoff")).slice(-6, -1), ["clockHandoff", "1", "-e", "class", C("ClockHandoff")]);
});

test("each named class starts from cleared app data with Android's shade closed", () => {
  // First emulator runs: Video, Accessibility and SettingsFlow passed or failed with the order of
  // the classes before them, and a system shade left open failed every later gesture.
  const commands = classIsolationCommands();
  assert.ok(commands.some(command => command.join(" ") === `shell pm clear ${PACKAGE}`));
  assert.ok(commands.some(command => command.join(" ") === "shell cmd statusbar collapse"));
  // Only the app under test is cleared; the instrumentation package and other apps keep their data.
  assert.equal(commands.filter(command => command.includes("clear")).length, 1);
  const runner = fs.readFileSync("scripts/android-instrumentation.mjs", "utf8");
  const loop = runner.slice(runner.indexOf("for (const cls of options.classes)"));
  assert.ok(loop.indexOf("classIsolationCommands()") > 0 && loop.indexOf("classIsolationCommands()") < loop.indexOf("spec.phases"), "isolation runs once per class, before its phases");
});
