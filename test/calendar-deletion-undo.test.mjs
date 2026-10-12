import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
// Policy P-30 (issue #414). The flow runs the real policy/controller over simulated providers; the
// source checks pin the native contract. No Android build, provider, alarm or device is exercised.
const root = new URL('..', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const native = path => read(`android/app/src/main/java/ai/elizaresearch/alphaphone/${path}`);

test('reviewed deletion Undo policy, restart and provider outcomes', () => {
  execFileSync(process.execPath, ['--import', 'tsx', '--experimental-transform-types', 'scripts/test-calendar-deletion-undo-flow.ts'], { cwd: root, timeout: 60_000, stdio: 'pipe' });
});

test('Alpha deferred deletion hashes the same provider revision as the shared Calendar guard', () => {
  const fields = source => JSON.parse(/String\[\] EVENT\s*=\s*(\{[^}]*\})/.exec(source)[1].replace(/^\{/, '[').replace(/\}$/, ']'));
  const shared = read('vendor/eliza/plugins/plugin-native-calendar/android/src/main/java/ai/eliza/plugins/calendar/CalendarEventGuard.java');
  const alpha = native('CalendarDeferredDeletion.java');
  assert.deepEqual(fields(alpha), fields(shared), 'Event revision fields drifted from CalendarEventGuard');
  assert.match(shared, /CALENDAR=CalendarSourceIdentity\.fields\(\)/);
  assert.match(alpha, /CalendarSourceIdentity\.fields\(\)/);
  // Same canonical encoding and hash as the shared guard.
  const encoding = source => source.replace(/\s+/g, '').includes('.append(key.length()).append(\':\').append(key).append(value==null?"N":"V"+value.toString().length()+":"+value.toString()).append(\';\')');
  assert.ok(encoding(shared) && encoding(alpha));
  assert.match(alpha, /MessageDigest\.getInstance\("SHA-256"\)/);
});

test('native commit consumes its single-use grant before the provider call and never shows a second dialog', () => {
  const plugin = native('AlphaCalendarPlugin.java');
  const commit = plugin.slice(plugin.indexOf('public void commitDeletion'), plugin.indexOf('public void revokeDeletion'));
  assert.ok(commit.indexOf('CalendarDeferredDeletion.consume') < commit.indexOf('CalendarDeferredDeletion.commit'));
  assert.doesNotMatch(commit, /AlertDialog/);
  const review = plugin.slice(plugin.indexOf('public void reviewDeletion'), plugin.indexOf('public void commitDeletion'));
  assert.match(review, /AlertDialog\.Builder/); assert.doesNotMatch(review, /applyBatch|newDelete/, 'Review never deletes');
  assert.doesNotMatch(read('apps/app/src/prototype/calendar-adapter.ts'), /calendar\.remove\(|calendar\.removeSeries\(/, 'Calendar no longer deletes immediately');
});

test('reminder alarms are absorbed by a pending-deletion hold before the shared engine', () => {
  const receiver = native('ReminderReceiver.java');
  assert.ok(receiver.indexOf('ReminderDeliveryHolds.defer') < receiver.indexOf('.dispatch(intent)'));
  assert.match(receiver, /remindAction\.equals\(intent\.getAction\(\)\)/, 'Only alarms are held; boot/decision intents still reach the engine');
  assert.match(native('DailyAppsPlugin.java'), /holdReminderDelivery[\s\S]*releaseReminderDelivery[\s\S]*reminderDeliveryHolds/);
  assert.match(read('apps/app/src/browser/daily.ts'), /row\.status==='scheduled'&&row\.at<=Date\.now\(\)&&!held\(data,row\)/);
});

test('pending deletions use one allowlisted renderer slot and are not a native-only namespace', () => {
  assert.match(native('AlphaConnectionPlugin.java'), /name\.equals\("pending-deletions:v1:device"\)/);
  assert.match(read('apps/app/src/runtime/pending-deletion-store.ts'), /PENDING_DELETIONS_SLOT='pending-deletions:v1:device'/);
  assert.doesNotMatch(native('RendererCredentialSlots.java'), /"pending-deletions"/);
});
