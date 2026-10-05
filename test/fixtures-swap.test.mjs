import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const prototype = path.join(root, 'apps/app/src/prototype');
const fixtures = path.join(prototype, 'fixtures.js');
const empty = path.join(prototype, 'fixtures.empty.js');
const SENTINELS = /Jordan Park|Maya Chen|Priya Nair|Alex Kim|you@gmail\.example|Ritual Coffee|news\.example|Design review at|Unlock for details|Running a few minutes late|218 GB free|tartine|Enclave lock/;

/** Resolve-time swap of the fixture module, independent of the project's vite.config. */
function swapFixtures() {
  return {
    name: 'test-swap-prototype-fixtures',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!importer || !/(^|\/)fixtures\.js$/.test(source)) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      return resolved && path.resolve(resolved.id.split('?')[0]) === fixtures ? empty : null;
    },
  };
}

const files = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);

test('a build with fixtures swapped out ships no fixture data or images', { timeout: 240_000 }, async () => {
  // This check is about the default (flag-off) product; never inherit test-mocks.
  delete process.env.ELIZA_DEV_ALLOW_TEST_MOCKS;
  delete process.env.VITE_ELIZA_DEV_ALLOW_TEST_MOCKS;
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-fixtures-swap-'));
  try {
    const { build } = await import('vite');
    await build({
      configFile: path.join(root, 'vite.config.ts'),
      logLevel: 'silent',
      plugins: [swapFixtures()],
      build: { outDir, emptyOutDir: true, sourcemap: false },
    });
    const all = files(outDir);
    const scripts = all.filter(file => file.endsWith('.js'));
    assert.ok(scripts.length > 0, 'the build emitted scripts');
    for (const file of scripts) {
      const source = fs.readFileSync(file, 'utf8');
      const hit = source.match(SENTINELS);
      assert.equal(hit, null, `${path.relative(outDir, file)} contains ${hit?.[0]}`);
    }
    assert.deepEqual(all.filter(file => file.endsWith('.webp')).map(file => path.relative(outDir, file)), []);
    assert.equal(fs.existsSync(path.join(outDir, 'img')), false);
    // The swapped bundle still carries the product shell and its empty states.
    const bundle = scripts.map(file => fs.readFileSync(file, 'utf8')).join('\n');
    assert.match(bundle, /No notifications/);
    assert.match(bundle, /No recent files/);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});
