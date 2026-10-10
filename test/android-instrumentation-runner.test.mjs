// Runner policy and result parsing on synthetic `am instrument` output. Not emulator evidence.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { instrumentationClassResults, listedInstrumentationTests, writeInstrumentationRecord } from "../scripts/instrumentation-result.mjs";
import { admitApks, admitHome, classIsolationCommands, CAMPAIGN_RUNNERS, CLASS_REGISTRY, DEFAULT_CLASSES, instrumentArgs, NOT_RUN_BY_A_RUNNER, parseInstrumentationArgs, PACKAGE, readHome, restoreHome, runLeased, selectAlphaHome } from "../scripts/android-instrumentation.mjs";
import { cases as permissionCases } from "../scripts/test-native-permissions.mjs";

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
  for (const name of ["ResidentEgressRedaction", "ReminderTapProcessDeath", "WorkflowNoticeProcessDeath", "NotificationChannels", "VoicePermissionDenied", "VoicePermissionRevoke", "LocalVoiceRecordingLimit"])
    assert.throws(() => parseInstrumentationArgs(["--classes", name]), /own campaign/);
  // Classes that assume a test-mocks app build are refused without it instead of reporting "skipped".
  assert.throws(() => parseInstrumentationArgs(["--classes", "ConnectionChooser"]), /test-mocks app build/);
  assert.equal(parseInstrumentationArgs(["--test-mocks", "--classes", "ConnectionChooser"]).classes[0], C("ConnectionChooser"));
  // HOME-role classes never run (and so never skip) outside the opt-in phase.
  for (const name of ["LauncherHome", "SettingsRoles"]) assert.throws(() => parseInstrumentationArgs(["--owned-emulator", "--classes", name]), /--home-role/);
  assert.deepEqual(parseInstrumentationArgs(["--owned-emulator", "--home-role", "--classes", "SettingsRoles,LauncherHome"]).classes, [C("SettingsRoles"), C("LauncherHome")]);
  assert.throws(() => parseInstrumentationArgs(["--home-role", "--classes", "LauncherHome"]), /requires --owned-emulator/);
  assert.throws(() => parseInstrumentationArgs(["--owned-emulator", "--home-role", "--variants", "standalone", "--classes", "LauncherHome"]), /launcher variant/);
  assert.throws(() => parseInstrumentationArgs(["--owned-emulator", "--home-role", "--classes", "Shell"]), /no requested class uses the HOME role/);
  assert.throws(() => parseInstrumentationArgs(["--owned-emulator", "--home-role", "--all"]), /cannot be combined with --all/);
  assert.deepEqual(instrumentArgs(C("BrowserPageQuestion")).slice(-6, -1), ["browserPageQuestion", "1", "-e", "class", C("BrowserPageQuestion")]);
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

const ROOTS = ["android/app/src/androidTest/java", "android/app/src/testMocks/androidTest/java"];
const javaFiles = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const file = path.join(dir, entry.name);
  return entry.isDirectory() ? javaFiles(file) : file.endsWith(".java") ? [file] : [];
});
/** Every class under androidTest with at least one @Test method, by simple class name. */
const testClasses = () => new Map(ROOTS.flatMap(javaFiles).filter(file => /^\s*@(?:org\.junit\.)?Test\b/m.test(fs.readFileSync(file, "utf8")) || /[\s;{}]@(?:org\.junit\.)?Test\b/.test(fs.readFileSync(file, "utf8")))
  .map(file => [path.basename(file, ".java"), file]));
const registryName = cls => cls.replace(/InstrumentedTest$/, "");
const gateRead = (source, gate, value) => source.includes(`"${value}".equals(InstrumentationRegistry.getArguments().getString("${gate}")`);

test("every registered class exists in the app's instrumentation sources and declares the gates the runner passes", () => {
  const roots = ROOTS.map(root => path.join(root, "ai/elizaresearch/alphaphone"));
  for (const [name, spec] of Object.entries(CLASS_REGISTRY)) {
    const found = roots.map(root => path.join(root, `${name}InstrumentedTest.java`)).filter(file => fs.existsSync(file));
    assert.equal(found.length, 1, `${name} must be exactly one class in the app instrumentation sources`);
    assert.equal(found[0].includes("testMocks"), spec.testMocks === true, `${name} test-mocks flag must match its source set`);
    const source = fs.readFileSync(found[0], "utf8");
    for (const [gate, value] of Object.entries(spec.args ?? {}))
      assert.ok(gateRead(source, gate, value), `${name} does not read gate ${gate}=${value}`);
    for (const method of spec.phases ?? []) assert.match(source, new RegExp(`void ${method}\\(`), `${name} has no phase ${method}`);
    if (spec.requiresTestMocksBuild) assert.ok(source.includes("BuildConfig.ELIZA_DEV_ALLOW_TEST_MOCKS"), `${name} does not assume a test-mocks app build`);
    if (spec.homeRole) {
      assert.ok(["requests", "held"].includes(spec.homeRole) && source.includes("BuildConfig.IS_LAUNCHER"), `${name} is not a launcher-variant HOME class`);
      // "held" classes must not change the role themselves; "requests" classes must put back what they found.
      if (spec.homeRole === "held") assert.ok(!/add-role-holder|remove-role-holder|set-home-activity/.test(source), `${name} must not change the HOME role`);
      else assert.ok(source.includes("add-role-holder") && /finally\s*\{/.test(source), `${name} must restore the HOME holder it found`);
    }
    if (spec.campaign) {
      // The refusal names a real script, and that script names the class.
      const script = /(?:node|python3) (scripts\/[A-Za-z0-9_./-]+)/.exec(spec.campaign)?.[1];
      assert.ok(script && fs.existsSync(script), `${name} campaign names no existing script: ${spec.campaign}`);
      assert.ok(new RegExp(`\\b${name}InstrumentedTest\\b`).test(fs.readFileSync(script, "utf8")), `${script} does not run ${name}`);
      assert.ok(!spec.args && !spec.phases, `${name} is a campaign; its gates belong to the campaign runner`);
    }
  }
  // A core-loop class with a gate runs its gated methods instead of reporting them skipped.
  assert.deepEqual(instrumentArgs(C("ClockHandoff")).slice(-6, -1), ["clockHandoff", "1", "-e", "class", C("ClockHandoff")]);
  // HostedResultNotice's posted and denied notices need the notification permission set first, so
  // this runner passes neither gate and the permission runner owns both.
  assert.equal(CLASS_REGISTRY.HostedResultNotice.args, undefined);
  for (const scenario of ["notice", "notice-denied"]) assert.equal(permissionCases[scenario].testClass, "HostedResultNoticeInstrumentedTest");
});

test("every @Test class is run by a runner or listed with a reason, and neither list goes stale", () => {
  const classes = testClasses();
  assert.ok(classes.size > 100, "instrumentation sources were found");
  for (const file of CAMPAIGN_RUNNERS) assert.ok(fs.existsSync(file), `campaign runner ${file} is missing`);
  const campaignSources = CAMPAIGN_RUNNERS.map(file => [file, fs.readFileSync(file, "utf8")]);
  const namedBy = cls => campaignSources.filter(([, source]) => new RegExp(`\\b${cls}\\b`).test(source)).map(([file]) => file);
  const unreachable = [], stale = [];
  for (const cls of classes.keys()) {
    const name = registryName(cls);
    const registered = Object.hasOwn(CLASS_REGISTRY, name) && cls.endsWith("InstrumentedTest");
    const campaigns = namedBy(cls);
    const excused = Object.hasOwn(NOT_RUN_BY_A_RUNNER, name);
    if (!registered && !campaigns.length && !excused) unreachable.push(cls);
    if (excused && (registered || campaigns.length)) stale.push(`${cls} (${registered ? "registered" : campaigns.join(", ")})`);
  }
  assert.deepEqual(unreachable, [], "these @Test classes have no runner entry, no campaign and no listed reason; register them in scripts/android-instrumentation.mjs or a campaign runner, or add them to NOT_RUN_BY_A_RUNNER with the reason");
  assert.deepEqual(stale, [], "these classes are run by a runner now; remove them from NOT_RUN_BY_A_RUNNER");
  for (const [name, reason] of Object.entries(NOT_RUN_BY_A_RUNNER)) {
    assert.ok(classes.has(name) || classes.has(`${name}InstrumentedTest`), `NOT_RUN_BY_A_RUNNER lists ${name}, which is not a @Test class`);
    assert.ok(typeof reason === "string" && reason.trim().length >= 40, `NOT_RUN_BY_A_RUNNER.${name} needs a specific reason`);
  }
  // Registry entries must be classes too (the test above checks each file); nothing is registered twice.
  assert.equal(new Set(Object.keys(CLASS_REGISTRY)).size, Object.keys(CLASS_REGISTRY).length);
  // What this package registered stays registered.
  for (const name of ["BrowserPageQuestion", "ConnectionChooser", "LauncherHome", "SettingsRoles", "NotesSecureStorage"]) assert.ok(Object.hasOwn(CLASS_REGISTRY, name), name);
  for (const cls of ["VoicePermissionDeniedInstrumentedTest", "VoicePermissionRevokeInstrumentedTest", "HostedResultNoticeInstrumentedTest", "LocalVoiceRecordingLimitInstrumentedTest"])
    assert.deepEqual(namedBy(cls), ["scripts/test-native-permissions.mjs"], cls);
});

test("permission scenarios name real classes, methods and gates", () => {
  const classes = testClasses();
  for (const [scenario, spec] of Object.entries(permissionCases)) {
    const file = classes.get(spec.testClass);
    assert.ok(file, `${scenario}: ${spec.testClass} is not a @Test class`);
    const source = fs.readFileSync(file, "utf8");
    assert.match(source, new RegExp(`@Test\\s+public void ${spec.method}\\(`), `${scenario}: ${spec.testClass} has no test ${spec.method}`);
    assert.ok(source.includes(`getString("${spec.gate}")`), `${scenario}: ${spec.testClass} does not read ${spec.gate}`);
    if (!spec.revokeWhileRecording) assert.ok(gateRead(source, spec.gate, spec.value), `${scenario}: gate ${spec.gate}=${spec.value} is not what the class checks`);
    for (const [operation, permission] of spec.permissions) {
      assert.ok(["grant", "revoke"].includes(operation));
      assert.ok(fs.readFileSync("android/app/src/main/AndroidManifest.xml", "utf8").includes(`android.permission.${permission}`), `${scenario}: the app does not declare ${permission}`);
    }
  }
  // The microphone scenarios: denied before start, and revoked mid-recording in phases the class implements.
  assert.deepEqual(permissionCases.voice.permissions, [["revoke", "RECORD_AUDIO"]]);
  const revoke = permissionCases["voice-revoke"], source = fs.readFileSync(classes.get(revoke.testClass), "utf8");
  for (const phase of [revoke.value, ...revoke.revokeWhileRecording.phases]) assert.ok(source.includes(`case "${phase}":`), `voice-revoke phase ${phase}`);
  assert.ok(source.includes(`getString("${revoke.revokeWhileRecording.runIdGate}")`));
  assert.equal(revoke.revokeWhileRecording.marker, `files/${/static final String MARKER = "([^"]+)"/.exec(source)[1]}`);
  assert.deepEqual(permissionCases["notice-denied"].permissions, [["revoke", "POST_NOTIFICATIONS"]]);
});

/** A scripted emulator: role state, installs and instrumentation output, with every command recorded. */
function fakeEmulator({ stock = "com.android.launcher3", mode = "pass" } = {}) {
  const state = { holder: stock, activity: `${stock}/.Launcher`, installed: new Map(), commands: [] };
  const sha = file => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  const adb = args => {
    state.commands.push(args.join(" "));
    const text = args.join(" ");
    if (text === "emu avd name") return "fixture-avd\nOK\n";
    if (text.includes("getprop ro.product.cpu.abi")) return "arm64-v8a\n";
    if (text.includes("getprop ro.build.version.sdk")) return "35\n";
    if (text.includes("getprop")) return "1\n";
    if (text.includes("pm list packages")) return [...state.installed.keys()].map(name => `package:${name}`).join("\n");
    if (text.includes("am get-current-user")) return mode === "secondary-user" ? "10\n" : "0\n";
    if (text.includes("get-role-holders")) return `${state.holder}\n`;
    if (text.includes("resolve-activity")) return `priority=0 preferredOrder=0 match=0x108000 specificIndex=-1 isDefault=true\n${state.activity}\n`;
    if (args[0] === "install") { const file = args.at(-1); state.installed.set(file.includes("androidTest") ? `${PACKAGE}.test` : PACKAGE, sha(file)); return "Success\n"; }
    if (text.includes("pm path")) return `package:/data/app/${args.at(-1)}.apk\n`;
    if (text.includes("sha256sum")) return `${state.installed.get(path.basename(args.at(-1), ".apk"))}  ${args.at(-1)}\n`;
    if (args[0] === "uninstall") { state.installed.delete(args[1]); return "Success\n"; }
    if (text.includes("set-home-activity")) {
      const component = args.at(-1);
      if (mode === "select-fails" && component.startsWith(PACKAGE)) return "";
      if (mode === "restore-fails" && !component.startsWith(PACKAGE)) return "";
      state.activity = component; state.holder = component.split("/")[0]; return "Success\n";
    }
    if (text.includes("add-role-holder")) { if (mode !== "restore-fails") { state.holder = args.at(-1); state.activity = `${state.holder}/.Launcher`; } return ""; }
    if (text.includes("dumpsys activity activities")) return `  topResumedActivity=ActivityRecord{1 u0 ${mode === "home-not-resumed" ? `${stock}/.Launcher` : state.activity} t1}\n`;
    if (text.includes("am instrument")) {
      const cls = args[args.indexOf("class") + 1];
      // A role-requesting class that forgets to restore leaves Alpha as HOME.
      if (mode === "requests-leaves-home" && cls === C("SettingsRoles") && !args.includes("log")) { state.holder = PACKAGE; state.activity = `${PACKAGE}/.MainActivity`; }
      return block(cls, "m", 1) + block(cls, "m", 0) + done();
    }
    return "";
  };
  return { state, adb };
}
function apkDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "alpha-home-role-"));
  const sha = bytes => createHash("sha256").update(bytes).digest("hex");
  fs.mkdirSync(path.join(dir, "instrumentation"));
  const manifest = { testMocks: false, results: [], instrumentation: {} };
  for (const variant of ["standalone", "launcher"]) {
    fs.writeFileSync(path.join(dir, `${variant}-debug.apk`), `${variant} app`);
    fs.writeFileSync(path.join(dir, `instrumentation/${variant}-androidTest.apk`), `${variant} test`);
    manifest.results.push({ variant, mode: "debug", sha256: sha(`${variant} app`), versionCode: 7 });
    manifest.instrumentation[variant] = { sha256: sha(`${variant} test`) };
  }
  fs.writeFileSync(path.join(dir, "apk-manifest.json"), JSON.stringify(manifest));
  return dir;
}
const timing = { sleep: () => {}, attempts: 2 };
async function homeRun(mode, extra = []) {
  const dir = apkDir(), emulator = fakeEmulator({ mode });
  try {
    const options = parseInstrumentationArgs(["--owned-emulator", "--avd", "fixture-avd", "--serial", "emulator-5554", "--home-role", "--classes", "Shell,LauncherHome,SettingsRoles", "--apk-dir", dir, "--output", path.join(dir, "out"), ...extra]);
    let result, error;
    try { result = await runLeased({ options, serial: "emulator-5554", adb: emulator.adb, timing }); } catch (failure) { error = failure; }
    const recovery = path.join(dir, "out/home-role-recovery.json");
    return { result, error, ...emulator, recovery: fs.existsSync(recovery) ? JSON.parse(fs.readFileSync(recovery, "utf8")) : null };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const stepsOf = commands => commands.flatMap(command => {
  if (command.startsWith("install")) return [`install ${/(standalone|launcher)-(debug|androidTest)/.exec(command)[0]}`];
  if (command.startsWith("uninstall")) return [command];
  if (command.includes("am instrument") && !command.includes("-e log true")) return [`run ${/alphaphone\.([A-Za-z]+)InstrumentedTest/.exec(command)[1]}`];
  if (command.includes("set-home-activity")) return [`home ${command.split(" ").at(-1)}`];
  if (command.includes("add-role-holder")) return [`role ${command.split(" ").at(-1)}`];
  if (command.includes("KEYCODE_HOME")) return ["HOME key"];
  if (command.includes("am force-stop")) return ["force-stop"];
  return [];
});

test("HOME role phase selects the launcher APK, runs the HOME classes and restores the original holder before uninstalling", async () => {
  const { result, error, state } = await homeRun("pass");
  assert.ifError(error);
  assert.deepEqual(stepsOf(state.commands), [
    // Standalone: only the classes that do not need HOME; LauncherHome and SettingsRoles are not run, so they cannot skip.
    "install standalone-debug", "install standalone-androidTest", "run Shell", `uninstall ${PACKAGE}.test`, `uninstall ${PACKAGE}`,
    // Launcher: ordinary classes, then the class that requests the role itself, then selection and a cold HOME start.
    "install launcher-debug", "install launcher-androidTest", "run Shell", "run SettingsRoles",
    `home ${PACKAGE}/.MainActivity`, "force-stop", "HOME key", "run LauncherHome",
    // The original holder is put back while Alpha is still installed, and only then is Alpha removed.
    "role com.android.launcher3", "home com.android.launcher3/.Launcher", `uninstall ${PACKAGE}.test`, `uninstall ${PACKAGE}`,
  ]);
  assert.equal(result.passed, true);
  assert.deepEqual(result.homeRole, { user: "0", original: { holders: ["com.android.launcher3"], activity: "com.android.launcher3/.Launcher" }, selected: true,
    coldHome: { resumed: true }, restored: true, after: { holders: ["com.android.launcher3"], activity: "com.android.launcher3/.Launcher" } });
  assert.deepEqual(result.classes.map(row => `${row.variant}:${row.class.split(".").pop()}:${row.status}`), [
    "standalone:ShellInstrumentedTest:passed", "launcher:ShellInstrumentedTest:passed", "launcher:SettingsRolesInstrumentedTest:passed", "launcher:LauncherHomeInstrumentedTest:passed"]);
  assert.equal(state.holder, "com.android.launcher3");
  assert.equal(state.installed.size, 0);
});

test("HOME role phase fails and keeps the installation when the original holder cannot be proven restored", async () => {
  const { result, state, recovery } = await homeRun("restore-fails");
  assert.equal(result.passed, false, "every class passed, but the run is not a pass");
  assert.equal(result.homeRole.restored, false);
  assert.deepEqual(result.homeRole.after.holders, [PACKAGE]);
  assert.ok(!stepsOf(state.commands).slice(stepsOf(state.commands).indexOf("run LauncherHome")).some(step => step.startsWith("uninstall")), "nothing is uninstalled after an unproven restoration");
  assert.deepEqual([...state.installed.keys()].sort(), [PACKAGE, `${PACKAGE}.test`]);
  assert.deepEqual(recovery.retainedPackages.sort(), [PACKAGE, `${PACKAGE}.test`]);
  assert.equal(recovery.recover, "adb -s emulator-5554 shell cmd role add-role-holder --user 0 android.app.role.HOME com.android.launcher3");
  assert.deepEqual(recovery.original, { holders: ["com.android.launcher3"], activity: "com.android.launcher3/.Launcher" });
});

test("HOME role phase reports a failed selection or cold start as missing HOME classes and still restores", async () => {
  for (const mode of ["select-fails", "home-not-resumed"]) {
    const { result, state } = await homeRun(mode);
    assert.equal(result.passed, false, mode);
    const launcherHome = result.classes.find(row => row.class === C("LauncherHome"));
    assert.equal(launcherHome.status, "missing", mode);
    assert.match(launcherHome.note, /HOME role phase failed/);
    assert.ok(!stepsOf(state.commands).includes("run LauncherHome"), `${mode}: HOME classes must not run without Alpha as HOME`);
    assert.equal(result.homeRole.restored, true, mode);
    assert.equal(state.holder, "com.android.launcher3", mode);
    assert.equal(state.installed.size, 0, mode);
    assert.match(result.homeRole.error, mode === "select-fails" ? /not selected as HOME/ : /did not bring Alpha to the foreground/);
  }
  // A role-requesting class that leaves HOME changed stops the phase before selection; the original is restored.
  const left = await homeRun("requests-leaves-home");
  assert.equal(left.result.passed, false);
  assert.match(left.result.homeRole.error, /did not restore it/);
  assert.equal(left.result.homeRole.selected, false);
  assert.ok(!stepsOf(left.state.commands).includes("run LauncherHome"));
  assert.equal(left.result.homeRole.restored, true, "the runner puts the original holder back even though it never selected Alpha itself");
  assert.equal(left.state.holder, "com.android.launcher3");
  assert.equal(left.recovery, null);
  assert.equal(left.state.installed.size, 0);
});

test("HOME role admission refuses an emulator without one stock HOME holder, and a secondary foreground user", async () => {
  await assert.rejects(async () => { const { error } = await homeRun("secondary-user"); throw error; }, /primary user/);
  const none = fakeEmulator(); none.state.holder = ""; assert.throws(() => admitHome(none.adb), /one stock HOME app/);
  const alpha = fakeEmulator(); alpha.state.holder = PACKAGE; alpha.state.activity = `${PACKAGE}/.MainActivity`; assert.throws(() => admitHome(alpha.adb), /one stock HOME app/);
  const ready = fakeEmulator();
  const home = admitHome(ready.adb);
  assert.deepEqual(readHome(ready.adb, "0"), home.original);
  // Restoring a HOME that was never selected changes nothing and only reads it back.
  const before = ready.state.commands.length;
  assert.equal(restoreHome(ready.adb, home, timing).restored, true);
  assert.ok(ready.state.commands.slice(before).every(command => /get-role-holders|resolve-activity/.test(command)));
  selectAlphaHome(ready.adb, home, timing);
  assert.equal(ready.state.holder, PACKAGE);
  assert.equal(restoreHome(ready.adb, home, timing).restored, true);
  assert.equal(ready.state.holder, "com.android.launcher3");
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
  const loop = runner.slice(runner.indexOf("const runClass = cls =>"));
  assert.ok(loop.indexOf("classIsolationCommands()") > 0 && loop.indexOf("classIsolationCommands()") < loop.indexOf("spec.phases"), "isolation runs once per class, before its phases");
});

test("classes that assert a secondary user are refused, and declared permissions are granted after isolation", () => {
  // First run: HostedProcessRestart (then a default class) and HostedBackgroundWorker received their
  // gates and failed on "Disposable secondary user required"; WorkflowApprovalNotice failed to post
  // because nothing had granted the notification permission its fixture requires.
  for (const name of ["HostedProcessRestart", "HostedBackgroundWorker"]) {
    assert.equal(CLASS_REGISTRY[name].secondaryUser, true);
    assert.throws(() => parseInstrumentationArgs(["--classes", name]), /secondary Android user/);
    assert.ok(!DEFAULT_CLASSES.includes(name), `${name} cannot be a default class`);
    const source = fs.readFileSync(`android/app/src/androidTest/java/ai/elizaresearch/alphaphone/${name}InstrumentedTest.java`, "utf8");
    assert.match(source, /isSystemUser\(\)/, `${name} still asserts a secondary user`);
  }
  assert.doesNotThrow(() => parseInstrumentationArgs([]));
  assert.deepEqual(CLASS_REGISTRY.WorkflowApprovalNotice.grant, ["POST_NOTIFICATIONS"]);
  const runner = fs.readFileSync("scripts/android-instrumentation.mjs", "utf8");
  const body = runner.slice(runner.indexOf("const runClass = cls =>"));
  assert.ok(body.indexOf("classIsolationCommands()") < body.indexOf("spec.grant"), "grants follow the data clear, which revokes them");
  assert.match(body, /-listing\.txt/);
});
