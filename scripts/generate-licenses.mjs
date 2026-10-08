#!/usr/bin/env node
// Generates the third-party notices shipped in the web bundle and in every APK payload.
//
//   node scripts/generate-licenses.mjs                    write apps/app/public/licenses/*
//   node scripts/generate-licenses.mjs --check            fail when outputs are stale or incomplete
//   node scripts/generate-licenses.mjs --refresh-android  re-resolve the Gradle release/debug runtime
//                                                         classpath into licenses/android-runtime-classpath.json
//
// Every entry has exactly {name, version, license, source, text}. Any license expression outside
// KNOWN_LICENSES fails generation. Fonts, models and payloads whose license cannot be established
// from shipped metadata are emitted with license 'license unverified' and fail unless
// licenses/unverified-allowlist.json names them with a reason. Allowlisting is not legal sign-off.
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {brotliDecompressSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const OUTPUT_DIR = 'apps/app/public/licenses';
export const JSON_OUTPUT = `${OUTPUT_DIR}/third-party-notices.json`;
export const TEXT_OUTPUT = `${OUTPUT_DIR}/THIRD_PARTY_NOTICES.txt`;
export const ALLOWLIST = 'licenses/unverified-allowlist.json';
export const ANDROID_CLASSPATH = 'licenses/android-runtime-classpath.json';
export const UNVERIFIED = 'license unverified';

/** SPDX identifiers (and the one SPDX exception) accepted without legal escalation by this check. */
export const KNOWN_LICENSES = new Set([
  '0BSD', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'MIT', 'MPL-2.0', 'OFL-1.1', 'ODbL-1.0', 'Zlib',
  'GPL-2.0-only WITH Font-exception-2.0',
  // Permissive licenses of libraries statically linked into the tesseract.js-core WebAssembly cores.
  'IJG', 'libpng-2.0', 'libtiff', 'SunPro',
]);

/** Maven group prefixes found on the resolved Android runtime classpath. Anything else fails. */
const MAVEN_FAMILIES = [
  {prefix: 'androidx.', name: 'AndroidX (Android Jetpack) libraries, including CameraX', license: 'Apache-2.0', source: 'https://android.googlesource.com/platform/frameworks/support/'},
  {prefix: 'org.jetbrains.kotlinx', name: 'Kotlin coroutines', license: 'Apache-2.0', source: 'https://github.com/Kotlin/kotlinx.coroutines'},
  {prefix: 'org.jetbrains.kotlin', name: 'Kotlin standard library', license: 'Apache-2.0', source: 'https://github.com/JetBrains/kotlin'},
  {prefix: 'org.jetbrains', exact: true, name: 'JetBrains Java annotations', license: 'Apache-2.0', source: 'https://github.com/JetBrains/java-annotations'},
  {prefix: 'com.google.guava', name: 'Guava ListenableFuture', license: 'Apache-2.0', source: 'https://github.com/google/guava'},
  {prefix: 'com.google.auto.value', name: 'AutoValue annotations', license: 'Apache-2.0', source: 'https://github.com/google/auto'},
  {prefix: 'org.jspecify', name: 'JSpecify annotations', license: 'Apache-2.0', source: 'https://github.com/jspecify/jspecify'},
  {prefix: 'org.apache.cordova', name: 'Apache Cordova Android framework (Capacitor compatibility layer)', license: 'Apache-2.0', source: 'https://github.com/apache/cordova-android'},
];

/** pdf.js ships decoders, fonts and CMaps beside the viewer; each has its own license file. */
const PDFJS_COMPONENTS = [
  {name: 'pdf.js standard fonts: Foxit', license: 'BSD-3-Clause', file: 'standard_fonts/LICENSE_FOXIT', source: 'https://pdfium.googlesource.com/pdfium/'},
  {name: 'pdf.js standard fonts: Liberation', license: 'GPL-2.0-only WITH Font-exception-2.0', file: 'standard_fonts/LICENSE_LIBERATION', source: 'https://github.com/liberationfonts'},
  {name: 'pdf.js CMaps (Adobe)', license: 'BSD-3-Clause', file: 'cmaps/LICENSE', source: 'https://github.com/adobe-type-tools/cmap-resources'},
  {name: 'pdf.js JBIG2 decoder (PDFium)', license: 'BSD-3-Clause AND Apache-2.0', files: ['wasm/LICENSE_JBIG2', 'wasm/LICENSE_PDFJS_JBIG2'], source: 'https://pdfium.googlesource.com/pdfium/'},
  {name: 'pdf.js OpenJPEG decoder', license: 'BSD-2-Clause', files: ['wasm/LICENSE_OPENJPEG', 'wasm/LICENSE_PDFJS_OPENJPEG'], source: 'https://github.com/uclouvain/openjpeg'},
  {name: 'pdf.js qcms colour management', license: 'MIT', files: ['wasm/LICENSE_QCMS', 'wasm/LICENSE_PDFJS_QCMS'], source: 'https://github.com/FirefoxGraphics/qcms'},
  {name: 'pdf.js QuickJS sandbox', license: UNVERIFIED, files: [], source: 'https://github.com/mozilla/pdf.js.quickjs'},
];

const LICENSE_FILE = /^(licen[cs]e|copying|notice)([.\-_].*)?$/i;

// ---------------------------------------------------------------- helpers

const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const readJson = (root, rel) => JSON.parse(read(root, rel));
const exists = (root, rel) => fs.existsSync(path.join(root, rel));
export const sha256 = data => createHash('sha256').update(data).digest('hex');
const normalizeText = text => text.replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').replace(/^\n+|\n+$/g, '');

/** Validate an SPDX-style expression. Returns the identifiers that are not known. */
export function unknownLicenseTerms(expression) {
  if (expression === UNVERIFIED) return [];
  if (typeof expression !== 'string' || !expression.trim()) return [String(expression)];
  if (KNOWN_LICENSES.has(expression)) return [];
  const bad = [];
  for (const term of expression.replace(/[()]/g, ' ').split(/\s+(?:AND|OR)\s+/)) {
    const id = term.trim();
    if (!KNOWN_LICENSES.has(id)) bad.push(id);
  }
  return bad;
}

/** Production packages in package-lock: not dev, not optional platform binaries, not links. */
export function productionLockPackages(lock) {
  const out = [];
  for (const [key, meta] of Object.entries(lock.packages || {})) {
    if (!key || meta.dev || meta.optional || meta.devOptional || meta.link) continue;
    if (!key.startsWith('node_modules/')) continue;
    const name = meta.name || key.slice(key.lastIndexOf('node_modules/') + 'node_modules/'.length);
    out.push({key, name, version: meta.version, license: meta.license, resolved: meta.resolved});
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

function licenseFilesText(dir) {
  if (!fs.existsSync(dir)) return '';
  const names = fs.readdirSync(dir).filter(name => LICENSE_FILE.test(name) && fs.statSync(path.join(dir, name)).isFile()).sort();
  return names.map(name => normalizeText(fs.readFileSync(path.join(dir, name), 'utf8'))).join('\n\n');
}

function packageAuthor(pkg) {
  const a = pkg.author;
  if (!a) return '';
  return typeof a === 'string' ? a : [a.name, a.email && `<${a.email}>`].filter(Boolean).join(' ');
}

// ---------------------------------------------------------------- font metadata

const WOFF2_TAGS = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];

function sfntNameTable(buf) {
  const count = buf.readUInt16BE(4);
  for (let i = 0; i < count; i++) {
    const rec = 12 + i * 16;
    if (buf.toString('latin1', rec, rec + 4) === 'name') {
      const offset = buf.readUInt32BE(rec + 8), length = buf.readUInt32BE(rec + 12);
      return buf.subarray(offset, offset + length);
    }
  }
  return null;
}

function woff2NameTable(buf) {
  const numTables = buf.readUInt16BE(12);
  const compressedLength = buf.readUInt32BE(20);
  let pos = 48;
  const base128 = () => {
    let value = 0;
    for (let i = 0; i < 5; i++) {
      const byte = buf[pos++];
      value = value * 128 + (byte & 0x7f);
      if (!(byte & 0x80)) return value;
    }
    throw new Error('Invalid WOFF2 UIntBase128');
  };
  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const flags = buf[pos++];
    let tag = WOFF2_TAGS[flags & 0x3f];
    if ((flags & 0x3f) === 63) { tag = buf.toString('latin1', pos, pos + 4); pos += 4; }
    const transform = (flags >> 6) & 3;
    const origLength = base128();
    const transformed = (tag === 'glyf' || tag === 'loca') ? transform === 0 : transform !== 0;
    const length = transformed ? base128() : origLength;
    tables.push({tag, length});
  }
  if (buf.toString('latin1', 4, 8) === 'ttcf') throw new Error('WOFF2 collections are not supported');
  const data = brotliDecompressSync(buf.subarray(pos, pos + compressedLength));
  let offset = 0;
  for (const table of tables) {
    if (table.tag === 'name') return data.subarray(offset, offset + table.length);
    offset += table.length;
  }
  return null;
}

/** Read the OpenType name table of a TTF/OTF/WOFF2 file. */
export function fontNames(buf) {
  const sig = buf.toString('latin1', 0, 4);
  const table = sig === 'wOF2' ? woff2NameTable(buf) : (sig === '\0\x01\0\0' || sig === 'OTTO' || sig === 'true') ? sfntNameTable(buf) : null;
  if (!table) throw new Error('Unsupported or unreadable font container');
  const count = table.readUInt16BE(2), stringOffset = table.readUInt16BE(4);
  const pick = {};
  for (let i = 0; i < count; i++) {
    const r = 6 + i * 12;
    const platform = table.readUInt16BE(r), encoding = table.readUInt16BE(r + 2), language = table.readUInt16BE(r + 4);
    const id = table.readUInt16BE(r + 6), length = table.readUInt16BE(r + 8), offset = table.readUInt16BE(r + 10);
    const raw = table.subarray(stringOffset + offset, stringOffset + offset + length);
    let rank, value;
    if (platform === 3 && encoding === 1) {
      rank = language === 0x409 ? 0 : 1;
      value = Buffer.from(raw).swap16().toString('utf16le');
    } else if (platform === 1 && encoding === 0) { rank = 2; value = raw.toString('latin1'); } else continue;
    if (!pick[id] || pick[id].rank > rank) pick[id] = {rank, value};
  }
  const get = id => pick[id]?.value?.trim() || '';
  return {copyright: get(0), family: get(16) || get(1), fullName: get(4), version: get(5), manufacturer: get(8), licenseDescription: get(13), licenseUrl: get(14)};
}

export function fontLicense(names) {
  const haystack = `${names.licenseDescription}\n${names.licenseUrl}`;
  if (/SIL Open Font License,? Version 1\.1|scripts\.sil\.org\/(cms\/scripts\/page\.php\?.*id=)?OFL|openfontlicense\.org/i.test(haystack)) return 'OFL-1.1';
  return UNVERIFIED;
}

function listFonts(root, dir) {
  const out = [];
  const walk = rel => {
    for (const entry of fs.readdirSync(path.join(root, rel), {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name))) {
      const child = path.posix.join(rel, entry.name);
      if (entry.isDirectory()) { if (entry.name !== 'licenses') walk(child); } else if (/\.(woff2|ttf|otf)$/i.test(entry.name)) out.push(child);
    }
  };
  walk(dir);
  return out;
}

// ---------------------------------------------------------------- collectors

function npmEntries(root, templates, errors) {
  const lock = readJson(root, 'package-lock.json');
  const entries = [];
  for (const pkg of productionLockPackages(lock)) {
    const dir = path.join(root, pkg.key);
    if (!fs.existsSync(path.join(dir, 'package.json'))) { errors.push(`${pkg.name}@${pkg.version}: not installed at ${pkg.key}; run npm ci`); continue; }
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    if (manifest.version !== pkg.version) errors.push(`${pkg.name}: installed ${manifest.version} differs from package-lock ${pkg.version}`);
    const license = pkg.license || (typeof manifest.license === 'string' ? manifest.license : '');
    let text = licenseFilesText(dir);
    if (!text) {
      const template = license === 'MIT' ? templates.mit : license === 'ISC' ? templates.isc : '';
      if (!template) { errors.push(`${pkg.name}@${pkg.version}: no license file shipped for ${license || 'undeclared license'}`); continue; }
      const author = packageAuthor(manifest);
      text = `The npm package ships no license file. Its package.json declares the ${license} License${author ? `; author: ${author}` : ''}. The standard ${license} terms follow.\n\n${template}`;
    }
    entries.push({name: pkg.name, version: pkg.version, license, source: pkg.resolved || `https://www.npmjs.com/package/${pkg.name}/v/${pkg.version}`, text});
  }
  return entries;
}

function pdfjsEntries(root, errors) {
  const dir = 'node_modules/pdfjs-dist';
  if (!exists(root, `${dir}/package.json`)) return [];
  const version = readJson(root, `${dir}/package.json`).version;
  return PDFJS_COMPONENTS.map(component => {
    const files = component.files || [component.file];
    for (const file of files) if (!exists(root, `${dir}/${file}`)) errors.push(`${component.name}: missing ${dir}/${file}`);
    const text = files.filter(file => exists(root, `${dir}/${file}`)).map(file => normalizeText(read(root, `${dir}/${file}`))).join('\n\n');
    return {name: component.name, version: `bundled with pdfjs-dist ${version}`, license: component.license, source: component.source,
      text: text || 'pdfjs-dist ships this component without a license file.'};
  });
}

function ocrDataEntries(root) {
  const eng = readJson(root, 'node_modules/@tesseract.js-data/eng/package.json');
  return [{name: 'Tesseract English trained data (tessdata 4.0.0_best_int)', version: `bundled with @tesseract.js-data/eng ${eng.version}`, license: 'Apache-2.0',
    source: 'https://github.com/naptha/tessdata', text: normalizeText(read(root, 'licenses/tessdata-APACHE-2.0.txt'))}];
}

/**
 * tesseract.js-core ships WebAssembly cores that statically link Tesseract, Leptonica and image/math
 * libraries. Its own LICENSE covers only the wrapper, so each linked library is listed from license
 * copies pinned in licenses/tesseract-core/sources.json to the exact cores that ship.
 */
export const TESSERACT_CORE_SOURCES = 'licenses/tesseract-core/sources.json';
function tesseractCoreEntries(root, errors) {
  if (!exists(root, TESSERACT_CORE_SOURCES)) { errors.push(`${TESSERACT_CORE_SOURCES} missing`); return []; }
  const pinned = readJson(root, TESSERACT_CORE_SOURCES);
  const dir = `node_modules/${pinned.package}`;
  if (!exists(root, `${dir}/package.json`)) { errors.push(`${pinned.package}: not installed; run npm ci`); return []; }
  const installed = readJson(root, `${dir}/package.json`).version;
  if (installed !== pinned.version)
    errors.push(`${pinned.package} ${installed} differs from ${TESSERACT_CORE_SOURCES} (${pinned.version}); re-review its statically linked libraries`);
  for (const [file, digest] of Object.entries(pinned.cores)) {
    if (!exists(root, `${dir}/${file}`)) errors.push(`${dir}/${file}: missing`);
    else if (sha256(fs.readFileSync(path.join(root, dir, file))) !== digest)
      errors.push(`${dir}/${file} differs from the core pinned in ${TESSERACT_CORE_SOURCES}; re-review its statically linked libraries`);
  }
  return pinned.components.map(component => {
    const texts = component.files.map(file => {
      const rel = `licenses/tesseract-core/${file.path}`;
      if (!exists(root, rel)) { errors.push(`${rel}: missing`); return ''; }
      const bytes = fs.readFileSync(path.join(root, rel));
      if (sha256(bytes) !== file.sha256) errors.push(`${rel} does not match its sha256 in ${TESSERACT_CORE_SOURCES}`);
      return normalizeText(bytes.toString('utf8'));
    }).filter(Boolean);
    return {name: `${component.name} (linked into ${pinned.package} WebAssembly)`, version: `${component.version}; bundled with ${pinned.package} ${pinned.version}`,
      license: component.license, source: component.source, text: [component.preface, ...texts].filter(Boolean).join('\n\n')};
  });
}

function fontEntries(root, templates, errors) {
  const entries = [];
  const groups = new Map();
  for (const rel of listFonts(root, 'apps/app/public')) {
    const bytes = fs.readFileSync(path.join(root, rel));
    let names;
    try { names = fontNames(bytes); } catch (error) { errors.push(`${rel}: cannot read font metadata (${error.message})`); continue; }
    const license = fontLicense(names);
    const key = [names.family, names.version, names.copyright, license].join('\0');
    if (!groups.has(key)) groups.set(key, {names, license, files: []});
    groups.get(key).files.push({rel: rel.replace(/^apps\/app\/public\//, ''), sha256: sha256(bytes)});
  }
  for (const {names, license, files} of groups.values()) {
    const fileList = files.map(file => `${file.rel} (sha256 ${file.sha256})`).join('\n');
    const body = license === 'OFL-1.1' ? `${names.copyright}\n\n${templates.ofl}` :
      `The font file states: "${names.copyright || 'no copyright notice'}". It names no license${names.manufacturer ? `; manufacturer: ${names.manufacturer}` : ''}.`;
    entries.push({name: `${names.family} typeface`, version: names.version.replace(/^Version\s+/i, ''), license,
      source: `Files shipped in the web bundle:\n${fileList}`, text: body, _unverifiedKey: files.map(file => file.sha256)});
  }
  const pkg = readJson(root, 'package.json');
  const fontsource = Object.keys({...pkg.dependencies, ...pkg.devDependencies}).filter(name => name.startsWith('@fontsource/')).sort();
  for (const name of fontsource) {
    const dir = `node_modules/${name}`;
    if (!exists(root, `${dir}/package.json`)) { errors.push(`${name}: not installed; run npm ci`); continue; }
    const manifest = readJson(root, `${dir}/package.json`);
    const text = licenseFilesText(path.join(root, dir));
    if (!text) errors.push(`${name}: no license file`);
    entries.push({name, version: manifest.version, license: manifest.license, source: `https://www.npmjs.com/package/${name}/v/${manifest.version}`, text});
  }
  return entries;
}

function elizaEntry(root) {
  const lock = readJson(root, 'upstream.lock.json');
  const version = exists(root, 'vendor/eliza/package.json') ? readJson(root, 'vendor/eliza/package.json').version : 'pinned';
  return {name: 'elizaOS', version: `${version} (${lock.commit})`, license: 'MIT', source: `${lock.url.replace(/\.git$/, '')}/tree/${lock.commit}`,
    text: normalizeText(read(root, 'vendor/eliza/LICENSE'))};
}

/** Parse `gradle dependencies` tree output into sorted unique resolved group:artifact:version. */
export function parseGradleTree(output) {
  const coords = new Set();
  for (const line of output.split('\n')) {
    const match = line.match(/[+\\]--- ([^\s:]+):([^\s:]+)(?::([^\s]+))?(?: -> ([^\s]+))?(?: \((\*|c|n)\))?\s*$/);
    if (!match || match[1] === 'project') continue;
    if (match[5] === 'c' || match[5] === 'n') continue;
    const version = match[4] || match[3];
    if (!version) continue;
    coords.add(`${match[1]}:${match[2]}:${version}`);
  }
  return [...coords].sort();
}

/** Fingerprint only Gradle inputs that can change the resolved runtime classpath. */
export function androidDependencyFingerprint(root) {
  const settings = read(root, 'android/settings.gradle');
  const modules = new Map([...settings.matchAll(/project\('(:[^']+)'\)\.projectDir\s*=\s*new File\('([^']+)'\)/g)].map(m => [m[1], path.posix.join('android', m[2])]));
  const files = ['android/variables.gradle', 'android/build.gradle', 'android/app/build.gradle', 'android/local-speech/build.gradle'];
  const app = read(root, 'android/app/build.gradle');
  for (const [, name] of app.matchAll(/^\s*implementation\s+project\('(:[^']+)'\)/gm)) if (modules.has(name)) files.push(path.posix.join(modules.get(name), 'build.gradle'));
  const consumer = read(root, 'android/local-speech/build.gradle').match(/elizaSpeechSourceDir\s*=\s*file\('([^']+)'\)/);
  if (consumer) files.push(path.posix.join('android/local-speech', consumer[1], 'consumer.gradle'));
  const lines = [];
  for (const file of [...new Set(files)].sort()) {
    if (!exists(root, file)) { lines.push(`${file}: missing`); continue; }
    const relevant = read(root, file).split('\n').map(line => line.trim())
      .filter(line => /^(implementation|api|runtimeOnly)\b/.test(line) || /Version\s*=/.test(line) || /^include\b|projectDir\s*=/.test(line));
    lines.push(`${file}:\n${relevant.join('\n')}`);
  }
  return sha256(lines.join('\n'));
}

export function refreshAndroidClasspath(root, env) {
  const configurations = ['standaloneReleaseRuntimeClasspath', 'launcherReleaseRuntimeClasspath', 'standaloneDebugRuntimeClasspath', 'launcherDebugRuntimeClasspath'];
  const coords = new Set();
  for (const configuration of configurations) {
    const output = execFileSync('./gradlew', ['-q', ':app:dependencies', '--configuration', configuration], {cwd: path.join(root, 'android'), env, encoding: 'utf8', maxBuffer: 64 << 20});
    const parsed = parseGradleTree(output);
    if (!parsed.length) throw new Error(`Gradle returned no dependencies for ${configuration}`);
    for (const coord of parsed) coords.add(coord);
  }
  const snapshot = {configurations, inputFingerprint: androidDependencyFingerprint(root), coordinates: [...coords].sort()};
  fs.writeFileSync(path.join(root, ANDROID_CLASSPATH), JSON.stringify(snapshot, null, 2) + '\n');
  return snapshot;
}

function androidEntries(root, templates, errors) {
  if (!exists(root, ANDROID_CLASSPATH)) { errors.push(`${ANDROID_CLASSPATH} missing; run node scripts/generate-licenses.mjs --refresh-android`); return []; }
  const snapshot = readJson(root, ANDROID_CLASSPATH);
  if (snapshot.inputFingerprint !== androidDependencyFingerprint(root))
    errors.push(`${ANDROID_CLASSPATH} is stale: Android dependency declarations changed; run node scripts/generate-licenses.mjs --refresh-android`);
  const families = new Map();
  for (const coord of snapshot.coordinates) {
    const [group] = coord.split(':');
    const family = MAVEN_FAMILIES.find(f => f.exact ? group === f.prefix : group.startsWith(f.prefix));
    if (!family) { errors.push(`Android dependency ${coord}: unknown license (add its group to MAVEN_FAMILIES after review)`); continue; }
    if (!families.has(family)) families.set(family, []);
    families.get(family).push(coord);
  }
  return [...families].map(([family, coords]) => ({name: family.name, version: coords.join('\n'), license: family.license, source: family.source, text: templates.apache}));
}

function speechEntries(root, templates, errors) {
  if (!exists(root, 'android/local-speech/runtime-manifest.json')) return [];
  const manifest = readJson(root, 'android/local-speech/runtime-manifest.json');
  if (manifest.noEspeak !== true) errors.push('android/local-speech/runtime-manifest.json: runtime is not the qualified no-eSpeak build (GPL eSpeak would need separate review)');
  const scripts = 'vendor/eliza/packages/app/scripts/local-speech';
  const consumer = exists(root, 'vendor/eliza/packages/app/platforms/android/local-speech/consumer.gradle') ? read(root, 'vendor/eliza/packages/app/platforms/android/local-speech/consumer.gradle') : '';
  const sherpaVersion = consumer.match(/sherpa-onnx-([\d.]+)-no-espeak\.aar/)?.[1];
  if (!sherpaVersion) errors.push('Cannot determine the Sherpa-ONNX version from the pinned local-speech consumer.gradle');
  const ort = exists(root, `${scripts}/onnxruntime-provenance.json`) ? readJson(root, `${scripts}/onnxruntime-provenance.json`) : [];
  const ortVersions = [...new Set(ort.map(item => item.version))];
  if (ortVersions.length !== 1) errors.push('Cannot determine a single ONNX Runtime version from onnxruntime-provenance.json');
  const reference = exists(root, `${scripts}/reference-manifest.json`) ? readJson(root, `${scripts}/reference-manifest.json`) : [];
  const pinned = (referencePath, localPath) => {
    const item = reference.find(entry => entry.path === referencePath);
    const text = read(root, localPath);
    if (!item) errors.push(`${referencePath} is not pinned in ${scripts}/reference-manifest.json`);
    else if (sha256(Buffer.from(text)) !== item.sha256) errors.push(`${localPath} does not match the pinned ${referencePath} sha256`);
    return normalizeText(text);
  };
  const abis = manifest.qualifiedAbis.map(q => q.abi).join(', ');
  return [
    {name: 'Sherpa-ONNX (no-eSpeak Android build)', version: `${sherpaVersion} (AAR sha256 ${manifest.aarSha256}; ABIs ${abis})`, license: 'Apache-2.0',
      source: `https://github.com/k2-fsa/sherpa-onnx/tree/v${sherpaVersion}`, text: templates.apache},
    {name: 'ONNX Runtime', version: ortVersions.join(', '), license: 'MIT', source: `https://github.com/microsoft/onnxruntime/tree/v${ortVersions[0]}`,
      text: pinned('onnxruntime-LICENSE', 'licenses/onnxruntime-MIT.txt')},
    {name: 'OpenAI Whisper tiny.en speech recognition model (int8 ONNX conversion by k2-fsa)', version: 'sherpa-onnx-whisper-tiny.en', license: 'MIT',
      source: 'https://github.com/openai/whisper', text: pinned('whisper-LICENSE', 'licenses/whisper-MIT.txt')},
    {name: 'CMU Pronouncing Dictionary (speech lexicon)', version: '74790861f652b15e4ac49015a90074ad62a27690', license: 'BSD-2-Clause',
      source: 'https://github.com/cmusphinx/cmudict', text: pinned('cmudict-LICENSE', 'licenses/cmudict-BSD-2-Clause.txt')},
    {name: 'Piper LJSpeech medium voice model (int8)', version: 'rhasspy/piper-voices c10ece1aade47bb51c153c893d14e5bf8e5b7117', license: UNVERIFIED,
      source: 'https://huggingface.co/rhasspy/piper-voices/tree/c10ece1aade47bb51c153c893d14e5bf8e5b7117/en/en_US/ljspeech/medium',
      text: `Model card:\n${pinned('ljspeech-MODEL_CARD', 'licenses/piper-ljspeech-medium-MODEL_CARD.txt')}\n\nRepository README:\n${pinned('piper-voices-README.md', 'licenses/piper-voices-README.md')}`},
    {name: 'Sherpa-ONNX native build dependencies', version: `built with Sherpa-ONNX ${sherpaVersion}`, license: UNVERIFIED,
      source: `https://github.com/k2-fsa/sherpa-onnx/tree/v${sherpaVersion}/cmake`,
      text: 'The statically linked native dependencies are discovered during the reproducible speech build. Their license files are copied into the installed model bundle under local-speech/v1/notices/native/ and hash-pinned by its manifest; they are not enumerated in source.'},
  ];
}

/** In-browser speech (web build only; Android omits these assets and uses its native recognizer). */
export const BROWSER_SPEECH_CONFIG = 'config/browser-speech.json';
function browserSpeechEntries(root, templates, errors) {
  if (!exists(root, BROWSER_SPEECH_CONFIG)) return [];
  const config = readJson(root, BROWSER_SPEECH_CONFIG);
  const pinned = item => {
    if (!exists(root, item.path)) { errors.push(`${item.path}: missing`); return ''; }
    const bytes = fs.readFileSync(path.join(root, item.path));
    if (sha256(bytes) !== item.sha256) errors.push(`${item.path} does not match its sha256 in ${BROWSER_SPEECH_CONFIG}`);
    return normalizeText(bytes.toString('utf8'));
  };
  const files = config.files.map(file => `${file.path} (sha256 ${file.sha256})`).join('\n');
  return [
    {name: `OpenAI Whisper tiny.en speech recognition model (int8 ONNX conversion by ${config.source.repository}, web build)`, version: `${config.source.repository}@${config.source.revision}`,
      license: 'MIT AND Apache-2.0', source: `https://huggingface.co/${config.source.repository}/tree/${config.source.revision}\nFiles shipped under browser-speech/ in the web build:\n${files}`,
      text: `OpenAI Whisper (model weights and code):\n${normalizeText(read(root, 'licenses/whisper-MIT.txt'))}\n\nONNX conversion model card (declares apache-2.0):\n${pinned(config.source.modelCard)}\n\n${templates.apache}`},
    {name: 'ONNX Runtime Web WebAssembly (statically linked components)', version: `${config.runtime.package} ${config.runtime.version}`, license: UNVERIFIED,
      source: config.runtime.notices.source, text: pinned(config.runtime.notices)},
  ];
}

function payloadEntries() {
  return [
    {name: 'On-device elizaOS agent runtime payload', version: 'pinned upstream runtime when present in the APK payload', license: UNVERIFIED,
      source: 'scripts/stage-local-agent-runtime.mjs',
      text: 'The on-device agent payload (Bun runtime and the bundled elizaOS agent with its dependencies) is staged from pinned upstream source and may be included in standard Android builds. The APK runtime provenance identifies the packaged source. Its dependency notices are not generated here.'},
  ];
}

function mapDataEntries(root) {
  return [{name: 'OpenStreetMap data', version: 'regional extract served by the configured Maps endpoint', license: 'ODbL-1.0', source: 'https://www.openstreetmap.org/copyright',
    text: `Map data © OpenStreetMap contributors, available under the Open Database License (ODbL) 1.0. Map tiles, search and routes are produced from OpenStreetMap data by the configured Maps service; the Planetiler OpenMapTiles profile used to build tiles carries its own attribution metadata.\n\n${normalizeText(read(root, 'licenses/ODbL-1.0.txt'))}`}];
}

// ---------------------------------------------------------------- assembly

function applyAllowlist(root, entries, errors) {
  const allowlist = exists(root, ALLOWLIST) ? readJson(root, ALLOWLIST) : {entries: []};
  const used = new Set();
  for (const entry of entries) {
    if (entry.license !== UNVERIFIED) continue;
    const keys = entry._unverifiedKey || [];
    // File-backed entries (fonts) are allowlisted per exact file hash, so a swapped file is re-reviewed.
    const match = allowlist.entries.find(item => item.name === entry.name && (keys.length ? keys.includes(item.sha256) : !item.sha256));
    if (!match) { errors.push(`${entry.name} ${entry.version}: ${UNVERIFIED} and not in ${ALLOWLIST}`); continue; }
    if (typeof match.reason !== 'string' || match.reason.trim().length < 20) { errors.push(`${ALLOWLIST}: ${entry.name} needs a reason`); continue; }
    used.add(match);
    entry.text = `LICENSE UNVERIFIED. ${match.reason.trim()}\n\n${entry.text}`;
  }
  for (const item of allowlist.entries) if (!used.has(item)) errors.push(`${ALLOWLIST}: stale entry ${item.name}${item.sha256 ? ` (${item.sha256})` : ''}`);
}

export function collectNotices(root = ROOT) {
  const errors = [];
  const templates = {
    mit: normalizeText(read(root, 'licenses/MIT.txt')),
    isc: normalizeText(read(root, 'licenses/ISC.txt')),
    apache: normalizeText(read(root, 'licenses/Apache-2.0.txt')),
    ofl: normalizeText(read(root, 'licenses/OFL-1.1.txt')),
  };
  const entries = [
    ...npmEntries(root, templates, errors),
    ...pdfjsEntries(root, errors),
    ...ocrDataEntries(root),
    ...tesseractCoreEntries(root, errors),
    ...fontEntries(root, templates, errors),
    elizaEntry(root),
    ...androidEntries(root, templates, errors),
    ...speechEntries(root, templates, errors),
    ...browserSpeechEntries(root, templates, errors),
    ...payloadEntries(),
    ...mapDataEntries(root),
  ];
  for (const entry of entries) {
    const bad = unknownLicenseTerms(entry.license);
    if (bad.length) errors.push(`${entry.name}@${entry.version}: unknown license ${bad.join(', ')}`);
    if (!entry.text || !entry.text.trim()) errors.push(`${entry.name}@${entry.version}: empty notice text`);
  }
  applyAllowlist(root, entries, errors);
  const clean = entries.map(({name, version, license, source, text}) => ({name, version, license, source, text: normalizeText(text)}))
    .sort((a, b) => a.name.localeCompare(b.name, 'en') || a.version.localeCompare(b.version, 'en'));
  return {entries: clean, errors};
}

export function renderJson(entries) {
  return JSON.stringify(entries, null, 2) + '\n';
}

export function renderText(entries) {
  const unverified = entries.filter(entry => entry.license === UNVERIFIED);
  const header = [
    'Alpha Phone third-party notices',
    '',
    'This product includes the third-party software, fonts, models and data listed below.',
    'Generated by scripts/generate-licenses.mjs from package-lock.json, bundled font files,',
    'the resolved Android runtime classpath, the pinned speech runtime manifests and elizaOS.',
    `Entries: ${entries.length}. Entries marked "${UNVERIFIED}": ${unverified.length} (pending legal review).`,
  ].join('\n');
  const blocks = entries.map(entry => [
    '='.repeat(78),
    `${entry.name}`,
    `Version: ${entry.version.replace(/\n/g, '\n         ')}`,
    `License: ${entry.license}`,
    `Source: ${entry.source.replace(/\n/g, '\n        ')}`,
    '',
    entry.text,
  ].join('\n'));
  return `${header}\n\n${blocks.join('\n\n')}\n`;
}

export function generate(root = ROOT) {
  const {entries, errors} = collectNotices(root);
  return {entries, errors, json: renderJson(entries), text: renderText(entries)};
}

async function main(argv) {
  const check = argv.includes('--check');
  if (argv.includes('--refresh-android')) {
    const {androidEnv} = await import('./toolchain.mjs');
    const snapshot = refreshAndroidClasspath(ROOT, androidEnv());
    console.log(`Resolved ${snapshot.coordinates.length} Android runtime coordinates into ${ANDROID_CLASSPATH}`);
  }
  const {entries, errors, json, text} = generate(ROOT);
  if (errors.length) {
    console.error(`Third-party notice generation failed:\n- ${errors.join('\n- ')}`);
    process.exit(1);
  }
  const outputs = [[JSON_OUTPUT, json], [TEXT_OUTPUT, text]];
  if (check) {
    const stale = outputs.filter(([file, content]) => !exists(ROOT, file) || read(ROOT, file) !== content).map(([file]) => file);
    if (stale.length) {
      console.error(`Third-party notices are stale: ${stale.join(', ')}. Run node scripts/generate-licenses.mjs`);
      process.exit(1);
    }
    console.log(`Third-party notices are complete and current (${entries.length} entries).`);
    return;
  }
  fs.mkdirSync(path.join(ROOT, OUTPUT_DIR), {recursive: true});
  for (const [file, content] of outputs) fs.writeFileSync(path.join(ROOT, file), content);
  console.log(`Wrote ${entries.length} entries to ${JSON_OUTPUT} and ${TEXT_OUTPUT}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
