#!/usr/bin/env node
/**
 * Fail fast, before web sync and Gradle, when an Android build input is missing.
 *
 *   node scripts/android-build-preflight.mjs [--before-prepare] [--allow-unpackaged-runtime] [--test-mocks]
 *
 * build-android.mjs runs the full check. `--before-prepare` checks only inputs that
 * android:build:local does not produce (the pinned checkout and the speech AAR), so
 * that chain stops before the long runtime preparation instead of after it.
 */
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const SPEECH_AAR = 'android/local-speech/libs/sherpa-onnx-1.13.8-no-espeak.aar';
export const SPEECH_MANIFEST = 'android/local-speech/runtime-manifest.json';
const FULL_CHAIN = 'npm run android:build:local';
const SPEECH_GUIDE = 'scripts/local-speech/README.md';

const sha256 = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function readHead(directory) {
  try {
    return execFileSync('git', ['-C', directory, 'rev-parse', 'HEAD'], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim();
  } catch {
    return null;
  }
}

/** Inputs no preparation step produces: the pinned checkout and the speech AAR. */
export function checkoutProblems(root) {
  const problems = [];
  const pin = JSON.parse(fs.readFileSync(path.join(root, 'upstream.lock.json'), 'utf8')).commit;
  const head = readHead(path.join(root, 'vendor/eliza'));
  if (head !== pin)
    problems.push(`vendor/eliza is ${head ? `at ${head}` : 'not checked out'}; upstream.lock.json pins ${pin}. Run: git submodule update --init vendor/eliza`);
  const aar = path.join(root, SPEECH_AAR);
  if (!fs.existsSync(aar)) {
    problems.push(`Speech runtime ${SPEECH_AAR} is missing (Gradle :local-speech:preBuild needs it). Build and install it with the commands in ${SPEECH_GUIDE}.`);
  } else {
    const approved = JSON.parse(fs.readFileSync(path.join(root, SPEECH_MANIFEST), 'utf8')).aarSha256;
    if (sha256(aar) !== approved)
      problems.push(`Speech runtime ${SPEECH_AAR} does not match ${SPEECH_MANIFEST} (Gradle :local-speech:preBuild rejects it). Rebuild and install it with the commands in ${SPEECH_GUIDE}.`);
  }
  return problems;
}

/**
 * Prepared runtime inputs. `preparedSource` is the resolved prepared runtime
 * directory (sourceDirectory()). Distribution builds also need the staged runtime.
 */
export function preparedRuntimeProblems(root, preparedSource, {allowUnpackagedRuntime = false, testMocks = false} = {}) {
  const stamp = path.join(preparedSource, '.alpha-runtime-source.json');
  if (!fs.existsSync(stamp))
    return [`Prepared runtime source ${path.relative(root, preparedSource)} is missing (Gradle :app:stageLocalAgentSources reads it). Run: ${FULL_CHAIN} for distributable APKs, or npm run agent:prepare before npm run android:build -- --allow-unpackaged-runtime for developer APKs.`];
  if (allowUnpackagedRuntime || testMocks) return [];
  const staged = path.join(root, 'android/app/src/main/assets/agent/alpha-source.json');
  const worker = path.join(root, 'android/app/src/main/assets/agent/workflow-worker/manifest.json');
  if (!fs.existsSync(staged) || !fs.existsSync(worker))
    return [`The resident runtime is not staged, so release APKs would not be distributable. Run: npm run agent:build-workflow-worker && npm run agent:stage-android (or ${FULL_CHAIN}), or pass -- --allow-unpackaged-runtime for non-distributable developer APKs.`];
  if (fs.readFileSync(staged, 'utf8') !== fs.readFileSync(stamp, 'utf8'))
    return [`The staged resident runtime was built from a different prepared source than ${path.relative(root, preparedSource)}. Run: npm run agent:build-workflow-worker && npm run agent:stage-android (or ${FULL_CHAIN}).`];
  return [];
}

export function formatProblems(problems) {
  return `Android build prerequisites are missing:\n${problems.map(problem => `  - ${problem}`).join('\n')}`;
}

async function main() {
  const args = process.argv.slice(2);
  for (const arg of args)
    if (!['--before-prepare', '--allow-unpackaged-runtime', '--test-mocks'].includes(arg)) throw new Error(`Unknown option ${arg}`);
  const root = path.resolve(import.meta.dirname, '..');
  let problems = checkoutProblems(root);
  if (!problems.length && !args.includes('--before-prepare')) {
    // The source guard imports the pinned checkout, so load it only once that is verified.
    const {sourceDirectory} = await import('./local-agent-source.mjs');
    problems = preparedRuntimeProblems(root, sourceDirectory(root), {
      allowUnpackagedRuntime: args.includes('--allow-unpackaged-runtime'),
      testMocks: args.includes('--test-mocks'),
    });
  }
  if (problems.length) {
    console.error(formatProblems(problems));
    process.exit(2);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
