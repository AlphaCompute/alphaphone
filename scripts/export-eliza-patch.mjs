import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Exports staged changes from a separate authoring clone of the pinned Eliza commit (never
// vendor/eliza) as patches/eliza/<name>.patch plus its <name>-source.json manifest.
// Usage: node scripts/export-eliza-patch.mjs <name> <authoring-clone> "<status>"
const root = fileURLToPath(new URL('../', import.meta.url));
const [name, sourceArgument, status] = process.argv.slice(2);
if (!/^[a-z0-9-]+$/.test(name || '') || !sourceArgument || !status) throw Error('Usage: export-eliza-patch.mjs <name> <authoring-clone> "<status>"');
const source = path.resolve(sourceArgument);
if (source === path.join(root, 'vendor/eliza')) throw Error('Author patches in a separate clone, never vendor/eliza.');
const pin = JSON.parse(fs.readFileSync(path.join(root, 'upstream.lock.json'), 'utf8')).commit;
const git = (args, options = {}) => execFileSync('git', ['-C', source, ...args], { maxBuffer: 256 * 1024 * 1024, ...options });
if (git(['rev-parse', 'HEAD']).toString().trim() !== pin) throw Error('Authoring clone must be checked out at the upstream.lock.json commit.');
if (git(['diff', '--name-only']).toString().trim()) throw Error('Stage every change (git add -A) before exporting.');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const changed = git(['diff', '--cached', '--name-status', '-z']).toString().split('\0').filter(Boolean);
const entries = [];
for (let i = 0; i < changed.length; i += 2) entries.push({ status: changed[i], file: changed[i + 1] });
if (!entries.length || entries.some(entry => !/^[AM]$/.test(entry.status))) throw Error('Only added or modified files are supported.');
// Base prefixes: the package directory (or single file) of each modified upstream path.
const prefixOf = file => file.startsWith('plugins/') ? file.split('/').slice(0, 2).join('/') : file;
const basePaths = [...new Set(entries.filter(entry => entry.status === 'M').map(entry => prefixOf(entry.file)))].sort();
const addedPaths = [...new Set(entries.filter(entry => entry.status === 'A').map(entry => prefixOf(entry.file)))].filter(prefix => !basePaths.includes(prefix)).sort();
const files = {};
for (const prefix of basePaths) {
  for (const file of git(['ls-tree', '-r', '--name-only', '-z', pin, '--', prefix]).toString().split('\0').filter(Boolean)) files[file] = hash(git(['show', `${pin}:${file}`]));
}
for (const entry of entries) files[entry.file] = hash(git(['show', `:${entry.file}`]));
const patch = git(['diff', '--cached', '--binary', '--full-index']);
fs.mkdirSync(path.join(root, 'patches/eliza'), { recursive: true });
fs.writeFileSync(path.join(root, 'patches/eliza', `${name}.patch`), patch);
const sorted = Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(path.join(root, 'patches/eliza', `${name}-source.json`), JSON.stringify({ baseCommit: pin, patch: `${name}.patch`, sha256: hash(patch), status, basePaths, addedPaths, changed: entries.map(entry => entry.file).sort(), files: sorted }, null, 2) + '\n');
console.log(`Exported ${entries.length} changed upstream files (${Object.keys(sorted).length} in the patched output).`);
