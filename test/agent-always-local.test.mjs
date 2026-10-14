// Owner directive (2026-10-13): "there should NEVER be no agent connected since the agent should
// ALWAYS run locally on device, no exceptions." Structural source contracts for the renderer and
// native start path. Not emulator, image or device evidence; the browser specs in
// test/browser/native-cloud-subscription.spec.ts exercise the composed flow with synthetic ports.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const ui = readFileSync('apps/app/src/runtime/connection-ui.tsx', 'utf8');
const plugin = readFileSync('android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaLocalAgentPlugin.java', 'utf8');
const store = readFileSync('android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaCredentialStore.java', 'utf8');
const between = (text, start, end) => { const from = text.indexOf(start), to = text.indexOf(end, from + start.length); assert.ok(from >= 0 && to > from, `${start} … ${end} located`); return text.slice(from, to); };

test('plan state never stops or withholds the on-device agent', () => {
  const admission = between(ui, 'async function admitCloudResident(', 'async function connectResident(');
  // Admission decides only the inference binding; nothing in it (or the refresh handlers) stops,
  // retires or skips the agent.
  for (const forbidden of ['stopLocalAgent(', "retire('Plan required')", "retire('Sign-in required')", 'return false', 'Promise<boolean>'])
    assert.ok(!admission.includes(forbidden), `admission/refresh must not ${forbidden}`);
  assert.match(admission, /Promise<ResidentAdmission>/);
  for (const binding of ["binding:'unbound',notice:{open:true}", "binding:recent?'kept':'unbound'", "return {binding:'unbound',account};", "return {binding:'cloud',credentialId:account.identity.credentialId,account};"])
    assert.ok(admission.includes(binding), `admission returns ${binding}`);
  // A plan that ends, or a rejected refresh, rebinds the running agent; it is never stopped.
  assert.match(between(ui, 'function residentPlanEnded(', 'function residentRefreshRefused('), /queueResidentRebind\(\);/);
  assert.match(between(ui, 'function residentRefreshRefused(', 'async function applyResidentBinding('), /queueResidentRebind\(\);/);
  // connectResident always reaches the start; only the test-mocks staging QA lane stops at admission.
  const connect = between(ui, 'async function connectResident(', 'async function connectCloud(');
  const start = connect.indexOf('await client.connect(signal)');
  assert.ok(start > 0);
  const beforeStart = connect.slice(0, start);
  assert.equal((beforeStart.match(/return;/g) || []).length, 1, 'only the QA lane returns before the start');
  assert.match(beforeStart, /if\(testMocksEnabled&&!residentBindable\(\)\)\{[^\n]*return;\}/);
  // Startup always starts the agent, signed in or not.
  assert.match(between(ui, 'async function startResidentGate(', 'function conversationKey('), /await work\('Starting your agent…',signal=>connectResident\(signal\)\);/);
  // Product phones refuse stop/disconnect/remove of the resident agent.
  for (const method of ['async stopLocal()', 'async removeProvider()', 'async disconnect()'])
    assert.match(between(ui, method, '\n  },'), /if\(residentCloudFlow\(\)\)\{update\(\{error:ALWAYS_LOCAL,message:''\}\);return;\}/, method);
  // Sign-in and sign-out keep the agent running and reconnect it afterwards.
  const login = between(ui, 'async residentCloudLogin()', 'async residentManagePlan()');
  assert.ok(!login.includes('stopLocalAgent(') && login.includes('retire();await connectResident(signal);'));
  const signOut = between(ui, 'async cloudSignOut()', 'async mock()');
  assert.ok(!signOut.includes('stopLocalAgent(') && signOut.includes('else{retire();await connectResident(signal);'));
  // Cloud inference is unbound (native stops a process holding the key) before the key is revoked.
  assert.ok(signOut.indexOf('await clearLocalProvider()') > 0 && signOut.indexOf('await clearLocalProvider()') < signOut.indexOf('client.revokeSession(signal)'));
});

test('Cloud inference is bound only for an admitted plan and unbound otherwise', () => {
  const bind = between(ui, 'async function applyResidentBinding(', 'async function connectResident(');
  const cloud = bind.indexOf("if(admission.binding==='cloud'&&admission.credentialId&&admission.account){");
  assert.ok(cloud > 0 && bind.indexOf('bindResidentCloudProvider(') > cloud, 'binding happens only in the admitted branch');
  assert.equal(bind.split('bindResidentCloudProvider(').length, 2, 'one bind call');
  // Every other outcome clears the stored provider before the agent starts.
  assert.ok(bind.split('await clearLocalProvider()').length >= 3);
  // The running state the UI and tests read is derived from the binding actually applied.
  assert.match(between(ui, 'async function connectResident(', 'async function connectCloud('), /residentBinding=bound\.binding;\n\s+update\(\{residentInference:bound\.binding==='cloud'\?'cloud':bound\.binding==='unbound'\?'unavailable':'unknown'\}\);/);
});

test('a chat turn without Cloud inference gets an honest answer with the plan actions', () => {
  const send = between(ui, '  async send(', 'export function ConnectionChooser');
  const honest = send.indexOf('inferenceUnavailableReply(notice, signedIn)');
  assert.ok(honest > 0 && honest < send.indexOf("new Error('The agent could not complete this response.')"), 'the plan answer precedes the generic failure');
  assert.match(send, /state\.residentInference === 'unavailable' \|\| \('failureKind' in reply && reply\.failureKind === 'no_provider'\)/);
  const reply = between(ui, 'export function inferenceUnavailableReply(', '\n}\n');
  for (const text of ['Redeem a subscription code or choose a plan', "can't reach Eliza Cloud", 'Sign in with Eliza Cloud', 'keep working'])
    assert.ok(reply.includes(text), text);
  assert.doesNotMatch(reply, /no agent|without AI|credit|top.?up|upgrade/i);
  // Workflow text generation fails honestly instead of using the plan answer as generated text.
  const client = readFileSync('apps/app/src/runtime/alpha-client.ts', 'utf8');
  assert.match(between(client, 'async generateWorkflowText(', 'async send('), /if\(reply&&\(reply as AgentReply\)\.planAction\)throw new AlphaClientError\('unconfigured'/);
  const adapter = readFileSync('apps/app/src/prototype/agent-adapter.ts', 'utf8');
  assert.match(adapter, /if\(card\.planAction\)\{\n\s+if\(card\.planAction==='plan'\)connectionController\.openPlan\(\);/);
});

test('the plan surface is a notice beside the running agent, not a gate', () => {
  const chooser = ui.slice(ui.indexOf('export function ConnectionChooser'));
  assert.match(chooser, /if \(!snapshot\.open\) \{\n\s+\/\/ Never a gate: the agent is running\./);
  assert.ok(chooser.includes('<aside className="alpha-plan-notice" role="region" aria-label="Eliza Cloud plan notice">'));
  // Only a required sign-in locks the dialog; needs-plan and offline are closable.
  assert.ok(chooser.includes("const residentLocked=!snapshot.cloudAccount&&snapshot.residentPlanNotice!=='offline';"));
  assert.ok(chooser.includes('{!residentLocked&&<button aria-label="Close connection settings"'));
  assert.match(ui, /close\(\) \{ if\(residentSignInRequired\(\)\)\{/);
  // No agent-less product choice remains in the phone's flow.
  const resident = between(chooser, 'if(residentCloudFlow())return', 'if(browserOnly)return');
  assert.doesNotMatch(resident, /Use local apps without AI|without AI|No agent connected/);
});

test('native starts the agent without a provider and never offers it a Cloud key without an admitted plan', () => {
  const start = between(plugin, '@PluginMethod public void start(', '@PluginMethod public void cancelStart(');
  assert.doesNotMatch(start, /Configure your model provider/);
  const configure = between(plugin, 'static void configureEnvironment(', '@PluginMethod public void start(');
  assert.doesNotMatch(configure, /Configure a model provider/);
  assert.match(configure, /if\(provider==null\)applyUnboundEnvironment\(env\);/);
  assert.match(configure, /launchedGeneration=generation;/);
  const unbound = between(plugin, 'static void applyUnboundEnvironment(', 'static final String PROVIDER_MODEL_PATTERN');
  for (const key of ['ELIZAOS_CLOUD_API_KEY', 'CEREBRAS_API_KEY', 'OPENAI_API_KEY', 'ELIZA_PROVIDER', 'ELIZAOS_CLOUD_BASE_URL'])
    assert.ok(unbound.includes(`"${key}"`), `unbound launch removes ${key}`);
  assert.match(unbound, /env\.put\("ELIZAOS_CLOUD_USE_INFERENCE","false"\);/);
  assert.ok(!unbound.includes('readCredentialSlot'), 'the unbound launch reads no credential');
  // An empty provider slot is its own attachable generation.
  assert.match(between(plugin, 'private static String storedProviderGeneration(', 'private void rejectPending('), /if\(saved==null\)return UNBOUND_PROVIDER_GENERATION;/);
  // With no stored provider, no process holds a Cloud key: a sign-in change does not stop the agent.
  assert.match(store, /if\(java\.util\.Objects\.equals\(before,value\)\)return false;\n\s+\/\/[^\n]*\n\s+\/\/[^\n]*\n\s+if\(provider==null\)return false;/);
});
