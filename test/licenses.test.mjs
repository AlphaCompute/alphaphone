import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ROOT, JSON_OUTPUT, TEXT_OUTPUT, ALLOWLIST, UNVERIFIED, generate, collectNotices,
} from '../scripts/generate-licenses.mjs';

const fresh = generate(ROOT);
const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));

test('notice generation is complete: no unknown licenses, missing texts or unreviewed unverified items', () => {
  assert.deepEqual(fresh.errors, []);
});

test('checked-in notices are byte-identical to a fresh generation', () => {
  assert.equal(fs.readFileSync(path.join(ROOT, JSON_OUTPUT), 'utf8'), fresh.json, `${JSON_OUTPUT} is stale; run node scripts/generate-licenses.mjs`);
  assert.equal(fs.readFileSync(path.join(ROOT, TEXT_OUTPUT), 'utf8'), fresh.text, `${TEXT_OUTPUT} is stale; run node scripts/generate-licenses.mjs`);
});

test('generation fails when the shipped OCR cores or their pinned license copies change', t => {
  const dir = scratchRoot(t);
  const file = path.join(dir, 'licenses/tesseract-core/sources.json');
  const pinned = JSON.parse(fs.readFileSync(file, 'utf8'));
  fs.appendFileSync(path.join(dir, 'licenses/tesseract-core/leptonica-license.txt'), '\nmodified');
  assert.ok(collectNotices(dir).errors.some(error => error.includes('leptonica-license.txt does not match')));
  fs.writeFileSync(file, JSON.stringify({...pinned, version: '0.0.0', cores: {...pinned.cores, 'tesseract-core-lstm.wasm.js': '0'.repeat(64)}}));
  const errors = collectNotices(dir).errors;
  assert.ok(errors.some(error => error.includes('differs from licenses/tesseract-core/sources.json (0.0.0)')));
  assert.ok(errors.some(error => error.includes('tesseract-core-lstm.wasm.js differs from the core pinned')));
});

test('generation fails for an unverified font that is not allowlisted, or a stale allowlist entry', t => {
  const dir = scratchRoot(t);
  const file = path.join(dir, ALLOWLIST);
  const allowlist = JSON.parse(fs.readFileSync(file, 'utf8'));
  fs.writeFileSync(file, JSON.stringify({...allowlist, entries: allowlist.entries.filter(entry => entry.name !== 'Denton typeface')}));
  assert.ok(collectNotices(dir).errors.some(error => error.startsWith('Denton typeface') && error.includes(UNVERIFIED)));
  fs.writeFileSync(file, JSON.stringify({...allowlist, entries: [...allowlist.entries, {name: 'Removed font', reason: 'no longer shipped anywhere in the product'}]}));
  assert.ok(collectNotices(dir).errors.some(error => error.includes('stale entry Removed font')));
  // A swapped Denton file (different hash) is not covered by the existing allowlist entry.
  fs.writeFileSync(file, JSON.stringify({...allowlist, entries: allowlist.entries.map(entry => entry.sha256 ? {...entry, sha256: '0'.repeat(64)} : entry)}));
  assert.ok(collectNotices(dir).errors.some(error => error.startsWith('Denton typeface')));
});

test('generation fails for a production dependency with an unknown license', t => {
  const dir = scratchRoot(t);
  const altered = structuredClone(lock);
  altered.packages['node_modules/react'].license = 'SSPL-1.0';
  fs.writeFileSync(path.join(dir, 'package-lock.json'), JSON.stringify(altered));
  assert.ok(collectNotices(dir).errors.some(error => error === 'react@19.3.0: unknown license SSPL-1.0'));
});

test('generation fails when pinned speech license copies drift from the upstream reference manifest', t => {
  const dir = scratchRoot(t);
  fs.appendFileSync(path.join(dir, 'licenses/whisper-MIT.txt'), '\nmodified');
  assert.ok(collectNotices(dir).errors.some(error => error.includes('licenses/whisper-MIT.txt does not match')));
});

function scratchRoot(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-licenses-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  for (const name of ['node_modules', 'vendor', 'android']) fs.symlinkSync(path.join(ROOT, name), path.join(dir, name));
  fs.mkdirSync(path.join(dir, 'apps/app'), {recursive: true});
  fs.symlinkSync(path.join(ROOT, 'apps/app/public'), path.join(dir, 'apps/app/public'));
  for (const name of ['package.json', 'package-lock.json', 'upstream.lock.json']) fs.copyFileSync(path.join(ROOT, name), path.join(dir, name));
  fs.cpSync(path.join(ROOT, 'licenses'), path.join(dir, 'licenses'), {recursive: true});
  return dir;
}
