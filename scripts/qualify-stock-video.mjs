// Product video acceptance on the unchanged AOSP provider, before the separate
// development provider qualifies isolated-browser APIs. Never runs on user devices.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { androidEnv } from "./toolchain.mjs";
import { requireVideoCases } from "./stock-video-evidence.mjs";
import { requireHostedFixtureEnvironment, assertFixtureIdentity, requireFixtureDisplay } from "../vendor/eliza/packages/app/scripts/mobile/android/hosted-fixture/ci-emulator-display.mjs";
const serial = process.env.ANDROID_SERIAL;
requireHostedFixtureEnvironment(process.env, serial);
const env = androidEnv();
const adb = path.join(env.ANDROID_HOME, "platform-tools/adb");
const run = (...args) => execFileSync(adb, ["-s", serial, ...args], {
  encoding: "utf8", env, timeout: args.includes("instrument") ? 600000 : 120000,
});
assertFixtureIdentity(run, { fresh: true });
const { appId } = JSON.parse(fs.readFileSync("app.config.json"));
if (!/^[a-z][a-z0-9_.]+$/.test(appId)) throw new Error("Invalid package identity");
const archive = process.env.ALPHA_BUILD_ARCHIVE;
if (!archive || !process.env.GITHUB_RUN_ID || !process.env.GITHUB_RUN_ATTEMPT) throw new Error("Same-run immutable APK bundle required");
const manifest = JSON.parse(fs.readFileSync(path.join(archive, "apk-manifest.json")));
const artifactHashes = {};
for (const variant of ["standalone", "launcher"]) for (const kind of ["debug", "androidTest"]) {
  const name = `${variant}-${kind}.apk`;
  const digest = crypto.createHash("sha256").update(fs.readFileSync(path.join(archive, name))).digest("hex");
  if (manifest[name] !== digest) throw new Error(`Archive hash mismatch: ${name}`);
  artifactHashes[name] = digest;
}
const installed = () => run("shell", "pm", "list", "packages").trim().split(/\r?\n/);
if (installed().some(row => [appId, `${appId}.test`].some(id => row === `package:${id}`))) throw new Error("Fresh fixture must not contain product packages");
function provider() {
  const state = run("shell", "dumpsys", "webviewupdate");
  const version = /Current WebView package \(name, version\): \(com\.android\.webview, (124\.[0-9.]+)\)/.exec(state)?.[1];
  const location = run("shell", "pm", "path", "com.android.webview").trim();
  if (!version || !/^package:\/product\/app\/webview\/[A-Za-z0-9_.-]+\.apk$/.test(location)) throw new Error("Unchanged stock124 WebView required");
  const sha256 = run("shell", "sha256sum", location.slice(8)).trim().split(/\s+/)[0];
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error("Stock provider hash missing");
  return { package: "com.android.webview", version, sha256 };
}
const output = "test-results/stock-video";
fs.mkdirSync(output); // Refuse stale evidence reuse.
const receipt = { status: "running", serial, runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT, provider: provider(), artifactHashes, variants: {}, cleanupVerified: false };
const save = () => fs.writeFileSync(path.join(output, "result.json"), JSON.stringify(receipt, null, 2) + "\n");
save();
let failure;
try {
  for (const variant of ["standalone", "launcher"]) {
    await requireFixtureDisplay(run, { serial });
    run("install", "-r", path.join(archive, `${variant}-debug.apk`));
    run("install", "-r", path.join(archive, `${variant}-androidTest.apk`));
    let instrumentation;
    try { instrumentation = run("shell", "am", "instrument", "-w", "-r", "-e", "class", `${appId}.VideoInstrumentedTest`, `${appId}.test/androidx.test.runner.AndroidJUnitRunner`); }
    catch (error) { fs.writeFileSync(path.join(output, `${variant}-instrumentation.txt`), error.stdout ?? ""); throw error; }
    fs.writeFileSync(path.join(output, `${variant}-instrumentation.txt`), instrumentation);
    receipt.variants[variant] = { instrumentation, counts: requireVideoCases(instrumentation, appId) };
    save();
  }
  if (JSON.stringify(provider()) !== JSON.stringify(receipt.provider)) throw new Error("Stock provider changed during video qualification");
} catch (error) { failure = error; receipt.error = error.message; }
finally {
  // Only packages admitted absent above can be removed from this fresh CI AVD.
  for (const id of [`${appId}.test`, appId]) {
    if (!installed().includes(`package:${id}`)) continue;
    try { if (run("uninstall", id).trim() !== "Success") throw new Error(`Could not remove ${id}`); }
    catch (error) { failure ??= error; receipt.cleanupError = error.message; }
  }
  receipt.cleanupVerified = !installed().some(row => [appId, `${appId}.test`].some(id => row === `package:${id}`));
  if (!receipt.cleanupVerified) failure ??= new Error("Product cleanup unverified");
  receipt.status = failure ? "failed" : "passed";
  save();
}
if (failure) throw failure;
