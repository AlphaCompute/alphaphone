import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { androidEnv } from "./toolchain.mjs";
const env = androidEnv();
const run = (cmd, args, options = {}) =>
  execFileSync(cmd, args, { stdio: "inherit", env, ...options });
run("node", ["scripts/verify-upstream.mjs"]);
run("npm", ["run", "android:sync"]);
// Opt-in for constrained builders; retained APKs and source evidence are never cleaned.
const lowDisk = process.env.ALPHA_ANDROID_LOW_DISK === "1";
function cleanPackagingIntermediates() {
  const root = fs.realpathSync(path.resolve(import.meta.dirname, ".."));
  if (fs.realpathSync(process.cwd()) !== root)
    throw new Error("Low-disk build must run from this product checkout");
  const categories = ["assets", "compressed_assets", "merged_native_libs", "stripped_native_libs"];
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
function copyVariant(variant, modes = ["debug", "release"]) {
  fs.mkdirSync("artifacts", { recursive: true });
  for (const mode of modes) {
    const suffix = mode === "release" ? "-unsigned" : "";
    const source = `android/app/build/outputs/apk/${variant}/${mode}/app-${variant}-${mode}${suffix}.apk`;
    const destination = `artifacts/${variant}-${mode}${suffix}.apk`;
    // Node's reflink hint can fall back to a full copy on macOS. Use APFS
    // cloning there so distributing four APKs does not duplicate their bytes.
    if (process.platform === 'darwin') {
      try { run('/bin/cp', ['-c', source, destination]); }
      catch { fs.copyFileSync(source, destination); }
    } else fs.copyFileSync(source, destination, fs.constants.COPYFILE_FICLONE);
  }
}
if (lowDisk) {
  cleanPackagingIntermediates();
  for (const variant of ["standalone", "launcher"]) {
    const taskName = variant[0].toUpperCase() + variant.slice(1);
    for (const mode of ["debug", "release"]) {
      const modeName = mode[0].toUpperCase() + mode.slice(1);
      try {
        run("./gradlew", ["--no-daemon", `:app:assemble${taskName}${modeName}`,
          ...(mode === "debug" ? [`:app:assemble${taskName}DebugAndroidTest`] : [])], { cwd: "android" });
        copyVariant(variant, [mode]);
      } finally {
        cleanPackagingIntermediates();
      }
    }
  }
  run("./gradlew", ["--no-daemon", ":app:lint"], { cwd: "android" });
} else {
  run(
    "./gradlew",
    [
      "--no-daemon",
      ":app:assembleStandaloneDebug",
      ":app:assembleLauncherDebug",
      ":app:assembleStandaloneRelease",
      ":app:assembleLauncherRelease",
      ":app:assembleStandaloneDebugAndroidTest",
      ":app:assembleLauncherDebugAndroidTest",
      ":app:lint",
    ],
    { cwd: "android" },
  );
  for (const variant of ["standalone", "launcher"]) copyVariant(variant);
}
run("node", ["scripts/verify-apks.mjs"]);
