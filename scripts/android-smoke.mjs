import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { androidEnv } from "./toolchain.mjs";
const env = androidEnv();
const serial = process.env.ANDROID_SERIAL;
if (!serial || !serial.startsWith("emulator-"))
  throw new Error(
    "Set ANDROID_SERIAL to a disposable emulator; this test changes its HOME role.",
  );
const identity = JSON.parse(fs.readFileSync("app.config.json"));
const adb = path.join(env.ANDROID_HOME, "platform-tools/adb");
const run = (...args) =>
  execFileSync(adb, ["-s", serial, ...args], {
    encoding: "utf8", env,
    timeout: args.includes("instrument") ? 600000 : args[0] === "install" ? 120000 : 30000,
  });
const original = run(
  "shell",
  "cmd",
  "role",
  "get-role-holders",
  "android.app.role.HOME",
).trim();
const archive = process.env.ALPHA_BUILD_ARCHIVE;
const output = process.env.ALPHA_SMOKE_RESULTS || "test-results/android";
const archivedManifest = archive ? JSON.parse(fs.readFileSync(path.join(archive, "apk-manifest.json"))) : null;
const artifactHashes = {};
if (archive) for (const variant of ["standalone", "launcher"]) for (const suffix of ["debug", "androidTest"]) {
  const name = `${variant}-${suffix}.apk`;
  const digest = crypto.createHash("sha256").update(fs.readFileSync(path.join(archive, name))).digest("hex");
  if (digest !== archivedManifest[name]) throw new Error(`Archive hash mismatch: ${name}`);
  artifactHashes[name] = digest;
}
const results = [];
const instrumentationFailures = [];
fs.mkdirSync(output, { recursive: true });
for (const name of [
  "result.json",
  "failure-activity.txt",
  "failure-crashes.txt",
  "failure-power.txt",
  "failure-window-policy.txt",
  "failure-display.txt",
  "failure-battery.txt",
  ...["standalone", "launcher"].flatMap((variant) => [
    `${variant}-instrumentation.txt`,
    `${variant}-instrumentation-stderr.txt`,
    `${variant}-instrumentation-command.json`,
    `${variant}-cases.json`,
    `${variant}-activity.txt`,
    `${variant}-hierarchy.xml`,
    `${variant}.png`,
  ]),
]) {
  fs.rmSync(path.join(output, name), { force: true });
}
let failure;
try {
  for (const variant of ["standalone", "launcher"]) {
    run("install", "-r", archive ? path.join(archive, `${variant}-debug.apk`) : `artifacts/${variant}-debug.apk`);
    run(
      "install",
      "-r",
      archive ? path.join(archive, `${variant}-androidTest.apk`) : `android/app/build/outputs/apk/androidTest/${variant}/debug/app-${variant}-debug-androidTest.apk`,
    );
    let instrumentation;
    const instrumentationStarted = Date.now();
    try {
      instrumentation = run(
        "shell", "am", "instrument", "-w", "-r",
        `${identity.appId}.test/androidx.test.runner.AndroidJUnitRunner`,
      );
      fs.writeFileSync(`${output}/${variant}-instrumentation.txt`, instrumentation);
    } catch (error) {
      // execFileSync carries complete partial output even when the command times
      // out. Preserve it before rethrowing; never turn a timeout into a pass.
      fs.writeFileSync(`${output}/${variant}-instrumentation.txt`, error.stdout ?? "");
      fs.writeFileSync(`${output}/${variant}-instrumentation-stderr.txt`, error.stderr ?? "");
      fs.writeFileSync(`${output}/${variant}-instrumentation-command.json`, JSON.stringify({
        variant, deadlineMs: 600000, elapsedMs: Date.now() - instrumentationStarted,
        code: error.code ?? null, status: error.status ?? null, signal: error.signal ?? null,
        completed: false,
      }, null, 2) + "\n");
      throw error;
    }
    const terminalCases = [];
    let statusBlock = "";
    for (const line of instrumentation.split("\n")) {
      const code = /^INSTRUMENTATION_STATUS_CODE: (-?\d+)\s*$/.exec(line);
      if (!code) { statusBlock += line + "\n"; continue; }
      const testClass = /^INSTRUMENTATION_STATUS: class=(.+)$/m.exec(statusBlock)?.[1];
      const testMethod = /^INSTRUMENTATION_STATUS: test=(.+)$/m.exec(statusBlock)?.[1];
      const value = Number(code[1]);
      if (testClass && testMethod && value <= 0)
        terminalCases.push({ selector: `${testClass}#${testMethod}`, code: value });
      statusBlock = "";
    }
    const testCounts = {
      passed: terminalCases.filter(row => row.code === 0).length,
      failed: terminalCases.filter(row => row.code === -1 || row.code === -2).length,
      ignored: terminalCases.filter(row => row.code === -3).length,
      assumptionSkipped: terminalCases.filter(row => row.code === -4).length,
      unknown: terminalCases.filter(row => ![0,-1,-2,-3,-4].includes(row.code)).length,
    };
    const reportedCount = Number(/(?:OK \(|Tests run: )(\d+)/.exec(instrumentation)?.[1]);
    const countsVerified = Number.isSafeInteger(reportedCount) && reportedCount > 0 &&
      reportedCount === terminalCases.length &&
      new Set(terminalCases.map(row => row.selector)).size === terminalCases.length &&
      testCounts.unknown === 0;
    fs.writeFileSync(`${output}/${variant}-cases.json`, JSON.stringify({reportedCount, countsVerified, testCounts, terminalCases}, null, 2));
    const instrumentationPassed = countsVerified && /OK \([1-9]\d* tests?\)/.test(instrumentation) &&
      !/FAILURES|INSTRUMENTATION_FAILED/.test(instrumentation);
    if (!instrumentationPassed) {
      instrumentationFailures.push(variant);
      console.error(`${variant} instrumentation failed; preserving its log and checking the other distribution variant.`);
    }
    // Instrumentation owns the prior process. Exercise a fresh normal launch.
    run("shell", "am", "force-stop", identity.appId);
    if (variant === "launcher") {
      run(
        "shell",
        "cmd",
        "package",
        "set-home-activity",
        `${identity.appId}/.MainActivity`,
      );
      const held = run(
        "shell",
        "cmd",
        "role",
        "get-role-holders",
        "android.app.role.HOME",
      ).trim();
      if (held !== identity.appId)
        throw new Error(`HOME role not held: ${held}`);
      run("shell", "input", "keyevent", "KEYCODE_HOME");
    } else
      run(
        "shell",
        "am",
        "start",
        "-W",
        "-n",
        `${identity.appId}/.MainActivity`,
      );
    let activity = "";
    let resumed = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      activity = run("shell", "dumpsys", "activity", "activities");
      resumed = activity
        .split("\n")
        .some(
          (line) =>
            /mResumedActivity|topResumedActivity/.test(line) &&
            line.includes(identity.appId),
        );
      if (resumed) break;
      run("shell", "sleep", "0.5");
    }
    if (!resumed) throw new Error("App not resumed after HOME/start");
    // Foreground activity alone does not prove a rendered HOME screen. Require
    // the product's accessible content after the fresh start before capturing.
    const markers = ["Open conversation", "Calendar", "Camera", "Notes", "Settings"];
    let hierarchy = "";
    let rendered = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      const remote = "/sdcard/launcher-smoke-hierarchy.xml";
      run("shell", "uiautomator", "dump", remote);
      hierarchy = run("shell", "cat", remote);
      if (markers.every(marker => hierarchy.includes(`text="${marker}"`) || hierarchy.includes(`content-desc="${marker}"`))) { rendered = true; break; }
      run("shell", "sleep", "0.5");
    }
    fs.writeFileSync(`${output}/${variant}-hierarchy.xml`, hierarchy);
    if (!rendered) throw new Error("Foreground app did not render its accessible home content");
    fs.writeFileSync(`${output}/${variant}-activity.txt`, activity);
    fs.writeFileSync(
      `${output}/${variant}.png`,
      execFileSync(adb, ["-s", serial, "exec-out", "screencap", "-p"], { env }),
    );
    results.push({
      variant,
      instrumentation: instrumentationPassed ? "passed" : "failed",
      testCounts,
      countsVerified,
      homeRole: variant === "launcher",
      resumed: true,
      rendered: true,
    });
  }
} catch (error) {
  failure = error;
  const diagnostics = {
    "failure-activity.txt": ["shell", "dumpsys", "activity", "activities"],
    "failure-crashes.txt": ["logcat", "-d", "-b", "crash"],
    "failure-power.txt": ["shell", "dumpsys", "power"],
    "failure-window-policy.txt": ["shell", "dumpsys", "window", "policy"],
    "failure-display.txt": ["shell", "dumpsys", "display"],
    "failure-battery.txt": ["shell", "dumpsys", "battery"],
  };
  for (const [name, args] of Object.entries(diagnostics)) {
    try { fs.writeFileSync(path.join(output, name), run(...args)); }
    catch (captureError) { console.error(`Could not collect ${name}:`, captureError.message); }
  }
} finally {
  if (original) {
    try {
      run(
        "shell",
        "cmd",
        "role",
        "add-role-holder",
        "android.app.role.HOME",
        original,
      );
    } catch (restoreError) {
      if (failure)
        console.error("HOME restoration also failed:", restoreError.message);
      else failure = restoreError;
    }
  }
}
fs.writeFileSync(
  path.join(output, "result.json"),
  JSON.stringify(
    { serial, archive, artifactHashes, createdAt: new Date().toISOString(), results,
      status: failure || instrumentationFailures.length ? "failed" : "passed",
      ...(failure ? { error: failure.message } : {}) },
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify(results, null, 2));
if (failure) throw failure;
if (instrumentationFailures.length)
  throw new Error(`Instrumentation failed for ${instrumentationFailures.join(", ")}; see the preserved per-variant logs.`);
