// Pixel 10a production staging inputs, release image signing, OTA and the compatibility record
// (issues #399, #400). The AOSP releasetools are mocked and every key is a throwaway value made
// in a temporary directory: these tests establish refusals, command construction and record
// contents. They are not a signed image, an image boot, an applied OTA, or a rollback or
// recovery drill.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { PIXEL10A_PRODUCT, pixel10aOptions, pixel10aProductProblems } from "../scripts/aosp-pixel10a.mjs";
import { channelDistributionProblems, channelSigningProblems, parseSigningArgs, signingCommands, signRelease, X509_KEYS } from "../scripts/sign-aosp-release.mjs";
import { compatibilityRecord, parseProperties } from "../scripts/aosp-release-record.mjs";
import { releaseBlockers } from "../scripts/release-blockers.mjs";

const root = path.resolve(import.meta.dirname, "..");
const read = rel => JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const CHANNEL = "android/aosp/pixel10a-ota-channel.json";
const FINGERPRINT = "Alpha/alpha_stallion_phone/stallion:17/CP2A.261005.001/42:user/release-keys";

function zip(file, entries) {
  execFileSync("python3", ["-c", "import json,sys,zipfile\nwith zipfile.ZipFile(sys.argv[1],'w') as z:\n for k,v in json.loads(sys.argv[2]).items(): z.writestr(k,v)", file, JSON.stringify(entries)]);
}
function temporary(t, prefix) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function certificate(dir, name) {
  execFileSync("openssl", ["req", "-x509", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:prime256v1", "-nodes", "-subj", `/CN=alpha-test-${name}`, "-days", "1",
    "-keyout", path.join(dir, `${name}.key.tmp`), "-out", path.join(dir, `${name}.x509.pem`)], { stdio: "ignore" });
  fs.rmSync(path.join(dir, `${name}.key.tmp`));
  const der = Buffer.from(fs.readFileSync(path.join(dir, `${name}.x509.pem`), "utf8").replace(/-----[^-]+-----|\s/g, ""), "base64");
  return sha256(der);
}

/** A throwaway key directory in the upstream decrypted layout. Private files hold a marker, never a key. */
function keyDirectory(t) {
  const keys = temporary(t, "alpha-test-keys-");
  fs.chmodSync(keys, 0o700);
  const platform = certificate(keys, "platform"), releasekey = certificate(keys, "releasekey");
  for (const name of X509_KEYS) {
    if (!["platform", "releasekey"].includes(name)) fs.copyFileSync(path.join(keys, "releasekey.x509.pem"), path.join(keys, `${name}.x509.pem`));
    fs.writeFileSync(path.join(keys, `${name}.pk8`), "TEST-ONLY-PRIVATE-MARKER");
  }
  fs.writeFileSync(path.join(keys, "avb.pem"), "TEST-ONLY-PRIVATE-MARKER");
  const pkmd = Buffer.from("test avb public key metadata");
  fs.writeFileSync(path.join(keys, "avb_pkmd.bin"), pkmd);
  return { keys, platform, releasekey, avb: sha256(pkmd) };
}

/** A repository copy whose production descriptors are complete for the given keys. */
function completeRoot(t, { platform, releasekey, avb }) {
  const dir = temporary(t, "alpha-release-root-");
  const write = (rel, value) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), typeof value === "string" ? value : JSON.stringify(value, null, 2)); };
  const lock = JSON.stringify({ schema: 1, target: "pixel10a", device: { codename: "stallion", androidRelease: "17" }, developmentOnly: false, releaseQualified: false });
  write("android/aosp/pixel10a-source.json", lock);
  const product = read(PIXEL10A_PRODUCT);
  write(PIXEL10A_PRODUCT, { ...product, sourceLock: { ...product.sourceLock, sha256: sha256(lock) }, signer: { ...product.signer, platformCertificateSha256: platform }, avb: { ...product.avb, publicKeySha256: avb } });
  write(CHANNEL, { ...read(CHANNEL), otaCertificateSha256: releasekey, avbPublicKeySha256: avb });
  write("android/release-signer.json", { ...read("android/release-signer.json"), signerSha256: "d".repeat(64) });
  write("android/aosp/stallion/release-avb.mk", fs.readFileSync(path.join(root, "android/aosp/stallion/release-avb.mk"), "utf8"));
  return { dir, write, product: read(PIXEL10A_PRODUCT) };
}

/** Mock otatools bin: records each invocation and writes outputs shaped like the real tools'. */
function releasetools(t, { postBuild = FINGERPRINT, fileHash = null } = {}) {
  const bin = path.join(temporary(t, "alpha-otatools-"), "bin");
  fs.mkdirSync(bin);
  const common = `#!/usr/bin/env python3\nimport sys, json, os, zipfile, hashlib, base64\nwith open(os.path.join(os.path.dirname(__file__), 'calls.jsonl'), 'a') as log: log.write(json.dumps([os.path.basename(__file__)] + sys.argv[1:]) + '\\n')\nsrc, dst = sys.argv[-2], sys.argv[-1]\n`;
  fs.writeFileSync(path.join(bin, "sign_target_files_apks"), common + `with zipfile.ZipFile(src) as i, zipfile.ZipFile(dst, 'w') as o:\n    for n in i.namelist(): o.writestr(n, i.read(n))\n    for p in ('vbmeta', 'vbmeta_system', 'vbmeta_vendor'): o.writestr('IMAGES/%s.img' % p, b'signed ' + p.encode())\n`);
  fs.writeFileSync(path.join(bin, "ota_from_target_files"), common + `payload = b'payload bytes'\nfh = ${fileHash ? JSON.stringify(fileHash) : "None"} or base64.b64encode(hashlib.sha256(payload).digest()).decode()\nwith zipfile.ZipFile(dst, 'w') as o:\n    o.writestr('payload.bin', payload)\n    o.writestr('payload_properties.txt', 'FILE_HASH=%s\\nFILE_SIZE=%d\\n' % (fh, len(payload)))\n    o.writestr('META-INF/com/android/metadata', 'ota-type=AB\\npost-build=${postBuild}\\npre-device=stallion\\n')\n`);
  for (const name of ["sign_target_files_apks", "ota_from_target_files"]) fs.chmodSync(path.join(bin, name), 0o755);
  return { bin, calls: () => fs.existsSync(path.join(bin, "calls.jsonl")) ? fs.readFileSync(path.join(bin, "calls.jsonl"), "utf8").trim().split("\n").filter(Boolean).map(JSON.parse) : [] };
}

function targetFiles(t) {
  const file = path.join(temporary(t, "alpha-target-files-"), "unsigned-target_files.zip");
  zip(file, { "SYSTEM/build.prop": `# test\nro.system.build.fingerprint=${FINGERPRINT}\nro.build.id=CP2A.261005.001\nro.build.version.incremental=42\nro.build.version.release=17\nro.build.version.sdk=37\nro.build.version.security_patch=2026-10-05\n`,
    "VENDOR/build.prop": "ro.vendor.build.fingerprint=google/stallion/stallion:17/CP3A.261005.005/1:user/release-keys\nro.vendor.build.security_patch=2026-10-05\n", "META/misc_info.txt": "avb_enable=true\n" });
  return { file, sha256: sha256(fs.readFileSync(file)) };
}

function setup(t, tools = {}) {
  const key = keyDirectory(t), repo = completeRoot(t, key), tf = targetFiles(t), ota = releasetools(t, tools);
  const out = path.join(temporary(t, "alpha-release-out-"), "release");
  return { key, repo, tf, ota, out, options: { root: repo.dir, targetFiles: tf.file, targetFilesSha256: tf.sha256, keysDir: key.keys, releasetools: ota.bin, out } };
}

test("the committed Pixel 10a production descriptor and channel name every unset release input and never claim qualification", () => {
  const product = read(PIXEL10A_PRODUCT), channel = read(CHANNEL);
  assert.equal(product.product, "alpha_stallion_phone");
  assert.deepEqual(product.device, { codename: "stallion", androidRelease: "17" });
  assert.equal(product.releaseQualified, false);
  assert.equal(product.deviceAcceptanceVerified, false);
  assert.equal(product.ota.channel, CHANNEL);
  assert.equal(channel.recovery.stockFactoryImage.sha256, read("android/aosp/pixel10a-source.json").factory.sha256, "stock recovery is the locked factory archive");
  const problems = pixel10aProductProblems(root);
  for (const expected of [/sourceLock\.sha256 is unset/, /still marked developmentOnly/, /signerSha256 is "unset"/, /platformCertificateSha256 must be a SHA-256/])
    assert.ok(problems.some(problem => expected.test(problem)), `${expected}\n${problems.join("\n")}`);
  assert.ok(channelSigningProblems(channel, product).some(problem => /otaCertificateSha256 is unset/.test(problem)));
  const distribution = channelDistributionProblems(channel);
  for (const drill of ["signedUpdate", "interruptedUpdate", "compatibleRollback", "stockRecovery"]) assert.ok(distribution.some(problem => problem.includes(`${drill} drill is "not run"`)), drill);
  assert.ok(distribution.some(problem => /knownGoodRelease\.otaSha256 is unset/.test(problem)));
});

test("a complete fixture descriptor admits Pixel 10a production staging inputs; each gap is refused", t => {
  const { repo } = setup(t);
  assert.deepEqual(pixel10aProductProblems(repo.dir), []);
  const refuse = (rel, change, pattern) => {
    const original = fs.readFileSync(path.join(repo.dir, rel), "utf8");
    repo.write(rel, change(JSON.parse(original)));
    assert.ok(pixel10aProductProblems(repo.dir).some(problem => pattern.test(problem)), `${pattern}\n${pixel10aProductProblems(repo.dir).join("\n")}`);
    fs.writeFileSync(path.join(repo.dir, rel), original);
  };
  refuse(PIXEL10A_PRODUCT, p => ({ ...p, releaseQualified: true }), /releaseQualified must stay false/);
  refuse(PIXEL10A_PRODUCT, p => ({ ...p, deviceAcceptanceVerified: true }), /deviceAcceptanceVerified must stay false/);
  refuse(PIXEL10A_PRODUCT, p => ({ ...p, signer: { ...p.signer, platformCertificateSha256: "UNSET" } }), /platformCertificateSha256/);
  refuse(PIXEL10A_PRODUCT, p => ({ ...p, sourceLock: { ...p.sourceLock, sha256: "0".repeat(64) } }), /differs from the pinned sourceLock\.sha256/);
  refuse(PIXEL10A_PRODUCT, p => ({ ...p, device: { codename: "frankel", androidRelease: "17" } }), /must be stallion on Android 17/);
  refuse(PIXEL10A_PRODUCT, p => ({ ...p, lunch: { ...p.lunch, production: "alpha_stallion_phone-cp2a-userdebug" } }), /user build/);
  refuse("android/release-signer.json", s => ({ ...s, signerSha256: "unset" }), /signerSha256 is "unset"/);
  refuse("android/aosp/pixel10a-source.json", l => ({ ...l, developmentOnly: true }), /still marked developmentOnly|differs from the pinned/);
});

test("Pixel 10a staging options: development or production, never both, always with exact source inputs", () => {
  const base = { target: "pixel10a", source: "/source", factory: "/factory" };
  assert.equal(pixel10aOptions({ ...base, development: true }), true);
  assert.equal(pixel10aOptions({ ...base, production: true }), true);
  assert.throws(() => pixel10aOptions({ ...base, development: true, production: true }), /exclusive/);
  assert.throws(() => pixel10aOptions(base), /--development or --production/);
  assert.throws(() => pixel10aOptions({ ...base, production: true, factory: null }), /--aosp-source and --factory-image/);
});

test("stage-aosp --target pixel10a --production refuses the committed descriptor before reading source or APK", () => {
  const out = spawnSync(process.execPath, [path.join(root, "scripts/stage-aosp.mjs"), "--target", "pixel10a", "--production", "--descriptor", "reviewed.json",
    "--apk", "absent.apk", "--aosp-source", "/absent/source", "--factory-image", "/absent/factory.zip"], { cwd: root, encoding: "utf8" });
  assert.notEqual(out.status, 0);
  assert.match(out.stderr, /Refusing production staging: the Pixel 10a production product \(android\/aosp\/pixel10a-product\.json\) is incomplete\.[\s\S]*platformCertificateSha256/);
  assert.doesNotMatch(out.stderr, /absent/);
});

test("release AVB configuration names the algorithm and rollback index and never a key", () => {
  const makefile = fs.readFileSync(path.join(root, "android/aosp/stallion/release-avb.mk"), "utf8");
  const settings = makefile.split("\n").filter(line => line && !line.startsWith("#")).join("\n");
  assert.doesNotMatch(settings, /KEY_PATH|\.pem|\.pk8|testkey/);
  assert.match(settings, new RegExp(`BOARD_AVB_ALGORITHM := ${read(PIXEL10A_PRODUCT).avb.algorithm}`));
  assert.match(settings, /BOARD_AVB_ROLLBACK_INDEX := \$\(PLATFORM_SECURITY_PATCH_TIMESTAMP\)/);
  for (const partition of read(PIXEL10A_PRODUCT).avb.chainedPartitions) assert.match(settings, new RegExp(`BOARD_AVB_${partition.toUpperCase()}_ALGORITHM`));
  assert.match(fs.readFileSync(path.join(root, "android/aosp/stallion/AndroidProducts.mk"), "utf8"), /alpha_stallion_phone-cp2a-user\b/);
  // No key material is committed with the AOSP product.
  const files = execFileSync("git", ["-C", root, "ls-files", "android/aosp"], { encoding: "utf8" }).split("\n");
  assert.deepEqual(files.filter(name => /\.(pk8|pem|key|p12|jks|keystore)$|avb_pkmd/.test(name)), []);
});

test("signing commands follow the upstream releasetools job with keys only as runtime paths", () => {
  const product = read(PIXEL10A_PRODUCT);
  const { commands } = signingCommands({ targetFiles: "/in/tf.zip", keysDir: "/dev/shm/keys", releasetools: "/otatools/bin", out: "/out", product, incrementalFrom: "/prev/tf.zip" });
  assert.deepEqual(commands.map(command => path.basename(command.tool)), ["sign_target_files_apks", "ota_from_target_files"]);
  assert.deepEqual(commands[0].args.slice(0, 5), ["-p", "/otatools", "-o", "-d", "/dev/shm/keys"]);
  for (const partition of ["vbmeta", ...product.avb.chainedPartitions]) {
    const at = commands[0].args.indexOf(`--avb_${partition}_key`);
    assert.equal(commands[0].args[at + 1], "/dev/shm/keys/avb.pem", partition);
    assert.equal(commands[0].args[commands[0].args.indexOf(`--avb_${partition}_algorithm`) + 1], "SHA256_RSA4096");
  }
  assert.deepEqual(commands[1].args.slice(2), ["-k", "/dev/shm/keys/releasekey", "-i", "/prev/tf.zip", "/out/signed-target_files.zip", "/out/incremental-ota.zip"]);
  assert.throws(() => parseSigningArgs(["--keys-dir"]), /Use --target-files/);
  assert.deepEqual(parseSigningArgs(["--dry-run", "--keys-dir", "/k"]), { dryRun: true, keysDir: "/k" });
});

test("a complete fixture signs with mocked releasetools and writes the compatibility record", async t => {
  const { key, ota, out, options, tf } = setup(t);
  const apkManifest = path.join(path.dirname(out), "apk-manifest.json");
  fs.writeFileSync(apkManifest, JSON.stringify({ results: [{ file: "launcher-release.apk", mode: "release", sha256: "a".repeat(64), signerSha256: "d".repeat(64), versionCode: 7, distributable: false }, { file: "launcher-debug.apk", mode: "debug" }] }));
  const result = await signRelease({ ...options, apkManifest });
  assert.equal(result.ran, true);
  const calls = ota.calls();
  assert.deepEqual(calls.map(call => call[0]), ["sign_target_files_apks", "ota_from_target_files"]);
  assert.ok(calls[0].includes("-o") && calls[0].includes(key.keys));
  assert.equal(calls[1][calls[1].indexOf("-k") + 1], path.join(key.keys, "releasekey"));
  assert.equal(fs.statSync(out).mode & 0o777, 0o700);
  assert.deepEqual(fs.readFileSync(path.join(out, "avb_pkmd.bin")), fs.readFileSync(path.join(key.keys, "avb_pkmd.bin")));
  const text = fs.readFileSync(result.record, "utf8"), record = JSON.parse(text);
  assert.doesNotMatch(text, /TEST-ONLY-PRIVATE-MARKER/, "private key files are never read into the record");
  assert.equal(record.kind, "alpha-aosp-release-compatibility");
  assert.equal(record.build.fingerprint, FINGERPRINT);
  assert.equal(record.build.androidRelease, "17");
  assert.equal(record.build.securityPatch, "2026-10-05");
  assert.match(record.build.vendorFingerprint, /^google\/stallion/);
  assert.equal(record.inputs.unsignedTargetFilesSha256, tf.sha256);
  assert.equal(record.verifiedBoot.publicKeySha256, key.avb);
  assert.equal(record.verifiedBoot.images.vbmeta, sha256(Buffer.from("signed vbmeta")));
  assert.equal(record.verifiedBoot.images.vbmeta_vendor, sha256(Buffer.from("signed vbmeta_vendor")));
  assert.equal(record.payload.sha256, sha256(Buffer.from("payload bytes")));
  assert.equal(record.payload.metadata["post-build"], FINGERPRINT);
  assert.equal(record.certificates.platform, key.platform);
  assert.equal(record.certificates.releasekey, key.releasekey);
  assert.deepEqual(record.apks, [{ file: "launcher-release.apk", sha256: "a".repeat(64), signerSha256: "d".repeat(64), versionCode: 7, distributable: false }]);
  assert.equal(record.artifacts.ota.type, "full");
  assert.equal(record.artifacts.ota.sha256, sha256(fs.readFileSync(path.join(out, "ota.zip"))));
  assert.deepEqual(record.problems, []);
  for (const flag of ["imageBooted", "signedUpdateApplied", "releaseQualified", "deviceAcceptanceVerified"]) assert.equal(record[flag], false, flag);
  assert.equal(record.downgradeAllowed, false);
  assert.ok(result.distributionProblems.some(problem => /signedUpdate drill is "not run"/.test(problem)), "drills still block distribution");
});

test("signing refuses unsafe keys, mismatched digests, changed inputs and unset descriptors without running a tool", async t => {
  const refuse = async (change, pattern) => {
    const fixture = setup(t);
    const options = change(fixture) ?? fixture.options;
    const existed = fs.existsSync(fixture.out);
    await assert.rejects(signRelease(options), pattern);
    assert.deepEqual(fixture.ota.calls(), [], `${pattern}: no releasetool ran`);
    if (!existed) assert.equal(fs.existsSync(fixture.out), false, "no output is created");
    const dry = await signRelease({ ...options, dryRun: true });
    assert.equal(dry.ran, false);
    assert.ok(dry.problems.some(problem => pattern.test(problem)), `${pattern}\n${dry.problems.join("\n")}`);
  };
  await refuse(({ key }) => { fs.chmodSync(key.keys, 0o755); }, /mode 0700/);
  await refuse(({ key }) => { fs.rmSync(path.join(key.keys, "platform.pk8")); }, /lacks platform\.pk8/);
  await refuse(({ key }) => { fs.writeFileSync(path.join(key.keys, "avb_pkmd.bin"), "other"); }, /avb_pkmd\.bin is not the product's avb\.publicKeySha256/);
  await refuse(({ key }) => { certificate(key.keys, "platform"); }, /platform\.x509\.pem is [0-9a-f]{64}, not the product's/);
  await refuse(({ key }) => { certificate(key.keys, "releasekey"); }, /not the channel's otaCertificateSha256/);
  await refuse(({ options }) => ({ ...options, targetFilesSha256: "0".repeat(64) }), /differs from --target-files-sha256/);
  await refuse(({ options }) => ({ ...options, keysDir: path.relative(process.cwd(), options.keysDir) }), /absolute path/);
  await refuse(({ options }) => { fs.mkdirSync(options.out); fs.chmodSync(options.out, 0o700); }, /already exists/);
  await refuse(({ repo }) => { repo.write(CHANNEL, { ...read(CHANNEL), avbPublicKeySha256: "UNSET" }); }, /avbPublicKeySha256 is unset/);
  await refuse(({ repo }) => { repo.write(CHANNEL, { ...JSON.parse(fs.readFileSync(path.join(repo.dir, CHANNEL), "utf8")), downgradeAllowed: true }); }, /downgradeAllowed must be false/);
  await refuse(({ repo }) => { repo.write("android/release-signer.json", read("android/release-signer.json")); }, /signerSha256 is "unset"/);
  // Keys inside a Git working tree (for example this repository) are refused.
  await refuse(({ options, key }) => {
    const inside = fs.mkdtempSync(path.join(options.root, "keys-"));
    execFileSync("git", ["init", "-q", options.root]);
    for (const name of fs.readdirSync(key.keys)) fs.copyFileSync(path.join(key.keys, name), path.join(inside, name));
    fs.chmodSync(inside, 0o700);
    return { ...options, keysDir: inside };
  }, /inside this repository|inside a Git working tree/);
});

test("the compatibility record names mismatched OTA metadata and payload hashes", async t => {
  const { options, out } = setup(t, { postBuild: "other/fingerprint", fileHash: "AAAA" });
  await assert.rejects(signRelease(options), /Signed outputs are inconsistent[\s\S]*post-build other\/fingerprint[\s\S]*FILE_HASH/);
  const record = JSON.parse(fs.readFileSync(path.join(out, "release-record.json"), "utf8"));
  assert.equal(record.releaseQualified, false);
  assert.equal(record.problems.length, 2);
  // A target-files without vbmeta images or build properties is recorded as such, never filled in.
  const empty = path.join(path.dirname(out), "empty.zip"), otaZip = path.join(path.dirname(out), "empty-ota.zip");
  zip(empty, { "META/misc_info.txt": "" });
  zip(otaZip, { "other.txt": "" });
  const bare = await compatibilityRecord({ signedTargetFiles: empty, ota: otaZip, product: read(PIXEL10A_PRODUCT), channel: read(CHANNEL) });
  for (const expected of [/SYSTEM\/build\.prop is missing/, /IMAGES\/vbmeta\.img is missing/, /payload\.bin is missing/, /no build fingerprint/]) assert.ok(bare.problems.some(problem => expected.test(problem)), String(expected));
  assert.deepEqual(parseProperties("# c\na=b\nc = d=e\n"), { a: "b", c: "d=e" });
});

test("release blockers judge a recorded release against the current signer and the image platform certificate", () => {
  const row = { mode: "release", distributable: true, testMocks: false, bundleAudit: "passed", signed: true, signerSha256: "d".repeat(64), versionCode: 2, runtime: "PACKAGED", runtimeNotices: true,
    releaseAdmission: { failures: [], blockers: [], signerMatches: true }, voiceHost: { packaged: true, asr: true, differences: [], qualified: true }, licenceBlockers: [] };
  const signer = signerSha256 => ({ schema: 1, signerSha256, lastRelease: { versionCode: null, versionName: null, recordedAt: null } });
  assert.deepEqual(releaseBlockers(row), [], "the recorded admission alone");
  assert.ok(releaseBlockers(row, { releaseSigner: signer("unset") }).includes("release signer is unset in android/release-signer.json"));
  assert.ok(releaseBlockers(row, { releaseSigner: read("android/release-signer.json") }).some(item => /release signer is unset/.test(item)), "the committed signer is unset");
  assert.ok(releaseBlockers(row, { releaseSigner: signer("e".repeat(64)) }).some(item => /does not match android\/release-signer\.json/.test(item)));
  assert.deepEqual(releaseBlockers(row, { releaseSigner: signer("d".repeat(64)) }), []);
  assert.deepEqual(releaseBlockers(row, { releaseSigner: signer("d".repeat(64)), image: { platformCertificateSha256: "c".repeat(64) } }), []);
  for (const value of ["UNSET", undefined, "C".repeat(64)])
    assert.ok(releaseBlockers(row, { image: { platformCertificateSha256: value } }).some(item => /image platform certificate is .*not a reviewed release certificate/.test(item)), String(value));
  assert.ok(releaseBlockers(row, { releaseSigner: { schema: 2 } }).some(item => /release-signer\.json is invalid/.test(item)));
});
