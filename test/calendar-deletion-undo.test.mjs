import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
// Policy P-30 (issue #414). The flow runs the real policy/controller over simulated providers; the
// source checks pin the native contract. No Android build, provider, alarm or device is exercised.
const root = new URL('..', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const read_ = read;
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

test('native commit spends its single-use grant only after the provider was read, right before the provider call', () => {
  const plugin = native('AlphaCalendarPlugin.java');
  const commit = plugin.slice(plugin.indexOf('public void commitDeletion'), plugin.indexOf('public void revokeDeletion'));
  assert.doesNotMatch(commit, /AlertDialog/);
  // Locked or not in the foreground: nothing dispatched, the grant kept, the renderer retries later.
  assert.ok(commit.indexOf('!foreground()||!unlocked()') >= 0 && commit.indexOf('!foreground()||!unlocked()') < commit.indexOf('CalendarDeferredDeletion.commit'));
  assert.match(commit, /status\("unavailable"\)/);
  const deferred = native('CalendarDeferredDeletion.java');
  const body = deferred.slice(deferred.indexOf('static String commit(Context context, String grantId)'), deferred.indexOf('static String readback('));
  const peek = body.indexOf('peek(context, grantId)'), read = body.indexOf('snapshot = read(resolver'), unreadable = body.indexOf('return "unavailable"'), consume = body.indexOf('if (consume(context, grantId) == null)'), batch = body.indexOf('applyBatch');
  assert.ok(peek >= 0 && peek < read && read < unreadable && unreadable < consume && consume < batch, 'peek, read (unavailable keeps the grant), consume, then the provider call');
  assert.match(body, /if \(grant == null\) return "unknown";/, 'A missing grant is settled by readback, never reported as a change');
  assert.doesNotMatch(body, /grant == null\) return "conflict"/);
  const review = plugin.slice(plugin.indexOf('public void reviewDeletion'), plugin.indexOf('public void commitDeletion'));
  assert.match(review, /AlertDialog\.Builder/); assert.doesNotMatch(review, /applyBatch|newDelete/, 'Review never deletes');
  assert.doesNotMatch(read_('apps/app/src/prototype/calendar-adapter.ts'), /calendar\.remove\(|calendar\.removeSeries\(/, 'Calendar no longer deletes immediately');
  const browser = read_('apps/app/src/browser/calendar.ts');
  assert.match(browser, /const grant=data\.deletionGrants\?\.\[input\.grant\];if\(!grant\)return \{status:'unknown'\};/);
});

test('an event moved to another calendar is reported as kept, never as deleted', () => {
  const deferred = native('CalendarDeferredDeletion.java');
  assert.match(deferred, /return number\(row, "calendar_id"\) != calendarId \? "moved" : "orphaned";/);
  assert.match(deferred, /"absent"\.equals\(presence\) \? "deleted" : "moved"\.equals\(presence\) \? "conflict" : "unknown"/);
  assert.match(deferred, /"moved"\.equals\(presence\) \? "changed"/);
  const browser = read_('apps/app/src/browser/calendar.ts');
  assert.match(browser, /if\(!row\)return 'absent';\s*\/\/[^\n]*\n\s*if\(row\.calendarId!==grant\.calendarId\)return 'changed';/);
});

test('reminder deletion uses an owned review dialog, not window.confirm', () => {
  const adapter = read_('apps/app/src/prototype/reminder-adapter.ts');
  const del = adapter.slice(adapter.indexOf('Policy P-30: one review, then a ten-second Undo'), adapter.indexOf('deletionUndo().request({label:event.title'));
  assert.match(del, /DailyApps\.reviewReminderDeletion\(/); assert.doesNotMatch(del, /window\.confirm/);
  const plugin = native('DailyAppsPlugin.java');
  assert.match(plugin, /public void reviewReminderDeletion[\s\S]*AlertDialog\.Builder/);
  assert.match(plugin, /handleOnPause\(\) \{ super\.handleOnPause\(\); if \(reminderDeletionDialog != null\) reminderDeletionDialog\.dismiss\(\); \}/);
  assert.match(read_('apps/app/src/browser/daily.ts'), /async reviewReminderDeletion[\s\S]{0,400}this\.reviews\.confirm\(/);
});

test('reminder alarms are absorbed by a pending-deletion hold before the shared engine', () => {
  const receiver = native('ReminderReceiver.java');
  assert.ok(receiver.indexOf('ReminderDeliveryHolds.defer') < receiver.indexOf('.dispatch(intent)'));
  assert.match(receiver, /remindAction\.equals\(intent\.getAction\(\)\)/, 'Only alarms are held; boot/decision intents still reach the engine');
  assert.match(native('DailyAppsPlugin.java'), /holdReminderDelivery[\s\S]*releaseReminderDelivery[\s\S]*reminderDeliveryHolds/);
  assert.match(read('apps/app/src/browser/daily.ts'), /row\.status==='scheduled'&&row\.at<=Date\.now\(\)&&!held\(data,row\)/);
  // A full deferral list delivers the alarm now instead of silently dropping it.
  assert.match(native('ReminderDeliveryHolds.java'), /if \(deferred\.length\(\) >= MAXIMUM_DEFERRED\) return false;/);
});

test('pending deletions use one allowlisted renderer slot and are not a native-only namespace', () => {
  assert.match(native('AlphaConnectionPlugin.java'), /name\.equals\("pending-deletions:v1:device"\)/);
  assert.match(read('apps/app/src/runtime/pending-deletion-store.ts'), /PENDING_DELETIONS_SLOT='pending-deletions:v1:device'/);
  assert.doesNotMatch(native('RendererCredentialSlots.java'), /"pending-deletions"/);
});
