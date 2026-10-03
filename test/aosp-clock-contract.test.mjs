import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { clockActions, clockProductRequirement, verifyAospClockHandlers } from "../scripts/aosp-clock-contract.mjs";

test("Alpha staging retains a real Clock requirement and shared caller contract", () => {
  assert.match(clockProductRequirement, /^PRODUCT_PACKAGES \+= DeskClock$/m);
  const stager = fs.readFileSync(new URL("../scripts/stage-aosp.mjs", import.meta.url), "utf8");
  assert.match(stager, /appendFileSync\(path.join\(output, "product.mk"\), clockProductRequirement\)/);
  const manifest = fs.readFileSync(new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8");
  assert.match(manifest, /uses-permission android:name="com.android.alarm.permission.SET_ALARM"/);
  for (const action of clockActions) assert.ok(manifest.includes(`android.intent.action.${action}`));
});

test("image admission queries all four handlers for the explicit user without launching them", () => {
  const commands = [];
  const result = verifyAospClockHandlers((...args) => {
    commands.push(args);
    return args[1] === "pm" ? "package:com.android.deskclock\n" : "com.android.deskclock/.HandleApiCalls\n";
  }, "12");
  assert.deepEqual(Object.keys(result.handlers), clockActions);
  assert.equal(result.ringingVerified, false);
  assert.equal(commands.length, 5);
  assert.ok(commands.every(args => args.includes("12") && !args.includes("start")));
});

test("missing, disabled and incomplete providers cannot satisfy the image contract", () => {
  assert.throws(() => verifyAospClockHandlers(() => "", "0"), /not enabled/);
  for (const missing of clockActions) {
    assert.throws(() => verifyAospClockHandlers((...args) => {
      if (args[1] === "pm") return "package:com.android.deskclock\n";
      return args.includes(`android.intent.action.${missing}`) ? "No activities found" : "com.android.deskclock/.HandleApiCalls\n";
    }, "0"), new RegExp(`missing: ${missing}`));
  }
  let calls = 0;
  assert.throws(() => verifyAospClockHandlers(() => { calls++; }, undefined), /Explicit Android user/);
  assert.equal(calls, 0);
});
