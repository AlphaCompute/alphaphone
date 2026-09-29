import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { validateApk } from "./apk.mjs";
import { androidEnv, tool } from "./toolchain.mjs";
const identity = JSON.parse(fs.readFileSync("app.config.json"));
const results = [];
for (const variant of ["standalone", "launcher"])
  for (const mode of ["debug", "release"]) {
    const file = `artifacts/${variant}-${mode}${mode === "release" ? "-unsigned" : ""}.apk`;
    const d = validateApk(file, identity, variant === "launcher");
    if (d.debuggable !== (mode === "debug"))
      throw new Error(`Wrong debug flag: ${file}`);
    if (mode === "debug")
      execFileSync(tool("apksigner"), ["verify", file], { env: androidEnv() });
    const { badging, xml, ...record } = d;
    results.push(record);
  }
fs.writeFileSync(
  "artifacts/apk-manifest.json",
  JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      upstream: JSON.parse(fs.readFileSync("upstream.lock.json")),
      results,
    },
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify(results, null, 2));
