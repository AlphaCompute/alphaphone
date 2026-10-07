import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const referenceOnly = path => /^(docs\/|design\/)/.test(path) || /^(README\.md|AGENTS\.md|LICENSE|LICENSE\.md)$/.test(path);

// Unknown paths run everything. Only explicitly non-executable reference data is ignored.
export function affected(paths) {
  const result = { verify: false, browser: false, android: false, prepare: false };
  for (const path of paths) {
    if (referenceOnly(path)) continue;
    result.verify = true;
    if (/^test\/browser\//.test(path) || path === 'playwright.config.ts' || path === 'scripts/storage-specs.mjs') {
      result.browser = true;
    } else if (/^test\//.test(path)) {
      // Host contract tests run in verify, not in an emulator.
    } else if (path === '.github/workflows/browser.yml') {
      result.browser = true;
    } else if (path === '.github/workflows/android.yml') {
      result.android = true;
    } else if (path === '.github/workflows/resident-prepare.yml') {
      result.prepare = true;
    } else if (/^\.github\/workflows\/(resident-android|bun-spawn-seccomp)\.yml$/.test(path)) {
      // These explicit qualification/diagnostic workflows have no automatic jobs.
    } else if (/^android\//.test(path)) {
      result.android = true;
    } else if (/^apps\/app\//.test(path)) {
      result.browser = true;
      result.android = true; // Renderer bytes are shipped inside every APK.
    } else {
      result.browser = result.android = result.prepare = true;
    }
  }
  return result;
}

// Restrict only an existing-spec-only diff. Renames/deletions, helpers, app inputs,
// manual runs and unavailable diffs all retain the complete browser inventory.
export function browserPlan(paths, exists = existsSync) {
  const changed = paths.filter(path => !referenceOnly(path));
  const narrow = changed.length > 0 && changed.every(path =>
    /^test\/browser\/[A-Za-z0-9_/-]+\.spec\.ts$/.test(path) && exists(path));
  const specs = narrow ? [...new Set(changed)].sort() : [];
  const development = specs.filter(path => !path.endsWith('/production-surface.spec.ts'));
  const shards = narrow && development.length <= 3 ? [1] : [1, 2, 3];
  return {
    browser_specs: JSON.stringify(development),
    browser_shards: JSON.stringify(shards),
    browser_total: shards.length,
    browser_development: !narrow || development.length > 0,
    browser_production: !narrow || specs.some(path => path.endsWith('/production-surface.spec.ts')),
    browser_speech: !narrow || development.some(path => /\/browser-(agent-recording|agent-tts|host-disclosure)\.spec\.ts$/.test(path)),
  };
}

export function changedPaths(base, head, git = (...args) => execFileSync('git', args, { encoding: 'utf8' })) {
  for (const sha of [base, head]) if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Expected full base and head commit IDs');
  // --no-renames reports both sides, so moving executable input into docs cannot hide it.
  return git('diff', '--no-renames', '--name-only', '-z', base, head, '--').split('\0').filter(Boolean);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  let result;
  let paths = [];
  if (process.env.GITHUB_EVENT_NAME === 'workflow_dispatch') {
    result = { verify: true, browser: true, android: true, prepare: true };
  } else {
    try {
      let base = event.before;
      let head = process.env.GITHUB_SHA;
      if (event.pull_request) {
        head = event.pull_request.head.sha;
        base = execFileSync('git', ['merge-base', event.pull_request.base.sha, head], { encoding: 'utf8' }).trim();
      }
      paths = changedPaths(base, head);
      result = affected(paths);
    } catch (error) {
      console.warn(`Cannot establish complete diff; running all checks: ${error.message}`);
      result = { verify: true, browser: true, android: true, prepare: true };
    }
  }
  Object.assign(result, browserPlan(paths));
  for (const [key, value] of Object.entries(result)) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Change selection\n\n${paths.length} changed paths. Missing diff or manual run selects all lanes.\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`\n`);
}
