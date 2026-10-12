// Secure camera contract (policy P-23, issue #407) from fabricated aapt xmltree and adb
// output plus source checks. Not image build, boot, locked-capture or device evidence.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import {
  assertNoAlphaLockScreenSurface, dexLockScreenReferences, hasFeature, lockScreenMethods, renderSecureCameraOverlay,
  runtimePermissionGranted, secureCameraActions, systemCameraPackage, verifyAospSecureCamera, writeSecureCameraOverlay,
} from "../scripts/aosp-secure-camera-contract.mjs";

const root = path.resolve(import.meta.dirname, "..");

const PKG = "ai.elizaresearch.alphaphone";
const TRUE = "(type 0x12)0xffffffff";
const str = value => `"${value}" (Raw: "${value}")`;
const element = (indent, tag, attrs = {}) => [`${" ".repeat(indent)}E: ${tag} (line=1)`,
  ...Object.entries(attrs).map(([key, value]) => `${" ".repeat(indent + 2)}A: android:${key}(0x01010003)=${value.startsWith("(") ? value : str(value)}`)];
const filter = (indent, action, categories = []) => [...element(indent, "intent-filter"), ...element(indent + 2, "action", { name: action }),
  ...categories.flatMap(name => element(indent + 2, "category", { name }))];
function tree({ mainAttrs = {}, extra = [] } = {}) {
  return ["N: android=http://schemas.android.com/apk/res/android", "  E: manifest (line=2)", "    E: application (line=3)",
    ...element(6, "activity", { name: `${PKG}.MainActivity`, exported: TRUE, ...mainAttrs }),
    ...filter(8, "android.intent.action.MAIN", ["android.intent.category.HOME", "android.intent.category.DEFAULT"]),
    ...element(6, "activity", { name: `${PKG}.AlphaAssistActivity` }), ...filter(8, "android.intent.action.ASSIST", ["android.intent.category.DEFAULT"]),
    ...extra,
  ].join("\n");
}

test("staging keeps the system camera and pins the power-key gesture to it without removing anything", t => {
  const files = renderSecureCameraOverlay();
  assert.match(files.productMakefile, /^PRODUCT_PACKAGES \+= Camera2$/m);
  assert.match(files.productMakefile, /PRODUCT_PACKAGE_OVERLAYS \+= \$\(alphaphone_secure_camera_dir\)\/overlay/);
  assert.doesNotMatch(files.productMakefile, /LOCAL_OVERRIDES_PACKAGES|PRODUCT_PACKAGES -=|\bALPHA_/);
  const overlay = files["secure-camera/overlay/frameworks/base/core/res/res/values/config.xml"];
  assert.match(overlay, /<bool name="config_cameraDoubleTapPowerGestureEnabled">true<\/bool>/);
  assert.match(overlay, /<bool name="config_doubleTapPowerGestureEnabled">true<\/bool>/);
  // 0 = launch camera, 1 = wallet (AOSP core/res config.xml).
  assert.match(overlay, /<integer name="config_defaultDoubleTapPowerGestureAction">0<\/integer>/);
  assert.match(files["secure-camera/README.md"], /not against the pinned Android 17 source/);
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "alpha-secure-camera-"));
  t.after(() => fs.rmSync(out, { recursive: true, force: true }));
  fs.writeFileSync(path.join(out, "product.mk"), "PRODUCT_PACKAGES += AlphaPhone\n");
  writeSecureCameraOverlay(out);
  assert.match(fs.readFileSync(path.join(out, "product.mk"), "utf8"), /PRODUCT_PACKAGES \+= AlphaPhone\n[\s\S]*PRODUCT_PACKAGES \+= Camera2/);
  assert.ok(fs.existsSync(path.join(out, "secure-camera/README.md")));
  assert.throws(() => writeSecureCameraOverlay(out), /EEXIST/);
});

test("an Alpha APK with a lock-screen attribute, reference value or secure-camera handler is refused", () => {
  assert.equal(assertNoAlphaLockScreenSurface(tree()), true);
  for (const attr of ["showWhenLocked", "showOnLockScreen", "turnScreenOn"]) {
    assert.throws(() => assertNoAlphaLockScreenSurface(tree({ mainAttrs: { [attr]: TRUE } })), new RegExp(`MainActivity sets android:${attr}`));
    // A resource reference hides the value from aapt; it is refused, not trusted.
    assert.throws(() => assertNoAlphaLockScreenSurface(tree({ mainAttrs: { [attr]: "@0x7f050001" } })), new RegExp(`android:${attr}=@0x7f050001`));
  }
  assert.equal(assertNoAlphaLockScreenSurface(tree({ mainAttrs: { showWhenLocked: "(type 0x12)0x0" } })), true);
  for (const action of secureCameraActions) {
    const extra = [...element(6, "activity", { name: `${PKG}.LockCamera` }), ...filter(8, action, ["android.intent.category.DEFAULT"])];
    assert.throws(() => assertNoAlphaLockScreenSurface(tree({ extra })), new RegExp(`LockCamera handles ${action.replaceAll(".", "\\.")}`));
  }
  const alias = [...element(6, "activity-alias", { name: `${PKG}.Alias`, targetActivity: `${PKG}.MainActivity` }), ...filter(8, secureCameraActions[0])];
  assert.throws(() => assertNoAlphaLockScreenSurface(tree({ extra: alias })), /Alias handles/);
});

// A dex string_data_item: ULEB128 length, MUTF-8 bytes, NUL.
const dexString = name => Buffer.concat([Buffer.from([name.length]), Buffer.from(name, "ascii"), Buffer.from([0])]);
test("dex references to the runtime Keyguard APIs are refused; look-alike strings are not", () => {
  const clean = Buffer.concat([Buffer.from("dex\n035\0"), dexString("setContentView"), dexString("setShowWhenLockedHint"), Buffer.from("xsetTurnScreenOn\0")]);
  assert.deepEqual(dexLockScreenReferences(clean), []);
  assert.equal(assertNoAlphaLockScreenSurface(tree(), clean), true);
  for (const name of lockScreenMethods) {
    const dex = Buffer.concat([clean, dexString(name)]);
    assert.deepEqual(dexLockScreenReferences(dex), [name]);
    assert.throws(() => assertNoAlphaLockScreenSurface(tree(), dex), new RegExp(`dex references ${name}`));
  }
});

/** Run stage-aosp against fake Android tools in a scratch directory. */
function stageWith(t, { manifest, dex }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "alpha-stage-camera-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const sdk = path.join(dir, "sdk"), tools = path.join(sdk, "build-tools/36.0.0"), java = path.join(dir, "jdk");
  fs.mkdirSync(tools, { recursive: true }); fs.mkdirSync(java);
  fs.writeFileSync(path.join(java, "release"), 'JAVA_VERSION="21"\n');
  const log = path.join(dir, "calls.log");
  fs.writeFileSync(path.join(dir, "manifest.txt"), manifest);
  for (const name of ["aapt", "apksigner"]) {
    fs.writeFileSync(path.join(tools, name), `#!/bin/sh\necho "${name} $*" >> "${log}"\n${name === "aapt" ? `cat "${path.join(dir, "manifest.txt")}"` : 'echo "Signer #1 certificate SHA-256 digest: ab"'}\n`);
    fs.chmodSync(path.join(tools, name), 0o755);
  }
  fs.copyFileSync(path.join(root, "app.config.json"), path.join(dir, "app.config.json"));
  const apk = path.join(dir, "launcher-debug.apk");
  execFileSync("python3", ["-c", "import sys,zipfile\nwith zipfile.ZipFile(sys.argv[1],'w') as z:\n z.writestr('assets/public/build-flags.json','{\"testMocks\":false}')\n z.writestr('classes.dex',open(sys.argv[2],'rb').read())", apk, (fs.writeFileSync(path.join(dir, "dex.bin"), dex), path.join(dir, "dex.bin"))]);
  const output = path.join(dir, "staged");
  const out = spawnSync(process.execPath, [path.join(root, "scripts/stage-aosp.mjs"), "--apk", apk, "--output", output, "--development"],
    { cwd: dir, encoding: "utf8", env: { ...process.env, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk, JAVA_HOME: java } });
  return { out, output, calls: fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n") : [] };
}
const debuggable = (attrs = {}) => tree({ mainAttrs: attrs }).replace("    E: application (line=3)", "    E: application (line=3)\n      A: android:debuggable(0x0101000f)=(type 0x12)0xffffffff");

test("development staging refuses a lock-screen APK before anything is staged and reads its manifest once", t => {
  const surface = stageWith(t, { manifest: debuggable({ showWhenLocked: TRUE }), dex: dexString("setContentView") });
  assert.notEqual(surface.out.status, 0);
  assert.match(surface.out.stderr, /Refusing the APK: Alpha does not implement a secure camera[\s\S]*MainActivity sets android:showWhenLocked/);
  assert.deepEqual(surface.calls.filter(call => call.startsWith("aapt ")).length, 1, "admission and the lock-screen check share one aapt dump");
  assert.ok(!surface.calls.some(call => call.startsWith("apksigner ")), "refused before signer, descriptor or overlay staging");
  assert.ok(!fs.existsSync(surface.output));
  const dex = stageWith(t, { manifest: debuggable(), dex: dexString("setShowWhenLocked") });
  assert.notEqual(dex.out.status, 0);
  assert.match(dex.out.stderr, /dex references setShowWhenLocked/);
  assert.ok(!fs.existsSync(dex.output));
});

test("stage-aosp writes the secure-camera overlay in both modes, after the APK checks", () => {
  const source = fs.readFileSync("scripts/stage-aosp.mjs", "utf8");
  const check = source.indexOf("assertNoAlphaLockScreenSurface(tree, readApkDex(apk));");
  const overlay = source.indexOf("writeSecureCameraOverlay(output);");
  assert.ok(check > 0 && check < source.indexOf("stage-launcher-overlay.ts") && check < overlay);
  assert.ok(overlay < source.indexOf("if (production) {", check), "written before, not inside, the --production branch");
});

/** Gradle projects the app module links, resolved from android/settings.gradle. */
function linkedAndroidSources() {
  const settings = fs.readFileSync("android/settings.gradle", "utf8");
  const dirs = new Map([...settings.matchAll(/project\('(:[\w-]+)'\)\.projectDir = new File\('([^']+)'\)/g)].map(m => [m[1], path.join("android", m[2])]));
  const app = fs.readFileSync("android/app/build.gradle", "utf8");
  const linked = [...app.matchAll(/implementation project\('(:[\w-]+)'\)/g)].map(m => dirs.get(m[1]) ?? path.join("android", m[1].slice(1)));
  return ["android/app", ...linked];
}
function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    // Instrumentation and unit-test source sets never reach the APK.
    if (entry.isDirectory()) { if (!["build", "test", "androidTest", "node_modules"].includes(entry.name)) walk(full, files); }
    else if (/\.(java|kt)$|^AndroidManifest\.xml$/.test(entry.name)) files.push(full);
  }
  return files;
}

test("no manifest or native source linked into the Alpha APK puts Alpha over Keyguard", () => {
  const modules = linkedAndroidSources();
  assert.ok(modules.some(dir => dir.includes("plugin-native-camera")), "linked plugins are resolved");
  const files = modules.flatMap(dir => walk(path.join(dir, "src")));
  assert.ok(files.includes(path.join("android/app/src/launcher/AndroidManifest.xml")) || !fs.existsSync("android/app/src/launcher/AndroidManifest.xml"));
  assert.ok(files.length > 20, `scanned ${files.length} files`);
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    if (file.endsWith(".xml")) {
      for (const match of text.matchAll(/android:(showWhenLocked|showOnLockScreen|turnScreenOn)="([^"]*)"/g))
        assert.equal(match[2], "false", `${file} sets android:${match[1]}`);
    } else assert.doesNotMatch(text, /setShowWhenLocked\(|setTurnScreenOn\(|FLAG_SHOW_WHEN_LOCKED|FLAG_DISMISS_KEYGUARD|FLAG_TURN_SCREEN_ON|requestDismissKeyguard/, file);
    for (const action of secureCameraActions) assert.ok(!text.includes(action) && !text.includes(action.split(".").pop()), `${file} mentions ${action}`);
  }
});

test("under native system chrome the prototype lock screen offers no camera, agent or secure state", () => {
  const model = fs.readFileSync("apps/app/src/prototype/model.js", "utf8");
  assert.match(model, /lockCameraOffered: !P\.nativeSystemChrome, noLockCamera: !!P\.nativeSystemChrome,/);
  assert.match(model, /lockAgentOffered: !P\.nativeSystemChrome, noLockAgent: !!P\.nativeSystemChrome,/);
  assert.match(model, /lockCamera: function \(\) \{ if \(P\.nativeSystemChrome\) return; /);
  assert.match(model, /if \(this\.props && this\.props\.nativeSystemChrome\) value\.secure = false;/);
  assert.match(model, /self\.pLong = true; if \(self\.lockedUnderSystemChrome\(\)\) return; self\.startVoice\(\);/);
  assert.match(model, /isMvpView\("wallet"\) && !self\.lockedUnderSystemChrome\(\)\)/);
  const template = fs.readFileSync("apps/app/src/prototype/template.html", "utf8");
  assert.match(template, /<sc-if value="\{\{lockCameraOffered\}\}"><button aria-label="Camera" onClick="\{\{lockCamera\}\}"/);
  assert.match(template, /<sc-if value="\{\{lockAgentOffered\}\}"><button aria-label="Talk to \{\{name\}\}"/);
  assert.equal(template.match(/onClick="\{\{lockCamera\}\}"/g).length, 1);
});

function adb(overrides = {}) {
  const calls = [];
  const answers = {
    ce: "true\n",
    feature: "true\n",
    packages: `package:${systemCameraPackage}\n`,
    dumpsys: `Packages:\n  Package [${systemCameraPackage}] (1a2b):\n    userId=10040\n    User 0: ceDataInode=1 installed=true\n      gids=[3003]\n      runtime permissions:\n        android.permission.CAMERA: granted=true, flags=[ GRANTED_BY_DEFAULT ]\n    User 10: ceDataInode=2 installed=true\n      runtime permissions:\n        android.permission.CAMERA: granted=false, flags=[ USER_SET ]\n`,
    [secureCameraActions[0]]: `${systemCameraPackage}/com.android.camera.SecureCameraActivity\n`,
    [secureCameraActions[1]]: `${systemCameraPackage}/com.android.camera.SecureCameraActivity\n`,
    camera_double_tap_power_gesture_disabled: "null\n",
    double_tap_power_button_gesture_enabled: "null\n",
    double_tap_power_button_gesture: "null\n",
    ...overrides,
  };
  const run = (...args) => {
    calls.push(args);
    if (args.includes("getprop")) return answers.ce;
    if (args.includes("has-feature")) {
      // Real adb: `pm has-feature` prints false and exits 1 when the feature is absent.
      if (answers.feature.trim() === "false") throw Object.assign(Error("Command failed"), { status: 1, stdout: answers.feature });
      return answers.feature;
    }
    if (args.includes("list")) return answers.packages;
    if (args.includes("dumpsys")) return answers.dumpsys;
    if (args.includes("query-activities")) return answers[args[args.indexOf("-a") + 1]];
    if (args.includes("settings")) return answers[args.at(-1)];
    throw Error(`unexpected ${args.join(" ")}`);
  };
  return { run, calls };
}

test("device admission reports secure-intent routing, grant and gesture settings and claims no acceptance", () => {
  const { run, calls } = adb();
  const result = verifyAospSecureCamera(run, "0", PKG);
  assert.equal(result.cameraPresent, true);
  assert.equal(result.systemCameraPermissionGranted, true);
  assert.equal(result.powerGestureDisabledByUser, false);
  assert.equal(result.powerGestureTargetsWallet, false);
  assert.deepEqual(result.secureIntentHandlers[secureCameraActions[0]], [`${systemCameraPackage}/com.android.camera.SecureCameraActivity`]);
  for (const flag of ["keyguardAffordanceVerified", "lockedCaptureVerified", "isolationVerified", "unlockReturnVerified"]) assert.equal(result[flag], false);
  assert.ok(calls.filter(args => args.includes("query-activities")).every(args => args.join(" ").endsWith("-c android.intent.category.DEFAULT")));
  assert.ok(calls.every(args => args[0] === "shell" && !args.some(arg => /^(install|uninstall|put|grant|revoke|am|input|setprop)$/.test(arg))), "read-only");
  assert.equal(verifyAospSecureCamera(adb().run, "10", PKG).systemCameraPermissionGranted, false);
  assert.equal(verifyAospSecureCamera(adb({ camera_double_tap_power_gesture_disabled: "1\n" }).run, "0", PKG).powerGestureDisabledByUser, true);
  assert.equal(verifyAospSecureCamera(adb({ double_tap_power_button_gesture_enabled: "0\n" }).run, "0", PKG).powerGestureDisabledByUser, true);
  assert.equal(verifyAospSecureCamera(adb({ double_tap_power_button_gesture: "1\n" }).run, "0", PKG).powerGestureTargetsWallet, true);
});

test("CAMERA grant parsing stays within the selected user's block", () => {
  const { dumpsys } = { dumpsys: "    User 0: installed=true\n      install permissions:\n        android.permission.INTERNET: granted=true\n    User 11: installed=true\n      runtime permissions:\n        android.permission.CAMERA: granted=true\n" };
  assert.equal(runtimePermissionGranted(dumpsys, "0", "android.permission.CAMERA"), null);
  assert.equal(runtimePermissionGranted(dumpsys, "11", "android.permission.CAMERA"), true);
  assert.equal(runtimePermissionGranted(dumpsys, "1", "android.permission.CAMERA"), null);
});

test("device admission refuses an Alpha handler, a missing system camera, a missing route or a never-unlocked user", () => {
  assert.throws(() => verifyAospSecureCamera(adb({ [secureCameraActions[0]]: `${systemCameraPackage}/com.android.camera.SecureCameraActivity\n${PKG}/${PKG}.LockCamera\n` }).run, "0", PKG), /Alpha must not handle/);
  assert.throws(() => verifyAospSecureCamera(adb({ packages: "" }).run, "0", PKG), /not enabled/);
  assert.throws(() => verifyAospSecureCamera(adb({ [secureCameraActions[0]]: "" }).run, "0", PKG), /no system camera route/);
  assert.throws(() => verifyAospSecureCamera(adb({ ce: "\n" }).run, "0", PKG), /Unlock Android user 0 once/);
  assert.throws(() => verifyAospSecureCamera(adb().run, "", PKG), /Explicit Android user/);
  assert.throws(() => verifyAospSecureCamera(adb().run, "0;rm", PKG), /Explicit Android user/);
});

test("a device without a camera reports absence: pm has-feature exits 1 with false", () => {
  const result = verifyAospSecureCamera(adb({ feature: "false\n", [secureCameraActions[0]]: "", [secureCameraActions[1]]: "" }).run, "10", PKG);
  assert.equal(result.cameraPresent, false);
  assert.deepEqual(result.secureIntentHandlers[secureCameraActions[0]], []);
  // Any other failure is not read as absence.
  assert.throws(() => hasFeature(() => { throw Object.assign(Error("device offline"), { status: 1, stdout: "" }); }, "x"), /device offline/);
  assert.throws(() => hasFeature(() => { throw Object.assign(Error("adb died"), { status: 255, stdout: "false\n" }); }, "x"), /adb died/);
  assert.throws(() => hasFeature(() => "Error: unknown\n", "x"), /Unexpected pm has-feature output/);
});
