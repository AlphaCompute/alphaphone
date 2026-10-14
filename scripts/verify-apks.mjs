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
 *
 * Licences (decision P-09): open-source licences never fail verification and never
 * make a release distributable:false. Every flagged entry of the packaged notices
 * (copyleft, unknown, unverified, missing licence text, proprietary font) is
 * recorded per APK in `licenceFlags` and printed as a LICENCE FLAG warning. The one
 * separately named check, unresolved-font-licence (proprietary fonts), is always
 * recorded in `fontLicenceCheck`: `resolved` lists fonts covered by the owner's
 * statement in licenses/font-licenses.json (the Denton typeface), `items` lists
 * fonts with no record. Unresolved items are copied to `licenceBlockers` and keep
 * a release distributable:false only while
 * UNRESOLVED_FONT_LICENCE_BLOCKS_DISTRIBUTION (scripts/licence-policy.mjs) is true.
 * It never fails verification of a developer build.
 * App Links: each row records `appLinks` ({present, hosts}), the https autoVerify filters in
 * the packaged manifest. A default build has none; ELIZAOS_APP_LINK_HOST adds one.
 * --test-mocks: the separate artifacts/test-mocks/ build, which is never
 * distributable. This is APK-build evidence only; it does not install or run
 * anything.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  auditBundle, distributionProblems, extractWebPayload, readBuildFlags, signerDigest, validateApk,
} from "./apk.mjs";
import { androidEnv, tool } from "./toolchain.mjs";
import { readReleaseSigner, releaseAdmission, RELEASE_SIGNER_FILE } from "./build-android.mjs";
import { BUN_ENTRY } from "./generate-licenses.mjs";
import { fontLicenceCheck, fontLicenceLine } from "./font-license-blockers.mjs";
import { licenceFlagLines, licenceFlagRecords } from "./licence-policy.mjs";
import { packagedGzipProblems } from "./android-gzip-assets.mjs";
import { appLinkFilters } from "./render-assetlinks.mjs";
import { readVoiceHost, VOICE_BUNDLE_FORMAT } from "./stage-embedding-host.mjs";

import { preparePatchedNative, nativePatchReceipt, verifyNativePatchReceipt } from './prepare-patched-native.mjs';
const USAGE = "Usage: node scripts/verify-apks.mjs [--test-mocks] [--allow-unpackaged-runtime]";
const args = process.argv.slice(2);
for (const arg of args)
  if (!["--test-mocks", "--allow-unpackaged-runtime"].includes(arg)) throw new Error(`Unknown option ${arg}. ${USAGE}`);
const testMocks = args.includes("--test-mocks");
const admittedNativePatches = preparePatchedNative();
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

/**
 * The packaged voice bundle (assets/voice/v1) and native engine against qualified-voice-host.json.
 * Records whether on-device voice is packaged; functional acceptance is never inferred from bytes.
 */
function voiceHostAdmission(file) {
  const names = execFileSync("unzip", ["-Z1", file], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).split("\n").filter(Boolean);
  const bundle = names.filter(name => name.startsWith("assets/voice/"));
  if (!bundle.length) return { packaged: false, asr: false, differences: [], functionalAcceptance: null };
  const differences = [];
  const host = readVoiceHost(".");
  const read = entry => execFileSync("unzip", ["-p", file, entry], { maxBuffer: 512 * 1024 * 1024 });
  const manifest = names.includes("assets/voice/v1/manifest.json") ? JSON.parse(read("assets/voice/v1/manifest.json").toString("utf8")) : null;
  if (manifest?.format !== VOICE_BUNDLE_FORMAT) differences.push("assets/voice/v1/manifest.json is missing or has another format");
  const pinned = new Map([...host.models.filter(row => row.sha256 !== null), ...(host.lexicon.sha256 !== null ? [host.lexicon] : [])].map(row => [row.path, row]));
  for (const row of manifest?.files ?? []) {
    const entry = `assets/voice/v1/${row.path}`, expected = pinned.get(row.path);
    if (!expected || !names.includes(entry)) { differences.push(`${entry}: not a qualified voice file`); continue; }
    const bytes = read(entry);
    if (bytes.length !== expected.bytes || createHash("sha256").update(bytes).digest("hex") !== expected.sha256) differences.push(`${entry}: differs from the qualified bytes`);
  }
  for (const name of bundle) if (name !== "assets/voice/v1/manifest.json" && !(manifest?.files ?? []).some(row => `assets/voice/v1/${row.path}` === name)) differences.push(`${name}: unlisted voice entry`);
  for (const abi of new Set(names.filter(name => /^lib\/[^/]+\/libelizainference\.so$/.test(name)).map(name => name.split("/")[1]))) {
    const record = host.abis.find(row => row.abi === abi);
    if (!record?.voiceSymbolsVerified) { differences.push(`lib/${abi}: native engine has no voice-symbol qualification`); continue; }
    for (const library of record.libraries) {
      const bytes = names.includes(`lib/${abi}/${library.name}`) ? read(`lib/${abi}/${library.name}`) : null;
      if (!bytes || bytes.length !== library.bytes || createHash("sha256").update(bytes).digest("hex") !== library.sha256) differences.push(`lib/${abi}/${library.name}: differs from the voice-qualified bytes`);
    }
  }
  return { packaged: true, asr: (manifest?.files ?? []).some(row => row.role === "asr-model"), differences, functionalAcceptance: host.evidence.functionalAcceptance };
}

const results = [];
const failures = [];
const flagLines = new Set();
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
    // A PACKAGED distribution must ship notices regenerated with --packaged-runtime (Bun and
    // the bundled agent/worker packages); the committed notices carry only the umbrella entry.
    let runtimeNotices = false;
    // The font check is recorded in full; only its `blockers` (policy constant) affect distributable.
    let fontCheck;
    try { fontCheck = fontLicenceCheck(payload.public); }
    catch (error) { const items = [`font licence check failed: ${error.message}`]; fontCheck = { ...fontLicenceCheck(path.join(payload.root, "absent")), status: "unresolved", items, blockers: items }; }
    const licenceBlockers = fontCheck.blockers;
    // Flags are a record of the packaged notices. They are never a blocker.
    let licenceFlags = [];
    try {
      const notices = path.join(payload.public, "licenses", "third-party-notices.json");
      const entries = fs.existsSync(notices) ? JSON.parse(fs.readFileSync(notices, "utf8")) : [];
      runtimeNotices = Array.isArray(entries) && entries.some(entry => entry?.name === BUN_ENTRY);
      licenceFlags = licenceFlagRecords(entries);
      for (const line of licenceFlagLines(entries)) flagLines.add(line);
    } catch { runtimeNotices = false; }
    try {
      flags = readBuildFlags(payload.public);
      if (flags.testMocks !== testMocks)
        problems.push(`Packaged web bundle has testMocks=${flags.testMocks}; expected ${testMocks}`);
      auditBundle(payload.public, { testMocks });
      // The asset merger unpacks *.gz; the scan engine needs its model under the published name.
      problems.push(...packagedGzipProblems(payload.public));
    } catch (error) {
      problems.push(error.message);
    } finally {
      fs.rmSync(payload.root, { recursive: true, force: true });
    }
    try { verifyNativePatchReceipt(execFileSync('unzip', ['-p', file, 'assets/native-patches.json'], {encoding:'utf8',stdio:['ignore','pipe','pipe']}), admittedNativePatches); }
    catch (error) { problems.push(`Native patch provenance: ${error.message}`); }
    let signerSha256 = null;
    if (signed) {
      try { signerSha256 = signerDigest(file); }
      catch (error) { problems.push(`apksigner verify failed for ${file}: ${error.message}`); }
    }
    if (problems.length) failures.push(`${file}:\n  - ${problems.join("\n  - ")}`);
    const { badging, xml, names, dexClasses, removedSpeechClasses, ...record } = d;
    results.push({
      ...record,
      variant,
      mode,
      versionCode: facts.versionCode,
      versionName: facts.versionName,
      signed,
      signerSha256,
      exportedComponents: facts.exported.map(component => component.name).sort(),
      appLinks: appLinkFilters(xml),
      testMocks: flags?.testMocks ?? null,
      bundleAudit: problems.length ? "failed" : "passed",
      runtimeNotices,
      licenceFlags,
      fontLicenceCheck: { check: fontCheck.check, status: fontCheck.status, blocksDistribution: fontCheck.blocksDistribution, items: fontCheck.items, resolved: fontCheck.resolved },
      licenceBlockers,
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

// A release is distributable only when signed by the committed release signer with
// a versionCode above the last recorded release. A mismatch fails verification.
const releaseSigner = readReleaseSigner();
for (const row of release) {
  row.releaseAdmission = releaseAdmission(row, releaseSigner);
  if (!testMocks && row.releaseAdmission.failures.length)
    throw new Error(`Release signing admission failed for ${row.file}: ${row.releaseAdmission.failures.join("; ")}`);
}

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
  // On-device voice is optional: without it local speech reports unavailable and Cloud voice is used.
  // A packaged bundle must match android/voice-host/qualified-voice-host.json byte for byte.
  row.voiceHost = voiceHostAdmission(row.file);
  if (row.voiceHost.differences.length)
    throw new Error(`On-device voice in ${row.file} is not admitted:\n  - ${row.voiceHost.differences.join("\n  - ")}`);
  row.distributable = !testMocks && row.signed === true && row.releaseAdmission.signerMatches === true &&
    row.releaseAdmission.blockers.length === 0 && row.releaseAdmission.failures.length === 0 &&
    runtime.distributable === true && row.runtimeNotices === true &&
    (row.voiceHost.packaged === false || row.voiceHost.functionalAcceptance?.passed === true) &&
    row.licenceBlockers.length === 0;
}
for (const row of results.filter(row => row.mode === "debug")) {
  row.runtime = runtimePackaging.find(entry => entry.apk === row.file).runtime;
  row.voiceHost = voiceHostAdmission(row.file);
  if (row.voiceHost.differences.length)
    throw new Error(`On-device voice in ${row.file} is not admitted:\n  - ${row.voiceHost.differences.join("\n  - ")}`);
}

const mappings = {};
for (const variant of ["standalone", "launcher"]) {
  const mapping = path.join(directory, "mapping", `${variant}-release-mapping.txt`);
  mappings[variant] = fs.existsSync(mapping) ? mapping : null;
}
// Instrumentation APKs built with these APKs (scripts/android-instrumentation.mjs binds to them).
const instrumentation = {};
for (const variant of ["standalone", "launcher"]) {
  const file = testMocks ? path.join(directory, `${variant}-androidTest.apk`) : path.join(directory, "instrumentation", `${variant}-androidTest.apk`);
  if (fs.existsSync(file)) instrumentation[variant] = { file, sha256: createHash("sha256").update(fs.readFileSync(file)).digest("hex") };
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
        descriptor: { file: RELEASE_SIGNER_FILE, signerSha256: releaseSigner.signerSha256, lastReleaseVersionCode: releaseSigner.lastRelease.versionCode },
      },
      mappings,
      instrumentation,
      upstream: JSON.parse(fs.readFileSync("upstream.lock.json")),
      nativePatches: nativePatchReceipt(admittedNativePatches),
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
  console.warn(`Not distributable: ${undistributable.map(row => `${row.file} (${[row.runtime !== "PACKAGED" && "no packaged runtime", testMocks && "test-mocks build", !row.runtimeNotices && "notices lack the packaged runtime (run node scripts/generate-licenses.mjs --packaged-runtime after staging)", row.voiceHost.packaged && row.voiceHost.functionalAcceptance?.passed !== true && "on-device voice packaged without recorded functional acceptance", ...row.releaseAdmission.blockers, ...row.licenceBlockers].filter(Boolean).join(", ")})`).join("; ")}`);
// Licence flags are warnings: recorded per APK above, printed once here, never a failure.
for (const line of flagLines) console.warn(line);
const fontItems = new Map(release.flatMap(row => [...row.fontLicenceCheck.items, ...row.fontLicenceCheck.resolved].map(item => [item, row.fontLicenceCheck.blocksDistribution])));
for (const [item, blocks] of fontItems) console.warn(fontLicenceLine(item, blocks));
const unsigned = release.filter(row => !row.signed);
if (unsigned.length)
  console.warn(`Unsigned releases (set ELIZAOS_KEYSTORE_PATH, ELIZAOS_KEYSTORE_PASSWORD, ELIZAOS_KEY_ALIAS and ELIZAOS_KEY_PASSWORD to sign): ${unsigned.map(row => row.file).join(", ")}`);
console.log(`Verified ${results.length} APKs in ${directory} (APK-build evidence only; not an install, emulator or device result).`);
