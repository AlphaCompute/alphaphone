import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

// Source-level guards for two round-8 changes whose behaviour is otherwise shown in a browser
// (test/browser/notifications-handle.spec.ts) or only on an emulator (the instrumented classes).
// These do not replace either; they stop the source drifting back while no emulator run exists.
const read = file => readFileSync(file, 'utf8');
const ANDROID_TESTS = 'android/app/src/androidTest/java/ai/elizaresearch/alphaphone';

test('Alpha\'s notifications open from the handle only: no swipe opener is left in the shell', () => {
  const model = read('apps/app/src/prototype/model.js');
  const swipe = model.slice(model.indexOf('  swipe(g, dx, dy) {'), model.indexOf('  sw(fn, opts) {'));
  assert.ok(swipe.length > 200 && swipe.length < 6000, 'swipe() located');
  // The one opener in the gesture handler is a pull that started on the handle.
  assert.match(swipe, /if \(dy > T && g\.handle\) return this\.openShade\(\);/);
  assert.doesNotMatch(swipe, /shade: true/, 'no swipe sets the panel open directly');
  assert.doesNotMatch(swipe, /g\.y < 90/, 'the top-edge band is not a gesture zone of Alpha');
  assert.match(model, /handle: !!e\.target\.closest\?\.\("\[data-alpha-shade-handle\]"\)/);
  const template = read('apps/app/src/prototype/template.html');
  assert.match(template, /<button class="alpha-shade-handle" data-alpha-shade-handle aria-label="Open notifications" aria-controls="alpha-notifications"[^>]*onClick="\{\{openShade\}\}"/);
  assert.match(template, /data-alpha-layer="shade" id="alpha-notifications"/);
});

test('the launcher handle\'s margin below the status bar is measured in screen pixels', () => {
  const css = read('apps/app/src/prototype/phone.css');
  // The inset is in screen pixels and Home is on the scaled 412px canvas: divide by the canvas scale.
  assert.match(css, /\[data-alpha-home-layout\] \{ padding-top:max\(20px,calc\(\(var\(--native-top-inset,0px\) \+ 12px\) \/ var\(--phone-scale,1\) - 44px\)\)!important; \}/);
  assert.match(css, /\.alpha-shade-handle \{[^}]*min-height:44px;[^}]*touch-action:none/);
});

test('no instrumented test opens the panel with the removed swipe', () => {
  for (const name of readdirSync(ANDROID_TESTS).filter(file => file.endsWith('.java'))) {
    const source = read(path.join(ANDROID_TESTS, name));
    // The synthetic top-edge swipe the product no longer answers (a pointer pair from y=50 to y=200).
    assert.doesNotMatch(source, /\['pointerdown',\s*50\]/, `${name} synthesizes the removed top-edge swipe`);
  }
  assert.match(read(path.join(ANDROID_TESTS, 'AppNavigation.java')), /static String openNotifications\(\)[^\n]*data-alpha-shade-handle[^\n]*handle\.click\(\)/);
  for (const name of ['NotificationsInstrumentedTest.java', 'NotificationChannelsInstrumentedTest.java'])
    assert.match(read(path.join(ANDROID_TESTS, name)), /AppNavigation\.openNotifications\(\)/, `${name} opens the panel through the handle`);
});

test('the launcher keeps one MainActivity and its kind belongs to the task', () => {
  const activity = read('android/app/src/main/java/ai/elizaresearch/alphaphone/MainActivity.java');
  // A second instance never loads a page.
  assert.match(activity, /@Override protected void load\(\) \{ if \(!handedOff\) super\.load\(\); \}/);
  assert.match(activity, /MainActivity live = BuildConfig\.IS_LAUNCHER && !isAssistantSurface\(\) \? liveInstance\(\) : null;/);
  // The kind is read from the start intent once per task. A relaunch is handed the last intent given
  // to setIntent (AlphaConnectionPlugin keeps the sign-in return there), so it must not be read again.
  assert.match(activity, /if \(task == -1 \|\| task != liveTaskId\) \{ liveTaskId = task; liveTaskHome = isHomeTypeStart\(getIntent\(\)\); \}\s*startedAsHome = liveTaskHome;/);
  assert.doesNotMatch(activity, /startedAsHome = isHome(Intent|TypeStart)\(getIntent\(\)\)/);
  assert.match(read('android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaConnectionPlugin.java'), /getActivity\(\)\.setIntent\(intent\);delegationCallback=uri;/, 'the sign-in return is still kept with setIntent, which is why the kind is per task');
  // An exported activity reads its own marker extra without trusting the sender's parcel.
  assert.match(activity, /try \{ return intent\.getBooleanExtra\(EXTRA_FRONT_START, false\); \}\s*catch \(RuntimeException foreign\) \{ return false; \}/);
  // The live instance's own task is never removed by the instance that hands off.
  assert.match(activity, /if \(home \|\| sameTask\) finish\(\); else finishAndRemoveTask\(\);/);
  // The bring-to-front start cannot loop: an instance it creates finishes without starting anything.
  const handOff = activity.slice(activity.indexOf('private void handOff(MainActivity live)'), activity.indexOf('@Override public void onCreate(Bundle state)'));
  assert.equal(handOff.split('startActivity(').length - 1, 1, 'one start in the hand-off');
  assert.match(handOff, /if \(isOwnFrontStart\(getIntent\(\)\)\) \{[\s\S]*?\} else \{[\s\S]*startActivity\(front\)/);
  // The instrumented classes that would show it on a device exist and name the behaviour.
  assert.match(read(path.join(ANDROID_TESTS, 'SettingsRolesInstrumentedTest.java')), /assertOneLiveInstance\("after the role is accepted",original\)/);
  assert.match(read(path.join(ANDROID_TESTS, 'LauncherHomeInstrumentedTest.java')), /aRelaunchHoldingAReplacedIntentKeepsOneInstanceThatLaterStartsBringToTheFront/);
});
