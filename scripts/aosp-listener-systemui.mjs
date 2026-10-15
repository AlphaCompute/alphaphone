// Exact two-file patch admission, not verification of a complete AOSP tree or image.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'android/aosp/listener/systemui');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function regular(file) {
  if (!fs.lstatSync(file).isFile() || fs.realpathSync(file) !== path.resolve(file)) throw Error(`Not a regular, non-symlink path: ${file}`);
  return fs.readFileSync(file);
}
export function verifyListenerSystemui(source, state = 'before') {
  if (!['before', 'after'].includes(state)) throw Error('Expected before or after state');
  const manifestBytes = regular(path.join(directory, 'manifest.json'));
  const manifest = JSON.parse(manifestBytes);
  const patch = regular(path.join(directory, manifest.patch));
  if (sha(patch) !== manifest.patchSha256) throw Error('SystemUI patch hash mismatch');
  if (sha(regular(path.join(root, 'android/aosp/pixel10a-source.json'))) !== manifest.baselineLockSha256) throw Error('Baseline source lock changed; re-review SystemUI patch');
  const project = path.join(path.resolve(source), manifest.project);
  const files = manifest.files.map(entry => {
    const digest = sha(regular(path.join(project, entry.path)));
    if (digest !== entry[`${state}Sha256`]) throw Error(`SystemUI ${state} image mismatch: ${entry.path}`);
    return {path: entry.path, sha256: digest};
  });
  return {schema: 1, scope: 'Two SystemUI files only; remaining source tree is not verified', state, expectedProjectRevision: manifest.revision, baselineLockSha256: manifest.baselineLockSha256, manifestSha256: sha(manifestBytes), patchSha256: manifest.patchSha256, files, fullTreeVerified: false, imageBuilt: false, lockAodIndicatorQualified: false};
}

// Prepare a tiny overlay for a disposable build copy; never write into the supplied AOSP source.
export function prepareListenerSystemui(source, output) {
  source = fs.realpathSync(source);
  output = path.resolve(output);
  const parent = fs.realpathSync(path.dirname(output));
  if (parent === source || parent.startsWith(source + path.sep)) throw Error('Output must be outside the supplied AOSP source');
  const before = verifyListenerSystemui(source);
  if (fs.existsSync(output)) throw Error('Output must not exist');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-systemui-'));
  try {
    for (const entry of before.files) {
      const file = path.join(temporary, 'frameworks/base', entry.path);
      fs.mkdirSync(path.dirname(file), {recursive: true});
      fs.copyFileSync(path.join(source, 'frameworks/base', entry.path), file);
    }
    execFileSync('git', ['apply', '--whitespace=error', path.join(directory, 'microphone-ops.patch')], {cwd: path.join(temporary, 'frameworks/base')});
    const after = verifyListenerSystemui(temporary, 'after');
    fs.writeFileSync(path.join(temporary, 'derived-source.json'), JSON.stringify(after, null, 2) + '\n');
    fs.mkdirSync(output); // Exclusive destination; existing source cannot be overwritten.
    fs.cpSync(temporary, output, {recursive: true, force: false, errorOnExist: true});
    return after;
  } finally { fs.rmSync(temporary, {recursive: true, force: true}); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const source = args[args.indexOf('--source') + 1];
  if (!args.includes('--source') || !source) throw Error('Use --source AOSP_ROOT [--output NEW_OVERLAY | --after]');
  const output = args.includes('--output') ? args[args.indexOf('--output') + 1] : null;
  if (args.includes('--output') && (!output || output.startsWith('--'))) throw Error('--output needs a new directory');
  if (output && args.includes('--after')) throw Error('--output requires the unpatched source');
  console.log(JSON.stringify(output ? prepareListenerSystemui(source, path.resolve(output)) : verifyListenerSystemui(source, args.includes('--after') ? 'after' : 'before'), null, 2));
}
