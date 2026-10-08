import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { upstreamNativeSource } from './upstream-native-source.mjs';

// Materializes explicit, reviewed upstream patches from patches/eliza outside the immutable
// vendor checkout. Patches follow the directory's numbered series (NNNN-<topic>.patch, see
// patches/eliza/README.md). A patch applied to Alpha's build has a <topic>-source.json manifest
// binding it to the Eliza pin, its own SHA-256, the authenticated upstream prefixes it is
// applied to, and the SHA-256 of every resulting file; patches are applied in series order.
// Reference-only patches (<topic>-source-base.json) are qualified in isolated upstream
// worktrees and are never read here. vendor/eliza is only read, through the same pin/clean
// admission as native staging. Output: .eliza/patched (ignored), with a .source.json stamp.
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const safeRelative = file => typeof file === 'string' && /^(plugins|packages)\/[A-Za-z0-9._@/-]+$/.test(file) && !file.includes('\\') && file.split('/').every(part => part && part !== '.' && part !== '..');
// Gradle writes build state inside module directories; it is not reviewed source.
const generated = relative => { const parts = relative.split('/'); return parts.some((part, index) => (part === 'build' || part === '.gradle' || part === '.cxx') && parts[index - 1] === 'android'); };

function regularPath(filename, directory = false) {
  try {
    const stat = fs.lstatSync(filename);
    if (stat.isSymbolicLink() || !(directory ? stat.isDirectory() : stat.isFile())) throw Error('Nonregular patched source path: ' + filename);
    return true;
  } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
function inventory(directory) {
  const files = {};
  function visit(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name), relative = path.relative(directory, file).split(path.sep).join('/');
      if (entry.isSymbolicLink()) throw Error('Symlink in patched source: ' + file);
      if (generated(relative)) continue;
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile()) files[relative] = hash(fs.readFileSync(file));
      else throw Error('Nonregular patched source: ' + file);
    }
  }
  visit(directory);
  return files;
}
const matches = (actual, expected) => JSON.stringify(Object.keys(actual).sort()) === JSON.stringify(Object.keys(expected).sort()) && Object.entries(expected).every(([file, digest]) => actual[file] === digest);

export function readPatchManifests(root = projectRoot) {
  const directory = path.join(root, 'patches/eliza');
  if (!fs.existsSync(directory)) return [];
  const manifests = fs.readdirSync(directory).filter(name => name.endsWith('-source.json')).map(name => {
    const bytes = fs.readFileSync(path.join(directory, name)), manifest = JSON.parse(bytes);
    const topic = name.replace(/-source\.json$/, '');
    const valid = manifest && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(topic) && /^[a-f0-9]{40}$/.test(manifest.baseCommit) && typeof manifest.patch === 'string' &&
      manifest.patch === manifest.patch.match(/^\d{4}-/)?.[0] + topic + '.patch' && /^[a-f0-9]{64}$/.test(manifest.sha256) &&
      Array.isArray(manifest.basePaths) && manifest.basePaths.every(safeRelative) && manifest.files && Object.keys(manifest.files).length &&
      Object.entries(manifest.files).every(([file, digest]) => safeRelative(file) && /^[a-f0-9]{64}$/.test(digest) && manifest.basePaths.concat(manifest.addedPaths || []).some(prefix => file === prefix || file.startsWith(prefix + '/'))) &&
      (manifest.addedPaths || []).every(safeRelative);
    if (!valid) throw Error(`Invalid Eliza patch manifest: patches/eliza/${name}`);
    return { name, manifest, manifestSha256: hash(bytes) };
  });
  // Series order. One series number names exactly one patch, applied or reference-only.
  manifests.sort((a, b) => a.manifest.patch.localeCompare(b.manifest.patch));
  const numbers = fs.readdirSync(directory).filter(name => name.endsWith('.patch')).map(name => name.slice(0, 4));
  if (new Set(numbers).size !== numbers.length) throw Error('Duplicate Eliza patch series number in patches/eliza');
  return manifests;
}

/** Applies every reviewed patch to authenticated pinned source; returns the output directory. */
export function prepareElizaPatches({ root = projectRoot } = {}) {
  const manifests = readPatchManifests(root);
  const parent = path.join(root, '.eliza'), destination = path.join(parent, 'patched'), stamp = path.join(destination, '.source.json');
  regularPath(parent, true);
  if (!manifests.length) { if (regularPath(destination, true)) fs.rmSync(destination, { recursive: true, force: true }); return null; }
  const pin = JSON.parse(fs.readFileSync(path.join(root, 'upstream.lock.json'), 'utf8')).commit;
  const expected = {};
  for (const { name, manifest } of manifests) {
    if (manifest.baseCommit !== pin) throw Error(`Requalify patches/eliza/${manifest.patch} against the new Eliza pin.`);
    if (hash(fs.readFileSync(path.join(root, 'patches/eliza', manifest.patch))) !== manifest.sha256) throw Error(`Eliza patch hash mismatch: ${manifest.patch}`);
    for (const [file, digest] of Object.entries(manifest.files)) {
      if (expected[file] && expected[file] !== digest) throw Error(`Conflicting Eliza patch outputs for ${file} (${name})`);
      expected[file] = digest;
    }
  }
  const provenance = { baseCommit: pin, patches: manifests.map(({ manifest, manifestSha256 }) => ({ patch: manifest.patch, sha256: manifest.sha256, manifestSha256 })), files: expected };
  if (regularPath(destination, true)) {
    if (!regularPath(stamp)) throw Error('Refusing to replace an unrecognized patched source directory.');
    const previous = JSON.parse(fs.readFileSync(stamp, 'utf8'));
    const actual = inventory(destination); delete actual['.source.json'];
    if (JSON.stringify(previous.patches) === JSON.stringify(provenance.patches) && previous.baseCommit === pin && matches(actual, expected)) return destination;
  }
  // Authenticate the base before applying anything: pin, clean checkout, regular files.
  const upstream = upstreamNativeSource(root);
  fs.mkdirSync(parent, { recursive: true });
  const temporary = fs.mkdtempSync(path.join(parent, 'patched-stage-'));
  try {
    for (const prefix of [...new Set(manifests.flatMap(({ manifest }) => manifest.basePaths))]) {
      for (const [name, file] of upstream.read(prefix)) {
        const target = path.join(temporary, name);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, file.bytes, { mode: parseInt(file.mode, 8) });
      }
    }
    execFileSync('git', ['init', '-q', temporary]);
    for (const { manifest } of manifests) {
      const patch = path.join(root, 'patches/eliza', manifest.patch);
      execFileSync('git', ['apply', '--check', '--whitespace=nowarn', patch], { cwd: temporary });
      execFileSync('git', ['apply', '--whitespace=nowarn', patch], { cwd: temporary });
    }
    fs.rmSync(path.join(temporary, '.git'), { recursive: true });
    // The manifest lists the complete output: every authenticated base file plus patch results.
    if (!matches(inventory(temporary), expected)) throw Error('Patched Eliza source does not match the checked-in file manifest.');
    fs.writeFileSync(path.join(temporary, '.source.json'), JSON.stringify(provenance, null, 2) + '\n');
    fs.rmSync(destination, { force: true, recursive: true });
    fs.renameSync(temporary, destination);
    return destination;
  } finally { fs.rmSync(temporary, { force: true, recursive: true }); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = prepareElizaPatches();
  console.log(output ? `Patched Eliza source prepared: ${output}` : 'No Eliza patches to prepare.');
}
