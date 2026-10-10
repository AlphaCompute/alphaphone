/**
 * Release blockers for font licences in a built web payload (web-dist or an APK's assets/public).
 *
 * A font is blocked when the payload's own notices mark its typeface "license unverified", or when
 * a payload file has the exact bytes of a font listed by hash in licenses/unverified-allowlist.json
 * (so stale or regenerated notices cannot hide it). Reporting only: callers decide what a blocker
 * stops. Developer builds are not failed by it; scripts/verify-apks.mjs refuses to mark a release
 * distributable while one remains.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UNVERIFIED = 'license unverified';
const FONT_FILE = /\.(?:woff2?|ttf|otf)$/i;
export const FONT_BLOCKER = 'unresolved-font-licence';
export const FONT_BLOCKER_REFERENCE = 'docs/dependency-audit.md#denton-typeface-mvp-43';

function walk(root, directory = root, out = []) {
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(root, file, out);
    else if (entry.isFile() && FONT_FILE.test(entry.name)) out.push(path.relative(root, file).split(path.sep).join('/'));
  }
  return out.sort();
}

export function readUnverifiedFontHashes(root = ROOT) {
  const file = path.join(root, 'licenses/unverified-allowlist.json');
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8')).entries.filter(entry => entry.sha256).map(entry => ({name: entry.name, sha256: entry.sha256}));
}

/**
 * @param {string} publicDir built web payload root
 * @param {{unverifiedFonts?: Array<{name: string, sha256: string}>}} [options]
 * @returns {Array<{blocker: string, name: string, files: string[], message: string}>}
 */
export function fontLicenseBlockers(publicDir, {unverifiedFonts = readUnverifiedFontHashes()} = {}) {
  const found = new Map();
  const add = (name, file) => {
    if (!found.has(name)) found.set(name, new Set());
    if (file) found.get(name).add(file);
  };
  const noticesFile = path.join(publicDir, 'licenses', 'third-party-notices.json');
  let notices = [];
  try { notices = JSON.parse(fs.readFileSync(noticesFile, 'utf8')); } catch { /* a payload without readable notices is judged by its bytes */ }
  for (const entry of Array.isArray(notices) ? notices : []) {
    if (entry?.license !== UNVERIFIED || typeof entry.name !== 'string' || !entry.name.endsWith(' typeface')) continue;
    add(entry.name);
    for (const match of String(entry.source ?? '').matchAll(/^(\S+) \(sha256 [0-9a-f]{64}\)$/gm)) add(entry.name, match[1]);
  }
  if (unverifiedFonts.length && fs.existsSync(publicDir))
    for (const file of walk(publicDir)) {
      const digest = createHash('sha256').update(fs.readFileSync(path.join(publicDir, file))).digest('hex');
      for (const font of unverifiedFonts) if (font.sha256 === digest) add(font.name, file);
    }
  return [...found].sort(([a], [b]) => a.localeCompare(b)).map(([name, files]) => {
    const list = [...files].sort();
    return {
      blocker: FONT_BLOCKER, name, files: list,
      message: `${FONT_BLOCKER}: ${name}${list.length ? ` (${list.join(', ')})` : ''} has no recorded embedding licence; license it or replace it before distribution (owner decision A-21, ${FONT_BLOCKER_REFERENCE})`,
    };
  });
}
