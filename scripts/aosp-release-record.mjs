/**
 * Version/hash compatibility record for one signed Alpha Phone Pixel 10a release (issue #400).
 *
 * Reads a signed target-files zip and its OTA package and writes, as JSON, the identities a
 * signed update, rollback or recovery decision compares: build fingerprints and versions, the
 * vbmeta image hashes, the payload hash and OTA metadata, the release certificate digests and
 * the APK signer digests verify-apks recorded. It only reads archives (with `unzip`); it never
 * reads private keys, applies an update or flashes a device, and every record says so:
 * imageBooted, signedUpdateApplied, releaseQualified and deviceAcceptanceVerified stay false.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash, X509Certificate } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export const RECORD_KIND = "alpha-aosp-release-compatibility";
export const VBMETA_IMAGES = Object.freeze(["vbmeta", "vbmeta_system", "vbmeta_vendor"]);
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

export async function fileSha256(file) {
  const hash = createHash("sha256");
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

/** SHA-256 of an X.509 certificate's DER bytes: the digest apksigner prints. */
export function certificateSha256(pem) {
  return new X509Certificate(pem).fingerprint256.replaceAll(":", "").toLowerCase();
}

function entries(zip) {
  return execFileSync("unzip", ["-Z1", zip], { encoding: "utf8", maxBuffer: 256 << 20 }).split(/\r?\n/).filter(Boolean);
}
function entry(zip, name) {
  return execFileSync("unzip", ["-p", zip, name], { maxBuffer: 256 << 20 });
}
/** Stream-hash one zip entry (payload.bin is several GB). */
function entrySha256(zip, name) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    let size = 0;
    const child = spawn("unzip", ["-p", zip, name], { stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", chunk => { size += chunk.length; hash.update(chunk); });
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve({ sha256: hash.digest("hex"), sizeBytes: size }) : reject(new Error(`unzip ${name} from ${zip} exited ${code}`)));
  });
}

/** key=value lines (build.prop, payload_properties.txt, OTA metadata); comments ignored. */
export function parseProperties(text) {
  const values = {};
  for (const line of String(text).split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const at = line.indexOf("=");
    if (at > 0) values[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return values;
}

/** Public certificate digests of the runtime key directory (x509 certificates only; private keys are never opened). */
export function keyCertificates(keysDir, names) {
  const result = {};
  for (const name of names) {
    const file = path.join(keysDir, `${name}.x509.pem`);
    if (!fs.existsSync(file)) { result[name] = null; continue; }
    try { result[name] = certificateSha256(fs.readFileSync(file)); } catch { result[name] = "invalid certificate"; }
  }
  return result;
}

/**
 * Build the compatibility record. `product` and `channel` are the parsed descriptors;
 * `apkManifest` is verify-apks' apk-manifest.json (optional). Problems found while reading are
 * listed in `problems`; a record with problems is evidence of a mismatch, never an admission.
 */
export async function compatibilityRecord({ signedTargetFiles, ota, product, channel, apkManifest = null, certificates = {}, avbPublicKeySha256 = null, inputs = {}, incrementalFrom = null, createdAt = new Date().toISOString() }) {
  const problems = [];
  const tf = entries(signedTargetFiles);
  const props = name => tf.includes(name) ? parseProperties(entry(signedTargetFiles, name).toString("utf8")) : (problems.push(`${name} is missing from the signed target-files`), {});
  const system = props("SYSTEM/build.prop");
  const vendor = tf.includes("VENDOR/build.prop") ? parseProperties(entry(signedTargetFiles, "VENDOR/build.prop").toString("utf8")) : {};
  const images = {};
  for (const name of VBMETA_IMAGES) {
    const file = `IMAGES/${name}.img`;
    images[name] = tf.includes(file) ? sha256(entry(signedTargetFiles, file)) : null;
    if (!images[name]) problems.push(`${file} is missing from the signed target-files`);
  }
  const otaEntries = entries(ota);
  const payload = otaEntries.includes("payload.bin") ? await entrySha256(ota, "payload.bin") : (problems.push("payload.bin is missing from the OTA package"), null);
  const payloadProperties = otaEntries.includes("payload_properties.txt") ? parseProperties(entry(ota, "payload_properties.txt").toString("utf8")) : (problems.push("payload_properties.txt is missing from the OTA package"), {});
  const metadata = otaEntries.includes("META-INF/com/android/metadata") ? parseProperties(entry(ota, "META-INF/com/android/metadata").toString("utf8")) : (problems.push("META-INF/com/android/metadata is missing from the OTA package"), {});
  const fingerprint = system["ro.system.build.fingerprint"] ?? system["ro.build.fingerprint"] ?? null;
  if (!fingerprint) problems.push("the signed target-files records no build fingerprint");
  if (metadata["post-build"] && fingerprint && metadata["post-build"] !== fingerprint) problems.push(`OTA post-build ${metadata["post-build"]} is not the target-files fingerprint ${fingerprint}`);
  if (payload && payloadProperties.FILE_HASH && Buffer.from(payload.sha256, "hex").toString("base64") !== payloadProperties.FILE_HASH) problems.push("payload_properties.txt FILE_HASH is not the payload.bin SHA-256");
  if (product?.device?.codename && metadata["pre-device"] && metadata["pre-device"] !== product.device.codename) problems.push(`OTA pre-device ${metadata["pre-device"]} is not ${product.device.codename}`);
  if (incrementalFrom && !metadata["pre-build"]) problems.push("an incremental OTA records no pre-build fingerprint");
  const androidRelease = system["ro.build.version.release"] ?? system["ro.system.build.version.release"] ?? null;
  if (product?.device?.androidRelease && androidRelease && androidRelease !== product.device.androidRelease) problems.push(`Android release ${androidRelease} is not ${product.device.androidRelease}`);
  const apks = (apkManifest?.results ?? []).filter(row => row.mode === "release").map(row => ({ file: row.file, sha256: row.sha256 ?? null, signerSha256: row.signerSha256 ?? null, versionCode: row.versionCode ?? null, distributable: row.distributable === true }));
  const [signedTf, otaPackage] = await Promise.all([fileSha256(signedTargetFiles), fileSha256(ota)]);
  return {
    schema: 1,
    kind: RECORD_KIND,
    product: product?.product ?? null,
    device: product?.device?.codename ?? null,
    channel: channel?.channel ?? null,
    createdAt,
    build: {
      fingerprint,
      vendorFingerprint: vendor["ro.vendor.build.fingerprint"] ?? null,
      id: system["ro.build.id"] ?? system["ro.system.build.id"] ?? null,
      incremental: system["ro.build.version.incremental"] ?? system["ro.system.build.version.incremental"] ?? null,
      androidRelease,
      sdk: system["ro.build.version.sdk"] ?? system["ro.system.build.version.sdk"] ?? null,
      securityPatch: system["ro.build.version.security_patch"] ?? null,
      vendorSecurityPatch: vendor["ro.vendor.build.security_patch"] ?? null,
      dateUtc: system["ro.build.date.utc"] ?? system["ro.system.build.date.utc"] ?? null,
    },
    inputs,
    artifacts: {
      signedTargetFiles: { file: path.basename(signedTargetFiles), sha256: signedTf, sizeBytes: fs.statSync(signedTargetFiles).size },
      ota: { file: path.basename(ota), sha256: otaPackage, sizeBytes: fs.statSync(ota).size, type: incrementalFrom ? "incremental" : "full", incrementalFrom },
    },
    verifiedBoot: { algorithm: product?.avb?.algorithm ?? null, publicKeySha256: avbPublicKeySha256, images },
    payload: { sha256: payload?.sha256 ?? null, sizeBytes: payload?.sizeBytes ?? null, properties: payloadProperties, metadata },
    certificates,
    apks,
    downgradeAllowed: channel?.downgradeAllowed === true,
    drills: channel?.drills ?? null,
    problems,
    imageBooted: false,
    signedUpdateApplied: false,
    releaseQualified: false,
    deviceAcceptanceVerified: false,
  };
}

export function writeRecord(file, record) {
  fs.writeFileSync(file, JSON.stringify(record, null, 2) + "\n", { flag: "wx" });
}

async function main(args) {
  const values = {};
  const names = ["--signed-target-files", "--ota", "--product", "--channel", "--apk-manifest", "--keys-dir", "--out", "--incremental-from"];
  for (let i = 0; i < args.length; i += 2) {
    if (!names.includes(args[i]) || !args[i + 1] || args[i + 1].startsWith("--") || values[args[i]])
      throw new Error("Use --signed-target-files ZIP --ota ZIP --out NEW_FILE [--product FILE] [--channel FILE] [--apk-manifest FILE] [--keys-dir DIR] [--incremental-from ZIP]");
    values[args[i]] = args[i + 1];
  }
  if (!values["--signed-target-files"] || !values["--ota"] || !values["--out"]) throw new Error("--signed-target-files, --ota and --out are required");
  const product = JSON.parse(fs.readFileSync(values["--product"] ?? "android/aosp/pixel10a-product.json", "utf8"));
  const channel = JSON.parse(fs.readFileSync(values["--channel"] ?? product.ota?.channel, "utf8"));
  const apkManifest = values["--apk-manifest"] ? JSON.parse(fs.readFileSync(values["--apk-manifest"], "utf8")) : null;
  const keysDir = values["--keys-dir"];
  const certificates = keysDir ? keyCertificates(keysDir, ["releasekey", "platform"]) : {};
  const pkmd = keysDir && path.join(keysDir, product.avb?.publicKeyMetadata ?? "avb_pkmd.bin");
  const record = await compatibilityRecord({ signedTargetFiles: values["--signed-target-files"], ota: values["--ota"], product, channel, apkManifest, certificates,
    avbPublicKeySha256: pkmd && fs.existsSync(pkmd) ? sha256(fs.readFileSync(pkmd)) : null, incrementalFrom: values["--incremental-from"] ? path.basename(values["--incremental-from"]) : null });
  writeRecord(values["--out"], record);
  console.log(JSON.stringify(record, null, 2));
  if (record.problems.length) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
