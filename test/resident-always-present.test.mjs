// Decision P-43 (owner, 2026-10-13): the resident agent is always present. Source-level guards
// for the retired "no agent" paths. Evidence class: source/test only; not an APK or device run.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DENYLIST, RETIRED_NO_AGENT_TEXT} from '../scripts/audit-production-bundle.mjs';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const connection = read('apps/app/src/runtime/connection-ui.tsx');

test('production bundles forbid the retired no-agent copy', () => {
  for (const text of ['without AI', 'Continue offline', 'Connect an agent']) {
    assert.ok(RETIRED_NO_AGENT_TEXT.includes(text), text);
    assert.ok(DENYLIST.includes(text), text);
  }
});

test('the connection controller has no local-apps-only mode and migrates old selections to the resident', () => {
  assert.doesNotMatch(connection, /localAppsSelected|localApps\?: ?true|Use local apps without AI/);
  // A stored offline, local-apps or none selection reads as the resident where it is always present.
  assert.match(connection, /value\?\.kind === 'offline' \|\| value\?\.kind === 'none'\) return residentAlwaysPresent \? \{ kind: 'resident' \}/);
  // Saving a no-agent choice there stores the resident instead.
  assert.match(connection, /residentAlwaysPresent && \(selection\.kind === 'none' \|\| selection\.kind === 'offline'\) \? \{ kind: 'resident' \}/);
  // Android production startup always starts the resident; Cloud admission never stops it.
  assert.match(connection, /if \(isAndroid && !testMocksEnabled\) \{[\s\S]{0,400}await startResident\(\);/);
  assert.doesNotMatch(connection, /credits\.balance<=0\)\{await stopLocalAgent\(\)/);
  assert.doesNotMatch(connection, /async stopLocal\(\)/);
  assert.match(connection, /async restartLocal\(\)/);
});

test('the native start no longer refuses a missing provider slot', () => {
  const plugin = read('android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaLocalAgentPlugin.java');
  assert.doesNotMatch(plugin, /Configure your model provider before starting the local agent|Configure a model provider before starting/);
  assert.match(plugin, /LocalAgentProviderAdmission\.launchGeneration\(saved,cloudSaved\)/);
  assert.match(read('android/app/src/main/java/ai/elizaresearch/alphaphone/LocalAgentProviderAdmission.java'), /NO_PROVIDER_GENERATION="no-provider"/);
});

test('browser speech has no Web Speech fallback', () => {
  for (const file of ['apps/app/src/browser/voice.ts', 'apps/app/src/browser/browser-surface.ts'])
    assert.doesNotMatch(read(file), /speechSynthesis|SpeechSynthesisUtterance/, file);
});

test('no startup path ends claiming "starting" with nothing starting', () => {
  // Every startup outcome is settled: the resident starts, or the state is `recovering` with Retry.
  assert.match(connection, /\}\)\(\)\.then\(settleResidentAfterStartup\)(\.finally\(\(\)=>update\(\{startupResolved:true\}\)\))?;/);
  assert.match(connection, /async function settleResidentAfterStartup\(\) \{[\s\S]{0,600}await ensureResident\(\);[\s\S]{0,80}update\(\{ kind: 'recovering' \}\);/);
});

test('the Cloud sign-in keeps the resident running until the new key is stored', () => {
  const login = connection.slice(connection.indexOf('async residentCloudLogin()'), connection.indexOf('async residentTopUp()'));
  assert.ok(login.indexOf('cloud.login(') >= 0 && login.indexOf('stopLocalAgent()') > login.indexOf('cloud.login('), 'stop only after the browser sign-in returned');
});
