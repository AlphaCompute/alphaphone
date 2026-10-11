#!/usr/bin/env node
/**
 * Release SBOM: a CycloneDX 1.6 JSON inventory of what the product ships, built offline and
 * deterministically from committed pins (no timestamp; the serial number is derived from content).
 *
 *   node scripts/generate-sbom.mjs                 # writes artifacts/sbom/alphaphone.cdx.json
 *   node scripts/generate-sbom.mjs --out <file>
 *   node scripts/generate-sbom.mjs --stdout
 *
 * Sources, and the hash each one can prove:
 *   - package-lock.json production packages: registry tarball SHA-512 (lock integrity).
 *   - apps/app/public font files: SHA-256 of the committed bytes.
 *   - licenses/tesseract-core/sources.json: SHA-256 of the shipped OCR WebAssembly cores.
 *   - config/browser-speech.json: SHA-256 of the web build's speech model and ONNX Runtime files.
 *   - licenses/android-runtime-classpath.json: resolved Gradle runtime coordinates. Gradle is not
 *     run here and the repository has no dependency verification metadata, so these carry NO hash.
 *   - android/local-speech/runtime-manifest.json and the pinned upstream local-speech manifests:
 *     SHA-256 of the speech AAR, its native libraries per ABI, and the acquired model inputs.
 *   - upstream.lock.json: the pinned elizaOS commit.
 * Licences (decision P-09): every component carries `alphaphone:licence-expression` (the declared
 * expression, or "not recorded in this inventory") and `alphaphone:licence-flags` (the flags of
 * scripts/licence-policy.mjs, or "none"). Flags are a record, never a failure of this script.
 * Not covered: the staged resident runtime payload (Bun, bundled agent packages, PGlite), which
 * exists only after `npm run agent:stage-android`; scripts/verify-packaged-runtime.py and
 * `generate-licenses.mjs --packaged-runtime` cover it for a concrete APK. This is a source-pin
 * inventory, not a scan of APK bytes.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {ANDROID_CLASSPATH, BROWSER_SPEECH_CONFIG, COMMERCIAL_FONT, FONT_LICENSES, HELD_OUTSIDE_REPOSITORY, KNOWN_LICENSES, MAVEN_FAMILIES, NO_FONT_LICENCE, ROOT, TESSERACT_CORE_SOURCES, UNKNOWN, UNVERIFIED, collectNotices, fontLicense, fontNames, productionLockPackages} from './generate-licenses.mjs';
import {classifyLicence, flagSummary} from './licence-policy.mjs';

export const LICENCE_NOT_RECORDED = 'not recorded in this inventory';

export const DEFAULT_OUTPUT = 'artifacts/sbom/alphaphone.cdx.json';
const SPEECH_RUNTIME = 'android/local-speech/runtime-manifest.json';
const UPSTREAM_SPEECH = 'vendor/eliza/packages/app/scripts/local-speech';
const NOT_COVERED = 'Staged resident runtime payload (Bun, bundled agent and workflow-worker packages, PGlite, musl loader): present only after agent:stage-android; verified per APK by scripts/verify-packaged-runtime.py.';

const sha256 = data => createHash('sha256').update(data).digest('hex');
const exists = (root, rel) => fs.existsSync(path.join(root, rel));
const readJson = (root, rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const property = (name, value) => ({name: `alphaphone:${name}`, value: String(value)});

function licenses(expression) {
  if (!expression) return undefined;
  if ([UNVERIFIED, NO_FONT_LICENCE, UNKNOWN, COMMERCIAL_FONT].includes(expression)) return [{license: {name: expression}}];
  if (KNOWN_LICENSES.has(expression) && !/\s/.test(expression)) return [{license: {id: expression}}];
  return [{expression}];
}

/** npm lock integrity ("sha512-<base64>") as a CycloneDX hash. */
export function integrityHash(integrity) {
  const match = /^(sha1|sha256|sha384|sha512)-([A-Za-z0-9+/=]+)$/.exec(integrity || '');
  if (!match) return null;
  return {alg: {sha1: 'SHA-1', sha256: 'SHA-256', sha384: 'SHA-384', sha512: 'SHA-512'}[match[1]], content: Buffer.from(match[2], 'base64').toString('hex')};
}

function npmComponents(root, lock) {
  return productionLockPackages(lock, root).map(pkg => {
    const meta = lock.packages[pkg.key];
    const hash = integrityHash(meta.integrity);
    if (!hash) throw new Error(`${pkg.key}: package-lock.json records no integrity hash`);
    const purl = `pkg:npm/${pkg.name.startsWith('@') ? `%40${pkg.name.slice(1)}` : pkg.name}@${pkg.version}`;
    return {type: 'library', 'bom-ref': `${purl}#${pkg.key}`, name: pkg.name, version: pkg.version, purl, hashes: [hash], licenses: licenses(pkg.license),
      properties: [property('ships-in', 'web,apk'), property('source', `package-lock.json ${pkg.key}`)]};
  });
}

function fontFiles(root, rel = 'apps/app/public', out = []) {
  for (const entry of fs.readdirSync(path.join(root, rel), {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name))) {
    const child = path.posix.join(rel, entry.name);
    if (entry.isDirectory()) { if (entry.name !== 'licenses') fontFiles(root, child, out); } else if (/\.(woff2|ttf|otf)$/i.test(entry.name)) out.push(child);
  }
  return out;
}

function fontComponents(root) {
  const records = exists(root, FONT_LICENSES) ? readJson(root, FONT_LICENSES).entries : [];
  return fontFiles(root).map(rel => {
    const bytes = fs.readFileSync(path.join(root, rel));
    const names = fontNames(bytes);
    const digest = sha256(bytes);
    const stated = fontLicense(names);
    // A font whose own metadata names no open licence is proprietary: recorded (LicenseRef-Commercial-Font) or not.
    const record = stated === NO_FONT_LICENCE ? records.find(item => item.name === `${names.family} typeface` && item.sha256?.includes(digest) && item.license === COMMERCIAL_FONT) : null;
    return {type: 'file', 'bom-ref': `font:${rel}`, name: `${names.family} typeface (${names.fullName || path.basename(rel)})`, version: names.version.replace(/^Version\s+/i, ''),
      hashes: [{alg: 'SHA-256', content: digest}], licenses: licenses(record ? COMMERCIAL_FONT : stated), copyright: names.copyright || undefined,
      properties: [property('ships-in', 'web,apk'), property('path', rel.replace(/^apps\/app\/public\//, '')), property('source', rel),
        ...(stated === NO_FONT_LICENCE ? [property('open-source', false), property('licence-evidence', !record ? `none recorded in ${FONT_LICENSES}`
          : record.evidence === HELD_OUTSIDE_REPOSITORY ? `${HELD_OUTSIDE_REPOSITORY}: owner statement recorded in ${FONT_LICENSES}; the licence document is not in this repository` : `recorded in ${FONT_LICENSES}`)] : [])]};
  });
}

function ocrComponents(root) {
  const pinned = readJson(root, TESSERACT_CORE_SOURCES);
  return Object.entries(pinned.cores).sort(([a], [b]) => a.localeCompare(b)).map(([file, digest]) => ({
    type: 'file', 'bom-ref': `ocr-core:${file}`, name: `${pinned.package} ${file}`, version: pinned.version, hashes: [{alg: 'SHA-256', content: digest}],
    licenses: licenses([...new Set(pinned.components.map(component => component.license))].map(item => /\s/.test(item) ? `(${item})` : item).join(' AND ')),
    properties: [property('ships-in', 'web,apk'), property('source', TESSERACT_CORE_SOURCES),
      property('statically-linked', pinned.components.map(component => `${component.name} ${component.version} (${component.license})`).join('; '))],
  }));
}

function browserSpeechComponents(root) {
  const config = readJson(root, BROWSER_SPEECH_CONFIG);
  const model = config.files.map(file => ({
    type: file.role === 'encoder' || file.role === 'decoder' ? 'machine-learning-model' : 'data', 'bom-ref': `browser-speech:${file.path}`,
    name: `${config.source.repository} ${file.path}`, version: config.source.revision, hashes: [{alg: 'SHA-256', content: file.sha256}], licenses: licenses('MIT'),
    properties: [property('ships-in', 'web'), property('bytes', file.bytes), property('source', `${BROWSER_SPEECH_CONFIG} (${config.source.url}${file.path})`)],
  }));
  const runtime = config.runtime.files.map(file => ({
    type: 'file', 'bom-ref': `browser-speech-runtime:${file.path}`, name: `${config.runtime.package} ${file.path}`, version: config.runtime.version,
    hashes: [{alg: 'SHA-256', content: file.sha256}], licenses: licenses('MIT'),
    properties: [property('ships-in', 'web'), property('bytes', file.bytes), property('source', BROWSER_SPEECH_CONFIG)],
  }));
  return [...model, ...runtime];
}

function gradleComponents(root) {
  const snapshot = readJson(root, ANDROID_CLASSPATH);
  return snapshot.coordinates.map(coordinate => {
    const [group, artifact, version] = coordinate.split(':');
    if (!group || !artifact || !version) throw new Error(`${ANDROID_CLASSPATH}: malformed coordinate ${coordinate}`);
    const purl = `pkg:maven/${group}/${artifact}@${version}`;
    const family = MAVEN_FAMILIES.find(item => item.exact ? group === item.prefix : group.startsWith(item.prefix));
    return {type: 'library', 'bom-ref': purl, group, name: artifact, version, purl, licenses: licenses(family ? family.license : UNKNOWN),
      properties: [property('ships-in', 'apk'), property('hash', 'not recorded: Gradle dependency verification metadata is not enabled'),
        property('source', `${ANDROID_CLASSPATH} (${snapshot.configurations.join(', ')}; input fingerprint ${snapshot.inputFingerprint})`)]};
  });
}

function speechComponents(root) {
  if (!exists(root, SPEECH_RUNTIME)) return [];
  const manifest = readJson(root, SPEECH_RUNTIME);
  const consumer = exists(root, 'vendor/eliza/packages/app/platforms/android/local-speech/consumer.gradle')
    ? fs.readFileSync(path.join(root, 'vendor/eliza/packages/app/platforms/android/local-speech/consumer.gradle'), 'utf8') : '';
  const sherpa = consumer.match(/sherpa-onnx-([\d.]+)-no-espeak\.aar/)?.[1] ?? 'unknown';
  const ort = exists(root, `${UPSTREAM_SPEECH}/onnxruntime-provenance.json`) ? readJson(root, `${UPSTREAM_SPEECH}/onnxruntime-provenance.json`) : [];
  const out = [{
    type: 'library', 'bom-ref': 'speech:sherpa-onnx-no-espeak.aar', name: 'Sherpa-ONNX (no-eSpeak Android build)', version: sherpa,
    hashes: [{alg: 'SHA-256', content: manifest.aarSha256}], licenses: licenses('Apache-2.0'),
    properties: [property('ships-in', 'apk'), property('source', SPEECH_RUNTIME), property('no-espeak', manifest.noEspeak === true)],
  }];
  for (const abi of manifest.qualifiedAbis)
    for (const native of abi.native) {
      const runtime = ort.find(item => item.sha256 === native.sha256);
      out.push({
        type: 'library', 'bom-ref': `speech-native:${abi.abi}/${native.file}`, name: `${native.file} (${abi.abi})`, version: runtime ? `ONNX Runtime ${runtime.version}` : `Sherpa-ONNX ${sherpa}`,
        hashes: [{alg: 'SHA-256', content: native.sha256}], licenses: licenses(runtime ? runtime.license : 'Apache-2.0'),
        properties: [property('ships-in', 'apk'), property('abi', abi.abi), property('bytes', native.bytes), property('source', SPEECH_RUNTIME),
          ...(runtime ? [property('origin', runtime.origin)] : [property('source-archive-sha256', abi.sourceArchiveSha256), property('patch-sha256', abi.patchSha256)])],
      });
    }
  const downloads = exists(root, `${UPSTREAM_SPEECH}/download-manifest.json`) ? readJson(root, `${UPSTREAM_SPEECH}/download-manifest.json`) : [];
  for (const item of downloads) {
    const digest = item.observedSha256 || /^sha256:([0-9a-f]{64})$/.exec(item.digest || '')?.[1];
    if (!digest) throw new Error(`${UPSTREAM_SPEECH}/download-manifest.json: ${item.name} has no SHA-256`);
    out.push({
      type: /\.aar$/.test(item.name) ? 'library' : 'machine-learning-model', 'bom-ref': `speech-input:${item.name}`, name: item.name, hashes: [{alg: 'SHA-256', content: digest}],
      externalReferences: [{type: 'distribution', url: item.browser_download_url}],
      properties: [property('ships-in', item.archiveDistributed === false ? 'build-input (archive not distributed; see role)' : 'apk'), property('bytes', item.size), property('role', item.distributionRole ?? 'speech build input'),
        property('source', `${UPSTREAM_SPEECH}/download-manifest.json`)],
    });
  }
  const reference = exists(root, `${UPSTREAM_SPEECH}/reference-manifest.json`) ? readJson(root, `${UPSTREAM_SPEECH}/reference-manifest.json`) : [];
  for (const item of reference.filter(entry => !entry.path.startsWith('onnxruntime-headers/') && !/LICENSE|MODEL_CARD|README/.test(entry.path)))
    out.push({
      type: 'data', 'bom-ref': `speech-reference:${item.path}`, name: item.path, hashes: [{alg: 'SHA-256', content: item.sha256}],
      externalReferences: [{type: 'distribution', url: item.url}],
      properties: [property('ships-in', 'build-input'), property('bytes', item.bytes), property('source', `${UPSTREAM_SPEECH}/reference-manifest.json`)],
    });
  return out;
}

function upstreamComponent(root) {
  const lock = readJson(root, 'upstream.lock.json');
  const repository = lock.url.replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '');
  return {type: 'framework', 'bom-ref': `pkg:github/${repository}@${lock.commit}`, name: 'elizaOS', version: lock.commit, purl: `pkg:github/${repository}@${lock.commit}`,
    hashes: [{alg: 'SHA-1', content: lock.commit}], licenses: licenses('MIT'),
    properties: [property('ships-in', 'web,apk'), property('source', 'upstream.lock.json (git commit; vendor/eliza submodule)')]};
}

const expressionOf = component => {
  const item = component.licenses?.[0];
  return item?.expression ?? item?.license?.id ?? item?.license?.name ?? LICENCE_NOT_RECORDED;
};

/**
 * Add the licence expression and flags to every component. npm packages and fonts take the flags
 * of their notice entry (which also knows when a package ships no licence file); everything else
 * is classified from its expression. A component with no recorded licence is flagged unverified.
 */
function withLicenceFlags(root, components) {
  const notices = new Map(collectNotices(root, {packagedRuntime: false}).entries.map(entry => [`${entry.name}@${entry.version}`, entry.flags]));
  const order = flags => flagSummary([{flags}]).map(group => group.flag);
  return components.map(component => {
    const expression = expressionOf(component);
    const key = component['bom-ref'].startsWith('font:') ? `${component.name.replace(/ \(.*\)$/, '')}@${component.version}` : `${component.name}@${component.version}`;
    const flags = order([...(notices.get(key) ?? []), ...(expression === LICENCE_NOT_RECORDED ? ['unverified'] : classifyLicence(expression).flags)]);
    return {...component, properties: [...component.properties, property('licence-expression', expression), property('licence-flags', flags.join(',') || 'none')]};
  });
}

const strip = value => Array.isArray(value) ? value.map(strip)
  : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, strip(item)])) : value;

export function buildSbom(root = ROOT) {
  const pkg = readJson(root, 'package.json');
  const lockText = fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8');
  const lock = JSON.parse(lockText);
  const components = strip(withLicenceFlags(root, [
    ...npmComponents(root, lock), ...fontComponents(root), ...ocrComponents(root), ...browserSpeechComponents(root),
    ...gradleComponents(root), ...speechComponents(root), upstreamComponent(root),
  ])).sort((a, b) => a['bom-ref'].localeCompare(b['bom-ref']));
  const refs = new Set();
  for (const component of components) {
    if (refs.has(component['bom-ref'])) throw new Error(`Duplicate SBOM component ${component['bom-ref']}`);
    refs.add(component['bom-ref']);
  }
  const identity = readJson(root, 'app.config.json');
  const digest = sha256(JSON.stringify(components));
  // Content-derived, so the same inputs always produce the same document.
  const serial = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
  return {
    bomFormat: 'CycloneDX', specVersion: '1.6', serialNumber: `urn:uuid:${serial}`, version: 1,
    metadata: {
      component: {type: 'application', 'bom-ref': 'alphaphone', name: pkg.name, version: pkg.version},
      tools: {components: [{type: 'application', name: 'scripts/generate-sbom.mjs'}]},
      properties: [
        property('evidence', 'source-pin inventory; not a scan of built APK or web bundle bytes'),
        property('package-lock-sha256', sha256(lockText)),
        property('android-application-id', identity.appId ?? identity.applicationId ?? 'see app.config.json'),
        property('not-covered', NOT_COVERED),
      ],
    },
    components,
  };
}

export const renderSbom = sbom => `${JSON.stringify(sbom, null, 2)}\n`;

function main(argv) {
  const out = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : DEFAULT_OUTPUT;
  const unknown = argv.filter((arg, index) => arg.startsWith('--') ? !['--out', '--stdout'].includes(arg) : argv[index - 1] !== '--out');
  if (unknown.length || !out) { console.error('Usage: node scripts/generate-sbom.mjs [--out <file> | --stdout]'); return 2; }
  const sbom = buildSbom(ROOT);
  const text = renderSbom(sbom);
  if (argv.includes('--stdout')) { process.stdout.write(text); return 0; }
  fs.mkdirSync(path.dirname(path.resolve(out)), {recursive: true});
  fs.writeFileSync(out, text);
  const hashed = sbom.components.filter(component => component.hashes?.length).length;
  console.log(`Wrote ${out}: ${sbom.components.length} components, ${hashed} with hashes, ${sbom.components.length - hashed} without (Gradle coordinates). sha256 ${sha256(text)}`);
  // Licence flags are warnings (decision P-09): printed, recorded per component, exit 0.
  for (const component of sbom.components) {
    const value = name => component.properties.find(item => item.name === `alphaphone:${name}`)?.value;
    if (value('licence-flags') !== 'none') for (const flag of value('licence-flags').split(',')) console.warn(`LICENCE FLAG ${flag}: ${component.name}@${component.version ?? 'unversioned'} (${value('licence-expression')})`);
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
