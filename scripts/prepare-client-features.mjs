import { createHash } from 'node:crypto';
import { upstreamNativeSource } from './upstream-native-source.mjs';
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
export const CLIENT_FEATURE_PATHS = [
  'packages/ui/src/platform/browser-document-store.ts',
  'plugins/plugin-files',
  'plugins/plugin-maps/src/client',
  'plugins/plugin-maps/test/device-client.test.mjs',
  'plugins/plugin-notes/src/client',
  'plugins/plugin-notes/test/device-client.test.mjs',
];
/** Copy authenticated upstream source outside the immutable vendor checkout. */
export function prepareClientFeatures({ root = projectRoot } = {}) {
  const upstream = upstreamNativeSource(root);
  const source = new Map(CLIENT_FEATURE_PATHS.flatMap(prefix => [...upstream.read(prefix)]));
  const files = Object.fromEntries([...source].map(([name, file]) => [name, file.sha256]));
  const provenance = { baseCommit: upstream.pin, files };
  const parent = path.join(root, '.eliza'), destination = path.join(parent, 'client-features');
  regularPath(parent, true);
  const exists = regularPath(destination, true), stamp = path.join(destination, '.source.json');
  if (exists) {
    if (!regularPath(stamp)) throw Error('Refusing to replace an unrecognized client feature directory.');
    const previous = JSON.parse(fs.readFileSync(stamp));
    const actual = inventory(destination); delete actual['.source.json'];
    if (previous.baseCommit === upstream.pin && matches(previous.files || {}, files) && matches(actual, files)) return destination;
  }
  fs.mkdirSync(parent, { recursive: true });
  const temporary = fs.mkdtempSync(path.join(parent, 'client-features-stage-'));
  try {
    for (const [name, file] of source) {
      const target = path.join(temporary, name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, file.bytes, { mode: parseInt(file.mode, 8) });
    }
    if (!matches(inventory(temporary), files)) throw Error('Client feature source copy failed authentication.');
    fs.writeFileSync(path.join(temporary, '.source.json'), JSON.stringify(provenance, null, 2));
    fs.rmSync(destination, { force: true, recursive: true });
    fs.renameSync(temporary, destination);
    return destination;
  } finally { fs.rmSync(temporary, { force: true, recursive: true }); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Client feature source prepared: ${prepareClientFeatures()}`);
}
