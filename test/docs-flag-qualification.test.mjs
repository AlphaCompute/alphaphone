// Documentation contract for the ELIZA_DEV_ALLOW_TEST_MOCKS production boundary.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const docs = ['README.md', ...fs.readdirSync(path.join(root, 'docs')).filter(name => name.endsWith('.md')).map(name => `docs/${name}`)];
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
// Paragraphs and table rows are the unit a qualification must share with the entry point.
const blocks = text => text.split(/\n\s*\n/).flatMap(block => block.split('\n').every(line => line.startsWith('|')) ? block.split('\n') : [block]);
const qualified = block => /ELIZA_DEV_ALLOW_TEST_MOCKS|switch (?:is )?(?:on|off)|When it is off|test-mocks|development server only/.test(block);

test('every mock, fixture and dev entry point in README and docs is qualified by the build-time switch', () => {
  const failures = [];
  for (const file of docs) for (const block of blocks(read(file))) {
    if (/mode=mock|\bfixture=1|\bmode=dev/.test(block) && !qualified(block)) failures.push(`${file}: ${block.trim().slice(0, 160)}`);
  }
  assert.deepEqual(failures, []);
});

test('README no longer offers mock mode as a product connection choice', () => {
  const readme = read('README.md');
  assert.doesNotMatch(readme, /offline use and mock mode/);
  assert.match(readme, /ELIZA_DEV_ALLOW_TEST_MOCKS/);
  for (const command of ['npm run android:build -- --test-mocks', 'npm run test:browser:production', 'scripts/audit-production-bundle.mjs', 'scripts/qualify-head.mjs',
    'ELIZAOS_KEYSTORE_PATH', 'ELIZAOS_KEYSTORE_PASSWORD', 'ELIZAOS_KEY_ALIAS', 'ELIZAOS_KEY_PASSWORD', 'ELIZAOS_VERSION_CODE', 'ELIZAOS_VERSION_NAME']) assert.ok(readme.includes(command), command);
  assert.doesNotMatch(readme, /ALPHA_DEV_ALLOW|ALPHA_TEST_MOCKS|ELIZA_DEV_MODE/);
});

test('current status names the production gates and keeps evidence classes separate', () => {
  const status = read('docs/mvp-current-status.md');
  for (const name of ['scripts/audit-production-bundle.mjs', 'scripts/qualify-head.mjs', 'scripts/verify-apks.mjs', 'npm run test:browser:production']) assert.ok(status.includes(name), name);
  assert.match(status, /## Remaining external items/);
  assert.match(status, /never stands in for another/);
});

test('no doc claims mock mode is available in production or distribution builds', () => {
  const claims = /mock mode (?:is )?(?:available|enabled|offered) in (?:production|release|distribution)/i;
  for (const file of docs) assert.doesNotMatch(read(file), claims, file);
});

const slug = heading => heading.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
const anchors = text => new Set([...text.matchAll(/^#{1,6}\s+(.+)$/gm)].map(match => slug(match[1])));

test('relative links in README and docs resolve, including heading anchors', () => {
  const failures = [];
  for (const file of docs) {
    for (const match of read(file).matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = match[1];
      if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
      const [pathPart, anchor] = target.split('#');
      const resolved = pathPart ? path.resolve(path.dirname(path.join(root, file)), decodeURIComponent(pathPart)) : path.join(root, file);
      const relative = path.relative(root, resolved);
      // Ignored generated evidence directories are referenced by path but never committed.
      if (/^(test-results|artifacts)(\/|$)/.test(relative)) continue;
      if (!fs.existsSync(resolved)) { failures.push(`${file}: ${target}`); continue; }
      if (anchor && resolved.endsWith('.md') && !anchors(fs.readFileSync(resolved, 'utf8')).has(anchor)) failures.push(`${file}: ${target} (missing anchor)`);
    }
  }
  assert.deepEqual(failures, []);
});
