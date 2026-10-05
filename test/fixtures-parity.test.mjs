import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const prototype = path.join(root, 'apps/app/src/prototype');
const fixturesPath = path.join(prototype, 'fixtures.js');
const emptyPath = path.join(prototype, 'fixtures.empty.js');

// Strings that only fixture data may contain. Production bundles are checked for
// the same list by test/fixtures-swap.test.mjs.
export const FIXTURE_SENTINELS = /Jordan Park|Maya Chen|Priya Nair|Alex Kim|you@gmail\.example|Ritual Coffee|news\.example|Design review at|Unlock for details|Running a few minutes late|218 GB free|tartine|Enclave lock/;

const load = file => import(pathToFileURL(file).href);

test('fixtures.empty.js exports exactly the names of fixtures.js', async () => {
  const fixtures = await load(fixturesPath), empty = await load(emptyPath);
  assert.deepEqual(Object.keys(empty).sort(), Object.keys(fixtures).sort());
  assert.ok(Object.keys(fixtures).length > 40);
});

test('every empty export is an empty array, an empty object or null', async () => {
  const empty = await load(emptyPath);
  for (const [name, value] of Object.entries(empty)) {
    if (value === null) continue;
    if (Array.isArray(value)) assert.equal(value.length, 0, name);
    else {
      assert.equal(Object.getPrototypeOf(value), Object.prototype, name);
      assert.deepEqual(Object.keys(value), [], name);
    }
  }
});

test('fixtures.empty.js names no fixture entity and references no image', () => {
  const source = fs.readFileSync(emptyPath, 'utf8');
  assert.doesNotMatch(source, FIXTURE_SENTINELS);
  assert.doesNotMatch(source, /\.webp|img\/|new URL|import\.meta/);
  const code = source.split('\n').filter(line => !line.startsWith('//')).join('\n');
  assert.doesNotMatch(code, /\bimport\b|\bfunction\b|=>/);
  // Only comments and `export const NAME = [] | {} | null;` lines.
  for (const line of source.split('\n')) {
    if (!line.trim() || line.startsWith('//')) continue;
    assert.match(line, /^export const [A-Z][A-Z0-9_]* = (\[\]|\{\}|null);$/, line);
  }
});

test('fixture values cover the seeds the prototype model used to inline', async () => {
  const fixtures = await load(fixturesPath);
  for (const name of ['PEOPLE', 'PN_REC', 'PN_VM', 'MSG_PHOTOS', 'INBOX_ACCTS', 'INBOX_SEED', 'CAL_SEED', 'PH_SEED', 'MAPS_PLACES', 'NOTES_SEED', 'NOTES_LIVE', 'NOTES_DICT', 'CT_SEED', 'FILES_SEED', 'WAL_CARDS', 'WAL_TRIPS', 'WAL_PASSES', 'WF_SEED', 'ST_ACCOUNTS', 'ST_NETS', 'ST_BT', 'ST_MODELS', 'ST_LOG', 'ST_DEVLOG', 'NOTIF', 'LOCK_SUM', 'QUICK_TILES', 'ATTENTION_ROWS'])
    assert.ok(Array.isArray(fixtures[name]) && fixtures[name].length > 0, name);
  for (const name of ['PN_SCRIPT', 'MSG_SEED', 'MSG_SMART', 'MSG_BOT', 'BR_PAGES', 'BR_START', 'BR_ME', 'MAPS_SAVED', 'ST_PERM0', 'ST_DEVICE', 'ST_ABOUT', 'QUICK_SETTINGS', 'HEADS', 'VOICE', 'HOME_DEFAULTS', 'COPY'])
    assert.ok(fixtures[name] && Object.keys(fixtures[name]).length > 0, name);
  assert.equal(fixtures.QUICK_TILES.find(tile => tile[0] === 'shield')?.[2], 'Enclave lock');
  assert.equal(fixtures.VOICE.lockedAnswer, 'Design review at 3. Unlock for details.');
  assert.equal(fixtures.COPY.files.storageText, '218 GB free');
});

test('fixture images live beside fixtures.js and match the asset manifest', async () => {
  const fixtures = await load(fixturesPath);
  const images = path.join(prototype, 'fixtures/img');
  const files = fs.readdirSync(images).filter(file => file.endsWith('.webp')).sort();
  assert.equal(files.length, 42);
  assert.deepEqual(Object.keys(fixtures.IMG).map(key => key + '.webp').sort(), files);
  const source = fs.readFileSync(fixturesPath, 'utf8');
  for (const file of files) assert.ok(source.includes(`new URL("./fixtures/img/${file}", import.meta.url)`), file);
  for (const value of Object.values(fixtures.IMG)) assert.ok(fs.existsSync(fileURLToPath(value)), value);
  assert.equal(fs.existsSync(path.join(root, 'apps/app/public/img')), false);
  const manifest = JSON.parse(fs.readFileSync(path.join(prototype, 'asset-manifest.json'), 'utf8'));
  const listed = manifest.assets.filter(asset => asset.path.startsWith('fixtures/img/'));
  assert.equal(listed.length, 42);
  for (const asset of listed) {
    const bytes = fs.readFileSync(path.join(prototype, asset.path));
    assert.equal(bytes.length, asset.bytes, asset.path);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), asset.sha256, asset.path);
  }
});

test('only fixtures.js imports name fixture entities in the prototype sources', () => {
  for (const file of ['model.js', 'template.html', 'data-adapter.ts', 'mock-attention.ts'])
    assert.doesNotMatch(fs.readFileSync(path.join(prototype, file), 'utf8'), FIXTURE_SENTINELS, file);
  const model = fs.readFileSync(path.join(prototype, 'model.js'), 'utf8');
  assert.match(model, /\} from "\.\/fixtures\.js";/);
  assert.doesNotMatch(model, /\.webp|\.\/img\//);
});
