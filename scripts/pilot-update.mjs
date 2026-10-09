#!/usr/bin/env node
/**
 * Update a provisioned pilot unit in place with a higher-versionCode signed APK.
 *
 *   node scripts/pilot-update.mjs --serial <adb serial> --alias <unit-name> \
 *     --apk-manifest <new build>/apk-manifest.json [--variant launcher|standalone] \
 *     [--build release|debug] [--units test-results/pilot-units]
 *
 * Generalizes scripts/test-installed-upgrade.mjs from one domain to the whole app:
 *  1. admit the new APK (as provision-unit.mjs does) and the unit's provisioning record;
 *  2. require the installed signer to equal the new APK's signer (the pulled installed
 *     APK is digested with apksigner) and the new versionCode to be greater;
 *  3. stop the app and read back every app-data domain (files, no_backup, databases,
 *     shared_prefs, app_webview, ...) as per-file SHA-256 inventories;
 *  4. `adb install -r` (data kept), then read back again without launching the app:
 *     the package uid and first-install time must be unchanged and every domain
 *     byte-identical. The app is not started in between, so nothing may change.
 * Readback uses run-as, which Android allows only for debuggable builds. A release
 * unit therefore gets the package-identity readback only and the record says so;
 * full data readback on a release needs the in-app export check (not built yet).
 *
 * Rollback is not offered: a lower versionCode cannot replace an install without
 * erasing data, and the rollback design (A-06) is still blocked.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { signerDigest } from "./apk.mjs";
import { adbFor, admitUnitApk, deviceFacts, installedApkSha256, PACKAGE, packageFacts, parseUnitArgs } from "./provision-unit.mjs";

const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

/** Parse `sha256sum` lines from run-as into { domain: { file: digest } }. */
export function parseDomainInventory(output) {
  const domains = {};
  for (const line of output.split(/\r?\n/)) {
    const match = /^([0-9a-f]{64})\s+\.\/(\S.*)$/.exec(line.trim());
    if (!match) continue;
    const [, digest, file] = match;
    const domain = file.includes("/") ? file.slice(0, file.indexOf("/")) : ".";
    (domains[domain] ??= {})[file] = digest;
  }
  return domains;
}

/** Compare two domain inventories; returns human-readable differences. */
export function compareDomains(before, after) {
  const problems = [];
  for (const domain of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const a = before[domain] ?? {}, b = after[domain] ?? {};
    for (const file of Object.keys(a)) if (!(file in b)) problems.push(`${file} was lost`);
      else if (a[file] !== b[file]) problems.push(`${file} changed`);
    for (const file of Object.keys(b)) if (!(file in a)) problems.push(`${file} appeared`);
  }
  return problems.sort();
}

export function updateAdmission({ installedVersionCode, installedSigner, newVersionCode, newSigner }) {
  const problems = [];
  if (!Number.isInteger(installedVersionCode) || !Number.isInteger(newVersionCode) || newVersionCode <= installedVersionCode)
    problems.push(`new versionCode ${newVersionCode} must be greater than the installed ${installedVersionCode}`);
  if (!installedSigner || installedSigner !== newSigner) problems.push(`new signer ${newSigner ?? "none"} differs from the installed ${installedSigner ?? "unknown"}`);
  return problems;
}

/** Both variants share one package id, so an update never switches the unit's variant or build type. */
export function unitApkMismatch(unit, apk) {
  if (unit?.apk?.variant === apk.variant && unit?.apk?.build === apk.build) return null;
  return `provisioned with the ${unit?.apk?.variant ?? "unknown"} ${unit?.apk?.build ?? "unknown"} APK, not ${apk.variant} ${apk.build}; pass the same --variant and --build`;
}

// Excludes caches and code-cache, which Android may clear at any time. adb joins the
// arguments into one device-shell command line, so the script is one single-quoted word
// whose patterns use double quotes (never globbed by either shell), and it ends with the
// inner exit status so a failed walk can never read as an empty, unchanged inventory.
export const DOMAIN_SCRIPT = 'find . -type f ! -path "./cache/*" ! -path "./code_cache/*" -exec sha256sum {} + ; echo "READBACK_EXIT=$?"';

/** Parse one readback; null when run-as is refused (non-debuggable), throws when the walk failed. */
export function readbackInventory(output) {
  if (/run-as: package not debuggable|is not debuggable|Package .* is unknown/.test(output)) return null;
  const exit = /^READBACK_EXIT=(\d+)\s*$/m.exec(output)?.[1];
  if (exit !== "0") throw new Error(`App-data readback failed (exit ${exit ?? "missing"}): ${output.trim().split(/\r?\n/).slice(-3).join(" | ")}`);
  return parseDomainInventory(output);
}

function readDomains(adb) {
  return readbackInventory(adb(["shell", "run-as", PACKAGE, "sh", "-c", `'${DOMAIN_SCRIPT}'`], { allowFailure: true, withStderr: true }));
}

async function main() {
  const argv = process.argv.slice(2);
  const unitsIndex = argv.findIndex(arg => arg === "--units" || arg.startsWith("--units="));
  let units = "test-results/pilot-units";
  if (unitsIndex >= 0) { units = argv[unitsIndex].includes("=") ? argv[unitsIndex].split("=")[1] : argv[unitsIndex + 1]; argv.splice(unitsIndex, argv[unitsIndex].includes("=") ? 1 : 2); }
  const options = parseUnitArgs(argv);
  const recordFile = path.resolve(units, `${options.alias}.json`);
  if (!fs.existsSync(recordFile)) throw new Error(`${recordFile} is missing; provision the unit with scripts/provision-unit.mjs first`);
  const unit = JSON.parse(fs.readFileSync(recordFile, "utf8"));
  const apk = admitUnitApk(options.apkManifest, options);
  const mismatch = unitApkMismatch(unit, apk);
  if (mismatch) throw new Error(`Unit ${options.alias}: ${mismatch}`);
  const adb = adbFor(options.serial);
  const device = deviceFacts(adb, options.serial);
  if (device.serialSha256 !== unit.device?.serialSha256) throw new Error(`Serial does not belong to unit ${options.alias}`);
  if (apk.rehearsal && !device.emulator) throw new Error("--build debug is an emulator rehearsal only");

  const before = packageFacts(adb(["shell", "dumpsys", "package", PACKAGE]));
  const pulled = fs.mkdtempSync(path.join(os.tmpdir(), "alpha-installed-"));
  let installedSigner;
  try {
    const apkPath = /^package:(\/\S+\.apk)$/m.exec(adb(["shell", "pm", "path", PACKAGE]))?.[1];
    if (!apkPath) throw new Error("Alpha Phone is not installed on this unit");
    adb(["pull", apkPath, path.join(pulled, "installed.apk")], { timeout: 600_000 });
    installedSigner = signerDigest(path.join(pulled, "installed.apk"));
  } finally { fs.rmSync(pulled, { recursive: true, force: true }); }
  const newSigner = signerDigest(apk.file);
  const problems = updateAdmission({ installedVersionCode: before.versionCode, installedSigner, newVersionCode: apk.versionCode, newSigner });
  if (problems.length) throw new Error(`Update refused: ${problems.join("; ")}`);

  adb(["shell", "am", "force-stop", PACKAGE]);
  const domainsBefore = readDomains(adb);
  adb(["install", "-r", apk.file], { timeout: 600_000 });
  const after = packageFacts(adb(["shell", "dumpsys", "package", PACKAGE]));
  const installedSha256 = installedApkSha256(adb);
  const domainsAfter = domainsBefore ? readDomains(adb) : null;
  const failures = [];
  if (installedSha256 !== apk.sha256) failures.push("installed bytes differ from the admitted APK");
  if (after.versionCode !== apk.versionCode) failures.push(`installed versionCode ${after.versionCode} is not ${apk.versionCode}`);
  if (after.userId !== before.userId) failures.push("package uid changed (data would be unreachable)");
  if (after.firstInstallTime !== before.firstInstallTime) failures.push("first-install time changed (the update replaced the install)");
  if (domainsBefore) {
    // An empty inventory would make the byte-identical check vacuous.
    if (!Object.values(domainsBefore).some(files => Object.keys(files).length)) failures.push("no app data was found before the update; the readback proves nothing");
    failures.push(...compareDomains(domainsBefore, domainsAfter ?? {}));
  }
  const update = {
    createdAt: new Date().toISOString(),
    from: { versionCode: before.versionCode, versionName: before.versionName, signerSha256: installedSigner },
    to: { versionCode: apk.versionCode, versionName: apk.versionName, sha256: apk.sha256, signerSha256: newSigner, build: apk.build },
    packageIdentityPreserved: after.userId === before.userId && after.firstInstallTime === before.firstInstallTime,
    dataReadback: domainsBefore
      ? { method: "run-as per-file SHA-256", domains: Object.fromEntries(Object.entries(domainsBefore).map(([domain, files]) => [domain, Object.keys(files).length])) }
      : { method: "unavailable", reason: "run-as is refused for a non-debuggable release; only package identity was read back" },
    failures,
    passed: failures.length === 0,
    rollback: "not offered (A-06 rollback design blocked)",
  };
  unit.updates = [...(unit.updates ?? []), update];
  fs.writeFileSync(recordFile, `${JSON.stringify(unit, null, 2)}\n`);
  console.log(`${options.alias}: ${update.passed ? "updated" : "UPDATE FAILED"} ${update.from.versionCode} -> ${update.to.versionCode}; ${domainsBefore ? `${Object.keys(domainsBefore).length} data domains byte-identical` : "package identity readback only"}${failures.length ? `\n  ${failures.join("\n  ")}` : ""}`);
  process.exitCode = update.passed ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
export { sha256 };
