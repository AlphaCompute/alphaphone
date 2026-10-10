/**
 * Per-turn voice latency records, kept only on this device. A record holds a random turn
 * id, the speech route, whether the turn was cold, and millisecond offsets from the end of
 * recording. It never holds transcript or reply text, account, agent or conversation
 * identifiers. Export produces the JSON that `scripts/aggregate-voice-latency.mjs` reads.
 *
 * Marks: recording-end (offset 0), transcript-ready, send, first-token, final-reply,
 * first-audio. Each mark is recorded once (first wins) and must not precede the mark before
 * it, so a late or out-of-order observation cannot shorten a measured phase.
 *
 * Plain constants and function exports only: Node contract tests evaluate this source.
 */
type VoiceTimingMark = 'recording-end' | 'transcript-ready' | 'send' | 'first-token' | 'final-reply' | 'first-audio';
type VoiceTimingRecord = { version: 1; id: string; recordedAt: number; route: string; cold: boolean; marks: Partial<Record<VoiceTimingMark, number>>; outcome?: 'abandoned' };
const voiceTimingKey = 'alphaphone:voice-timing:v1';
const voiceTimingLimit = 200;
const voiceTimingOrder: VoiceTimingMark[] = ['recording-end', 'transcript-ready', 'send', 'first-token', 'final-reply', 'first-audio'];
const voiceTimingRoutes = ['on-device', 'browser', 'local-agent', 'eliza-cloud', 'paired-agent', 'development-agent', 'manual'];
let voiceTimingActive: { id: string; base: number } | undefined;
let voiceTimingClock: () => number = () => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now());

function voiceTimingStore(): Storage | undefined { try { return globalThis.localStorage; } catch { return undefined; } }
function voiceTimingValid(value: unknown): value is VoiceTimingRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  if (row.version !== 1 || typeof row.id !== 'string' || !/^[0-9a-f-]{36}$/.test(row.id) || !Number.isFinite(row.recordedAt) || typeof row.cold !== 'boolean' || !voiceTimingRoutes.includes(row.route as string)) return false;
  if (!row.marks || typeof row.marks !== 'object' || Array.isArray(row.marks)) return false;
  return Object.entries(row.marks as Record<string, unknown>).every(([key, at]) => voiceTimingOrder.includes(key as VoiceTimingMark) && typeof at === 'number' && Number.isFinite(at) && at >= 0 && at < 3_600_000);
}
/** Every stored record that passes validation, oldest first. */
export function voiceTimingRecords(): VoiceTimingRecord[] {
  try { const raw = voiceTimingStore()?.getItem(voiceTimingKey); const parsed = raw ? JSON.parse(raw) : []; return Array.isArray(parsed) ? parsed.filter(voiceTimingValid) : []; }
  catch { return []; }
}
function voiceTimingSave(row: VoiceTimingRecord) {
  try {
    const rows = voiceTimingRecords().filter(item => item.id !== row.id);
    rows.push(row);
    voiceTimingStore()?.setItem(voiceTimingKey, JSON.stringify(rows.slice(-voiceTimingLimit)));
  } catch { /* Timing is diagnostic; it never blocks a voice turn. */ }
}
/** Start a conversation turn at the end of recording. Any unfinished turn is abandoned. */
export function beginVoiceTurn(input: { route: string; cold: boolean }): string | undefined {
  abandonVoiceTurn();
  if (!voiceTimingRoutes.includes(input.route) || typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') return undefined;
  const id = crypto.randomUUID();
  voiceTimingActive = { id, base: voiceTimingClock() };
  voiceTimingSave({ version: 1, id, recordedAt: Date.now(), route: input.route, cold: input.cold === true, marks: { 'recording-end': 0 } });
  return id;
}
/** Record one mark for the active turn (or the named turn while it is still active). */
export function markVoiceTiming(mark: VoiceTimingMark, turn?: string): boolean {
  const active = voiceTimingActive;
  if (!active || (turn !== undefined && turn !== active.id) || !voiceTimingOrder.includes(mark)) return false;
  const row = voiceTimingRecords().find(item => item.id === active.id);
  if (!row || row.outcome || row.marks[mark] !== undefined) return false;
  const at = Math.max(0, Math.round(voiceTimingClock() - active.base));
  const index = voiceTimingOrder.indexOf(mark);
  // Reply and audio marks measure from send; send measures from a ready transcript.
  if (index >= 3 && row.marks.send === undefined) return false;
  if (mark === 'send' && row.marks['transcript-ready'] === undefined) return false;
  if (voiceTimingOrder.slice(0, index).some(prior => (row.marks[prior] ?? -1) > at)) return false;
  row.marks[mark] = at; voiceTimingSave(row);
  if (mark === 'first-audio') voiceTimingActive = undefined;
  return true;
}
/** The turn ended without a reply (cancelled, discarded, typed instead). Kept as abandoned. */
export function abandonVoiceTurn() {
  const active = voiceTimingActive; voiceTimingActive = undefined; if (!active) return;
  const row = voiceTimingRecords().find(item => item.id === active.id);
  if (row && row.marks['final-reply'] === undefined) voiceTimingSave({ ...row, outcome: 'abandoned' });
}
/** Finish the active turn after its final reply when no audio will follow. */
export function finishVoiceTurn(turn?: string) { if (voiceTimingActive && (turn === undefined || turn === voiceTimingActive.id)) voiceTimingActive = undefined; }
export function activeVoiceTurn() { return voiceTimingActive?.id; }
/** JSON export for the latency aggregator. Contains no text or account identifiers. */
export function exportVoiceTiming(): string {
  return JSON.stringify({ format: 'alpha-voice-timing-v1', exportedAt: new Date().toISOString(), marks: voiceTimingOrder, records: voiceTimingRecords() }, null, 2);
}
export function clearVoiceTiming() { voiceTimingActive = undefined; try { voiceTimingStore()?.removeItem(voiceTimingKey); } catch { /* Nothing stored. */ } }
/** Test hook: a deterministic clock. */
export function setVoiceTimingClock(clock: () => number) { voiceTimingClock = clock; }
