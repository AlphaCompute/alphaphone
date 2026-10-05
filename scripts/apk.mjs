import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { androidEnv, tool } from "./toolchain.mjs";

// Debug-only native hooks that may exist only in an explicit test-mocks build
// (src/testMocks attached to debug variants when ELIZA_DEV_ALLOW_TEST_MOCKS=1).
export const DEVELOPMENT_CLASSES = Object.freeze([
  "SyntheticAutofillService",
  "DevelopmentAgentPlugin",
  "DevelopmentVoiceCapture",
]);
// Components a distribution APK may export. Each one must be guarded by the
// listed permission (null: a deliberate public entry point).
export const EXPORTED_COMPONENTS = Object.freeze({
  "ai.elizaresearch.alphaphone.MainActivity": null,
  "ai.elizaresearch.alphaphone.AlphaAssistActivity": null,
  "ai.elizaresearch.alphaphone.AlphaNotificationListener": "android.permission.BIND_NOTIFICATION_LISTENER_SERVICE",
  "androidx.work.impl.background.systemjob.SystemJobService": "android.permission.BIND_JOB_SERVICE",
  "androidx.work.impl.diagnostics.DiagnosticsReceiver": "android.permission.DUMP",
  "androidx.profileinstaller.ProfileInstallReceiver": "android.permission.DUMP",
});
const COMPONENT_TAGS = new Set(["activity", "activity-alias", "service", "receiver", "provider"]);
const TRUE = "0xffffffff";

/** Parse `aapt dump xmltree` output into an element tree. */
export function parseXmlTree(text) {
  const root = { name: "#root", attrs: {}, children: [], indent: -1 };
  const stack = [root];
  for (const line of text.split("\n")) {
    const match = /^(\s*)([EA]): (.*)$/.exec(line);
    if (!match) continue;
    const indent = match[1].length;
    if (match[2] === "E") {
      const name = /^(\S+)/.exec(match[3])[1];
      while (stack.at(-1).indent >= indent) stack.pop();
      const node = { name, attrs: {}, children: [], indent };
      stack.at(-1).children.push(node);
      stack.push(node);
    } else {
      while (stack.length > 1 && stack.at(-1).indent >= indent) stack.pop();
      // e.g. android:name(0x01010003)="value" (Raw: "value")
      //      android:exported(0x01010010)=(type 0x12)0xffffffff
      //      android:networkSecurityConfig(0x01010527)=@0x7f150002
      const attr = /^(?:[^\s(]*:)?([A-Za-z_][\w.-]*)(?:\(0x[0-9a-f]+\))?=(.*)$/.exec(match[3]);
      if (!attr) continue;
      let value = attr[2].trim();
      const quoted = /^"((?:[^"\\]|\\.)*)"/.exec(value);
      if (quoted) value = quoted[1];
      else {
        const typed = /^\(type 0x[0-9a-f]+\)(0x[0-9a-f]+)$/.exec(value);
        if (typed) value = typed[1];
      }
      stack.at(-1).attrs[attr[1]] = value;
    }
  }
  return root;
}
function* walk(node) {
  for (const child of node.children) {
    yield child;
    yield* walk(child);
  }
}
const isTrue = value => value === TRUE;
const isFalse = value => value === "0x0";

/** Extract the release-relevant facts from aapt manifest and badging dumps. */
export function manifestFacts(xml, badging = "") {
  const tree = parseXmlTree(xml);
  const elements = [...walk(tree)];
  const manifest = elements.find(node => node.name === "manifest");
  const application = elements.find(node => node.name === "application");
  const packageName = manifest?.attrs.package ?? /package: name='([^']+)'/.exec(badging)?.[1];
  const permissions = elements
    .filter(node => node.name === "uses-permission" || node.name === "uses-permission-sdk-23")
    .map(node => node.attrs.name)
    .filter(Boolean);
  const qualify = name => (name?.startsWith(".") ? packageName + name : name?.includes(".") ? name : `${packageName}.${name}`);
  const components = elements
    .filter(node => COMPONENT_TAGS.has(node.name))
    .map(node => ({
      tag: node.name,
      name: qualify(node.attrs.name),
      exported: isTrue(node.attrs.exported),
      permission: node.attrs.permission ?? null,
    }));
  const queriedPackages = elements
    .filter(node => node.name === "package")
    .map(node => node.attrs.name)
    .filter(Boolean);
  const versionCodeText = /versionCode='([^']*)'/.exec(badging)?.[1] ?? manifest?.attrs.versionCode;
  const versionName = /versionName='([^']*)'/.exec(badging)?.[1] ?? manifest?.attrs.versionName ?? null;
  return {
    packageName,
    versionCodeText: versionCodeText ?? null,
    versionCode: /^[1-9]\d*$/.test(versionCodeText ?? "") ? Number(versionCodeText) : null,
    versionName,
    permissions,
    components,
    exported: components.filter(component => component.exported),
    queriedPackages,
    application: {
      allowBackup: application?.attrs.allowBackup ?? null,
      usesCleartextTraffic: application?.attrs.usesCleartextTraffic ?? null,
      networkSecurityConfig: application?.attrs.networkSecurityConfig ?? null,
      debuggable: application?.attrs.debuggable ?? null,
    },
  };
}

/**
 * Pure release-policy assessment. `apk` holds aapt dumps, zip entry names and
 * the development class names found in dex. Returns a list of problems.
 */
export function distributionProblems(apk, { mode, testMocks = false } = {}) {
  const facts = manifestFacts(apk.xml, apk.badging);
  const problems = [];
  const debugHooksAllowed = testMocks && mode === "debug";
  if (!debugHooksAllowed) {
    for (const name of DEVELOPMENT_CLASSES) {
      if (apk.xml.includes(name) || apk.dexClasses?.includes(name))
        problems.push(`Development class ${name} is packaged`);
    }
    if (/peerfixture/.test(apk.xml)) problems.push("peerfixture permission or package query is packaged");
    if (apk.names.some(name => /^res\/xml\/development_network_security_config\.xml$/.test(name)))
      problems.push("Development network security config is packaged");
    if (!isFalse(facts.application.usesCleartextTraffic))
      problems.push(`usesCleartextTraffic must be false (found ${facts.application.usesCleartextTraffic ?? "unset"})`);
  }
  if (mode === "release" && !facts.application.networkSecurityConfig)
    problems.push("Release manifest has no networkSecurityConfig");
  if (!isFalse(facts.application.allowBackup))
    problems.push(`allowBackup must be false (found ${facts.application.allowBackup ?? "unset"})`);
  for (const component of facts.exported) {
    if (debugHooksAllowed && DEVELOPMENT_CLASSES.some(name => component.name.endsWith("." + name))) continue;
    if (!(component.name in EXPORTED_COMPONENTS)) {
      problems.push(`Unexpected exported ${component.tag} ${component.name}`);
      continue;
    }
    const required = EXPORTED_COMPONENTS[component.name];
    if (required && component.permission !== required)
      problems.push(`Exported ${component.name} must require ${required}`);
  }
  // Test-only names (mock providers, fixture peers) never ship in a flag-off build.
  if (!debugHooksAllowed) {
    const named = [
      ...facts.components.map(component => component.name),
      ...facts.permissions,
      ...facts.queriedPackages,
    ];
    for (const name of named.filter(value => /mock|fixture/i.test(value)))
      problems.push(`Test-only manifest entry ${name}`);
  }
  if (facts.permissions.includes("android.permission.WRITE_EXTERNAL_STORAGE"))
    problems.push("WRITE_EXTERNAL_STORAGE is requested");
  const maps = apk.names.filter(name => name.startsWith("assets/") && name.endsWith(".map"));
  if (maps.length) problems.push(`Source maps are packaged: ${maps.slice(0, 3).join(", ")}`);
  if (!apk.names.includes("assets/public/licenses/third-party-notices.json"))
    problems.push("assets/public/licenses/third-party-notices.json is missing");
  if (facts.versionCode === null)
    problems.push(`versionCode must be a positive integer (found ${facts.versionCodeText ?? "none"})`);
  if (!facts.versionName || facts.versionName === "0")
    problems.push(`versionName must be set (found ${facts.versionName ?? "none"})`);
  return { facts, problems };
}

function dexClassNames(file, names) {
  const found = new Set();
  for (const entry of names.filter(name => /^classes\d*\.dex$/.test(name))) {
    const bytes = execFileSync("unzip", ["-p", file, entry], { maxBuffer: 512 * 1024 * 1024 });
    for (const name of DEVELOPMENT_CLASSES) if (bytes.includes(`/${name};`)) found.add(name);
  }
  return [...found];
}

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
    encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
  }).split("\n").filter(Boolean);
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
    names,
    dexClasses: dexClassNames(file, names),
  };
}

/** Extract assets/public into a fresh temporary directory; caller removes it. */
export function extractWebPayload(file) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "alpha-apk-public-"));
  execFileSync("unzip", ["-q", file, "assets/public/*", "-d", directory]);
  return { root: directory, public: path.join(directory, "assets/public") };
}

/** Read the build-time flag record that vite writes beside the web bundle. */
export function readBuildFlags(publicDir) {
  const file = path.join(publicDir, "build-flags.json");
  if (!fs.existsSync(file))
    throw new Error(`build-flags.json is missing from the packaged web bundle (${file}); the web build did not record its test-mocks flag`);
  const flags = JSON.parse(fs.readFileSync(file, "utf8"));
  if (typeof flags.testMocks !== "boolean") throw new Error("build-flags.json has no boolean testMocks");
  return flags;
}

export const AUDIT_SCRIPT = "scripts/audit-production-bundle.mjs";
/** Run the shared production-bundle audit CLI against an extracted web payload. */
export function auditBundle(directory, { testMocks = false, script = AUDIT_SCRIPT } = {}) {
  if (!fs.existsSync(script))
    throw new Error(`${script} is missing; the production bundle audit is required to verify APK web payloads`);
  const args = [script, directory, ...(testMocks ? ["--expect-test-mocks"] : [])];
  try {
    return execFileSync(process.execPath, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    throw new Error(`Production bundle audit failed for ${directory}:\n${error.stdout ?? ""}${error.stderr ?? ""}`);
  }
}

/** apksigner certificate digest of the first signer, or null when unsigned. */
export function signerDigest(file) {
  const output = execFileSync(tool("apksigner"), ["verify", "--print-certs", file], {
    encoding: "utf8", env: androidEnv(),
  });
  return parseSignerDigest(output);
}
export function parseSignerDigest(output) {
  const digest = /Signer #1 certificate SHA-256 digest:\s*([a-fA-F0-9]{64})/.exec(output)?.[1];
  if (!digest) throw new Error("apksigner reported no SHA-256 signer digest");
  return digest.toLowerCase();
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

/** Archive the verified APK payload, independent of the restored working web bundle. */
export function archiveWebPayload(apkFile, destination, { testMocks = false } = {}) {
  const payload = extractWebPayload(apkFile);
  try {
    const flags = readBuildFlags(payload.public);
    if (flags.testMocks !== testMocks) throw new Error(`APK web payload has testMocks=${flags.testMocks}; expected ${testMocks}`);
    auditBundle(payload.public, { testMocks });
    fs.cpSync(payload.public, destination, { recursive: true, errorOnExist: true, force: false });
  } finally {
    fs.rmSync(payload.root, { recursive: true, force: true });
  }
}
