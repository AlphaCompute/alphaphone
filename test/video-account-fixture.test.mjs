import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('android/app/src/androidTest/assets/video-account-fixture.js', 'utf8');
function fixture() {
  const actual = [];
  const context = { URL, Date, window: {}, Capacitor: { nativePromise: async (...args) => { actual.push(args); return { native: true }; } } };
  vm.runInNewContext(source, context);
  return { call: context.Capacitor.nativePromise, actual, calls: context.window.__alphaVideoAccount.calls };
}
test('video account fixture closes account traffic and validates the selected resident credential', async () => {
  const { call, actual, calls } = fixture();
  const request = (path, method, headers = {}) => call('AlphaConnection', 'request', { url: `https://api.eliza.app${path}`, method, headers });
  const created = await request('/api/auth/cli-session', 'POST');
  await call('AlphaConnection', 'openExternal', { url: `https://eliza.app/auth/cli-login?session=${created.data.sessionId}` });
  const authenticated = await request(`/api/auth/cli-session/${created.data.sessionId}`, 'GET');
  const credential = { token: authenticated.data.token, credentialId: '9f1dc45a-4011-4e44-947a-30d999d24fa5' };
  await call('AlphaConnection', 'secureWrite', { slot: 'cloud:production', value: JSON.stringify(credential) });
  const headers = { Authorization: `Bearer ${credential.token}` };
  assert.equal((await request('/api/v1/credits/balance', 'GET', headers)).data.balance, 5);
  assert.ok((await request('/api/v1/user', 'GET', headers)).data.data.id);
  await assert.rejects(call('Agent', 'configureCloudProvider', { credentialId: 'stale', model: 'cerebras/qwen-3.8-27b' }));
  await call('Agent', 'configureCloudProvider', { credentialId: credential.credentialId, model: 'cerebras/qwen-3.8-27b' });
  await call('Agent', 'start');
  assert.equal((await call('Agent', 'getStatus')).state, 'running');
  assert.equal(JSON.parse((await call('Agent', 'request', { path: '/api/auth/me', method: 'GET' })).body).identity.kind, 'owner');
  await assert.rejects(request('/api/v1/personal/provision', 'POST', headers));
  await assert.rejects(call('Agent', 'request', { path: '/api/conversations/example/messages', method: 'POST' }));
  await assert.rejects(call('AlphaConnection', 'request', { url: 'https://unexpected.invalid/api/v1/user', method: 'GET', headers }));
  assert.equal(actual.length, 0, 'No account or agent request reached the real native transport');
  assert.ok(calls.indexOf('configureCloudProvider') < calls.indexOf('start'));
});
test('video account fixture retains real media plugins and nonaccount encrypted storage', async () => {
  const { call, actual } = fixture();
  assert.deepEqual(await call('ElizaCamera', 'startRecording', { video: true }), { native: true });
  await call('AlphaPhotos', 'read', { id: 'owned-video' });
  await call('AlphaConnection', 'secureRead', { slot: 'notes-records:v1:device' });
  assert.deepEqual(actual.map(args => [args[0], args[1]]), [['ElizaCamera', 'startRecording'], ['AlphaPhotos', 'read'], ['AlphaConnection', 'secureRead']]);
});
