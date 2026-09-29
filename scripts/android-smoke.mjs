import fs from "node:fs";
import path from "node:path";
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
  execFileSync(adb, ["-s", serial, ...args], { encoding: "utf8", env });
const original = run(
  "shell",
  "cmd",
  "role",
  "get-role-holders",
  "android.app.role.HOME",
).trim();
const results = [];
fs.mkdirSync("test-results/android", { recursive: true });
for (const name of [
  "result.json",
  "failure-activity.txt",
  "failure-crashes.txt",
  ...["standalone", "launcher"].flatMap((variant) => [
    `${variant}-instrumentation.txt`,
    `${variant}-activity.txt`,
    `${variant}.png`,
  ]),
]) {
  fs.rmSync(path.join("test-results/android", name), { force: true });
}
let failure;
try {
  for (const variant of ["standalone", "launcher"]) {
    run("install", "-r", `artifacts/${variant}-debug.apk`);
    run(
      "install",
      "-r",
      `android/app/build/outputs/apk/androidTest/${variant}/debug/app-${variant}-debug-androidTest.apk`,
    );
    const instrumentation = run(
      "shell",
      "am",
      "instrument",
      "-w",
      `${identity.appId}.test/androidx.test.runner.AndroidJUnitRunner`,
    );
    fs.writeFileSync(
      `test-results/android/${variant}-instrumentation.txt`,
      instrumentation,
    );
    if (
      !/OK \(1 test\)/.test(instrumentation) ||
      /FAILURES|INSTRUMENTATION_FAILED/.test(instrumentation)
    )
      throw new Error(instrumentation);
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
    // Let the newly started WebView finish its first paint and native app query.
    // The instrumentation above separately asserts renderer/bridge readiness.
    run("shell", "sleep", "3");
    fs.writeFileSync(`test-results/android/${variant}-activity.txt`, activity);
    fs.writeFileSync(
      `test-results/android/${variant}.png`,
      execFileSync(adb, ["-s", serial, "exec-out", "screencap", "-p"], { env }),
    );
    results.push({
      variant,
      instrumentation: "passed",
      homeRole: variant === "launcher",
      resumed: true,
    });
  }
} catch (error) {
  failure = error;
  try {
    fs.writeFileSync(
      "test-results/android/failure-activity.txt",
      run("shell", "dumpsys", "activity", "activities"),
    );
    fs.writeFileSync(
      "test-results/android/failure-crashes.txt",
      run("logcat", "-d", "-b", "crash"),
    );
  } catch (captureError) {
    console.error(
      "Could not collect failure diagnostics:",
      captureError.message,
    );
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
if (failure) throw failure;
fs.writeFileSync(
  "test-results/android/result.json",
  JSON.stringify(
    { serial, createdAt: new Date().toISOString(), results },
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify(results, null, 2));
