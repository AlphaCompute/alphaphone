import test from "node:test";
import assert from "node:assert/strict";
import { exercise } from "./fixtures/isolated-native-campaign.mjs";

test("native campaign admits the owned user's ready WebView before APK installation", () => {
  const r = exercise("pass", "camera");
  assert.equal(r.code, 0, r.stderr);
  const admission = r.commands.findIndex((a) => a.includes("webviewupdate"));
  const installation = r.commands.findIndex((a) => a[0] === "install");
  assert.ok(admission >= 0 && installation > admission);
  assert.equal(r.record.androidUser, 10);
  assert.equal(r.record.webViewAdmission.ready, true);
  assert.equal(r.record.userLifecycle.removed, true);
});

test("a WebView service read failure prevents installation and instrumentation", () => {
  const r = exercise("webview-service-failure", "camera");
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /WebView service unavailable/);
  assert.ok(!r.commands.some((a) => a[0] === "install" || a.includes("instrument")));
  assert.equal(r.record.passed, false);
  assert.equal(r.state.user, "0");
});
