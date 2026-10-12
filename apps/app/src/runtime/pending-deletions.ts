/**
 * Reviewed deletion with a durable Undo window for Calendar events and reminders (policy P-30).
 *
 * The user reviews a deletion once. The intent is persisted before anything else happens and the
 * provider deletion is delayed until the window expires, so an Undo inside the window is lossless:
 * the provider object was never touched. After expiry the deletion is dispatched exactly once
 * (the record is marked `committing` and saved before dispatch) and read back from the provider.
 * Nothing is ever recreated: after the provider deletion there is no restore, and a recreated
 * invitation would never be described as a lossless restore.
 *
 * Pure policy: storage and provider effects are injected, so the same rules serve the browser
 * build, the Android bridge and the node tests.
 */
export const UNDO_WINDOW_MS = 10_000;
export const MAX_PENDING_DELETIONS = 50;
/** Dispatches allowed for one intent; each one after the first requires a readback of the exact revision. */
export const MAX_DISPATCHES = 3;

export type EventDeletionScope = 'event' | 'occurrence' | 'series';
export type EventExpected = { title: string; body: string; location: string; begin: number; end: number };
export type EventDeletionTarget = {
  kind: 'event';
  id: string;
  calendarId: string;
  /** Exact provider revision captured by the review. A different revision is a concurrent edit. */
  revision: string;
  expected: EventExpected;
  scope: EventDeletionScope;
  /** Series identity for an occurrence or whole-series deletion. */
  seriesId?: string;
  occurrenceBegin?: number;
  /** Guests or an organizer exist; deleting may notify people and cannot be undone by recreation. */
  invitation: boolean;
  /** Single-use review grant issued by the calendar provider for this exact revision. */
  grant: string;
};
export type ReminderDeletionTarget = {
  kind: 'reminder';
  /** Exact reviewed reminder target: source, reminder, occurrence and revision. */
  target: { sourceId: string; sourceRevision: string; reminderId: string; occurrenceId: string; revision: string };
  /** A repeating reminder is cancelled as a whole series; a single reminder as itself. */
  scope: 'reminder' | 'series';
  /** Operation identity reused for the provider cancellation so a retry never repeats it. */
  operationId: string;
};
export type DeletionTarget = EventDeletionTarget | ReminderDeletionTarget;
export type DeletionPhase = 'pending' | 'committing' | 'unknown';
export type PendingDeletion = {
  version: 1;
  id: string;
  label: string;
  requestedAt: number;
  expiresAt: number;
  phase: DeletionPhase;
  /** Number of dispatches started. Only a readback that shows the exact revision allows another. */
  attempts: number;
  target: DeletionTarget;
};
export type PendingDeletionDocument = Record<string, PendingDeletion>;

export interface PendingDeletionStore {
  read(): Promise<PendingDeletionDocument | null>;
  /** Replace `expected` with `next` atomically; false when another writer changed it first. */
  compareExchange(expected: PendingDeletionDocument | null, next: PendingDeletionDocument | null): Promise<boolean>;
}

/** Provider result of a dispatched deletion. `unknown` means the effect may or may not have happened. */
export type CommitOutcome = 'deleted' | 'conflict' | 'permission-required' | 'unavailable' | 'unknown';
/**
 * Provider readback of the exact target.
 * `absent`: the reviewed object (or occurrence) no longer exists.
 * `present`: it exists with the reviewed revision, so the deletion did not happen.
 * `changed`: it exists with a different revision (concurrent edit, organizer change).
 */
export type ReadbackOutcome = 'absent' | 'present' | 'changed' | 'permission-required' | 'unavailable';

export interface DeletionProvider {
  commit(record: PendingDeletion): Promise<CommitOutcome>;
  readback(record: PendingDeletion): Promise<ReadbackOutcome>;
  /** Suspend reminder delivery for this target. Must be idempotent. */
  hold(record: PendingDeletion): Promise<void>;
  /**
   * Resume delivery. `redeliver` is true when the reminder survives (Undo, conflict, permission
   * loss): an alert suppressed during the hold is then delivered late rather than dropped.
   */
  release(hold: DeliveryHold, redeliver: boolean): Promise<void>;
  /** Holds the provider currently keeps; one without a record is left over from a finished Undo. */
  holds(): Promise<DeliveryHold[]>;
  /** Revoke a provider review grant after Undo. Must be idempotent. */
  revoke(record: PendingDeletion): Promise<void>;
}

export type DeliveryHold = { id: string; reminderId: string };
export const deliveryHold = (record: PendingDeletion): DeliveryHold | undefined =>
  record.target.kind === 'reminder' ? { id: record.id, reminderId: record.target.target.reminderId } : undefined;

export type DeletionReport = {
  id: string;
  label: string;
  kind: DeletionTarget['kind'];
  target: DeletionTarget;
  status: 'deleted' | 'kept-changed' | 'kept-permission' | 'unconfirmed' | 'retry-later';
  message: string;
};

const ID = /^[A-Za-z0-9_:.-]{1,200}$/;
const text = (value: unknown, max: number) => typeof value === 'string' && value.length <= max;
const finite = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

export function targetKey(target: DeletionTarget): string {
  return target.kind === 'event'
    ? `event:${target.calendarId}:${target.scope === 'series' ? target.seriesId : target.id}:${target.scope}`
    : `reminder:${target.target.sourceId}:${target.target.reminderId}`;
}

function validTarget(target: DeletionTarget): boolean {
  if (!target || typeof target !== 'object') return false;
  if (target.kind === 'event') {
    const e = target.expected;
    return ID.test(target.id) && ID.test(target.calendarId) && text(target.revision, 200) && target.revision.length > 0
      && ['event', 'occurrence', 'series'].includes(target.scope)
      && (target.scope === 'event' || (typeof target.seriesId === 'string' && ID.test(target.seriesId)))
      && (target.scope !== 'occurrence' || finite(target.occurrenceBegin))
      && typeof target.invitation === 'boolean' && ID.test(target.grant)
      && !!e && text(e.title, 4000) && text(e.body, 20000) && text(e.location, 4000) && Number.isFinite(e.begin) && Number.isFinite(e.end);
  }
  if (target.kind === 'reminder') {
    const t = target.target;
    return !!t && ['sourceId', 'sourceRevision', 'reminderId', 'occurrenceId', 'revision'].every(key => text((t as Record<string, unknown>)[key], 200) && (t as Record<string, string>)[key].length > 0)
      && ['reminder', 'series'].includes(target.scope) && /^[A-Za-z0-9_-]{1,128}$/.test(target.operationId);
  }
  return false;
}

export function validatePendingDeletions(raw: unknown): PendingDeletionDocument {
  if (raw === null || raw === undefined) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) throw Error('Invalid pending deletion store');
  const entries = Object.entries(raw as Record<string, PendingDeletion>);
  if (entries.length > MAX_PENDING_DELETIONS) throw Error('Pending deletion store is full');
  for (const [id, record] of entries) {
    if (!record || record.version !== 1 || record.id !== id || !ID.test(id) || !text(record.label, 500)
      || !finite(record.requestedAt) || !finite(record.expiresAt) || record.expiresAt < record.requestedAt
      || !['pending', 'committing', 'unknown'].includes(record.phase) || !finite(record.attempts) || !validTarget(record.target))
      throw Error('Invalid pending deletion');
  }
  return raw as PendingDeletionDocument;
}

async function edit<T>(store: PendingDeletionStore, change: (all: PendingDeletionDocument) => { next: PendingDeletionDocument | null; value: T }): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const raw = await store.read();
    const current = validatePendingDeletions(raw);
    const { next, value } = change(structuredClone(current));
    if (next === null) return value;
    if (await store.compareExchange(raw, Object.keys(next).length ? validatePendingDeletions(next) : null)) return value;
  }
  throw Error('Pending deletions changed. Try again.');
}

export async function pendingDeletions(store: PendingDeletionStore): Promise<PendingDeletion[]> {
  return Object.values(validatePendingDeletions(await store.read())).sort((a, b) => a.requestedAt - b.requestedAt || a.id.localeCompare(b.id));
}

/**
 * A wall clock moved backwards could otherwise stretch the window indefinitely. The window never
 * extends beyond UNDO_WINDOW_MS from now, and a clock jump forward simply ends it.
 */
export function undoRemaining(record: PendingDeletion, now: number): number {
  if (record.phase !== 'pending') return 0;
  const remaining = record.expiresAt - now;
  if (remaining > UNDO_WINDOW_MS || now < record.requestedAt) return 0;
  return Math.max(0, remaining);
}

export type RequestResult =
  | { status: 'pending'; record: PendingDeletion }
  | { status: 'duplicate'; record: PendingDeletion }
  | { status: 'full' };

/**
 * Persist a reviewed deletion intent, then suspend reminder delivery for it.
 * The provider object is untouched until `commitDueDeletions` runs after expiry.
 */
export async function requestDeletion(store: PendingDeletionStore, provider: DeletionProvider, input: { id: string; label: string; target: DeletionTarget }, now: number): Promise<RequestResult> {
  const record: PendingDeletion = { version: 1, id: input.id, label: input.label.slice(0, 500), requestedAt: now, expiresAt: now + UNDO_WINDOW_MS, phase: 'pending', attempts: 0, target: structuredClone(input.target) };
  if (!validTarget(record.target) || !ID.test(record.id)) throw Error('Invalid deletion target');
  const key = targetKey(record.target);
  const result = await edit<RequestResult>(store, all => {
    const existing = Object.values(all).find(row => targetKey(row.target) === key);
    if (existing) return { next: null, value: { status: 'duplicate', record: existing } };
    if (Object.keys(all).length >= MAX_PENDING_DELETIONS) return { next: null, value: { status: 'full' } };
    return { next: { ...all, [record.id]: record }, value: { status: 'pending', record } };
  });
  // Holding is idempotent; a failure here is repaired by reconciliation before any delivery check.
  if (result.status === 'pending' && record.target.kind === 'reminder') await provider.hold(record).catch(() => undefined);
  return result;
}

export type UndoResult =
  | { status: 'restored'; lossless: true; record: PendingDeletion }
  | { status: 'expired' | 'too-late' | 'missing' };

/** Undo is lossless only before dispatch: the provider object was never deleted. */
export async function undoDeletion(store: PendingDeletionStore, provider: DeletionProvider, id: string, now: number): Promise<UndoResult> {
  const result = await edit<UndoResult>(store, all => {
    const record = all[id];
    if (!record) return { next: null, value: { status: 'missing' } };
    if (record.phase !== 'pending') return { next: null, value: { status: 'too-late' } };
    if (undoRemaining(record, now) <= 0) return { next: null, value: { status: 'expired' } };
    const next = { ...all };
    delete next[id];
    return { next, value: { status: 'restored', lossless: true, record } };
  });
  if (result.status === 'restored') await settle(provider, result.record, true);
  return result;
}

async function settle(provider: DeletionProvider, record: PendingDeletion, survives: boolean) {
  const hold = deliveryHold(record);
  if (hold) await provider.release(hold, survives).catch(() => undefined);
  else if (survives) await provider.revoke(record).catch(() => undefined);
}

function report(record: PendingDeletion, status: DeletionReport['status']): DeletionReport {
  const noun = record.target.kind === 'event' ? (record.target.scope === 'series' ? 'repeating event' : record.target.scope === 'occurrence' ? 'event occurrence' : 'event') : (record.target.scope === 'series' ? 'repeating reminder' : 'reminder');
  const name = record.label || (record.target.kind === 'event' ? 'Untitled event' : 'Reminder');
  const message = {
    deleted: `${name}: ${noun} deleted and confirmed.`,
    'kept-changed': `${name} changed after you deleted it, so it was kept. Review it and delete again if needed.`,
    'kept-permission': `${name} was kept: Calendar or reminder access is no longer available. Nothing was deleted.`,
    unconfirmed: `${name}: deletion could not be confirmed. It stays hidden and will not be repeated until it is checked.`,
    'retry-later': `${name}: deletion will finish when the phone is unlocked and Alpha is open.`,
  }[status];
  return { id: record.id, label: name, kind: record.target.kind, target: record.target, status, message };
}

async function remove(store: PendingDeletionStore, id: string, phase: DeletionPhase) {
  await edit(store, all => {
    if (all[id]?.phase !== phase) return { next: null, value: undefined };
    const next = { ...all };
    delete next[id];
    return { next, value: undefined };
  });
}
async function setPhase(store: PendingDeletionStore, id: string, from: DeletionPhase, to: DeletionPhase, attempt = false): Promise<PendingDeletion | undefined> {
  return edit(store, all => {
    const record = all[id];
    if (!record || record.phase !== from) return { next: null, value: undefined };
    const updated = { ...record, phase: to, attempts: record.attempts + (attempt ? 1 : 0) };
    return { next: { ...all, [id]: updated }, value: updated };
  });
}

/** Apply a readback to a record that may already have been dispatched. Never dispatches. */
async function resolveReadback(store: PendingDeletionStore, provider: DeletionProvider, record: PendingDeletion, readback: ReadbackOutcome): Promise<DeletionReport | undefined> {
  if (readback === 'absent') { await remove(store, record.id, record.phase); await settle(provider, record, false); return report(record, 'deleted'); }
  if (readback === 'changed') { await remove(store, record.id, record.phase); await settle(provider, record, true); return report(record, 'kept-changed'); }
  if (readback === 'present' && record.attempts < MAX_DISPATCHES) {
    // The exact reviewed revision is still there, so no deletion happened. Re-arm one dispatch;
    // the provider's revision guard makes a second effect impossible.
    await setPhase(store, record.id, record.phase, 'pending');
    return undefined;
  }
  if (record.phase === 'committing') await setPhase(store, record.id, 'committing', 'unknown');
  return report(record, 'unconfirmed');
}

/**
 * Dispatch every expired intent once. The `committing` phase is saved before dispatch, so a
 * process death after dispatch is resolved by readback on the next start, never by a blind retry.
 */
export async function commitDueDeletions(store: PendingDeletionStore, provider: DeletionProvider, now: number, elapsed: (record: PendingDeletion) => boolean = () => false): Promise<DeletionReport[]> {
  const reports: DeletionReport[] = [];
  for (const due of await pendingDeletions(store)) {
    // `elapsed` lets a live process end a window by its monotonic clock when the wall clock stalls.
    if (due.phase !== 'pending' || (undoRemaining(due, now) > 0 && !elapsed(due))) continue;
    const record = await setPhase(store, due.id, 'pending', 'committing', true);
    if (!record) continue;
    let outcome: CommitOutcome;
    try { outcome = await provider.commit(record); } catch { outcome = 'unknown'; }
    if (outcome === 'deleted') {
      let readback: ReadbackOutcome;
      try { readback = await provider.readback(record); } catch { readback = 'unavailable'; }
      // A successful provider result that reads back as still present is not a confirmed deletion.
      const confirmed = await resolveReadback(store, provider, record, readback === 'present' ? 'unavailable' : readback);
      if (confirmed) reports.push(confirmed);
    } else if (outcome === 'conflict') {
      await remove(store, record.id, 'committing'); await settle(provider, record, true); reports.push(report(record, 'kept-changed'));
    } else if (outcome === 'permission-required') {
      await remove(store, record.id, 'committing'); await settle(provider, record, true); reports.push(report(record, 'kept-permission'));
    } else if (outcome === 'unavailable') {
      // Known not dispatched (locked, not foreground). Keep the intent and the hold; retry later.
      await setPhase(store, record.id, 'committing', 'pending'); reports.push(report(record, 'retry-later'));
    } else {
      await setPhase(store, record.id, 'committing', 'unknown'); reports.push(report(record, 'unconfirmed'));
    }
  }
  return reports;
}

/**
 * Restart and resume reconciliation: restore suspended delivery for every live reminder intent,
 * release holds left by a completed Undo, read back interrupted dispatches, then commit what expired.
 */
export async function reconcileDeletions(store: PendingDeletionStore, provider: DeletionProvider, now: number, elapsed?: (record: PendingDeletion) => boolean): Promise<DeletionReport[]> {
  const reports: DeletionReport[] = [];
  const records = await pendingDeletions(store);
  const ids = new Set(records.map(row => row.id));
  for (const record of records) if (record.target.kind === 'reminder') await provider.hold(record).catch(() => undefined);
  try {
    for (const hold of await provider.holds()) if (!ids.has(hold.id)) await provider.release(hold, true).catch(() => undefined);
  } catch { /* Holds stay until the next reconciliation; delivery remains suspended, never lost. */ }
  for (const record of records) {
    if (record.phase === 'pending') continue;
    let readback: ReadbackOutcome;
    try { readback = await provider.readback(record); } catch { readback = 'unavailable'; }
    const result = await resolveReadback(store, provider, record, readback);
    if (result) reports.push(result);
  }
  reports.push(...await commitDueDeletions(store, provider, now, elapsed));
  return reports;
}

/** Targets hidden from Calendar while their deletion is pending, dispatched or unconfirmed. */
export function hiddenDeletionTargets(records: PendingDeletion[]) {
  const events = new Set<string>(), series = new Set<string>(), occurrences = new Set<string>(), reminders = new Set<string>();
  for (const record of records) {
    const target = record.target;
    if (target.kind === 'reminder') reminders.add(target.target.reminderId);
    else if (target.scope === 'series') series.add(target.seriesId!);
    else if (target.scope === 'occurrence') occurrences.add(target.id);
    else events.add(target.id);
  }
  return {
    events, series, occurrences, reminders,
    event(id: string, seriesId?: string) { return events.has(id) || occurrences.has(id) || (!!seriesId && series.has(seriesId)) || series.has(id); },
  };
}

/** One review sentence shared by both builds. Never promises a restore after the window. */
export function deletionReviewText(target: Pick<EventDeletionTarget, 'kind' | 'scope' | 'invitation'> | Pick<ReminderDeletionTarget, 'kind' | 'scope'>): string {
  const window = `You can undo for ${UNDO_WINDOW_MS / 1000} seconds. After that it is deleted and cannot be restored.`;
  if (target.kind === 'reminder') return `${target.scope === 'series' ? 'Delete this repeating reminder and all of its future times?' : 'Delete this reminder?'} Its alert is paused while you can undo. ${window}`;
  const scope = target.scope === 'series' ? 'Delete every occurrence, including edited dates?' : target.scope === 'occurrence' ? 'Delete this one occurrence? Other dates in the series stay.' : 'Delete this one event?';
  return `${scope}${target.invitation ? ' Guests may be notified when the deletion completes. A deleted invitation cannot be restored by Alpha; recreating it would be a new event, not the original.' : ''} ${window}`;
}
