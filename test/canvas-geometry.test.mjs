import test from 'node:test';
import assert from 'node:assert/strict';

// Issue #411: the canvas arrangement follows measured window geometry, not screen orientation,
// and the software keyboard is never mistaken for a rotation.
const { canvasGeometry, keyboardFreeHeight, surfaceLayout, WIDE_CANVAS } = await import('../apps/app/src/runtime/canvas-geometry.ts');

const input = (width, height, extra = {}) => ({ width, layoutHeight: height, available: height, desktop: false, fluid: true, launcher: false, screenShort: Math.min(width, height), editing: false, ...extra });
const fit = (width, height, extra) => canvasGeometry(input(width, height, extra), height);

test('standalone touch windows keep their own density in every orientation', () => {
  assert.deepEqual([fit(412, 915).scale, fit(412, 915).landscape, fit(412, 915).wide], [1, false, false]);
  // A small phone on its side is not shrunk below 44px targets.
  assert.deepEqual([fit(640, 360).scale, fit(640, 360).landscape], [1, true]);
  // A tablet is never a magnified phone.
  assert.deepEqual([fit(1280, 800).scale, fit(1280, 800).wide], [1, true]);
  assert.deepEqual([fit(800, 1280).scale, fit(800, 1280).landscape, fit(800, 1280).wide, fit(800, 1280).width], [1, false, true, '800px']);
  // A narrow portrait phone still fits the reference canvas, as before.
  assert.equal(fit(360, 740).scale, 360 / 412);
  assert.equal(fit(WIDE_CANVAS - 1, 1000).wide, false);
});

test('the launcher and desktop preview keep their fitted 412px canvas', () => {
  const launcher = canvasGeometry(input(915, 412, { launcher: true, screenShort: 412 }), 412);
  assert.deepEqual([launcher.scale, launcher.landscape], [1, true]);
  assert.equal(canvasGeometry(input(412, 915, { launcher: true }), 915).width, '412px');
  const desktop = canvasGeometry(input(1440, 900, { desktop: true, fluid: false, available: 852 }), 900);
  assert.deepEqual([desktop.scale, desktop.landscape, desktop.wide, desktop.width], [852 / 915, false, false, '412px']);
});

test('the keyboard shortens a portrait window without flipping it to landscape', () => {
  const free = keyboardFreeHeight();
  assert.equal(free(412, 915, false), 915);
  // Typing: the window is now wider than tall, but the width did not change.
  assert.equal(free(412, 380, true), 915);
  assert.equal(canvasGeometry(input(412, 380, { editing: true }), free(412, 380, true)).landscape, false);
  // The keyboard closes or the field loses focus: the real height is measured again.
  assert.equal(free(412, 380, false), 380);
  // Rotation changes the width, so it is honoured even while a field has focus.
  const turned = keyboardFreeHeight();
  turned(412, 915, true);
  assert.equal(turned(915, 300, true), 300);
  assert.equal(canvasGeometry(input(915, 300, { editing: true }), 300).landscape, true);
});

test('list-detail split and Calendar day columns follow measured width, with an agenda at large text', () => {
  assert.deepEqual(surfaceLayout(412, 1), { split: false, calendarDays: 1 });
  assert.deepEqual(surfaceLayout(640, 1), { split: false, calendarDays: 2 });
  assert.deepEqual(surfaceLayout(800, 1), { split: false, calendarDays: 3 });
  assert.deepEqual(surfaceLayout(915, 1), { split: false, calendarDays: 3 });
  assert.deepEqual(surfaceLayout(1024, 1), { split: true, calendarDays: 3 });
  assert.deepEqual(surfaceLayout(1280, 1), { split: true, calendarDays: 5 });
  assert.equal(surfaceLayout(4000, 1).calendarDays, 7);
  // Large text keeps the single-day agenda; the split still follows width.
  assert.deepEqual(surfaceLayout(1280, 1.3), { split: true, calendarDays: 1 });
  assert.deepEqual(surfaceLayout(1280, 1, true), { split: false, calendarDays: 1 });
});
