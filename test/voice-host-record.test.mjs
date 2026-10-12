import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {ROOT, UNVERIFIED, VOICE_HOST, VOICE_HOST_DEFAULT_COMPONENTS, collectNotices, voiceHostProblems} from '../scripts/generate-licenses.mjs';
import {buildSbom as generateSbom} from '../scripts/generate-sbom.mjs';

// The on-device speech engine is the llama.cpp-based libelizainference voice host. Its
// qualification record (android/voice-host/qualified-voice-host.json, docs/fused-speech.md)
// drives the notices and the SBOM. Fixture records only: no real binary or model is read.
const hex = seed => createHash('sha256').update(seed).digest('hex');
const commit = seed => hex(seed).slice(0, 40);
export function voiceHostFixture(overrides = {}) {
  return {
    schemaVersion: 1, pin: commit('pin'), forkPin: commit('fork'), identity: 'ai.elizaresearch.alphaphone', provider: 'libelizainference-cpu',
    abis: [{abi: 'arm64-v8a', libraries: [
      {name: 'libelizainference.so', sha256: hex('inference'), bytes: 6199248},
      {name: 'libelizavoicejni.so', sha256: hex('jni'), bytes: 1016376},
      {name: 'libc++_shared.so', sha256: hex('libcxx'), bytes: 1304848},
    ]}],
    models: [
      {name: 'Kokoro-82M', role: 'tts', revision: 'hexgrad/Kokoro-82M@fixture', path: 'tts/kokoro-82m-q8.gguf', sha256: hex('kokoro'), bytes: 90_000_000, license: 'Apache-2.0', source: 'https://huggingface.co/hexgrad/Kokoro-82M'},
      {name: 'Silero VAD', role: 'vad', revision: 'v5-fixture', path: 'vad/silero-v5.gguf', sha256: hex('vad'), bytes: 2_000_000, license: 'MIT', source: 'https://github.com/snakers4/silero-vad'},
      // A model under non-OSI terms with no licence file held: listed and flagged, never blocking.
      {name: 'Fixture ASR text model', role: 'asr', revision: 'fixture', path: 'asr/text.gguf', sha256: hex('asr'), bytes: 500_000_000, license: 'LicenseRef-Gemma-Terms-of-Use', source: 'https://ai.google.dev/gemma/terms'},
      {name: 'Fixture ASR projector', role: 'asr', revision: 'fixture', path: 'asr/eliza-1-asr-mmproj.gguf', sha256: hex('mmproj'), bytes: 100_000_000, source: 'https://example.invalid/asr'},
    ],
    ...overrides,
  };
}

function scratch(t, record) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-voice-host-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  fs.symlinkSync(path.join(ROOT, 'vendor'), path.join(dir, 'vendor'));
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(dir, 'node_modules'));
  // A writable android/ whose entries point at the checkout, plus the fixture record.
  fs.mkdirSync(path.join(dir, 'android'));
  for (const name of fs.readdirSync(path.join(ROOT, 'android'))) if (name !== 'voice-host') fs.symlinkSync(path.join(ROOT, 'android', name), path.join(dir, 'android', name));
  fs.mkdirSync(path.join(dir, path.dirname(VOICE_HOST)), {recursive: true});
  fs.writeFileSync(path.join(dir, VOICE_HOST), JSON.stringify(record, null, 2));
  fs.mkdirSync(path.join(dir, 'apps/app'), {recursive: true});
  fs.symlinkSync(path.join(ROOT, 'apps/app/public'), path.join(dir, 'apps/app/public'));
  for (const name of ['package.json', 'package-lock.json', 'upstream.lock.json', 'app.config.json']) fs.copyFileSync(path.join(ROOT, name), path.join(dir, name));
  fs.cpSync(path.join(ROOT, 'licenses'), path.join(dir, 'licenses'), {recursive: true});
  return dir;
}

test('a well-formed voice-host record has no problems', () => {
  assert.deepEqual(voiceHostProblems(voiceHostFixture()), []);
});

test('the schema rejects malformed hashes, missing libraries and non-GGUF models', () => {
  const bad = voiceHostFixture({schemaVersion: 2, forkPin: 'main', abis: [{abi: 'x86_64', libraries: [{name: 'libelizainference.so', sha256: 'ABC', bytes: 0}]}]});
  bad.models.push({name: 'Legacy recognizer', role: 'asr', revision: 'r', path: 'asr/encoder.bin', sha256: hex('legacy'), bytes: 1, source: 'https://example.invalid'});
  const problems = voiceHostProblems(bad, 'fixture');
  for (const expected of ['schemaVersion must be 1', 'forkPin must be a 40-character git commit', 'abis[0].libraries[0].sha256 must be a lowercase SHA-256',
    'abis[0].libraries[0].bytes must be a positive integer', 'models[4].path must be a GGUF file'])
    assert.ok(problems.some(problem => problem.includes(expected)), `${expected}\n${problems.join('\n')}`);
  assert.ok(voiceHostProblems(voiceHostFixture({abis: []})).some(problem => problem.includes('abis must list at least one ABI')));
  assert.deepEqual(voiceHostProblems([], 'fixture'), ['fixture: not a JSON object']);
});

test('notices list the fused libelizainference sources and every GGUF model, flagging what is unverified', t => {
  const dir = scratch(t, voiceHostFixture());
  const {entries, errors, warnings} = collectNotices(dir);
  assert.deepEqual(errors, []);
  // The requires-scoped reason applies once the record exists, so it is used, not stale. The one
  // model with no licence and no recorded reason is listed with a note, never an error.
  assert.deepEqual(warnings, [`Fixture ASR projector (asr model, GGUF) fixture (sha256 ${hex('mmproj')}; 100000000 bytes): license unverified, with no reason recorded in licenses/unverified-allowlist.json`]);
  const byName = Object.fromEntries(entries.map(entry => [entry.name, entry]));
  for (const component of VOICE_HOST_DEFAULT_COMPONENTS) assert.ok(byName[component.name], component.name);
  const llama = byName['llama.cpp, ggml and mtmd (fused into libelizainference)'];
  assert.equal(llama.license, 'MIT');
  assert.match(llama.version, new RegExp(`elizaOS fused fork ${commit('fork')}`));
  assert.match(llama.source, new RegExp(`arm64-v8a/libelizainference\\.so \\(sha256 ${hex('inference')}; 6199248 bytes\\)`));
  assert.match(llama.text, /Permission is hereby granted, free of charge/);
  const voice = byName['elizaOS voice runtime sources (OmniVoice, kokoro_lib, eliza-inference FFI) in libelizainference'];
  assert.deepEqual([voice.license, voice.flags.includes('unverified')], [UNVERIFIED, true]);
  assert.match(voice.obligations.find(item => item.flag === 'unverified').note, /fused llama\.cpp fork/);
  const kokoro = byName['Kokoro-82M (tts model, GGUF)'];
  assert.deepEqual([kokoro.license, kokoro.version], ['Apache-2.0', `hexgrad/Kokoro-82M@fixture (sha256 ${hex('kokoro')}; 90000000 bytes)`]);
  // Non-OSI model terms with no text held are flagged, not an error.
  const asr = byName['Fixture ASR text model (asr model, GGUF)'];
  assert.ok(asr.flags.length > 0, JSON.stringify(asr.flags));
  assert.deepEqual(byName['Fixture ASR projector (asr model, GGUF)'].license, UNVERIFIED);
});

test('a licence file named by the record must match its recorded hash', t => {
  const record = voiceHostFixture({components: [{name: 'CMU Pronouncing Dictionary (Kokoro lexicon)', license: 'BSD-2-Clause', source: 'https://github.com/cmusphinx/cmudict',
    licenseFile: 'licenses/cmudict-BSD-2-Clause.txt', licenseSha256: hex('not the file')}]});
  const dir = scratch(t, record);
  assert.ok(collectNotices(dir).errors.some(error => error === `licenses/cmudict-BSD-2-Clause.txt does not match the licenseSha256 recorded in ${VOICE_HOST}`));
  record.components[0].licenseSha256 = createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'licenses/cmudict-BSD-2-Clause.txt'))).digest('hex');
  fs.writeFileSync(path.join(dir, VOICE_HOST), JSON.stringify(record));
  const result = collectNotices(dir);
  assert.deepEqual(result.errors, []);
  assert.match(result.entries.find(entry => entry.name === 'CMU Pronouncing Dictionary (Kokoro lexicon)').text, /Carnegie Mellon/);
});

test('a malformed record is broken input for the notices', t => {
  const dir = scratch(t, voiceHostFixture({pin: 'nope'}));
  assert.ok(collectNotices(dir).errors.some(error => error.includes('pin must be a 40-character git commit')));
});

test('the SBOM lists each qualified library per ABI and each model with its hash and size', t => {
  const dir = scratch(t, voiceHostFixture());
  const bom = generateSbom(dir);
  const byRef = new Map(bom.components.map(component => [component['bom-ref'], component]));
  const library = byRef.get('voice-host:arm64-v8a/libelizainference.so');
  assert.equal(library.hashes[0].content, hex('inference'));
  assert.ok(library.properties.some(item => item.name === 'alphaphone:bytes' && item.value === '6199248'));
  // A fused library's licences are its notice entries; the component says so and is flagged.
  const prop = (component, name) => component.properties.find(item => item.name === `alphaphone:${name}`)?.value;
  assert.deepEqual([prop(library, 'licence-expression'), prop(library, 'licence-flags')], ['not recorded in this inventory', 'unverified']);
  const kokoro = byRef.get('voice-model:tts/Kokoro-82M');
  assert.equal(kokoro.type, 'machine-learning-model');
  assert.equal(kokoro.hashes[0].content, hex('kokoro'));
  assert.ok(kokoro.properties.some(item => item.name === 'alphaphone:source-revision' && item.value === 'hexgrad/Kokoro-82M@fixture'));
});
