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
    data.xml.includes("android.permission.WRITE_SETTINGS")
  )
    throw new Error(`Unexpected elevated permission in ${file}`);
  for (const permission of ['CAMERA']) {
    if (!data.xml.includes('android.permission.' + permission)) throw new Error(`Missing native feature permission ${permission} in ${file}`);
  }
  // MVP-DEFERRED: Contacts is not packaged; restore only with the documented scope gate.
  for (const permission of ['READ_CONTACTS', 'WRITE_CONTACTS']) {
    if (data.xml.includes('android.permission.' + permission)) throw new Error(`Deferred Contacts permission ${permission} in ${file}`);
  }
  // aapt badging distinguishes required hardware from optional feature declarations.
  if (/uses-feature: name='android\.hardware\.camera(?:\.any|\.autofocus)?'/.test(data.badging))
    throw new Error(`Camera hardware must remain optional in ${file}`);
  return data;
}
