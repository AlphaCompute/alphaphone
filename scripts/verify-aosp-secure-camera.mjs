// Read-only secure-camera admission of a booted Alpha AOSP image (policy P-23, issue #407).
// Usage: ANDROID_SERIAL=<serial> node scripts/verify-aosp-secure-camera.mjs --user <id>
// Proves handler routing and settings only; locked capture, isolation and unlock/return
// behaviour remain device acceptance by a person.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { androidEnv } from "./toolchain.mjs";
import { verifyAospSecureCamera } from "./aosp-secure-camera-contract.mjs";

const serial = process.env.ANDROID_SERIAL;
if (!serial || !/^[A-Za-z0-9_.:-]+$/.test(serial)) throw Error("Explicit ANDROID_SERIAL required");
const args = process.argv.slice(2);
const userIndex = args.indexOf("--user");
if (userIndex < 0 || args.length !== 2) throw Error("Use --user ANDROID_USER_ID");
const identity = JSON.parse(fs.readFileSync("app.config.json", "utf8"));
const env = androidEnv();
const adb = path.join(env.ANDROID_HOME, "platform-tools/adb");
const run = (...cmd) => execFileSync(adb, ["-s", serial, ...cmd], {
  encoding: "utf8", env, timeout: 10_000, maxBuffer: 128 * 1024,
});
console.log(JSON.stringify(verifyAospSecureCamera(run, args[userIndex + 1], identity.appId), null, 2));
