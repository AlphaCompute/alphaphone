import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { prepareClientFeatures } from '../scripts/prepare-client-features.mjs';

test('upstream device-client tests run without an Alpha application host', () => {
  const source = prepareClientFeatures();
  const manifest = JSON.parse(fs.readFileSync(path.join(source, '.source.json')));
  const tests = Object.keys(manifest.files).filter(file => /\/test\/.*\.test\.mjs$/.test(file));
  assert.ok(tests.length > 0);
  execFileSync(process.execPath, ['--experimental-transform-types', '--test', ...tests.map(file => path.join(source,file))], { stdio: 'pipe', timeout: 20_000 });
});

test('shared feature source does not import the product or embed its persistent namespace', () => {
  const root = prepareClientFeatures();
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (file.endsWith('.ts')) {
        const source = fs.readFileSync(file, 'utf8');
        assert.doesNotMatch(source, /apps\/app|alpha\.browser|alpha\.maps|AlphaPhone|Alpha Phone/, file);
      }
    }
  };
  visit(path.join(root, 'plugins'));
});
