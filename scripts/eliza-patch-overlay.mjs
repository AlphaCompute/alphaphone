/**
 * Temporary overlay of applied server-side Eliza patches onto the immutable prepared
 * runtime source, for exactly the duration of one build (agent bundle or workflow
 * worker), so patches such as plugin-assistant, plugin-workflow or contracts changes
 * reach the resident agent.
 *
 * The prepared source stays the pinned upstream commit: every overlaid path is
 * journalled outside the source first, restored byte-for-byte afterwards (also on
 * failure) and re-hashed, and the normal source admission runs before and after.
 * An interrupted overlay leaves a journal that refuses further builds until
 * `node scripts/eliza-patch-overlay.mjs --restore` puts the original bytes back.
 * The overlay bytes come only from `.eliza/patched`, which prepare-eliza-patches.mjs
 * authenticates against each patch's complete output manifest.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPatchManifests } from './prepare-eliza-patches.mjs';

/** Server-side upstream sources built into the resident agent or the workflow worker. */
export const SERVER_SIDE_PREFIXES = Object.freeze(['plugins/plugin-assistant', 'plugins/plugin-workflow', 'packages/contracts']);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const within = (file, prefixes) => prefixes.some(prefix => file === prefix || file.startsWith(`${prefix}/`));

/**
 * Applied patches (series order) that change a server-side prefix, with the exact
 * files of those prefixes in the patched output. Native-only patches are excluded.
 */
export function serverSideOverlay(root, prefixes = SERVER_SIDE_PREFIXES) {
  const manifests = readPatchManifests(root).filter(({ manifest }) =>
    [...manifest.basePaths, ...(manifest.addedPaths ?? [])].some(prefix => within(prefix, prefixes) || prefixes.some(p => p.startsWith(`${prefix}/`))));
  if (!manifests.length) return null;
  const pin = JSON.parse(fs.readFileSync(path.join(root, 'upstream.lock.json'), 'utf8')).commit;
  const files = {};
  const roots = new Set();
  for (const { manifest } of manifests) {
    if (manifest.baseCommit !== pin) throw Error(`Requalify patches/eliza/${manifest.patch} against the new Eliza pin.`);
    for (const prefix of [...manifest.basePaths, ...(manifest.addedPaths ?? [])]) if (within(prefix, prefixes)) roots.add(prefix);
    for (const [file, digest] of Object.entries(manifest.files)) if (within(file, prefixes)) files[file] = digest;
  }
  return {
    baseCommit: pin,
    patches: manifests.map(({ manifest, manifestSha256 }) => ({ patch: manifest.patch, sha256: manifest.sha256, manifestSha256 })),
    roots: [...roots].sort(),
    files: Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b))),
  };
}

function listFiles(directory, relative) {
  const out = [];
  const start = path.join(directory, relative);
  if (!fs.existsSync(start)) return out;
  const visit = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      const name = path.relative(directory, file).split(path.sep).join('/');
      if (entry.isSymbolicLink()) throw Error(`Symlink in overlaid source: ${name}`);
      // Dependencies, build outputs and tool caches are not source and are never touched.
      if (entry.isDirectory()) { if (!['node_modules', 'dist', 'build', '.turbo'].includes(entry.name)) visit(file); }
      else if (entry.isFile()) out.push(name);
    }
  };
  visit(start);
  return out;
}

export const journalPath = (root, source) => path.join(root, 'artifacts', `${path.basename(source)}.patch-overlay.journal.json`);

/** Put every journalled path back to its original bytes (or absence) and verify. */
export function restoreOverlay(root, source) {
  const journalFile = journalPath(root, source);
  if (!fs.existsSync(journalFile)) return false;
  const journal = JSON.parse(fs.readFileSync(journalFile, 'utf8'));
  const backup = `${journalFile}.d`;
  for (const [file, original] of Object.entries(journal.original)) {
    const target = path.join(source, file);
    if (original === null) fs.rmSync(target, { force: true });
    else {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(backup, original.sha256), target);
      fs.chmodSync(target, original.mode);
      if (hash(fs.readFileSync(target)) !== original.sha256) throw Error(`Could not restore ${file}; preserve ${journalFile} for recovery`);
    }
  }
  // Directories created only for added files are removed again, deepest first.
  for (const dir of [...journal.createdDirectories].sort((a, b) => b.length - a.length)) {
    const target = path.join(source, dir);
    try { fs.rmdirSync(target); } catch (error) { if (error.code !== 'ENOENT' && error.code !== 'ENOTEMPTY') throw error; }
  }
  fs.rmSync(backup, { recursive: true, force: true });
  fs.rmSync(journalFile, { force: true });
  return true;
}

/**
 * Overlay the server-side patched files into `source`, run `build`, restore.
 * Returns { overlay, result }; overlay is null (and nothing is touched) when no
 * applied patch changes a server-side prefix.
 */
export async function withPatchOverlay(root, source, build, { prefixes = SERVER_SIDE_PREFIXES, patchedDir = path.join(root, '.eliza/patched') } = {}) {
  const journalFile = journalPath(root, source);
  if (fs.existsSync(journalFile)) throw Error(`An interrupted patch overlay is recorded in ${journalFile}; run node scripts/eliza-patch-overlay.mjs --restore first`);
  const overlay = serverSideOverlay(root, prefixes);
  if (!overlay) return { overlay: null, result: await build() };
  const stamp = JSON.parse(fs.readFileSync(path.join(patchedDir, '.source.json'), 'utf8'));
  if (stamp.baseCommit !== overlay.baseCommit) throw Error('.eliza/patched is not prepared for the current pin; run npm run upstream:prepare-client');
  for (const [file, digest] of Object.entries(overlay.files)) {
    if (stamp.files?.[file] !== digest) throw Error(`.eliza/patched does not match the manifest for ${file}; run npm run upstream:prepare-client`);
    if (hash(fs.readFileSync(path.join(patchedDir, file))) !== digest) throw Error(`.eliza/patched/${file} changed after preparation`);
  }
  // Every file of an overlaid root in the source is either replaced or, when the
  // patch deleted it, removed for the build. Build outputs are left alone.
  const existing = new Set(overlay.roots.flatMap(prefix => listFiles(source, prefix)));
  const touched = [...new Set([...existing, ...Object.keys(overlay.files)])].sort();
  const backup = `${journalFile}.d`;
  fs.mkdirSync(backup, { recursive: true });
  const journal = { source, overlay: overlay.patches, original: {}, createdDirectories: [] };
  for (const file of touched) {
    const target = path.join(source, file);
    if (fs.existsSync(target)) {
      const bytes = fs.readFileSync(target);
      const digest = hash(bytes);
      fs.writeFileSync(path.join(backup, digest), bytes);
      journal.original[file] = { sha256: digest, mode: fs.statSync(target).mode & 0o777 };
    } else journal.original[file] = null;
  }
  for (const file of Object.keys(overlay.files)) {
    for (let dir = path.posix.dirname(file); dir !== '.' && !fs.existsSync(path.join(source, dir)); dir = path.posix.dirname(dir)) journal.createdDirectories.push(dir);
  }
  fs.writeFileSync(journalFile, `${JSON.stringify(journal, null, 2)}\n`, { flag: 'wx' });
  let result;
  try {
    for (const file of touched) {
      const target = path.join(source, file);
      if (file in overlay.files) {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(patchedDir, file), target);
      } else fs.rmSync(target, { force: true });
    }
    result = await build();
  } finally {
    restoreOverlay(root, source);
  }
  return { overlay, result };
}

/** Overlay identity recorded beside a build output; null means no server-side patch. */
export const overlayIdentity = overlay => (overlay ? { baseCommit: overlay.baseCommit, patches: overlay.patches, filesSha256: hash(JSON.stringify(overlay.files)) } : null);
export const overlayRecordPath = output => `${path.resolve(output)}.patch-overlay.json`;
export function readOverlayRecord(output) {
  const file = overlayRecordPath(output);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).overlay : null;
}
export function writeOverlayRecord(output, overlay) {
  fs.writeFileSync(overlayRecordPath(output), `${JSON.stringify({ overlay: overlayIdentity(overlay) }, null, 2)}\n`);
}
export const sameOverlay = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(import.meta.dirname, '..');
  const { sourceDirectory } = await import('./local-agent-source.mjs');
  const source = sourceDirectory(root);
  if (process.argv.includes('--restore')) console.log(restoreOverlay(root, source) ? `Restored ${source}` : 'No interrupted overlay.');
  else console.log(JSON.stringify(serverSideOverlay(root), null, 2));
}
