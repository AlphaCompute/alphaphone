/**
 * Build and verify the four Android APKs (standalone/launcher, debug/release).
 *
 *   npm run android:build [-- --allow-unpackaged-runtime]
 *   npm run android:build -- --test-mocks
 *
 * Inputs are checked first (scripts/android-build-preflight.mjs): the pinned
 * checkout, the installed speech AAR, the prepared runtime source and, for
 * distribution builds, the staged resident runtime. `npm run android:build:local`
 * prepares and stages the runtime before calling this script.
 *
 * Distribution builds (the default) are always flag-off: ELIZA_DEV_ALLOW_TEST_MOCKS
 * and its VITE_ mirror are removed from every child environment, whatever the
 * caller exported, and Gradle receives -PELIZA_DEV_ALLOW_TEST_MOCKS=0. Outputs go
 * to artifacts/.
 * --test-mocks builds the web bundle and APKs with the flag on and writes only
 * under artifacts/test-mocks/; it never replaces distribution artifacts.
 * Afterwards (also on failure) it rebuilds and syncs the flag-off bundle, so
 * web-dist and the Android web assets never stay flag-on.
 * --allow-unpackaged-runtime is a developer option forwarded to verify-apks:
 * releases without the staged resident runtime are recorded distributable:false
 * instead of failing the build.
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { copyFilesClone } from "./copy-file-clone.mjs";

const FLAG = "ELIZA_DEV_ALLOW_TEST_MOCKS";
const FLAG_ENV_NAMES = [FLAG, `VITE_${FLAG}`, `ORG_GRADLE_PROJECT_${FLAG}`];
const SIGNING_ENV = ["ELIZAOS_KEYSTORE_PATH", "ELIZAOS_KEYSTORE_PASSWORD", "ELIZAOS_KEY_ALIAS", "ELIZAOS_KEY_PASSWORD"];
const USAGE = "Usage: npm run android:build [-- --test-mocks] [-- --allow-unpackaged-runtime]";

export function parseBuildArgs(argv) {
  const options = { testMocks: false, allowUnpackagedRuntime: false };
  for (const arg of argv) {
    if (arg === "--test-mocks") options.testMocks = true;
    else if (arg === "--allow-unpackaged-runtime") options.allowUnpackagedRuntime = true;
    else throw new Error(`Unknown option ${arg}. ${USAGE}`);
  }
  return options;
}

/** Child environment for a build: the flag is set only for --test-mocks. */
export function buildEnv(base, { testMocks }) {
  const env = { ...base };
  for (const name of FLAG_ENV_NAMES) delete env[name];
  if (testMocks) {
    env[FLAG] = "1";
    env[`VITE_${FLAG}`] = "1";
  }
  return env;
}

export function gradleFlagArgs({ testMocks, allowUnpackagedRuntime = false }) {
  return [`-P${FLAG}=${testMocks ? "1" : "0"}`, `-PELIZA_ALLOW_UNPACKAGED_RUNTIME=${allowUnpackagedRuntime ? "1" : "0"}`];
}

export const outputDirectory = ({ testMocks }) => (testMocks ? "artifacts/test-mocks" : "artifacts");

/**
 * A test-mocks build has to sync a flag-on bundle into web-dist and the Android
 * assets. Afterwards, whether it succeeded or failed, rebuild and sync the
 * flag-off bundle so neither web-dist nor android/app/src/main/assets/public is
 * left carrying mocks for a later sync, Gradle or archive step.
 */
export function withDistributionWebRestored(options, baseEnv, run, body, { root = process.cwd() } = {}) {
  if (!options.testMocks) return body();
  let failed = false;
  try {
    return body();
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    try {
      run("npm", ["run", "android:sync"], { env: buildEnv(baseEnv, { testMocks: false }) });
      const flags = JSON.parse(fs.readFileSync(path.join(root, "web-dist/build-flags.json"), "utf8"));
      if (flags.testMocks !== false) throw new Error("web-dist/build-flags.json still records testMocks after restoring the distribution bundle");
      console.log("Restored the flag-off web bundle in web-dist and the Android assets.");
    } catch (error) {
      // Never hide the original failure; still report that web-dist may carry mocks.
      if (!failed) throw error;
      console.error(`Could not restore the flag-off web bundle: ${error.message}`);
    }
  }
}
export const signingRequested = env => SIGNING_ENV.every(name => Boolean(env[name]));

async function main() {
  const options = parseBuildArgs(process.argv.slice(2));
  // Report missing inputs (pinned checkout, speech AAR, prepared/staged runtime)
  // with the exact command to run, before web sync and a long Gradle build.
  const preflight = spawnSync(process.execPath, [path.join(import.meta.dirname, "android-build-preflight.mjs"), ...process.argv.slice(2)], { stdio: "inherit" });
  if (preflight.status !== 0) process.exit(preflight.status ?? 1);
  // The toolchain resolver lives in the pinned checkout, which the preflight verified.
  const { androidEnv } = await import("./toolchain.mjs");
  const baseEnv = androidEnv();
  const run = (cmd, args, extra = {}) =>
    execFileSync(cmd, args, { stdio: "inherit", env: buildEnv(baseEnv, options), ...extra });
  withDistributionWebRestored(options, baseEnv, run, () => build(options, baseEnv, run));
}

function build(options, baseEnv, run) {
  const env = buildEnv(baseEnv, options);
  const outDir = outputDirectory(options);
  const gradleFlags = gradleFlagArgs(options);
  console.log(`Android build: ${options.testMocks ? "TEST-MOCKS (never distributable) -> " : "distribution, test mocks off -> "}${outDir}/`);

  run("node", ["scripts/verify-upstream.mjs"]);
  run("npm", ["run", "android:sync"]);
  // The packaged web bundle must carry the requested flag before Gradle runs.
  const flagsFile = "web-dist/build-flags.json";
  if (fs.existsSync(flagsFile)) {
    const flags = JSON.parse(fs.readFileSync(flagsFile, "utf8"));
    if (flags.testMocks !== options.testMocks)
      throw new Error(`${flagsFile} records testMocks=${flags.testMocks}; expected ${options.testMocks}`);
  }

  const root = fs.realpathSync(path.resolve(import.meta.dirname, ".."));
  const outputs = path.join(root, "android/app/build/outputs");
  // Remove previous release outputs so signed/unsigned detection sees only this build.
  for (const variant of ["standalone", "launcher"]) {
    fs.rmSync(path.join(outputs, "apk", variant, "release"), { recursive: true, force: true });
    fs.rmSync(path.join(outputs, "mapping", `${variant}Release`), { recursive: true, force: true });
  }
  fs.mkdirSync(outDir, { recursive: true });
  fs.rmSync(path.join(outDir, "apk-manifest.json"), { force: true });
  fs.rmSync(path.join(outDir, "mapping"), { recursive: true, force: true });

  // Opt-in for constrained builders; retained APKs and source evidence are never cleaned.
  const lowDisk = process.env.ALPHA_ANDROID_LOW_DISK === "1";
  function cleanPackagingIntermediates() {
    if (fs.realpathSync(process.cwd()) !== root)
      throw new Error("Low-disk build must run from this product checkout");
    const categories = ["assets", "compressed_assets", "merged_native_libs", "merged_jni_libs", "stripped_native_libs"];
    const targets = categories.map(name => path.join(root, "android/app/build/intermediates", name));
    // Preflight every ancestor before deleting anything. rmSync removes nested links
    // themselves, never their targets; a linked category or ancestor is rejected.
    for (const target of targets) {
      let current = root;
      for (const segment of path.relative(root, target).split(path.sep)) {
        current = path.join(current, segment);
        let stat;
        try { stat = fs.lstatSync(current); }
        catch (error) { if (error.code === "ENOENT") break; throw error; }
        if (stat.isSymbolicLink() || !stat.isDirectory())
          throw new Error(`Unsafe packaging intermediate path: ${current}`);
      }
    }
    for (const target of targets) fs.rmSync(target, { recursive: true, force: true });
  }
  function copy(source, destination) {
    fs.rmSync(destination, { force: true });
    copyFilesClone([{ source, destination }]);
  }
  const requested = signingRequested(env);
  function copyVariant(variant, modes = ["debug", "release"]) {
    for (const mode of modes) {
      const dir = path.join(outputs, "apk", variant, mode);
      if (mode === "debug") {
        copy(path.join(dir, `app-${variant}-debug.apk`), path.join(outDir, `${variant}-debug.apk`));
        // The shared Gradle outputs are overwritten by the next build; keep the
        // matching instrumentation APK beside a test-mocks build.
        if (options.testMocks)
          copy(path.join(outputs, "apk/androidTest", variant, "debug", `app-${variant}-debug-androidTest.apk`),
            path.join(outDir, `${variant}-androidTest.apk`));
        continue;
      }
      const signed = path.join(dir, `app-${variant}-release.apk`);
      const unsigned = path.join(dir, `app-${variant}-release-unsigned.apk`);
      const isSigned = fs.existsSync(signed);
      if (!isSigned && !fs.existsSync(unsigned)) throw new Error(`Gradle produced no ${variant} release APK in ${dir}`);
      if (requested && !isSigned)
        throw new Error(`${SIGNING_ENV.join(", ")} are set but Gradle produced an unsigned ${variant} release`);
      const name = `${variant}-release${isSigned ? "" : "-unsigned"}.apk`;
      // Exactly one release name per variant: drop the other form from older builds.
      fs.rmSync(path.join(outDir, `${variant}-release${isSigned ? "-unsigned" : ""}.apk`), { force: true });
      copy(isSigned ? signed : unsigned, path.join(outDir, name));
      const mapping = path.join(outputs, "mapping", `${variant}Release`, "mapping.txt");
      if (fs.existsSync(mapping)) {
        const mappingDir = path.join(outDir, "mapping");
        fs.mkdirSync(mappingDir, { recursive: true });
        fs.copyFileSync(mapping, path.join(mappingDir, `${variant}-release-mapping.txt`));
      }
    }
  }
  if (lowDisk) {
    cleanPackagingIntermediates();
    for (const variant of ["standalone", "launcher"]) {
      const taskName = variant[0].toUpperCase() + variant.slice(1);
      for (const mode of ["debug", "release"]) {
        const modeName = mode[0].toUpperCase() + mode.slice(1);
        try {
          run("./gradlew", ["--no-daemon", ...gradleFlags, `:app:assemble${taskName}${modeName}`,
            ...(mode === "debug" ? [`:app:assemble${taskName}DebugAndroidTest`] : [])], { cwd: "android" });
          copyVariant(variant, [mode]);
        } finally {
          cleanPackagingIntermediates();
        }
      }
    }
    if (!options.testMocks) run("./gradlew", ["--no-daemon", ...gradleFlags, ":app:lint"], { cwd: "android" });
  } else {
    run(
      "./gradlew",
      [
        "--no-daemon",
        ...gradleFlags,
        ":app:assembleStandaloneDebug",
        ":app:assembleLauncherDebug",
        ":app:assembleStandaloneRelease",
        ":app:assembleLauncherRelease",
        ":app:assembleStandaloneDebugAndroidTest",
        ":app:assembleLauncherDebugAndroidTest",
        ...(options.testMocks ? [] : [":app:lint"]),
      ],
      { cwd: "android" },
    );
    for (const variant of ["standalone", "launcher"]) copyVariant(variant);
  }
  fs.writeFileSync(path.join(outDir, "build-config.json"), JSON.stringify({
    createdAt: new Date().toISOString(),
    testMocks: options.testMocks,
    mapsConfigured: Boolean(env.VITE_MAPS_BASE_URL),
    signingRequested: requested,
    versionOverride: { code: env.ELIZAOS_VERSION_CODE ?? null, name: env.ELIZAOS_VERSION_NAME ?? null },
  }, null, 2) + "\n");
  run("node", ["scripts/verify-apks.mjs",
    ...(options.testMocks ? ["--test-mocks"] : []),
    ...(options.allowUnpackagedRuntime ? ["--allow-unpackaged-runtime"] : [])]);
  if (options.testMocks)
    console.log("Test-mocks APKs are for mock-isolation instrumentation only and are never distributable.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
