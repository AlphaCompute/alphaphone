/**
 * Release-sign an alpha_stallion_phone target-files zip and build its OTA (issue #400).
 *
 * Runs on the Linux image host, after the production image build, with AOSP releasetools
 * (otatools `bin/`) and a decrypted release key directory supplied at runtime:
 *
 *   node scripts/sign-aosp-release.mjs \
 *     --target-files /abs/unsigned-target_files.zip --target-files-sha256 <hex from the build record> \
 *     --keys-dir /dev/shm/keys --releasetools /abs/otatools/bin --out /abs/new-release-dir \
 *     [--apk-manifest /abs/apk-manifest.json] [--incremental-from /abs/previous-signed-target_files.zip] [--dry-run]
 *
 * It follows the upstream key layout and signing job (vendor/eliza/packages/os/android/signing):
 * `sign_target_files_apks -o -d KEYS` with the `avb` key for vbmeta and its chained partitions,
 * then `ota_from_target_files -k KEYS/releasekey`, then writes release-record.json
 * (scripts/aosp-release-record.mjs) and the public avb_pkmd.bin for avb_custom_key enrollment.
 *
 * Keys never come from the repository: the key directory must be outside every Git working tree
 * and private to its owner. Private keys are only passed by path to the releasetools; this script
 * reads public certificates and avb_pkmd.bin to compare them with the reviewed digests in
 * android/aosp/pixel10a-product.json and android/aosp/pixel10a-ota-channel.json, and refuses on
 * any UNSET or mismatching value. --dry-run prints the plan and every problem and runs nothing.
 * A signed output is not an image boot, an applied update, a rollback or recovery drill, or
 * release qualification.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PIXEL10A_PRODUCT, pixel10aProductProblems, placeholderFields } from "./aosp-pixel10a.mjs";
import { compatibilityRecord, fileSha256, keyCertificates, writeRecord } from "./aosp-release-record.mjs";

/** x509/pk8 keys sign_target_files_apks maps by default name (upstream key-manifest.json). */
export const X509_KEYS = Object.freeze(["releasekey", "platform", "shared", "media", "networkstack", "sdk_sandbox", "bluetooth", "nfc"]);
export const RELEASETOOLS = Object.freeze(["sign_target_files_apks", "ota_from_target_files"]);
const HEX64 = /^[0-9a-f]{64}$/;
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

/** Channel fields that must be reviewed before signing. A first release has no known-good predecessor, and drills follow signing. */
export function channelSigningProblems(channel, product, file = "android/aosp/pixel10a-ota-channel.json") {
  if (!channel || typeof channel !== "object") return [`${file} is missing or unreadable`];
  const problems = [];
  const { recovery, drills, ...signing } = channel;
  const { knownGoodRelease, ...stock } = recovery ?? {};
  for (const field of [...placeholderFields(signing), ...placeholderFields(stock).map(name => `recovery.${name}`)]) problems.push(`${file}: ${field} is unset or a placeholder`);
  if (channel.schema !== 1) problems.push(`${file}: schema must be 1`);
  if (channel.product !== product?.product || channel.device !== product?.device?.codename) problems.push(`${file}: channel is not for ${product?.product ?? "the product"} on ${product?.device?.codename ?? "its device"}`);
  if (!HEX64.test(channel.otaCertificateSha256 ?? "")) problems.push(`${file}: otaCertificateSha256 must be a SHA-256`);
  if (!HEX64.test(channel.avbPublicKeySha256 ?? "")) problems.push(`${file}: avbPublicKeySha256 must be a SHA-256`);
  else if (channel.avbPublicKeySha256 !== product?.avb?.publicKeySha256) problems.push(`${file}: avbPublicKeySha256 is not the product's avb.publicKeySha256`);
  if (channel.downgradeAllowed !== false) problems.push(`${file}: downgradeAllowed must be false`);
  if (!HEX64.test(recovery?.stockFactoryImage?.sha256 ?? "")) problems.push(`${file}: recovery.stockFactoryImage.sha256 must be a SHA-256`);
  return problems;
}

/**
 * Problems with distributing a signed release on the channel: a retained known-good recovery
 * release and passed signed-update, interruption, rollback and stock-recovery drills. These are
 * recorded from executed drills; nothing in this repository runs them.
 */
export function channelDistributionProblems(channel, file = "android/aosp/pixel10a-ota-channel.json") {
  const problems = [];
  for (const field of placeholderFields(channel?.recovery?.knownGoodRelease ?? {})) problems.push(`${file}: recovery.knownGoodRelease.${field} is unset`);
  for (const [drill, result] of Object.entries(channel?.drills ?? {})) if (result !== "passed") problems.push(`${file}: ${drill} drill is ${JSON.stringify(result)}, not passed`);
  if (!channel?.drills || !Object.keys(channel.drills).length) problems.push(`${file}: no update or recovery drills are recorded`);
  return problems;
}

function insideGitWorkTree(dir) {
  const out = spawnSync("git", ["-C", dir, "rev-parse", "--is-inside-work-tree"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  return out.status === 0 && out.stdout.trim() === "true";
}

/** Runtime key directory checks: location and permissions, file presence, and public digests. Never opens a private key. */
export function keyDirectoryProblems(keysDir, { product, channel, root = process.cwd() } = {}) {
  if (!keysDir) return ["--keys-dir is required: the decrypted release key directory, supplied at signing time"];
  if (!path.isAbsolute(keysDir)) return ["--keys-dir must be an absolute path"];
  if (!fs.existsSync(keysDir) || !fs.statSync(keysDir).isDirectory()) return [`--keys-dir ${keysDir} is not a directory`];
  const problems = [];
  const real = fs.realpathSync(keysDir), repo = fs.realpathSync(root);
  const relative = path.relative(repo, real);
  if (!relative.startsWith("..") && !path.isAbsolute(relative)) problems.push("--keys-dir is inside this repository; release keys never enter a working tree");
  if (insideGitWorkTree(real)) problems.push("--keys-dir is inside a Git working tree; release keys never enter a working tree");
  if (fs.statSync(real).mode & 0o077) problems.push("--keys-dir must not be readable or writable by group or others (mode 0700)");
  const missing = [...X509_KEYS.flatMap(name => [`${name}.pk8`, `${name}.x509.pem`]), product?.avb?.vbmetaKey ?? "avb.pem", product?.avb?.publicKeyMetadata ?? "avb_pkmd.bin"]
    .filter(name => !fs.existsSync(path.join(real, name)));
  if (missing.length) problems.push(`--keys-dir lacks ${missing.join(", ")} (decrypt the release key bundle first; .enc files are not read)`);
  const certs = keyCertificates(real, ["platform", "releasekey"]);
  if (certs.platform && certs.platform !== product?.signer?.platformCertificateSha256) problems.push(`platform.x509.pem is ${certs.platform}, not the product's signer.platformCertificateSha256`);
  if (certs.releasekey && certs.releasekey !== channel?.otaCertificateSha256) problems.push(`releasekey.x509.pem is ${certs.releasekey}, not the channel's otaCertificateSha256`);
  const pkmd = path.join(real, product?.avb?.publicKeyMetadata ?? "avb_pkmd.bin");
  if (fs.existsSync(pkmd) && sha256(fs.readFileSync(pkmd)) !== product?.avb?.publicKeySha256) problems.push(`${path.basename(pkmd)} is not the product's avb.publicKeySha256`);
  return problems;
}

/** The exact releasetools invocations. Key paths are arguments only; their contents are never read here. */
export function signingCommands({ targetFiles, keysDir, releasetools, out, product, incrementalFrom = null }) {
  const keys = path.resolve(keysDir), tools = path.resolve(releasetools);
  const algorithm = product.avb.algorithm, avbKey = path.join(keys, product.avb.vbmetaKey);
  const signed = path.join(out, "signed-target_files.zip"), ota = path.join(out, incrementalFrom ? "incremental-ota.zip" : "ota.zip");
  const avb = ["--avb_vbmeta_key", avbKey, "--avb_vbmeta_algorithm", algorithm,
    ...product.avb.chainedPartitions.flatMap(partition => [`--avb_${partition}_key`, avbKey, `--avb_${partition}_algorithm`, algorithm])];
  return {
    signed, ota,
    commands: [
      { tool: path.join(tools, "sign_target_files_apks"), args: ["-p", path.dirname(tools), "-o", "-d", keys, ...avb, path.resolve(targetFiles), signed] },
      { tool: path.join(tools, "ota_from_target_files"), args: ["-p", path.dirname(tools), "-k", path.join(keys, "releasekey"), ...(incrementalFrom ? ["-i", path.resolve(incrementalFrom)] : []), signed, ota] },
    ],
  };
}

/** Every reason the signing job would refuse, without running anything. */
export async function signingProblems({ root = process.cwd(), targetFiles, targetFilesSha256, keysDir, releasetools, out, incrementalFrom, product, channel }) {
  const problems = [...pixel10aProductProblems(root)];
  if (!HEX64.test(product?.avb?.publicKeySha256 ?? "")) problems.push(`${PIXEL10A_PRODUCT}: avb.publicKeySha256 must be a SHA-256`);
  if (!/^SHA(256|512)_RSA(4096|8192)$/.test(product?.avb?.algorithm ?? "")) problems.push(`${PIXEL10A_PRODUCT}: avb.algorithm must be an RSA-4096/8192 AVB algorithm`);
  if (!Array.isArray(product?.avb?.chainedPartitions)) problems.push(`${PIXEL10A_PRODUCT}: avb.chainedPartitions must list the chained vbmeta partitions`);
  problems.push(...channelSigningProblems(channel, product, product?.ota?.channel));
  if (!targetFiles || !fs.existsSync(targetFiles) || !fs.statSync(targetFiles).isFile()) problems.push("--target-files must name the unsigned target-files zip");
  else if (!HEX64.test(targetFilesSha256 ?? "")) problems.push("--target-files-sha256 must be the SHA-256 from the image build record");
  else if (await fileSha256(targetFiles) !== targetFilesSha256) problems.push("--target-files differs from --target-files-sha256");
  if (incrementalFrom && !fs.existsSync(incrementalFrom)) problems.push("--incremental-from must name the previous signed target-files zip");
  if (!releasetools) problems.push("--releasetools is required: the otatools bin directory");
  else for (const name of RELEASETOOLS) {
    const tool = path.join(releasetools, name);
    try { fs.accessSync(tool, fs.constants.X_OK); } catch { problems.push(`--releasetools lacks an executable ${name}`); }
  }
  if (!out) problems.push("--out is required: a new output directory");
  else if (fs.existsSync(out)) problems.push(`--out ${out} already exists`);
  problems.push(...keyDirectoryProblems(keysDir, { product, channel, root }));
  return [...new Set(problems)];
}

export async function signRelease(options) {
  const root = options.root ?? process.cwd();
  const read = rel => JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
  const product = read(PIXEL10A_PRODUCT);
  let channel = null;
  try { channel = read(product.ota?.channel); } catch { channel = null; }
  const problems = await signingProblems({ ...options, root, product, channel });
  const plan = Array.isArray(product.avb?.chainedPartitions) && options.targetFiles && options.keysDir && options.releasetools && options.out
    ? signingCommands({ ...options, product }) : null;
  if (options.dryRun) return { dryRun: true, problems, commands: plan?.commands ?? [], ran: false };
  if (problems.length) throw new Error(`Refusing to sign the release:\n${problems.map(item => `  - ${item}`).join("\n")}`);
  fs.mkdirSync(options.out, { mode: 0o700 });
  const env = { ...process.env, PATH: `${path.resolve(options.releasetools)}${path.delimiter}${process.env.PATH ?? ""}` };
  for (const { tool, args } of plan.commands) execFileSync(tool, args, { stdio: "inherit", env });
  const pkmd = path.join(options.keysDir, product.avb.publicKeyMetadata);
  fs.copyFileSync(pkmd, path.join(options.out, "avb_pkmd.bin"), fs.constants.COPYFILE_EXCL);
  const apkManifest = options.apkManifest ? JSON.parse(fs.readFileSync(options.apkManifest, "utf8")) : null;
  const certificates = keyCertificates(options.keysDir, X509_KEYS);
  const record = await compatibilityRecord({
    signedTargetFiles: plan.signed, ota: plan.ota, product, channel, apkManifest, certificates,
    avbPublicKeySha256: sha256(fs.readFileSync(pkmd)),
    incrementalFrom: options.incrementalFrom ? { file: path.basename(options.incrementalFrom), sha256: await fileSha256(options.incrementalFrom) } : null,
    inputs: { unsignedTargetFilesSha256: options.targetFilesSha256, productDescriptorSha256: sha256(fs.readFileSync(path.join(root, PIXEL10A_PRODUCT))), sourceLockSha256: product.sourceLock.sha256 },
  });
  const recordFile = path.join(options.out, "release-record.json");
  writeRecord(recordFile, record);
  if (record.problems.length) throw new Error(`Signed outputs are inconsistent; see ${recordFile}:\n${record.problems.map(item => `  - ${item}`).join("\n")}`);
  return { dryRun: false, problems: [], commands: plan.commands, ran: true, record: recordFile, distributionProblems: channelDistributionProblems(channel, product.ota.channel) };
}

export function parseSigningArgs(args) {
  const names = { "--target-files": "targetFiles", "--target-files-sha256": "targetFilesSha256", "--keys-dir": "keysDir", "--releasetools": "releasetools", "--out": "out", "--apk-manifest": "apkManifest", "--incremental-from": "incrementalFrom" };
  const options = { dryRun: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") { options.dryRun = true; continue; }
    const key = names[args[i]];
    if (!key || !args[i + 1] || args[i + 1].startsWith("--") || options[key] !== undefined)
      throw new Error("Use --target-files ZIP --target-files-sha256 HEX --keys-dir DIR --releasetools DIR --out NEW_DIR [--apk-manifest FILE] [--incremental-from ZIP] [--dry-run]");
    options[key] = args[++i];
  }
  return options;
}

async function main(args) {
  const result = await signRelease(parseSigningArgs(args));
  if (result.dryRun) {
    console.log(JSON.stringify({ dryRun: true, ran: false, commands: result.commands.map(({ tool, args }) => [tool, ...args]), problems: result.problems }, null, 2));
    if (result.problems.length) console.warn(`Signing would be refused (${result.problems.length} problem${result.problems.length === 1 ? "" : "s"}).`);
    return;
  }
  console.log(`Signed release written to ${path.dirname(result.record)}. Compatibility record: ${result.record}.`);
  for (const problem of result.distributionProblems) console.warn(`NOT DISTRIBUTABLE ${problem}`);
  console.log("This is a signed build output, not an image boot, an applied update, a rollback or recovery drill, or release qualification.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
