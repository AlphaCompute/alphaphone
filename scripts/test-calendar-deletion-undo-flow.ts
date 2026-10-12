// Policy P-30 (issue #414): reviewed Calendar/reminder deletion with a durable ten-second Undo.
// Pure policy, controller and provider wiring over an in-memory durable store and a simulated
// provider that models revisions, single-use review grants (consumed before the provider call, as
// AlphaCalendarPlugin and BrowserCalendar do), process death and alarm delivery. No Android, CalendarProvider,
// reminder engine, WebView or browser storage is exercised here.
import assert from 'node:assert/strict';
import {
  UNDO_WINDOW_MS, requestDeletion, undoDeletion, commitDueDeletions, reconcileDeletions, pendingDeletions, keepUnconfirmedDeletion,
  hiddenDeletionTargets, deletionReviewText, undoRemaining, targetKey, validatePendingDeletions,
  type PendingDeletionDocument, type PendingDeletionStore, type DeletionProvider, type PendingDeletion, type EventDeletionTarget, type ReminderDeletionTarget, type DeliveryHold,
} from '../apps/app/src/runtime/pending-deletions.ts';
import { createDeletionUndo, deletionProvider, RETRY_LATER_MS } from '../apps/app/src/runtime/deletion-undo-core.ts';

/** Durable store: survives "process death" because tests create new providers/controllers over it. */
class MemoryStore implements PendingDeletionStore {
  raw: string | null = null; failWrites = 0;
  async read() { return this.raw === null ? null : JSON.parse(this.raw) as PendingDeletionDocument; }
  async compareExchange(expected: PendingDeletionDocument | null, next: PendingDeletionDocument | null) {
    if (this.failWrites > 0) { this.failWrites--; return false; }
    if (JSON.stringify(expected) !== (this.raw ?? 'null')) return false;
    this.raw = next === null ? null : JSON.stringify(next); return true;
  }
}

type Row = { revision: string; deleted: boolean };
/** Provider model: rows with revisions, holds with deferred alarms, and an effect log. */
class World {
  rows = new Map<string, Row>(); holds = new Map<string, { holdId: string; deferred: string[] }>();
  deliveries: string[] = []; effects: string[] = []; revoked: string[] = []; used = new Set<string>(); commits = 0;
  permission = true; available = true; nextCommit: 'normal' | 'die-after-effect' | 'die-before-effect' | 'unknown' = 'normal';
  readbackFails = false;
  key(record: PendingDeletion) { return record.target.kind === 'event' ? record.target.id : record.target.target.reminderId; }
  revisionOf(record: PendingDeletion) { return record.target.kind === 'event' ? record.target.revision : record.target.target.revision; }
  alarm(reminderId: string, occurrence: string) {
    const hold = this.holds.get(reminderId);
    if (hold) { if (!hold.deferred.includes(occurrence)) hold.deferred.push(occurrence); return; }
    if (this.rows.get(reminderId)?.deleted) return;
    this.deliveries.push(`${reminderId}/${occurrence}`);
  }
  provider(): DeletionProvider {
    return {
      commit: async record => {
        this.commits++;
        if (!this.permission) return 'permission-required';
        // Not ready: nothing dispatched and the grant is kept (Android checks this before consume()).
        if (!this.available) return 'unavailable';
        // Single-use grant: a used or revoked grant can never delete; the readback decides.
        if (record.target.kind === 'event') {
          const grant = record.target.grant;
          if (this.used.has(grant) || this.revoked.includes(grant)) return 'unknown';
          this.used.add(grant);
        }
        const row = this.rows.get(this.key(record));
        if (!row || row.deleted) return 'deleted';
        if (row.revision !== this.revisionOf(record)) return 'conflict';
        const mode = this.nextCommit; this.nextCommit = 'normal';
        if (mode === 'die-before-effect') throw Error('process died before the provider call');
        row.deleted = true; this.effects.push(this.key(record));
        if (mode === 'die-after-effect') throw Error('process died after the provider call');
        if (mode === 'unknown') return 'unknown';
        return 'deleted';
      },
      readback: async record => {
        if (!this.permission) return 'permission-required';
        if (this.readbackFails) return 'unavailable';
        const row = this.rows.get(this.key(record));
        return !row || row.deleted ? 'absent' : row.revision === this.revisionOf(record) ? 'present' : 'changed';
      },
      hold: async record => { if (record.target.kind !== 'reminder') return; const id = record.target.target.reminderId; const existing = this.holds.get(id); if (existing?.holdId === record.id) return; this.holds.set(id, { holdId: record.id, deferred: [] }); },
      release: async (hold: DeliveryHold, redeliver) => {
        const existing = this.holds.get(hold.reminderId); if (!existing || existing.holdId !== hold.id) return;
        this.holds.delete(hold.reminderId);
        if (redeliver) for (const occurrence of existing.deferred) this.alarm(hold.reminderId, occurrence);
      },
      holds: async () => [...this.holds].map(([reminderId, hold]) => ({ id: hold.holdId, reminderId })),
      revoke: async record => { if (record.target.kind === 'event') this.revoked.push(record.target.grant); },
    };
  }
}

const expected = { title: 'Dentist', body: '', location: '', begin: 1_800_000_000_000, end: 1_800_000_360_000 };
const event = (id = '71', revision = 'r1', extra: Partial<EventDeletionTarget> = {}): EventDeletionTarget => ({ kind: 'event', id, calendarId: '19', revision, expected, scope: 'event', invitation: false, grant: `grant-${id}`, ...extra });
const reminder = (id = 'rem1', revision = 'a'.repeat(64), scope: 'reminder' | 'series' = 'reminder'): ReminderDeletionTarget => ({ kind: 'reminder', target: { sourceId: 'local', sourceRevision: 'b'.repeat(64), reminderId: id, occurrenceId: 'occ1', revision }, scope, operationId: `op-${id}` });
const T0 = 1_700_000_000_000;

// 1. Request hides the target, holds delivery and leaves the provider untouched; Undo is lossless.
{
  const store = new MemoryStore(), world = new World();
  world.rows.set('71', { revision: 'r1', deleted: false }); world.rows.set('rem1', { revision: 'a'.repeat(64), deleted: false });
  const e = await requestDeletion(store, world.provider(), { id: 'd1', label: 'Dentist', target: event() }, T0);
  const r = await requestDeletion(store, world.provider(), { id: 'd2', label: 'Pills', target: reminder() }, T0);
  assert.equal(e.status, 'pending'); assert.equal(r.status, 'pending');
  assert.equal(world.effects.length, 0, 'Nothing is deleted at request time');
  assert.ok(world.holds.has('rem1'), 'Reminder delivery is suspended immediately');
  const hidden = hiddenDeletionTargets(await pendingDeletions(store));
  assert.ok(hidden.event('71') && hidden.reminders.has('rem1'));
  world.alarm('rem1', 'occ1');
  assert.deepEqual(world.deliveries, [], 'An alarm during the Undo window is not posted');
  assert.equal((await requestDeletion(store, world.provider(), { id: 'd3', label: 'Dentist', target: event() }, T0 + 1)).status, 'duplicate');
  const undoneEvent = await undoDeletion(store, world.provider(), 'd1', T0 + UNDO_WINDOW_MS - 1);
  assert.deepEqual([undoneEvent.status, (undoneEvent as { lossless?: boolean }).lossless], ['restored', true]);
  assert.deepEqual(world.revoked, ['grant-71'], 'Undo revokes the single-use provider grant');
  await undoDeletion(store, world.provider(), 'd2', T0 + 5000);
  assert.deepEqual(world.deliveries, ['rem1/occ1'], 'Undo delivers the suppressed alert late instead of dropping it');
  assert.equal(world.holds.size, 0); assert.equal(store.raw, null); assert.equal(world.effects.length, 0);
}

// 2. Expiry commits once, reads back, and drops a suppressed alert for a confirmed deletion.
{
  const store = new MemoryStore(), world = new World();
  world.rows.set('rem1', { revision: 'a'.repeat(64), deleted: false });
  await requestDeletion(store, world.provider(), { id: 'd1', label: 'Pills', target: reminder('rem1', 'a'.repeat(64), 'series') }, T0);
  world.alarm('rem1', 'occ1');
  assert.deepEqual(await commitDueDeletions(store, world.provider(), T0 + UNDO_WINDOW_MS - 1), [], 'Nothing commits inside the window');
  assert.equal((await undoDeletion(store, world.provider(), 'd1', T0 + UNDO_WINDOW_MS)).status, 'expired', 'Undo ends exactly at expiry');
  const reports = await commitDueDeletions(store, world.provider(), T0 + UNDO_WINDOW_MS);
  assert.deepEqual(reports.map(r => r.status), ['deleted']); assert.match(reports[0].message, /repeating reminder deleted/);
  assert.deepEqual(world.effects, ['rem1']); assert.deepEqual(world.deliveries, [], 'A confirmed deletion drops its suppressed alert');
  assert.equal(world.holds.size, 0); assert.equal(store.raw, null);
  assert.deepEqual(await commitDueDeletions(store, world.provider(), T0 + 60_000), [], 'No second dispatch');
}

// 3. Process death before expiry: the intent, hidden state and Undo survive restart.
{
  const store = new MemoryStore(), world = new World();
  world.rows.set('71', { revision: 'r1', deleted: false });
  await requestDeletion(store, world.provider(), { id: 'd1', label: 'Dentist', target: event() }, T0);
  const restarted = new World(); restarted.rows = world.rows; restarted.revoked = world.revoked; // new process, same provider data
  const reports = await reconcileDeletions(store, restarted.provider(), T0 + 4000);
  assert.deepEqual(reports, [], 'Restart inside the window neither commits nor drops the intent');
  const [record] = await pendingDeletions(store);
  assert.equal(undoRemaining(record, T0 + 4000), UNDO_WINDOW_MS - 4000, 'Remaining Undo time is restored, not reset');
  assert.equal((await undoDeletion(store, restarted.provider(), 'd1', T0 + 4000)).status, 'restored');
  assert.equal(world.rows.get('71')!.deleted, false);
}

// 4. Process death after expiry but before dispatch: restart commits exactly once.
{
  const store = new MemoryStore(), world = new World();
  world.rows.set('71', { revision: 'r1', deleted: false });
  await requestDeletion(store, world.provider(), { id: 'd1', label: 'Dentist', target: event() }, T0);
  const reports = await reconcileDeletions(store, world.provider(), T0 + 3_600_000);
  assert.deepEqual(reports.map(r => r.status), ['deleted']); assert.deepEqual(world.effects, ['71']);
}

// 5. Process death during dispatch, after the provider effect: readback, never a second delete.
{
  const store = new MemoryStore(), world = new World();
  world.rows.set('71', { revision: 'r1', deleted: false });
  await requestDeletion(store, world.provider(), { id: 'd1', label: 'Dentist', target: event() }, T0);
  world.nextCommit = 'die-after-effect'; world.readbackFails = true;
  assert.deepEqual((await commitDueDeletions(store, world.provider(), T0 + UNDO_WINDOW_MS)).map(r => r.status), ['unconfirmed']);
  world.readbackFails = false;
  assert.equal((await pendingDeletions(store))[0].phase, 'unknown');
  assert.deepEqual(await commitDueDeletions(store, world.provider(), T0 + 60_000), [], 'An unknown outcome is never redispatched blindly');
  const reports = await reconcileDeletions(store, world.provider(), T0 + 120_000);
  assert.deepEqual(reports.map(r => r.status), ['deleted']); assert.deepEqual(world.effects, ['71'], 'Exactly one provider effect');
  assert.equal(store.raw, null);
}

// 6. A dispatch that used its single-use grant but deleted nothing is reported as "not deleted",
//    never as "changed", and is never dispatched a second time.
{
  const store = new MemoryStore(), world = new World();
  world.rows.set('71', { revision: 'r1', deleted: false });
  await requestDeletion(store, world.provider(), { id: 'd1', label: 'Dentist', target: event() }, T0);
  world.nextCommit = 'die-before-effect'; // grant consumed, provider call never made (Android: read/applyBatch threw)
  const reports = await commitDueDeletions(store, world.provider(), T0 + UNDO_WINDOW_MS);
  assert.deepEqual(reports.map(r => r.status), ['not-deleted']);
  assert.match(reports[0].message, /deletion did not happen, so it is still there/);
  assert.doesNotMatch(reports[0].message, /changed after you deleted it/);
  assert.equal(store.raw, null, 'The item is shown again; nothing stays hidden');
  for (let i = 0; i < 3; i++) assert.deepEqual(await reconcileDeletions(store, world.provider(), T0 + 20_000 + i), []);
  assert.equal(world.commits, 1, 'Never dispatched again'); assert.deepEqual(world.effects, []);
  // Process death after `committing` was saved but before the provider was called: restart reads
  // back the exact revision and reports "not deleted" without dispatching.
  const died = new MemoryStore(), restarted = new World(); restarted.rows.set('72', { revision: 'r1', deleted: false });
  await requestDeletion(died, restarted.provider(), { id: 'd2', label: 'Gym', target: event('72') }, T0);
  const doc = JSON.parse(died.raw!) as PendingDeletionDocument; doc.d2 = { ...doc.d2, phase: 'committing', attempts: 1 }; died.raw = JSON.stringify(doc);
  assert.deepEqual((await reconcileDeletions(died, restarted.provider(), T0 + 60_000)).map(r => r.status), ['not-deleted']);
  assert.equal(restarted.commits, 0); assert.deepEqual(restarted.revoked, ['grant-72'], 'The unused grant is revoked');
  // A grant that is already gone (used by an interrupted commit) is "unknown", settled by readback.
  const spent = new MemoryStore(), reused = new World(); reused.rows.set('73', { revision: 'r1', deleted: false }); reused.used.add('grant-73');
  await requestDeletion(spent, reused.provider(), { id: 'd3', label: 'Lunch', target: event('73') }, T0);
  assert.deepEqual((await commitDueDeletions(spent, reused.provider(), T0 + UNDO_WINDOW_MS)).map(r => r.status), ['not-deleted']);
}

// 7. Concurrent edit and organizer/permission effects keep the object and resume delivery.
{
  const store = new MemoryStore(), world = new World();
  world.rows.set('71', { revision: 'r1', deleted: false }); world.rows.set('rem1', { revision: 'a'.repeat(64), deleted: false });
  await requestDeletion(store, world.provider(), { id: 'd1', label: 'Dentist', target: event() }, T0);
  await requestDeletion(store, world.provider(), { id: 'd2', label: 'Pills', target: reminder() }, T0);
  world.rows.get('71')!.revision = 'r2'; world.rows.get('rem1')!.revision = 'c'.repeat(64);
  world.alarm('rem1', 'occ1');
  const reports = await commitDueDeletions(store, world.provider(), T0 + UNDO_WINDOW_MS);
  assert.deepEqual(reports.map(r => r.status), ['kept-changed', 'kept-changed']);
  assert.match(reports[0].message, /changed after you deleted it, so it was kept/);
  assert.deepEqual(world.effects, []); assert.deepEqual(world.deliveries, ['rem1/occ1'], 'A kept reminder gets its suppressed alert');
  assert.deepEqual(world.revoked, ['grant-71']);
  // An uncertain dispatch whose target then reads back as changed is reported as kept at once.
  const raced = new MemoryStore(), racing = new World(); racing.rows.set('73', { revision: 'r1', deleted: false });
  const racer = racing.provider(); racer.commit = async () => { racing.rows.get('73')!.revision = 'r9'; return 'unknown'; };
  await requestDeletion(raced, racer, { id: 'd5', label: 'Raced', target: event('73') }, T0);
  assert.deepEqual((await commitDueDeletions(raced, racer, T0 + UNDO_WINDOW_MS)).map(r => r.status), ['kept-changed']);
  assert.equal(raced.raw, null);
  const lost = new MemoryStore(), denied = new World(); denied.rows.set('71', { revision: 'r1', deleted: false });
  await requestDeletion(lost, denied.provider(), { id: 'd1', label: 'Dentist', target: event() }, T0);
  denied.permission = false;
  assert.deepEqual((await commitDueDeletions(lost, denied.provider(), T0 + UNDO_WINDOW_MS)).map(r => r.status), ['kept-permission']);
  assert.equal(lost.raw, null, 'Permission loss ends the intent visibly instead of retrying forever');
  const locked = new MemoryStore(), later = new World(); later.rows.set('71', { revision: 'r1', deleted: false });
  await requestDeletion(locked, later.provider(), { id: 'd1', label: 'Dentist', target: event() }, T0);
  later.available = false;
  assert.deepEqual((await commitDueDeletions(locked, later.provider(), T0 + UNDO_WINDOW_MS)).map(r => r.status), ['retry-later']);
  later.available = true;
  assert.deepEqual((await reconcileDeletions(locked, later.provider(), T0 + 99_000)).map(r => r.status), ['deleted']);
}

// 8. Unknown outcome with unavailable readback: the item is shown again, reported once, listed
//    as unconfirmed until a readback or the user's Keep settles it, and never redispatched.
{
  const store = new MemoryStore(), world = new World();
  world.rows.set('71', { revision: 'r1', deleted: false });
  await requestDeletion(store, world.provider(), { id: 'd1', label: 'Dentist', target: event() }, T0);
  world.nextCommit = 'unknown'; world.readbackFails = true;
  assert.deepEqual((await commitDueDeletions(store, world.provider(), T0 + UNDO_WINDOW_MS)).map(r => r.status), ['unconfirmed']);
  assert.deepEqual((await reconcileDeletions(store, world.provider(), T0 + 20_000)).map(r => r.status), [], 'Reported once, then listed in Calendar');
  assert.equal(hiddenDeletionTargets(await pendingDeletions(store)).event('71'), false, 'An unconfirmed deletion is not hidden');
  world.readbackFails = false;
  assert.deepEqual((await reconcileDeletions(store, world.provider(), T0 + 30_000)).map(r => r.status), ['deleted'], 'Check again settles it');
  assert.deepEqual(world.effects, ['71']); assert.equal(world.commits, 1);
  // A reminder whose outcome is unknown stops muting its alerts and can be kept explicitly.
  const kept = new MemoryStore(), muted = new World(); muted.rows.set('rem1', { revision: 'a'.repeat(64), deleted: false });
  const provider = muted.provider(); provider.commit = async () => 'unknown';
  await requestDeletion(kept, provider, { id: 'd2', label: 'Pills', target: reminder() }, T0);
  muted.alarm('rem1', 'occ1'); muted.readbackFails = true;
  assert.deepEqual((await commitDueDeletions(kept, provider, T0 + UNDO_WINDOW_MS)).map(r => r.status), ['unconfirmed']);
  assert.equal(muted.holds.size, 0, 'An unknown record releases its delivery hold');
  assert.deepEqual(muted.deliveries, ['rem1/occ1'], 'The alert suppressed during the window is delivered');
  await reconcileDeletions(kept, provider, T0 + 99_000);
  assert.equal(muted.holds.size, 0, 'Reconciliation never re-holds an unknown record');
  muted.alarm('rem1', 'occ2'); assert.deepEqual(muted.deliveries, ['rem1/occ1', 'rem1/occ2']);
  assert.equal(await keepUnconfirmedDeletion(kept, provider, 'd2'), true);
  assert.equal(kept.raw, null, 'Keep ends tracking');
  assert.equal(await keepUnconfirmedDeletion(kept, provider, 'd2'), false);
  // A new review of an item with an unconfirmed deletion supersedes it instead of reporting a duplicate.
  const again = new MemoryStore(), redo = new World(); redo.rows.set('74', { revision: 'r1', deleted: false });
  const p2 = redo.provider(); p2.commit = async () => 'unknown'; redo.readbackFails = true;
  await requestDeletion(again, p2, { id: 'd4', label: 'Call', target: event('74') }, T0);
  await commitDueDeletions(again, p2, T0 + UNDO_WINDOW_MS);
  const second = await requestDeletion(again, p2, { id: 'd5', label: 'Call', target: event('74', 'r1', { grant: 'grant-74b' }) }, T0 + 60_000);
  assert.equal(second.status, 'pending'); assert.deepEqual((await pendingDeletions(again)).map(r => r.id), ['d5']);
  assert.deepEqual(redo.revoked, ['grant-74'], 'The superseded grant is revoked');
}

// 9. Recurrence scopes: a series hides every occurrence; two occurrences are separate intents.
{
  const store = new MemoryStore(), world = new World();
  const occurrence = (begin: number) => event(`s1:occ:${begin}`, 'rs', { scope: 'occurrence', seriesId: 's1', occurrenceBegin: begin, grant: `g${begin}` });
  assert.equal((await requestDeletion(store, world.provider(), { id: 'o1', label: 'Standup', target: occurrence(1000) }, T0)).status, 'pending');
  assert.equal((await requestDeletion(store, world.provider(), { id: 'o2', label: 'Standup', target: occurrence(2000) }, T0)).status, 'pending');
  let hidden = hiddenDeletionTargets(await pendingDeletions(store));
  assert.ok(hidden.event('s1:occ:1000', 's1') && hidden.event('s1:occ:2000', 's1') && !hidden.event('s1:occ:3000', 's1'));
  await requestDeletion(store, world.provider(), { id: 's', label: 'Standup', target: event('s1:occ:3000', 'rs', { scope: 'series', seriesId: 's1', grant: 'gs' }) }, T0);
  hidden = hiddenDeletionTargets(await pendingDeletions(store));
  assert.ok(hidden.event('s1:occ:9000', 's1'), 'A pending series deletion hides all of its occurrences');
  assert.notEqual(targetKey(occurrence(1000)), targetKey(occurrence(2000)));
  assert.throws(() => validatePendingDeletions({ x: { ...(JSON.parse(store.raw!) as PendingDeletionDocument).o1, id: 'x', target: { ...occurrence(1), occurrenceBegin: undefined } } }), /Invalid pending deletion/);
}

// 10. Failed restoration: a dispatched deletion cannot be undone, and a failed Undo save keeps the
//     intent intact for a retry instead of claiming a restore.
{
  const store = new MemoryStore(), world = new World();
  world.rows.set('71', { revision: 'r1', deleted: false });
  await requestDeletion(store, world.provider(), { id: 'd1', label: 'Dentist', target: event() }, T0);
  store.failWrites = 99;
  await assert.rejects(undoDeletion(store, world.provider(), 'd1', T0 + 1000), /changed/);
  store.failWrites = 0;
  assert.equal((await pendingDeletions(store))[0].phase, 'pending', 'The intent is unchanged after a failed Undo save');
  assert.deepEqual(world.revoked, [], 'No revoke until the Undo is saved');
  world.nextCommit = 'die-after-effect'; world.readbackFails = true;
  await commitDueDeletions(store, world.provider(), T0 + UNDO_WINDOW_MS);
  assert.equal((await undoDeletion(store, world.provider(), 'd1', T0 + UNDO_WINDOW_MS + 1)).status, 'too-late', 'A dispatched deletion is never offered as restorable');
  assert.equal((await undoDeletion(store, world.provider(), 'missing', T0)).status, 'missing');
}

// 11. A wall clock moved backwards cannot stretch the window; a hold left by an interrupted Undo
//     is released (and its alert delivered) by reconciliation.
{
  const store = new MemoryStore(), world = new World();
  world.rows.set('71', { revision: 'r1', deleted: false });
  await requestDeletion(store, world.provider(), { id: 'd1', label: 'Dentist', target: event() }, T0);
  const [record] = await pendingDeletions(store);
  assert.equal(undoRemaining(record, T0 - 60_000), 0);
  assert.deepEqual((await commitDueDeletions(store, world.provider(), T0 - 60_000)).map(r => r.status), ['deleted']);
  world.holds.set('orphan', { holdId: 'gone', deferred: ['occ7'] });
  await reconcileDeletions(store, world.provider(), T0);
  assert.equal(world.holds.size, 0); assert.deepEqual(world.deliveries, ['orphan/occ7']);
  // A record whose hold write was lost gets its hold back before any delivery decision.
  const second = new MemoryStore(), lostHold = new World(); lostHold.rows.set('rem1', { revision: 'a'.repeat(64), deleted: false });
  const provider = lostHold.provider(), hold = provider.hold; provider.hold = async () => { throw Error('hold write lost'); };
  await requestDeletion(second, provider, { id: 'd2', label: 'Pills', target: reminder() }, T0);
  assert.equal(lostHold.holds.size, 0); provider.hold = hold;
  await reconcileDeletions(second, provider, T0 + 1000);
  assert.ok(lostHold.holds.has('rem1'), 'Reconciliation restores a missing hold');
}

// 12. Review copy: one step, a stated ten-second window and no lossless-restore claim for invitations.
{
  const invitation = deletionReviewText({ kind: 'event', scope: 'event', invitation: true });
  assert.match(invitation, /undo for 10 seconds/); assert.match(invitation, /cannot be restored/);
  assert.match(invitation, /recreating it would be a new event, not the original/);
  assert.doesNotMatch(invitation, /lossless|restored exactly|fully restored/i);
  assert.match(deletionReviewText({ kind: 'event', scope: 'occurrence', invitation: false }), /one occurrence/);
  assert.match(deletionReviewText({ kind: 'reminder', scope: 'series' }), /alert is paused/);
}

// 13. Controller: one timer commits at expiry; restart re-arms from the durable record.
{
  const store = new MemoryStore(), world = new World();
  world.rows.set('71', { revision: 'r1', deleted: false });
  let now = T0; const timers: { at: number; fn: () => void }[] = [];
  const clock = { now: () => now, setTimeout: (fn: () => void, ms: number) => { const t = { at: now + ms, fn }; timers.push(t); return t; }, clearTimeout: (t: unknown) => { const i = timers.indexOf(t as never); if (i >= 0) timers.splice(i, 1); } };
  const seen: string[] = [];
  const first = createDeletionUndo(store, world.provider(), clock);
  first.subscribe(event => { if (event.type === 'reports') seen.push(...event.reports.map(r => r.status)); });
  const held = await first.request({ label: 'Dentist', target: event() });
  assert.equal(held.status, 'pending'); assert.equal(timers.length, 1); assert.ok(timers[0].at >= T0 + UNDO_WINDOW_MS);
  // Process death: the first controller and its timer are gone.
  timers.length = 0; now = T0 + 3000;
  const second = createDeletionUndo(store, world.provider(), clock);
  second.subscribe(event => { if (event.type === 'reports') seen.push(...event.reports.map(r => r.status)); });
  await second.reconcile();
  assert.equal(second.remaining(second.records()[0].id), UNDO_WINDOW_MS - 3000);
  assert.equal(timers.length, 1, 'Restart re-arms the expiry timer');
  now = timers[0].at; timers.shift()!.fn(); await second.commitDue();
  assert.deepEqual(seen, ['deleted']); assert.deepEqual(world.effects, ['71']); assert.deepEqual(second.records(), []);
}

// 13b. A stalled wall clock cannot hold a deletion open while this process watches the window.
{
  const store = new MemoryStore(), world = new World();
  world.rows.set('71', { revision: 'r1', deleted: false });
  let mono = 0; const timers: (() => void)[] = [];
  const controller = createDeletionUndo(store, world.provider(), { now: () => T0, monotonic: () => mono, setTimeout: fn => { timers.push(fn); return fn; }, clearTimeout: () => undefined });
  const held = await controller.request({ label: 'Dentist', target: event() });
  assert.equal(held.status, 'pending');
  mono = 4000; assert.equal(controller.remaining(held.record.id), UNDO_WINDOW_MS - 4000);
  mono = UNDO_WINDOW_MS + 1; assert.equal(controller.remaining(held.record.id), 0);
  assert.equal((await controller.undo(held.record.id)).status, 'expired', 'Undo ends with the observed window even if the wall clock stalls');
  await controller.commitDue();
  assert.deepEqual(world.effects, ['71']);
}

// 13c. "Retry later" pauses before the next attempt instead of spinning on the expiry timer.
{
  const store = new MemoryStore(), world = new World();
  world.rows.set('71', { revision: 'r1', deleted: false }); world.available = false;
  let now = T0; const delays: number[] = [];
  const controller = createDeletionUndo(store, world.provider(), { now: () => now, setTimeout: (fn, ms) => { delays.push(ms); return fn; }, clearTimeout: () => undefined });
  await controller.request({ label: 'Dentist', target: event() });
  now = T0 + UNDO_WINDOW_MS; await controller.commitDue();
  assert.ok(delays.at(-1)! >= RETRY_LATER_MS, 'The next attempt waits RETRY_LATER_MS');
  world.available = true; now += RETRY_LATER_MS; await controller.commitDue();
  assert.deepEqual(world.effects, ['71']);
}

// 14. Provider wiring: reminder cancellation reuses the action journal and never redispatches.
{
  const journal: Record<string, unknown> = {}; const calls: string[] = []; let receipt: { status: string; result?: unknown } = { status: 'unknown' };
  const reminders = {
    holdReminderDelivery: async () => ({ status: 'held' }), releaseReminderDelivery: async () => ({ status: 'released' }), reminderDeliveryHolds: async () => ({ holds: [] }),
    operateReminder: async () => { calls.push('operate'); throw Error('process died'); },
    reminderOperationReceipt: async () => { calls.push('receipt'); return receipt; },
    listReminders: async () => ({ reminders: [] as { id: string; status: 'scheduled' }[] }),
  };
  const provider = deletionProvider(
    { commitDeletion: async () => ({ status: 'deleted' }), revokeDeletion: async () => ({ status: 'revoked' }), deletionReadback: async () => ({ status: 'absent' }) },
    reminders,
    { pending: async () => journal as never, retain: async input => { journal[input.operationId] = input; }, acknowledge: async input => { delete journal[input.operationId]; }, discard: async input => { delete journal[input.operationId]; } },
  );
  const record: PendingDeletion = { version: 1, id: 'd1', label: 'Pills', requestedAt: T0, expiresAt: T0 + UNDO_WINDOW_MS, phase: 'committing', attempts: 1, target: reminder() };
  await assert.rejects(provider.commit(record));
  assert.ok(journal['op-rem1'], 'The cancellation is journaled before dispatch');
  assert.equal(await provider.commit(record), 'unknown', 'A journaled cancellation is reconciled from its receipt, not dispatched again');
  assert.deepEqual(calls, ['operate', 'receipt']);
  receipt = { status: 'succeeded', result: { status: 'cancelled' } };
  assert.equal(await provider.readback(record), 'absent');
  reminders.listReminders = async () => ({ reminders: [{ id: 'rem1', status: 'scheduled', target: { ...reminder().target, revision: 'f'.repeat(64) } } as never] });
  receipt = { status: 'unknown' };
  assert.equal(await provider.readback(record), 'changed');
}

// 15. A refused reminder cancellation leaves no journal entry behind and is reported truthfully.
{
  const scenario = async (operate: () => Promise<{ status: string; result?: unknown }>, listed: { revision: string }) => {
    const journal: Record<string, unknown> = {}, store = new MemoryStore();
    const reminders = {
      holdReminderDelivery: async () => ({ status: 'held' }), releaseReminderDelivery: async () => ({ status: 'released' }), reminderDeliveryHolds: async () => ({ holds: [] }),
      operateReminder: operate, reminderOperationReceipt: async () => ({ status: 'unknown' }),
      listReminders: async () => ({ reminders: [{ id: 'rem1', status: 'scheduled', target: { ...reminder().target, ...listed } } as never] }),
    };
    const provider = deletionProvider(
      { commitDeletion: async () => ({ status: 'unknown' }), revokeDeletion: async () => ({ status: 'revoked' }), deletionReadback: async () => ({ status: 'unavailable' }) },
      reminders,
      { pending: async () => journal as never, retain: async input => { journal[input.operationId] = input; }, acknowledge: async input => { delete journal[input.operationId]; }, discard: async input => { delete journal[input.operationId]; } },
    );
    await requestDeletion(store, provider, { id: 'd1', label: 'Pills', target: reminder() }, T0);
    const reports = await commitDueDeletions(store, provider, T0 + UNDO_WINDOW_MS);
    return { statuses: reports.map(r => r.status), journal: Object.keys(journal), store: store.raw };
  };
  // Both engines reject a cancellation of a changed target; the readback shows the new revision.
  assert.deepEqual(await scenario(async () => { throw Error('Selected reminder changed'); }, { revision: 'f'.repeat(64) }), { statuses: ['kept-changed'], journal: [], store: null });
  // A rejection for any other reason with the reminder unchanged: not deleted, never "changed".
  assert.deepEqual(await scenario(async () => { throw Error('Reminder operation storage full'); }, { revision: 'a'.repeat(64) }), { statuses: ['not-deleted'], journal: [], store: null });
  assert.deepEqual(await scenario(async () => ({ status: 'stale' }), { revision: 'a'.repeat(64) }), { statuses: ['kept-changed'], journal: [], store: null });
}

console.log('PASS P-30 deletion Undo: lossless Undo before dispatch, durable intent across process death before/after expiry and during dispatch, single provider effect, concurrent edit/permission/unknown/not-deleted outcomes with single-use grants, unconfirmed Keep, refused reminder cancellation journal cleanup, recurrence scopes, reminder alert suppression and late redelivery, failed restoration, clock skew, controller re-arm, journaled reminder cancellation. Android provider, receiver and WebView behavior not exercised.');
