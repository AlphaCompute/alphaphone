import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { androidEnv } from "./toolchain.mjs";
const env = androidEnv();
const run = (cmd, args, options = {}) =>
  execFileSync(cmd, args, { stdio: "inherit", env, ...options });
run("node", ["scripts/verify-upstream.mjs"]);
run("npm", ["run", "android:sync"]);
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
fs.mkdirSync("artifacts", { recursive: true });
for (const variant of ["standalone", "launcher"])
  for (const mode of ["debug", "release"]) {
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
run("node", ["scripts/verify-apks.mjs"]);
