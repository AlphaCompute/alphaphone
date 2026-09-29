import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { tool } from "./toolchain.mjs";
export function inspectApk(file) {
  const badging = execFileSync(tool("aapt"), ["dump", "badging", file], {
    encoding: "utf8",
  });
  const xml = execFileSync(
    tool("aapt"),
    ["dump", "xmltree", file, "AndroidManifest.xml"],
    { encoding: "utf8" },
  );
  const names = execFileSync("unzip", ["-Z1", file], {
    encoding: "utf8",
  }).split("\n");
  const pkg = /package: name='([^']+)'/.exec(badging)?.[1];
  return {
    file,
    packageName: pkg,
    home: xml.includes("android.intent.category.HOME"),
    launcher: xml.includes("android.intent.category.LAUNCHER"),
    debuggable: /android:debuggable[^\n]*0xffffffff/.test(xml),
    sha256: createHash("sha256").update(fs.readFileSync(file)).digest("hex"),
    webPayload: names.includes("assets/public/index.html"),
    badging,
    xml,
  };
}
export function validateApk(file, identity, wantsHome) {
  const data = inspectApk(file);
  if (data.packageName !== identity.appId)
    throw new Error(`Wrong package in ${file}: ${data.packageName}`);
  if (data.home !== wantsHome || !data.launcher || !data.webPayload)
    throw new Error(`Invalid launcher/web payload contract in ${file}`);
  if (
    data.xml.includes("android.permission.WRITE_SETTINGS") ||
    data.xml.includes("android.permission.CAMERA")
  )
    throw new Error(`Unexpected elevated permission in ${file}`);
  return data;
}
