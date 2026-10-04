import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFixtureNetwork, prepareFixtureNetwork } from '../scripts/ci-emulator-network.mjs';

const connected = 'Active default network: 101\n  NetworkAgentInfo{network{101} handle{123} nc{[ Transports: WIFI Capabilities: INTERNET&NOT_RESTRICTED&VALIDATED LinkUpBandwidth>=1000]}\n';
const disconnected = 'Active default network: none\n';
const options = { env: { GITHUB_ACTIONS: 'true', RUNNER_ENVIRONMENT: 'github-hosted' }, serial: 'emulator-5554', sleep: async () => {} };
function fixture({ neverReady = false, packages = '', user = '0', initiallyReady = false } = {}) {
  let requested = false;
  const calls = [];
  const run = (...args) => {
    const key = args.join(' '); calls.push(key);
    const responses = {
      'emu avd name': 'test\nOK', 'shell getprop ro.kernel.qemu': '1',
      'shell getprop ro.build.type': 'userdebug', 'shell am get-current-user': user,
      'shell pm list users': 'Users:\n UserInfo{0:Owner:4c13} running',
      'shell pm list packages -3': packages,
    };
    if (key in responses) return responses[key];
    if (key === 'shell dumpsys connectivity') return initiallyReady || requested && !neverReady ? connected : disconnected;
    if (key === 'shell cmd wifi set-wifi-enabled enabled') return '';
    if (key === 'shell cmd wifi connect-network AndroidWifi open') { requested = true; return 'Connection initiated'; }
    throw Error('Unexpected command: ' + key);
  };
  return { run, calls };
}
const writes = calls => calls.filter(call => call.startsWith('shell cmd wifi'));

test('only the active network capabilities can admit Internet access', () => {
  assert.deepEqual(parseFixtureNetwork(connected), { active: true, internet: true, validated: true });
  assert.deepEqual(parseFixtureNetwork(disconnected), { active: false, internet: false, validated: false });
  assert.equal(parseFixtureNetwork(connected.replace('&VALIDATED', '&NOT_VALIDATED')).validated, false);
  assert.equal(parseFixtureNetwork(connected.replace('INTERNET&', '')).internet, false);
  for (const text of ['', connected.replace('network{101}', 'network{102}'), connected + connected, connected.replace('Capabilities:', 'Unavailable:')])
    assert.throws(() => parseFixtureNetwork(text), /Unknown fixture/);
});
test('preparation connects once and requires two actual ready observations', async () => {
  const f = fixture({ packages: 'package:com.android.webview' }), records = [];
  await prepareFixtureNetwork(f.run, { ...options, record: state => records.push(state) });
  assert.deepEqual(writes(f.calls), ['shell cmd wifi set-wifi-enabled enabled', 'shell cmd wifi connect-network AndroidWifi open']);
  assert.equal(records.filter(row => row.phase === 'admission' && row.validated).length, 2);
  assert.equal(JSON.stringify(records).includes('101'), false);
});
test('already connected fixtures are only observed', async () => {
  const f = fixture({ initiallyReady: true });
  await prepareFixtureNetwork(f.run, options); assert.deepEqual(writes(f.calls), []);
});
test('a successful connect command cannot substitute for a working network', async () => {
  const f = fixture({ neverReady: true }); let waits = 0;
  await assert.rejects(prepareFixtureNetwork(f.run, { ...options, sleep: async () => { waits++; } }), /no validated Internet/);
  assert.equal(waits, 60); assert.equal(writes(f.calls).length, 2);
});
test('local contexts, populated fixtures, secondary users and identity drift refuse writes', async () => {
  const local = fixture();
  await assert.rejects(prepareFixtureNetwork(local.run, { ...options, env: {} }));
  assert.deepEqual(local.calls, []);
  for (const setup of [{ packages: 'package:ai.elizaresearch.alphaphone' }, { user: '10' }]) {
    const f = fixture(setup); await assert.rejects(prepareFixtureNetwork(f.run, options)); assert.deepEqual(writes(f.calls), []);
  }
  const f = fixture(); let users = 0;
  await assert.rejects(prepareFixtureNetwork((...args) => args.join(' ') === 'shell am get-current-user' && ++users > 1 ? '10' : f.run(...args), options));
  assert.deepEqual(writes(f.calls), []);
});
