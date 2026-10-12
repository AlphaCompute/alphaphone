#!/usr/bin/env node
/**
 * Generate the on-device Kokoro en-US lexicon from the pinned CMU Pronouncing Dictionary.
 *
 *   node scripts/android-voice-lexicon.mjs --cmudict <cmudict.dict> [--output <file>] [--record]
 *
 * The input is operator-supplied and must be the exact pinned bytes (cmusphinx/cmudict
 * 74790861f652b15e4ac49015a90074ad62a27690, BSD-2-Clause; notice in licenses/cmudict-BSD-2-Clause.txt).
 * Nothing is downloaded. Output rows are `word<TAB>ipa`, sorted and unique, first pronunciation
 * only, with a deterministic ARPAbet to Kokoro (misaki-style en-US) symbol mapping; every symbol
 * emitted is in the Kokoro v1.0 vocabulary. `--record` writes the output hash into
 * android/voice-host/qualified-voice-host.json when no hash is recorded yet, and refuses to change
 * a recorded one. Intelligibility is unqualified: no listening or recognition gate has accepted it.
 */
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_OUTPUT = '.eliza/voice-lexicon/en-us-lexicon.tsv';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

/** Vowels take a stress mark before them; diphthongs use Kokoro's single-symbol forms. */
export const ARPABET = Object.freeze({
  AA: 'ɑ', AE: 'æ', AH: 'ʌ', AO: 'ɔ', AW: 'W', AY: 'I', EH: 'ɛ', ER: 'ɜɹ', EY: 'A', IH: 'ɪ', IY: 'i', OW: 'O', OY: 'Y', UH: 'ʊ', UW: 'u',
  B: 'b', CH: 'ʧ', D: 'd', DH: 'ð', F: 'f', G: 'ɡ', HH: 'h', JH: 'ʤ', K: 'k', L: 'l', M: 'm', N: 'n', NG: 'ŋ', P: 'p', R: 'ɹ',
  S: 's', SH: 'ʃ', T: 't', TH: 'θ', V: 'v', W: 'w', Y: 'j', Z: 'z', ZH: 'ʒ',
});
/** Symbols of the Kokoro v1.0 vocabulary this generator may emit. */
export const KOKORO_SYMBOLS = new Set([...'AIOWYbdfhijklmnpstuvwzæðŋɑɔəɚɛɜɡɪɹʃʊʌʒʤʧθˈˌ']);

export function arpabetToKokoro(phones) {
  let out = '';
  for (const symbol of phones) {
    const match = /^([A-Z]+)([012]?)$/.exec(symbol);
    if (!match || !(match[1] in ARPABET)) throw new Error(`Unknown ARPAbet symbol ${symbol}`);
    const [, base, stress] = match;
    let phone = ARPABET[base];
    if (base === 'AH' && stress === '0') phone = 'ə';
    if (base === 'ER' && stress === '0') phone = 'ɚ';
    if (stress === '1') out += 'ˈ';
    else if (stress === '2') out += 'ˌ';
    out += phone;
  }
  for (const character of out) if (!KOKORO_SYMBOLS.has(character)) throw new Error(`Symbol ${character} is outside the Kokoro vocabulary`);
  return out;
}

/** CMUdict text to sorted `word\tipa\n` rows; alternates (`word(2)`) and non-letter words are skipped. */
export function buildLexicon(text) {
  const words = new Map();
  for (const line of text.split('\n')) {
    const fields = line.split('#')[0].trim().split(/\s+/).filter(Boolean);
    if (fields.length < 2) continue;
    const word = fields[0];
    if (!/^[a-z]+(?:'[a-z]+)?$/.test(word) || words.has(word)) continue;
    words.set(word, arpabetToKokoro(fields.slice(1)));
  }
  const sorted = [...words.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return sorted.map(word => `${word}\t${words.get(word)}\n`).join('');
}

function main() {
  const args = process.argv.slice(2);
  const option = name => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--record') continue;
    if (['--cmudict', '--output'].includes(args[i]) && args[i + 1] && !args[i + 1].startsWith('--')) { i++; continue; }
    throw new Error('Usage: node scripts/android-voice-lexicon.mjs --cmudict <cmudict.dict> [--output <file>] [--record]');
  }
  const manifestFile = path.join(root, 'android/voice-host/qualified-voice-host.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const input = option('--cmudict');
  if (!input) throw new Error(`--cmudict is required: the pinned file from ${manifest.lexicon.source.url} (never downloaded here)`);
  const bytes = fs.readFileSync(input);
  if (bytes.length !== manifest.lexicon.source.bytes || sha(bytes) !== manifest.lexicon.source.sha256)
    throw new Error(`${input} is not the pinned CMUdict (${manifest.lexicon.source.sha256}, ${manifest.lexicon.source.bytes} bytes)`);
  const lexicon = Buffer.from(buildLexicon(bytes.toString('utf8')), 'utf8');
  const output = path.resolve(root, option('--output') ?? DEFAULT_OUTPUT);
  fs.mkdirSync(path.dirname(output), {recursive: true});
  fs.writeFileSync(output, lexicon);
  const provenance = {entries: lexicon.toString('utf8').split('\n').length - 1, sha256: sha(lexicon), bytes: lexicon.length, inputSha256: manifest.lexicon.source.sha256,
    source: manifest.lexicon.source.url, license: 'BSD-2-Clause', intelligibility: 'unqualified: deterministic ARPAbet to Kokoro symbol mapping; no listening or recognition gate has accepted it'};
  fs.writeFileSync(`${output}.provenance.json`, `${JSON.stringify(provenance, null, 2)}\n`);
  if (args.includes('--record')) {
    if (manifest.lexicon.sha256 !== null && (manifest.lexicon.sha256 !== provenance.sha256 || manifest.lexicon.bytes !== provenance.bytes))
      throw new Error('qualified-voice-host.json already records a different lexicon; review before replacing');
    Object.assign(manifest.lexicon, {sha256: provenance.sha256, bytes: provenance.bytes, status: 'generated and recorded'});
    fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  console.log(JSON.stringify({output: path.relative(root, output), ...provenance, recorded: args.includes('--record')}, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
