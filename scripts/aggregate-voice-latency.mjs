#!/usr/bin/env node
// Aggregate exported per-turn voice timing records (apps/app/src/runtime/voice-timing.ts).
//
//   node scripts/aggregate-voice-latency.mjs export-1.json [export-2.json ...] [--warm N>=20] [--cold N>=5] [--entry conversation|notes] [--out summary.json]
//
// Phases are measured from marks on one device clock, in milliseconds:
//   recognition         transcript-ready - recording-end
//   review              send - transcript-ready   (the user's review and Send; P-01: never automatic)
//   firstToken          first-token - send
//   finalReply          final-reply - send
//   firstAudio          first-audio - send        (only when Speak replies is on)
//   speechToTokenExcludingReview  recognition + firstToken
//   speechToAudioExcludingReview  recognition + firstAudio
//   speechToTokenIncludingReview  first-token - recording-end
//   speechToAudioIncludingReview  first-audio - recording-end
// These are the candidate A-10 measures, one per boundary in `boundaries`: whether the user's
// review and send time counts is the A-10 decision, so both are reported and neither is chosen.
// This script does not sign off a target.
//
// Records written by an app entrypoint name it: `entry` is 'conversation' (the Cloud voice
// conversation) or 'notes' (the Notes recorder, whose send is the user's Save and which has no
// reply), and conversation records name the send `policy` ('auto-send' or 'review'). The
// summary counts each entry; --entry keeps only that entry's records. Records without an entry
// (older exports) stay valid and are counted as 'unspecified'.
// Exit 0: enough complete samples in both cohorts. Exit 2: not enough. Exit 1: bad input.
import fs from 'node:fs';

const order = ['recording-end', 'transcript-ready', 'send', 'first-token', 'final-reply', 'first-audio'];
const routes = new Set(['on-device', 'browser', 'local-agent', 'eliza-cloud', 'paired-agent', 'development-agent', 'manual']);
export const voiceEntries = Object.freeze(['conversation', 'notes']);
export const boundaries = Object.freeze({ excludingReview: 'recording-end to transcript-ready, plus send to the reply mark', includingReview: 'recording-end to the reply mark, including review and send time' });

/** The sample counts the measurement plan requires. Options can raise them, never lower them. */
export const minimumSamples = Object.freeze({ warm: 20, cold: 5 });
export function parseArguments(argv) {
  const options = { files: [], warm: minimumSamples.warm, cold: minimumSamples.cold, out: null, entry: null };
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    if (value === '--warm' || value === '--cold') { const n = Number(argv[++i]); const key = value.slice(2); if (!Number.isInteger(n) || n < minimumSamples[key]) throw new Error(`${value} needs an integer of at least ${minimumSamples[key]}`); options[key] = n; }
    else if (value === '--out') { options.out = argv[++i]; if (!options.out) throw new Error('--out needs a path'); }
    else if (value === '--entry') { options.entry = argv[++i]; if (!voiceEntries.includes(options.entry)) throw new Error('--entry needs conversation or notes'); }
    else if (value.startsWith('--')) throw new Error(`Unknown option ${value}`);
    else options.files.push(value);
  }
  if (!options.files.length) throw new Error('Pass at least one voice timing export');
  return options;
}

function validRecord(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row) || row.version !== 1 || typeof row.id !== 'string' || !/^[0-9a-f-]{36}$/.test(row.id)) return false;
  if (typeof row.cold !== 'boolean' || !routes.has(row.route) || !Number.isFinite(row.recordedAt) || !row.marks || typeof row.marks !== 'object') return false;
  if ((row.entry !== undefined && !voiceEntries.includes(row.entry)) || (row.policy !== undefined && row.policy !== 'auto-send' && row.policy !== 'review')) return false;
  const entries = Object.entries(row.marks);
  if (entries.some(([key, at]) => !order.includes(key) || typeof at !== 'number' || !Number.isFinite(at) || at < 0)) return false;
  // Marks must be monotonic in their defined order.
  let last = -1;
  for (const key of order) { const at = row.marks[key]; if (at === undefined) continue; if (at < last) return false; last = at; }
  return true;
}

/** Reads exports, drops invalid and duplicate records, and keeps the first copy of each id. */
export function collectRecords(exports) {
  const seen = new Map(); let invalid = 0;
  for (const document of exports) {
    if (!document || document.format !== 'alpha-voice-timing-v1' || !Array.isArray(document.records)) throw new Error('Not an alpha-voice-timing-v1 export');
    for (const row of document.records) { if (!validRecord(row)) { invalid++; continue; } if (!seen.has(row.id)) seen.set(row.id, row); }
  }
  return { records: [...seen.values()], invalid };
}

/** Nearest-rank percentile of sorted values. */
export function percentile(sorted, p) { if (!sorted.length) return null; return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p / 100 * sorted.length) - 1))]; }
function stats(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return { n: sorted.length, p50: percentile(sorted, 50), p90: percentile(sorted, 90), p95: percentile(sorted, 95), max: sorted.length ? sorted[sorted.length - 1] : null };
}
export function phases(row) {
  const m = row.marks, gap = (a, b) => m[a] !== undefined && m[b] !== undefined ? m[b] - m[a] : undefined;
  const recognition = gap('recording-end', 'transcript-ready'), firstToken = gap('send', 'first-token'), firstAudio = gap('send', 'first-audio');
  return {
    recognition, review: gap('transcript-ready', 'send'), firstToken, finalReply: gap('send', 'final-reply'), firstAudio,
    speechToTokenExcludingReview: recognition !== undefined && firstToken !== undefined ? recognition + firstToken : undefined,
    speechToAudioExcludingReview: recognition !== undefined && firstAudio !== undefined ? recognition + firstAudio : undefined,
    speechToTokenIncludingReview: gap('recording-end', 'first-token'),
    speechToAudioIncludingReview: gap('recording-end', 'first-audio'),
  };
}
/** A complete sample reached the final reply through every earlier mark. */
export const complete = row => !row.outcome && order.slice(0, 5).every(key => row.marks[key] !== undefined);

export function aggregate(exports, requested = minimumSamples) {
  const required = { warm: Math.max(minimumSamples.warm, requested.warm ?? 0), cold: Math.max(minimumSamples.cold, requested.cold ?? 0) };
  const collected = collectRecords(exports), invalid = collected.invalid;
  if (requested.entry != null && !voiceEntries.includes(requested.entry)) throw new Error('Unknown entry ' + requested.entry);
  const records = requested.entry ? collected.records.filter(row => row.entry === requested.entry) : collected.records;
  const bySource = {};
  for (const row of collected.records) {
    const name = row.entry ?? 'unspecified', item = bySource[name] ??= { records: 0, complete: 0, abandoned: 0, policies: {}, recognition: [] };
    item.records++; if (complete(row)) item.complete++; if (row.outcome === 'abandoned') item.abandoned++;
    if (row.policy) item.policies[row.policy] = (item.policies[row.policy] ?? 0) + 1;
    item.recognition.push(phases(row).recognition);
  }
  for (const item of Object.values(bySource)) item.recognition = stats(item.recognition);
  const usable = records.filter(complete), cohorts = {};
  for (const name of ['warm', 'cold']) {
    const rows = usable.filter(row => row.cold === (name === 'cold')), byPhase = {};
    for (const key of Object.keys(phases({ marks: {} }))) byPhase[key] = stats(rows.map(row => phases(row)[key]));
    cohorts[name] = { samples: rows.length, required: required[name], sufficient: rows.length >= required[name], routes: [...new Set(rows.map(row => row.route))].sort(), withAudio: rows.filter(row => row.marks['first-audio'] !== undefined).length, phases: byPhase };
  }
  return {
    format: 'alpha-voice-latency-summary-v1', units: 'ms', entry: requested.entry ?? null, entries: bySource, boundaries,
    records: records.length, complete: usable.length, abandoned: records.filter(row => row.outcome === 'abandoned').length, incomplete: records.filter(row => !row.outcome && !complete(row)).length, invalid,
    cohorts, sufficient: cohorts.warm.sufficient && cohorts.cold.sufficient,
    targetSignOff: 'pending A-10: the measurement boundary and target are not decided; this summary is evidence only',
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let options;
  try { options = parseArguments(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exit(1); }
  let summary;
  try { summary = aggregate(options.files.map(file => JSON.parse(fs.readFileSync(file, 'utf8'))), { warm: options.warm, cold: options.cold, entry: options.entry }); }
  catch (error) { console.error(`Cannot aggregate: ${error.message}`); process.exit(1); }
  const text = JSON.stringify(summary, null, 2);
  if (options.out) fs.writeFileSync(options.out, text + '\n'); else console.log(text);
  if (!summary.sufficient) { console.error(`Insufficient samples: warm ${summary.cohorts.warm.samples}/${options.warm}, cold ${summary.cohorts.cold.samples}/${options.cold}.`); process.exit(2); }
}
