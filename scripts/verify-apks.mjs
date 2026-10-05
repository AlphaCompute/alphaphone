/**
 * Verify the four APKs of one build and record the result in apk-manifest.json.
 *
 *   node scripts/verify-apks.mjs [--test-mocks] [--allow-unpackaged-runtime]
 *
 * Default: the distribution APKs in artifacts/. They must be flag-off
 * (testMocks:false), pass the shared production bundle audit, carry no
 * development hooks, and releases must package the authenticated resident
 * runtime. --allow-unpackaged-runtime is a developer option that records such
 * releases as distributable:false instead of failing.
 * --test-mocks: the separate artifacts/test-mocks/ build, which is never
 * distributable. This is APK-build evidence only; it does not install or run
 * anything.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  auditBundle, distributionProblems, extractWebPayload, readBuildFlags, signerDigest, validateApk,
} from "./apk.mjs";
import { androidEnv, tool } from "./toolchain.mjs";

const USAGE = "Usage: node scripts/verify-apks.mjs [--test-mocks] [--allow-unpackaged-runtime]";
const args = process.argv.slice(2);
for (const arg of args)
  if (!["--test-mocks", "--allow-unpackaged-runtime"].includes(arg)) throw new Error(`Unknown option ${arg}. ${USAGE}`);
const testMocks = args.includes("--test-mocks");
const allowUnpackaged = args.includes("--allow-unpackaged-runtime");
const directory = testMocks ? "artifacts/test-mocks" : "artifacts";
const manifestFile = path.join(directory, "apk-manifest.json");
// Never leave an older passing manifest beside APKs that failed verification.
fs.rmSync(manifestFile, { force: true });

const identity = JSON.parse(fs.readFileSync("app.config.json"));
const buildRecordFile = path.join(directory, "build-config.json");
const buildRecord = fs.existsSync(buildRecordFile) ? JSON.parse(fs.readFileSync(buildRecordFile, "utf8")) : null;
if (buildRecord && buildRecord.testMocks !== testMocks)
  throw new Error(`${buildRecordFile} records testMocks=${buildRecord.testMocks}; refusing to verify it as testMocks=${testMocks}`);

function releaseFile(dir, variant) {
  const signed = path.join(dir, `${variant}-release.apk`);
  const unsigned = path.join(dir, `${variant}-release-unsigned.apk`);
  const present = [signed, unsigned].filter(file => fs.existsSync(file));
  if (present.length !== 1)
    throw new Error(`Expected exactly one ${variant} release APK in ${dir}, found ${present.length ? present.join(", ") : "none"}`);
  return { file: present[0], signed: present[0] === signed };
}

const results = [];
const failures = [];
for (const variant of ["standalone", "launcher"])
  for (const mode of ["debug", "release"]) {
    const { file, signed } = mode === "release"
      ? releaseFile(directory, variant)
      : { file: path.join(directory, `${variant}-debug.apk`), signed: true };
    if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
    const d = validateApk(file, identity, variant === "launcher");
    if (d.debuggable !== (mode === "debug"))
      throw new Error(`Wrong debug flag: ${file}`);
    const { facts, problems } = distributionProblems(d, { mode, testMocks });
    // Shared web bundle audit on the exact packaged payload.
    const payload = extractWebPayload(file);
    let flags;
    try {
      flags = readBuildFlags(payload.public);
      if (flags.testMocks !== testMocks)
        problems.push(`Packaged web bundle has testMocks=${flags.testMocks}; expected ${testMocks}`);
      auditBundle(payload.public, { testMocks });
    } catch (error) {
      problems.push(error.message);
    } finally {
      fs.rmSync(payload.root, { recursive: true, force: true });
    }
    let signerSha256 = null;
    if (signed) {
      try { signerSha256 = signerDigest(file); }
      catch (error) { problems.push(`apksigner verify failed for ${file}: ${error.message}`); }
    }
    if (problems.length) failures.push(`${file}:\n  - ${problems.join("\n  - ")}`);
    const { badging, xml, names, dexClasses, ...record } = d;
    results.push({
      ...record,
      variant,
      mode,
      versionCode: facts.versionCode,
      versionName: facts.versionName,
      signed,
      signerSha256,
      exportedComponents: facts.exported.map(component => component.name).sort(),
      testMocks: flags?.testMocks ?? null,
      bundleAudit: problems.length ? "failed" : "passed",
    });
  }
if (failures.length)
  throw new Error(`APK distribution verification failed:\n${failures.join("\n")}`);

// One product version across the four APKs, matching an explicit override.
const versions = new Set(results.map(row => `${row.versionCode}/${row.versionName}`));
if (versions.size !== 1) throw new Error(`APK versions differ: ${[...versions].join(", ")}`);
const { versionCode, versionName } = results[0];
if (process.env.ELIZAOS_VERSION_CODE && String(versionCode) !== process.env.ELIZAOS_VERSION_CODE)
  throw new Error(`versionCode ${versionCode} does not match ELIZAOS_VERSION_CODE=${process.env.ELIZAOS_VERSION_CODE}`);
if (process.env.ELIZAOS_VERSION_NAME && versionName !== process.env.ELIZAOS_VERSION_NAME)
  throw new Error(`versionName ${versionName} does not match ELIZAOS_VERSION_NAME=${process.env.ELIZAOS_VERSION_NAME}`);

// Standalone and launcher must share a signer per build type.
for (const mode of ["debug", "release"]) {
  const rows = results.filter(row => row.mode === mode);
  if (rows.some(row => row.signed) && new Set(rows.map(row => row.signerSha256)).size !== 1)
    throw new Error(`Standalone and launcher ${mode} APKs do not share one signer: ${rows.map(row => `${row.file}=${row.signerSha256 ?? "unsigned"}`).join(", ")}`);
}
const release = results.filter(row => row.mode === "release");
if (release.some(row => row.signed) && !release.every(row => row.signed))
  throw new Error("Only one release APK is signed");

// Debug keeps the original report-only semantics; releases need the runtime.
const runtimeArgs = [
  ...(allowUnpackaged || testMocks ? ["--allow-unpackaged-runtime"] : []),
  ...release.flatMap(row => ["--release", row.file]),
  ...results.filter(row => row.mode === "debug").map(row => row.file),
];
let runtimeOutput;
try {
  runtimeOutput = execFileSync("python3", ["scripts/verify-packaged-runtime.py", ...runtimeArgs], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
} catch (error) {
  if (error.status === 3)
    throw new Error(`Release APKs are not distributable: no packaged resident runtime (runtimePackaging NOT_PACKAGED).\n${error.stderr}`);
  throw new Error(`Packaged runtime verification failed:\n${error.stdout ?? ""}${error.stderr ?? ""}`);
}
const runtimePackaging = JSON.parse(runtimeOutput);
for (const row of release) {
  const runtime = runtimePackaging.find(entry => entry.apk === row.file);
  row.runtime = runtime.runtime;
  // Test-mocks builds and releases without the resident runtime are never
  // distributable. Signing is recorded separately (row.signed).
  row.speechQualification = JSON.parse(execFileSync("python3", [
    "scripts/local-speech/verify-apk-qualification.py", row.file,
  ], { encoding: "utf8" }));
  row.distributable = !testMocks && runtime.distributable === true && row.speechQualification.qualified;
}
for (const row of results.filter(row => row.mode === "debug"))
  row.runtime = runtimePackaging.find(entry => entry.apk === row.file).runtime;

const mappings = {};
for (const variant of ["standalone", "launcher"]) {
  const mapping = path.join(directory, "mapping", `${variant}-release-mapping.txt`);
  mappings[variant] = fs.existsSync(mapping) ? mapping : null;
}
let apksignerVersion = null;
try { apksignerVersion = execFileSync(tool("apksigner"), ["--version"], { encoding: "utf8", env: androidEnv() }).trim(); }
catch { /* recorded as unknown */ }

fs.writeFileSync(
  manifestFile,
  JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      evidence: "apk-build",
      testMocks,
      demoEntryPoints: testMocks,
      mapsConfigured: buildRecord ? buildRecord.mapsConfigured : Boolean(process.env.VITE_MAPS_BASE_URL),
      allowUnpackagedRuntime: allowUnpackaged,
      version: { code: versionCode, name: versionName },
      signing: {
        release: release.every(row => row.signed) ? { signed: true, signerSha256: release[0].signerSha256 } : { signed: false },
        debugSignerSha256: results.find(row => row.mode === "debug").signerSha256,
        apksigner: apksignerVersion,
      },
      mappings,
      upstream: JSON.parse(fs.readFileSync("upstream.lock.json")),
      results,
      runtimePackaging,
    },
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify(results, null, 2));
const undistributable = release.filter(row => !row.distributable);
if (undistributable.length)
  console.warn(`Not distributable: ${undistributable.map(row => `${row.file} (${[row.runtime !== "PACKAGED" && "no packaged runtime", testMocks && "test-mocks build", !row.speechQualification.qualified && "unqualified speech runtime"].filter(Boolean).join(", ")})`).join("; ")}`);
const unsigned = release.filter(row => !row.signed);
if (unsigned.length)
  console.warn(`Unsigned releases (set ELIZAOS_KEYSTORE_PATH, ELIZAOS_KEYSTORE_PASSWORD, ELIZAOS_KEY_ALIAS and ELIZAOS_KEY_PASSWORD to sign): ${unsigned.map(row => row.file).join(", ")}`);
console.log(`Verified ${results.length} APKs in ${directory} (APK-build evidence only; not an install, emulator or device result).`);
