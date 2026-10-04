import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// Export intentionally staged candidate source, never the pinned vendor checkout.
const source = path.resolve(process.argv[2] || '.eliza/client-feature-authoring');
const git = args => execFileSync('git', ['-C', source, ...args]);
const files = git(['diff', '--cached', '--name-only', '--diff-filter=A', '-z']).toString().split('\0').filter(Boolean);
const all = git(['diff', '--cached', '--name-only', '-z']).toString().split('\0').filter(Boolean);
if (!files.length || files.length !== all.length || files.some(file => !/^plugins\/plugin-[a-z0-9-]+\//.test(file))) {
  throw Error('This additive candidate exporter requires staged new plugin files only.');
}
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const manifestPath = 'patches/eliza/client-features-source.json';
const previous = JSON.parse(fs.readFileSync(manifestPath));
const patch = git(['diff', '--cached', '--binary']);
fs.writeFileSync('patches/eliza/client-features.patch', patch);
fs.writeFileSync(manifestPath, JSON.stringify({
  baseCommit: previous.baseCommit,
  patch: 'client-features.patch',
  sha256: hash(patch),
  packages: [...new Set(files.map(file => file.split('/').slice(0,2).join('/')))].sort(),
  status: 'Candidate changed; consumer and upstream qualification pending; not published upstream',
  files: Object.fromEntries(files.map(file => [file, hash(git(['show', ':' + file]))])),
}, null, 2) + '\n');
console.log(`Exported ${files.length} upstream candidate files.`);
