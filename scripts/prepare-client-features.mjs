import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
/** Materialize the reviewed patch outside the immutable vendor checkout. */
export function prepareClientFeatures() {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'patches/eliza/client-features-source.json')));
  const pin = JSON.parse(fs.readFileSync(path.join(root, 'upstream.lock.json')));
  if (pin.commit !== manifest.baseCommit) throw Error('Requalify client feature patch against the new Eliza pin.');
  const patch = path.join(root, 'patches/eliza', manifest.patch);
  if (hash(fs.readFileSync(patch)) !== manifest.sha256) throw Error('Client feature patch hash mismatch.');
  const destination = path.join(root, '.eliza/client-features');
  const stamp = path.join(destination, '.source.json');
  if (fs.existsSync(stamp)) {
    const previous = JSON.parse(fs.readFileSync(stamp));
    if (previous.patch === manifest.sha256 && Object.entries(manifest.files).every(([file, digest]) => {
      const target = path.join(destination, file);
      return fs.existsSync(target) && hash(fs.readFileSync(target)) === digest;
    })) return destination;
  } else if (fs.existsSync(destination)) throw Error('Refusing to replace an unrecognized client feature directory.');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = fs.mkdtempSync(path.join(root, '.eliza/client-features-stage-'));
  try {
    execFileSync('git', ['init', '-q', temporary]);
    execFileSync('git', ['apply', '--check', patch], { cwd: temporary });
    execFileSync('git', ['apply', patch], { cwd: temporary });
    fs.rmSync(path.join(temporary, '.git'), { recursive: true });
    const files = {};
    function inventory(directory) {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) inventory(file);
        else files[path.relative(temporary, file)] = hash(fs.readFileSync(file));
      }
    }
    inventory(temporary);
    if (JSON.stringify(Object.keys(files).sort()) !== JSON.stringify(Object.keys(manifest.files).sort()) ||
      Object.entries(manifest.files).some(([file, digest]) => files[file] !== digest)) {
      throw Error('Client feature source does not match the checked-in file manifest.');
    }
    fs.writeFileSync(path.join(temporary, '.source.json'), JSON.stringify({ patch: manifest.sha256, files }, null, 2));
    fs.rmSync(destination, { force: true, recursive: true });
    fs.renameSync(temporary, destination);
    return destination;
  } finally { fs.rmSync(temporary, { force: true, recursive: true }); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Client feature source prepared: ${prepareClientFeatures()}`);
}
