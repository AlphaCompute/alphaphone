import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function regularPath(filename, directory = false) {
  try {
    const stat = fs.lstatSync(filename);
    if (stat.isSymbolicLink() || !(directory ? stat.isDirectory() : stat.isFile())) throw Error('Nonregular client feature path: ' + filename);
    return true;
  } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
function inventory(directory) {
  const files = {};
  function visit(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isSymbolicLink()) throw Error('Symlink in client feature source: ' + file);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile()) files[path.relative(directory, file)] = hash(fs.readFileSync(file));
      else throw Error('Nonregular client feature source: ' + file);
    }
  }
  visit(directory);
  return files;
}
function matches(actual, expected) {
  return JSON.stringify(Object.keys(actual).sort()) === JSON.stringify(Object.keys(expected).sort()) &&
    Object.entries(expected).every(([file, digest]) => actual[file] === digest);
}
/** Materialize the reviewed additive patch outside the immutable vendor checkout. */
export function prepareClientFeatures({ root = projectRoot } = {}) {
  const manifestBytes = fs.readFileSync(path.join(root, 'patches/eliza/client-features-source.json'));
  const manifest = JSON.parse(manifestBytes);
  const pin = JSON.parse(fs.readFileSync(path.join(root, 'upstream.lock.json')));
  if (pin.commit !== manifest.baseCommit) throw Error('Requalify client feature patch against the new Eliza pin.');
  if (manifest.patch !== 'client-features.patch' || !manifest.files || !Object.keys(manifest.files).length ||
      Object.entries(manifest.files).some(([file, digest]) => !/^plugins\/plugin-[a-z0-9-]+\//.test(file) || file.includes('\\') || file.split('/').some(part => !part || part === '.' || part === '..') || !/^[a-f0-9]{64}$/.test(digest))) {
    throw Error('Invalid client feature manifest.');
  }
  const patch = path.join(root, 'patches/eliza', manifest.patch);
  if (hash(fs.readFileSync(patch)) !== manifest.sha256) throw Error('Client feature patch hash mismatch.');
  const parent = path.join(root, '.eliza'), destination = path.join(parent, 'client-features');
  regularPath(parent, true);
  const exists = regularPath(destination, true), stamp = path.join(destination, '.source.json');
  if (exists) {
    if (!regularPath(stamp)) throw Error('Refusing to replace an unrecognized client feature directory.');
    const previous = JSON.parse(fs.readFileSync(stamp));
    const actual = inventory(destination); delete actual['.source.json'];
    if (previous.baseCommit === pin.commit && previous.manifestSha256 === hash(manifestBytes) && previous.patch === manifest.sha256 && matches(actual, manifest.files)) return destination;
  }
  fs.mkdirSync(parent, { recursive: true });
  const temporary = fs.mkdtempSync(path.join(parent, 'client-features-stage-'));
  try {
    execFileSync('git', ['init', '-q', temporary]);
    execFileSync('git', ['apply', '--check', patch], { cwd: temporary });
    execFileSync('git', ['apply', patch], { cwd: temporary });
    fs.rmSync(path.join(temporary, '.git'), { recursive: true });
    const files = inventory(temporary);
    if (!matches(files, manifest.files)) throw Error('Client feature source does not match the checked-in file manifest.');
    fs.writeFileSync(path.join(temporary, '.source.json'), JSON.stringify({ baseCommit: pin.commit, manifestSha256: hash(manifestBytes), patch: manifest.sha256, files }, null, 2));
    fs.rmSync(destination, { force: true, recursive: true });
    fs.renameSync(temporary, destination);
    return destination;
  } finally { fs.rmSync(temporary, { force: true, recursive: true }); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Client feature source prepared: ${prepareClientFeatures()}`);
}
