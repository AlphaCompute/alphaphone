import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {auditWebBundle, avatarInitials, PENDING_AVATAR_INITIALS} from '../scripts/audit-production-bundle.mjs';

const badge = (text, quote = '"') => `<span style=${quote}width: 30px; height: 30px; border-radius: 15px; background: #fff; font-weight: 700${quote}>${text}</span>`;

test('initials badges are found in raw markup and JSON-escaped bundle strings, not in ordinary text', () => {
  assert.deepEqual(avatarInitials(badge('MC') + badge('+2')), ['MC', '+2']);
  assert.deepEqual(avatarInitials(JSON.stringify(badge('QX'))), ['QX']);
  assert.deepEqual(avatarInitials('<span class="time">PM</span><span style="border-radius: 15px">Calendar</span>'), []);
  assert.deepEqual(avatarInitials(badge('{{e.initials}}')), [], 'data-bound initials are allowed');
});

test('a new hard-coded initials badge fails the audit; only the tracked prototype trio is pending', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-initials-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html>');
  fs.writeFileSync(path.join(dir, 'build-flags.json'), JSON.stringify({testMocks: false}));
  fs.writeFileSync(path.join(dir, 'app.js'), `const t=${JSON.stringify(badge('MC') + badge('JP') + badge('+2'))};`);
  const pending = auditWebBundle(dir);
  assert.equal(pending.ok, true);
  assert.deepEqual(pending.pendingAvatarInitials, [...PENDING_AVATAR_INITIALS].sort());
  fs.writeFileSync(path.join(dir, 'app.js'), `const t=${JSON.stringify(badge('SW'))};`);
  const failed = auditWebBundle(dir);
  assert.equal(failed.ok, false);
  assert.deepEqual(failed.findings.map(row => row.rule), ['hard-coded avatar initials "SW"']);
});
