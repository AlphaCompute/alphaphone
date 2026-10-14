#!/usr/bin/env node
// Remove stale assets from builds made before the shared browser recognizer was retired.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const PUBLISHED='browser-speech';
export function pruneAndroidBrowserSpeech(root = ROOT) {
  const target = path.join(root, 'android/app/src/main/assets/public', PUBLISHED);
  let stat;
  try { stat = fs.lstatSync(target); } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
  if (stat.isSymbolicLink()) throw new Error(`Refusing to follow a linked ${target}`);
  fs.rmSync(target, {recursive: true, force: true});
  return true;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv[2]!=='prune-android'){console.error('Browser-local recognition was retired. Usage: browser-speech-assets.mjs prune-android');process.exitCode=2;}
 else console.log(pruneAndroidBrowserSpeech()?'Removed stale browser speech assets.':'No stale browser speech assets.');
}
