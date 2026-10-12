// Secure camera contract (policy P-23, issue #407) from fabricated aapt xmltree and adb
// output plus source checks. Not image build, boot, locked-capture or device evidence.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  assertNoAlphaLockScreenSurface, renderSecureCameraOverlay, secureCameraActions, systemCameraPackage,
  verifyAospSecureCamera, writeSecureCameraOverlay,
} from "../scripts/aosp-secure-camera-contract.mjs";

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

test("staging keeps the system camera and power-key gesture without removing anything", t => {
  const files = renderSecureCameraOverlay();
  assert.match(files.productMakefile, /^PRODUCT_PACKAGES \+= Camera2$/m);
  assert.match(files.productMakefile, /PRODUCT_PACKAGE_OVERLAYS \+= \$\(alphaphone_secure_camera_dir\)\/overlay/);
  assert.doesNotMatch(files.productMakefile, /LOCAL_OVERRIDES_PACKAGES|PRODUCT_PACKAGES -=|\bALPHA_/);
  assert.match(files["secure-camera/overlay/frameworks/base/core/res/res/values/config.xml"], /<bool name="config_cameraDoubleTapPowerGestureEnabled">true<\/bool>/);
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "alpha-secure-camera-"));
  t.after(() => fs.rmSync(out, { recursive: true, force: true }));
  fs.writeFileSync(path.join(out, "product.mk"), "PRODUCT_PACKAGES += AlphaPhone\n");
  writeSecureCameraOverlay(out);
  assert.match(fs.readFileSync(path.join(out, "product.mk"), "utf8"), /PRODUCT_PACKAGES \+= AlphaPhone\n[\s\S]*PRODUCT_PACKAGES \+= Camera2/);
  assert.ok(fs.existsSync(path.join(out, "secure-camera/README.md")));
  assert.throws(() => writeSecureCameraOverlay(out), /EEXIST/);
});

test("an Alpha APK with a lock-screen surface or secure-camera handler is refused", () => {
  assert.equal(assertNoAlphaLockScreenSurface(tree()), true);
  for (const attr of ["showWhenLocked", "showOnLockScreen", "turnScreenOn"])
    assert.throws(() => assertNoAlphaLockScreenSurface(tree({ mainAttrs: { [attr]: TRUE } })), new RegExp(`MainActivity sets android:${attr}`));
  assert.equal(assertNoAlphaLockScreenSurface(tree({ mainAttrs: { showWhenLocked: "(type 0x12)0x0" } })), true);
  for (const action of secureCameraActions) {
    const extra = [...element(6, "activity", { name: `${PKG}.LockCamera` }), ...filter(8, action, ["android.intent.category.DEFAULT"])];
    assert.throws(() => assertNoAlphaLockScreenSurface(tree({ extra })), new RegExp(`LockCamera handles ${action.replaceAll(".", "\\.")}`));
  }
  const alias = [...element(6, "activity-alias", { name: `${PKG}.Alias`, targetActivity: `${PKG}.MainActivity` }), ...filter(8, secureCameraActions[0])];
  assert.throws(() => assertNoAlphaLockScreenSurface(tree({ extra: alias })), /Alias handles/);
});

test("stage-aosp checks the APK and writes the secure-camera overlay in both modes", () => {
  const source = fs.readFileSync("scripts/stage-aosp.mjs", "utf8");
  const check = source.indexOf("assertNoAlphaLockScreenSurface(tree);");
  assert.ok(check > 0 && check < source.indexOf("stage-launcher-overlay.ts"), "the APK is checked before anything is staged");
  assert.match(source, /clockProductRequirement\);\nwriteSecureCameraOverlay\(output\);\nif \(production\) \{/);
});

test("the shipped Alpha manifest and native code never put Alpha over Keyguard", () => {
  const manifest = fs.readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");
  assert.doesNotMatch(manifest, /android:(showWhenLocked|showOnLockScreen|turnScreenOn)="true"/);
  for (const action of secureCameraActions) assert.ok(!manifest.includes(action), `no ${action} filter or query`);
  const dir = "android/app/src/main/java/ai/elizaresearch/alphaphone";
  for (const name of fs.readdirSync(dir).filter(file => file.endsWith(".java"))) {
    const java = fs.readFileSync(path.join(dir, name), "utf8");
    assert.doesNotMatch(java, /setShowWhenLocked\(\s*true|setTurnScreenOn\(\s*true|FLAG_SHOW_WHEN_LOCKED|FLAG_DISMISS_KEYGUARD|requestDismissKeyguard|STILL_IMAGE_CAMERA_SECURE|IMAGE_CAPTURE_SECURE/, name);
  }
});

test("the renderer offers its prototype lock-screen camera only in the simulated phone frame", () => {
  const model = fs.readFileSync("apps/app/src/prototype/model.js", "utf8");
  assert.match(model, /lockCameraOffered: !P\.nativeSystemChrome, noLockCamera: !!P\.nativeSystemChrome,/);
  assert.match(model, /lockCamera: function \(\) \{ if \(P\.nativeSystemChrome\) return; /);
  const template = fs.readFileSync("apps/app/src/prototype/template.html", "utf8");
  assert.match(template, /<sc-if value="\{\{lockCameraOffered\}\}"><button aria-label="Camera" onClick="\{\{lockCamera\}\}"/);
  assert.equal(template.match(/onClick="\{\{lockCamera\}\}"/g).length, 1);
});

function adb(overrides = {}) {
  const calls = [];
  const answers = {
    feature: "true\n",
    packages: `package:${systemCameraPackage}\n`,
    [secureCameraActions[0]]: `${systemCameraPackage}/com.android.camera.SecureCameraActivity\n`,
    [secureCameraActions[1]]: `${systemCameraPackage}/com.android.camera.SecureCameraActivity\n`,
    setting: "null\n",
    ...overrides,
  };
  const run = (...args) => {
    calls.push(args);
    if (args.includes("has-feature")) return answers.feature;
    if (args.includes("list")) return answers.packages;
    if (args.includes("query-activities")) return answers[args[args.indexOf("-a") + 1]];
    if (args.includes("settings")) return answers.setting;
    throw Error(`unexpected ${args.join(" ")}`);
  };
  return { run, calls };
}

test("device admission routes secure capture to the system camera only and claims no acceptance", () => {
  const { run, calls } = adb();
  const result = verifyAospSecureCamera(run, "0", PKG);
  assert.equal(result.cameraPresent, true);
  assert.equal(result.powerGestureDisabledByUser, false);
  assert.deepEqual(result.handlers[secureCameraActions[0]], [`${systemCameraPackage}/com.android.camera.SecureCameraActivity`]);
  assert.equal(result.lockedCaptureVerified, false);
  assert.equal(result.isolationVerified, false);
  assert.equal(result.unlockReturnVerified, false);
  assert.ok(calls.every(args => args[0] === "shell" && !args.some(arg => /^(install|uninstall|put|grant|revoke|am|input)$/.test(arg))), "read-only");
  assert.equal(verifyAospSecureCamera(adb({ setting: "1\n" }).run, "0", PKG).powerGestureDisabledByUser, true);
});

test("device admission refuses an Alpha handler, a missing system camera or a missing entry", () => {
  assert.throws(() => verifyAospSecureCamera(adb({ [secureCameraActions[0]]: `${systemCameraPackage}/com.android.camera.SecureCameraActivity\n${PKG}/${PKG}.LockCamera\n` }).run, "0", PKG), /Alpha must not handle/);
  assert.throws(() => verifyAospSecureCamera(adb({ packages: "" }).run, "0", PKG), /not enabled/);
  assert.throws(() => verifyAospSecureCamera(adb({ [secureCameraActions[0]]: "" }).run, "0", PKG), /no secure camera entry/);
  assert.throws(() => verifyAospSecureCamera(adb().run, "", PKG), /Explicit Android user/);
  assert.throws(() => verifyAospSecureCamera(adb().run, "0;rm", PKG), /Explicit Android user/);
});

test("a device without a camera reports absence instead of requiring an entry", () => {
  const result = verifyAospSecureCamera(adb({ feature: "false\n", [secureCameraActions[0]]: "", [secureCameraActions[1]]: "" }).run, "10", PKG);
  assert.equal(result.cameraPresent, false);
  assert.deepEqual(result.handlers[secureCameraActions[0]], []);
});
