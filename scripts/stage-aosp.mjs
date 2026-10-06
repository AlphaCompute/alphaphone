import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { androidEnv, tool } from "./toolchain.mjs";
import { clockProductRequirement } from "./aosp-clock-contract.mjs";

/**
 * Refuse inputs that must never reach an image: anything from the separate
 * test-mocks build, APKs whose packaged web bundle was built with test mocks,
 * and releases verify-apks recorded as non-distributable. Production staging
 * additionally requires a verified distributable release from apk-manifest.json.
 */
function admitApk({ apk, hash, development, manifestFile }) {
  const testMocksDir = path.resolve("artifacts/test-mocks");
  const real = fs.realpathSync(apk);
  for (const candidate of [path.resolve(apk), real]) {
    const relative = path.relative(testMocksDir, candidate);
    if (!relative.startsWith("..") && !path.isAbsolute(relative))
      throw new Error(`Refusing ${apk}: artifacts/test-mocks/ builds are never staged into an image.`);
  }
  let flags;
  try {
    flags = JSON.parse(execFileSync("unzip", ["-p", apk, "assets/public/build-flags.json"], { encoding: "utf8" }));
  } catch {
    throw new Error(`Refusing ${apk}: its web bundle has no assets/public/build-flags.json, so its test-mocks flag is unverified.`);
  }
  if (flags.testMocks !== false)
    throw new Error(`Refusing ${apk}: its web bundle was built with test mocks enabled.`);
  const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, "utf8")) : null;
  const entry = manifest?.results?.find(row => row.sha256 === hash) ?? null;
  if (entry && (manifest.testMocks === true || entry.testMocks === true))
    throw new Error(`Refusing ${apk}: ${manifestFile} records it as a test-mocks build.`);
  if (entry?.distributable === false)
    throw new Error(`Refusing ${apk}: ${manifestFile} records this release as not distributable (runtime ${entry.runtime ?? "unknown"}, ${entry.signed ? "signed" : "unsigned"}).`);
  if (!development && !(entry && entry.mode === "release" && entry.distributable === true))
    throw new Error(`Production staging requires a release APK that verify-apks recorded as distributable in ${manifestFile}.`);
}
const args = process.argv.slice(2);
const get = (key) => {
  const i = args.indexOf(key);
  return i < 0 ? null : args[i + 1];
};
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--development") continue;
  if (
    !["--apk", "--output", "--descriptor", "--apk-manifest"].includes(args[i]) ||
    !args[i + 1] ||
    args[i + 1].startsWith("--")
  )
    throw new Error(
      "Use --apk FILE --output NEW_DIR [--descriptor FILE | --development] [--apk-manifest FILE]",
    );
  i++;
}
const development = args.includes("--development");
const apk = get("--apk");
if (!apk) throw new Error("Supply --apk PATH to a signed launcher APK.");
const identity = JSON.parse(fs.readFileSync("app.config.json"));
let descriptor = get("--descriptor");
const hash = createHash("sha256").update(fs.readFileSync(apk)).digest("hex");
admitApk({
  apk,
  hash,
  development,
  manifestFile: get("--apk-manifest") || "artifacts/apk-manifest.json",
});
const env = androidEnv();
if (!descriptor) {
  if (!development)
    throw new Error(
      "Production staging requires an independently reviewed --descriptor with pinned hash and signer.",
    );
  const cert = execFileSync(
    tool("apksigner"),
    ["verify", "--print-certs", apk],
    { encoding: "utf8", env },
  );
  const signer = /Signer #1 certificate SHA-256 digest:\s*([a-fA-F0-9]+)/
    .exec(cert)?.[1]
    .toLowerCase();
  if (!signer) throw new Error("No verified signer found");
  fs.mkdirSync("artifacts", { recursive: true });
  descriptor = `artifacts/launcher-${hash.slice(0, 12)}.json`;
  fs.writeFileSync(
    descriptor,
    JSON.stringify(
      {
        schemaVersion: 1,
        brand: identity.slug.replaceAll("-", "_"),
        moduleName: identity.moduleName,
        packageName: identity.appId,
        apkSha256: hash,
        certificateSha256: signer,
      },
      null,
      2,
    ) + "\n",
  );
}
const reviewed = JSON.parse(fs.readFileSync(descriptor));
if (
  reviewed.packageName !== identity.appId ||
  reviewed.moduleName !== identity.moduleName
)
  throw new Error("Descriptor does not belong to this product");
const output =
  get("--output") || `artifacts/aosp/${identity.slug}-${hash.slice(0, 12)}`;
execFileSync(
  "node",
  [
    "vendor/eliza/packages/os/scripts/android/stage-launcher-overlay.ts",
    "--descriptor",
    path.resolve(descriptor),
    "--apk",
    path.resolve(apk),
    "--output",
    path.resolve(output),
    "--aapt",
    tool("aapt"),
    "--apksigner",
    tool("apksigner"),
    ...(development ? ["--development"] : []),
  ],
  { stdio: "inherit", env },
);
fs.appendFileSync(path.join(output, "product.mk"), clockProductRequirement);
console.log(
  `Add under vendor/${identity.slug.replaceAll("-", "_")} and inherit product.mk from the selected AOSP product. This is staging evidence, not an image boot.`,
);
