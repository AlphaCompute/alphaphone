#!/usr/bin/env node
/**
 * Gradle dependency verification metadata (android/gradle/verification-metadata.xml).
 *
 *   node scripts/gradle-verification.mjs --check                 # offline; also run by `npm test`
 *   node scripts/gradle-verification.mjs --write [--allow-unpackaged-runtime]
 *                                                                # npm run android:deps:write-verification
 *
 * While the file exists Gradle refuses any plugin or dependency artifact whose SHA-256 is not
 * listed in it, in every build of the android/ project: nothing has to opt in and no build step
 * is added. `--check` reads the committed file only. `--write` is the one command that uses the
 * network: it runs the real build tasks with `--write-verification-metadata sha256` (Gradle adds
 * what they resolve and never removes an entry), then records the Linux and Windows builds of
 * aapt2, which a macOS build never resolves, from Google's Maven repository. Review the diff
 * before committing it: a new entry is a new trusted artifact.
 */
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const METADATA = 'android/gradle/verification-metadata.xml';
export const CLASSPATH = 'licenses/android-runtime-classpath.json';
/** Every task a script or workflow runs on the android/ Gradle project. */
export const VERIFIED_TASKS = [
  ':app:assembleStandaloneDebug', ':app:assembleLauncherDebug', ':app:assembleStandaloneRelease', ':app:assembleLauncherRelease',
  ':app:assembleStandaloneDebugAndroidTest', ':app:assembleLauncherDebugAndroidTest', ':app:lint',
  ':notification-fixture:assembleSelectedDebug', ':notification-fixture:assembleExcludedDebug', ':notification-fixture:lint',
];
/** Repositories the Gradle build may resolve from (android/settings.gradle and build.gradle). */
export const ALLOWED_REPOSITORIES = ['google()', 'mavenCentral()', 'gradlePluginPortal()'];
/**
 * Publisher groups reviewed for this build, with the date and what was looked at. A component in
 * another group fails --check until someone looks at where it comes from and adds the group.
 */
export const REVIEWED_GROUPS = 'android/gradle/verification-reviewed-groups.json';
const AAPT2_HOSTS = ['linux', 'osx', 'windows'];
const GOOGLE_MAVEN = 'https://dl.google.com/dl/android/maven2';
const AAPT2_ORIGIN = 'Fetched from dl.google.com/dl/android/maven2 by scripts/gradle-verification.mjs';

const attribute = (tag, name) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1];

/** Parse the metadata into {configuration, components[]}; throws on a shape this reader does not know. */
export function parseVerificationMetadata(text) {
  const configuration = {
    verifyMetadata: /<verify-metadata>\s*(true|false)\s*<\/verify-metadata>/.exec(text)?.[1] ?? null,
    verifySignatures: /<verify-signatures>\s*(true|false)\s*<\/verify-signatures>/.exec(text)?.[1] ?? null,
    trusted: /<trusted-artifacts>|<trusted-keys>|<ignored-keys>|<key-servers/.test(text),
  };
  const components = [];
  for (const match of text.matchAll(/<component\b([^>]*)>([\s\S]*?)<\/component>/g)) {
    const component = {group: attribute(match[1], 'group'), name: attribute(match[1], 'name'), version: attribute(match[1], 'version'), artifacts: []};
    if (!component.group || !component.name || !component.version) throw new Error(`Malformed component: ${match[1].trim()}`);
    for (const artifact of match[2].matchAll(/<artifact\b([^>]*)>([\s\S]*?)<\/artifact>/g)) {
      const hashes = [...artifact[2].matchAll(/<(md5|sha1|sha256|sha512|pgp)\b([^>]*)\/>/g)].map(hash => ({algorithm: hash[1], value: attribute(hash[2], 'value'), origin: attribute(hash[2], 'origin') ?? null}));
      component.artifacts.push({name: attribute(artifact[1], 'name'), hashes});
    }
    components.push(component);
  }
  return {configuration, components};
}

/**
 * The pinned checksum of a coordinate: its archive (.aar or .jar) when it has one, otherwise the
 * metadata file Gradle resolved for it (a Kotlin multiplatform root module or a BOM publishes no
 * archive of its own). Returns {sha256, artifact, archive} or null when nothing is recorded.
 */
export function coordinateChecksum(metadata, group, name, version) {
  const component = metadata.components.find(item => item.group === group && item.name === name && item.version === version);
  for (const extension of ['aar', 'jar', 'module', 'pom']) {
    const artifact = `${name}-${version}.${extension}`;
    const hash = component?.artifacts.find(item => item.name === artifact)?.hashes.find(item => item.algorithm === 'sha256');
    if (hash) return {sha256: hash.value, artifact, archive: extension === 'aar' || extension === 'jar'};
  }
  return null;
}

/** Repository declarations in a Gradle script, e.g. ['google()', 'mavenCentral()']. */
export function declaredRepositories(text) {
  const found = [];
  for (const block of text.matchAll(/repositories\s*\{([^}]*)\}/g))
    for (const entry of block[1].split(/[;\n]/).map(item => item.trim()).filter(Boolean)) found.push(entry);
  return found;
}

export function checkVerification(root) {
  const problems = [];
  const file = path.join(root, METADATA);
  if (!fs.existsSync(file)) return {problems: [`${METADATA} is missing: Gradle dependency verification is off. Run: npm run android:deps:write-verification`], metadata: null};
  const metadata = parseVerificationMetadata(fs.readFileSync(file, 'utf8'));
  if (metadata.configuration.verifyMetadata !== 'true') problems.push('verify-metadata must be true (POM and module files are verified too)');
  if (metadata.configuration.verifySignatures !== 'false') problems.push('verify-signatures must be false: this build pins SHA-256 checksums and trusts no key server');
  if (metadata.configuration.trusted) problems.push('trusted-artifacts, trusted-keys, ignored-keys and key-servers are not used: every artifact is pinned by checksum');
  if (!metadata.components.length) problems.push('no components are recorded');
  const reviewed = new Set(JSON.parse(fs.readFileSync(path.join(root, REVIEWED_GROUPS), 'utf8')).groups);
  const seen = new Set();
  for (const component of metadata.components) {
    const id = `${component.group}:${component.name}:${component.version}`;
    if (seen.has(id)) problems.push(`${id} is listed twice`);
    seen.add(id);
    if (!reviewed.has(component.group)) problems.push(`${id}: publisher group ${component.group} has not been reviewed (${REVIEWED_GROUPS})`);
    if (!component.artifacts.length) problems.push(`${id} lists no artifact`);
    for (const artifact of component.artifacts) {
      const sha = artifact.hashes.filter(hash => hash.algorithm === 'sha256');
      if (artifact.hashes.length !== sha.length || sha.length < 1 || sha.some(hash => !/^[0-9a-f]{64}$/.test(hash.value ?? '')))
        problems.push(`${id} ${artifact.name}: exactly SHA-256 checksums are expected`);
      if (sha.some(hash => hash.origin !== 'Generated by Gradle' && hash.origin !== AAPT2_ORIGIN)) problems.push(`${id} ${artifact.name}: unexpected checksum origin ${sha.map(hash => hash.origin).join(', ')}`);
    }
  }
  // What ships: every coordinate of the four runtime classpaths is pinned.
  const classpath = JSON.parse(fs.readFileSync(path.join(root, CLASSPATH), 'utf8'));
  for (const coordinate of classpath.coordinates) {
    const [group, name, version] = coordinate.split(':');
    if (!coordinateChecksum(metadata, group, name, version)) problems.push(`${coordinate} ships in the APKs (${CLASSPATH}) but has no SHA-256 in ${METADATA}`);
  }
  // aapt2 is the one host-specific artifact: a macOS-only record would break Linux CI builds.
  for (const component of metadata.components.filter(item => item.group === 'com.android.tools.build' && item.name === 'aapt2'))
    for (const host of AAPT2_HOSTS)
      if (!component.artifacts.some(artifact => artifact.name === `aapt2-${component.version}-${host}.jar`)) problems.push(`aapt2 ${component.version} has no ${host} archive recorded`);
  if (!metadata.components.some(item => item.group === 'com.android.tools.build' && item.name === 'aapt2')) problems.push('aapt2 is not recorded: the metadata was not generated from a real build');
  for (const script of ['android/settings.gradle', 'android/build.gradle'])
    for (const repository of declaredRepositories(fs.readFileSync(path.join(root, script), 'utf8')))
      if (!ALLOWED_REPOSITORIES.includes(repository)) problems.push(`${script} declares repository ${repository}; only ${ALLOWED_REPOSITORIES.join(', ')} are reviewed`);
  return {problems, metadata};
}

/** Insert an artifact into a component block, keeping artifacts sorted by name. Returns the new text. */
export function addArtifact(text, {group, name, version}, artifactName, sha256, origin) {
  const open = `<component group="${group}" name="${name}" version="${version}">`;
  const start = text.indexOf(open);
  if (start < 0) throw new Error(`${group}:${name}:${version} is not in the metadata`);
  const end = text.indexOf('</component>', start);
  const block = text.slice(start, end);
  if (block.includes(`<artifact name="${artifactName}">`)) return text;
  const indent = /\n(\s*)<artifact /.exec(block)?.[1] ?? '         ';
  const entry = `${indent}<artifact name="${artifactName}">\n${indent}   <sha256 value="${sha256}" origin="${origin}"/>\n${indent}</artifact>\n`;
  const artifacts = [...block.matchAll(/\n(\s*<artifact name="([^"]+)">[\s\S]*?<\/artifact>)/g)];
  const after = artifacts.find(item => item[2].localeCompare(artifactName) > 0);
  const at = after ? start + after.index + 1 : end - (/\n\s*$/.exec(block)?.[0].length ?? 0) + 1;
  return text.slice(0, at) + entry + text.slice(at);
}

async function recordOtherHostAapt2(root) {
  const file = path.join(root, METADATA);
  let text = fs.readFileSync(file, 'utf8');
  for (const component of parseVerificationMetadata(text).components.filter(item => item.group === 'com.android.tools.build' && item.name === 'aapt2'))
    for (const host of AAPT2_HOSTS) {
      const artifact = `aapt2-${component.version}-${host}.jar`;
      if (component.artifacts.some(item => item.name === artifact)) continue;
      const url = `${GOOGLE_MAVEN}/com/android/tools/build/aapt2/${component.version}/${artifact}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
      const digest = createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');
      text = addArtifact(text, component, artifact, digest, AAPT2_ORIGIN);
      console.log(`Recorded ${artifact} sha256 ${digest} from ${url}`);
    }
  fs.writeFileSync(file, text);
}

async function write(root, {allowUnpackagedRuntime}) {
  const {androidEnv} = await import('./toolchain.mjs');
  const env = {...androidEnv()};
  for (const name of ['ELIZA_DEV_ALLOW_TEST_MOCKS', 'VITE_ELIZA_DEV_ALLOW_TEST_MOCKS', 'ORG_GRADLE_PROJECT_ELIZA_DEV_ALLOW_TEST_MOCKS']) delete env[name];
  const preflight = [path.join(root, 'scripts/android-build-preflight.mjs'), ...(allowUnpackagedRuntime ? ['--allow-unpackaged-runtime'] : [])];
  execFileSync(process.execPath, preflight, {cwd: root, stdio: 'inherit', env});
  execFileSync('npm', ['run', 'android:sync'], {cwd: root, stdio: 'inherit', env});
  // The fixture's lint needs a signing input only to configure; a throwaway path is enough to resolve dependencies.
  execFileSync('./gradlew', ['--no-daemon', '--write-verification-metadata', 'sha256', '-PELIZA_DEV_ALLOW_TEST_MOCKS=0',
    `-PELIZA_ALLOW_UNPACKAGED_RUNTIME=${allowUnpackagedRuntime ? '1' : '0'}`, ...VERIFIED_TASKS], {cwd: path.join(root, 'android'), stdio: 'inherit', env});
  await recordOtherHostAapt2(root);
  const {problems} = checkVerification(root);
  if (problems.length) throw new Error(`Written metadata does not pass --check:\n${problems.map(item => `  - ${item}`).join('\n')}`);
  console.log(`Wrote ${METADATA}. Review the diff before committing: every new entry is a newly trusted artifact.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const root = path.resolve(import.meta.dirname, '..');
  const mode = args.filter(arg => ['--check', '--write'].includes(arg));
  if (mode.length !== 1 || args.some(arg => !['--check', '--write', '--allow-unpackaged-runtime'].includes(arg))) {
    console.error('Usage: node scripts/gradle-verification.mjs --check | --write [--allow-unpackaged-runtime]');
    process.exit(2);
  }
  if (mode[0] === '--write') await write(root, {allowUnpackagedRuntime: args.includes('--allow-unpackaged-runtime')});
  else {
    const {problems, metadata} = checkVerification(root);
    if (problems.length) { console.error(`Gradle dependency verification problems:\n${problems.map(item => `  - ${item}`).join('\n')}`); process.exit(1); }
    console.log(`${METADATA}: ${metadata.components.length} components, ${metadata.components.reduce((sum, item) => sum + item.artifacts.length, 0)} artifacts, all SHA-256.`);
  }
}
