import fs from "node:fs";
import path from "node:path";
import os from "node:os";
export function androidEnv() {
  const sdk =
    process.env.ANDROID_HOME ||
    process.env.ANDROID_SDK_ROOT ||
    path.join(os.homedir(), "Library/Android/sdk");
  const java =
    process.env.JAVA_HOME ||
    (process.platform === "darwin"
      ? "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
      : "");
  if (!fs.existsSync(sdk))
    throw new Error(
      "Set ANDROID_HOME to an installed Android SDK (platform 36).",
    );
  if (!java || !fs.existsSync(java))
    throw new Error("Set JAVA_HOME to JDK 21.");
  return {
    ...process.env,
    ANDROID_HOME: sdk,
    ANDROID_SDK_ROOT: sdk,
    JAVA_HOME: java,
  };
}
export function tool(name) {
  return path.join(androidEnv().ANDROID_HOME, "build-tools", "36.0.0", name);
}
