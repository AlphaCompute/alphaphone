import {test} from 'node:test';
import assert from 'node:assert/strict';
const {createLauncher, filterLauncherApps} = await import('../apps/app/src/prototype/home-launcher.ts');

const icon = 'data:image/png;base64,iVBORw0KGgo=';
const apps = [
  {packageName: 'com.android.settings', label: 'Settings', icon},
  {packageName: 'org.example.camera', label: 'Caméra'},
  {packageName: 'com.android.chrome', label: 'Chrome'},
  {packageName: 'com.example.reset', label: 'Reset tools'},
];
/** Native DeviceApps stub: records every call, never touches a device. */
function stub(overrides = {}) {
  const calls = [];
  const bridge = {
    list: async options => { calls.push(['list', options]); return {apps}; },
    launch: async input => { calls.push(['launch', input.packageName]); },
    resolveDefault: async input => { calls.push(['resolveDefault', input.role]); return {role: 'dial', available: true, packageName: 'com.android.dialer', label: 'Phone'}; },
    openDefault: async input => { calls.push(['openDefault', input.role]); },
    ...overrides,
  };
  let changes = 0;
  const launcher = createLauncher(bridge, () => changes++, {icons: true});
  return {launcher, calls, changes: () => changes};
}

test('search matches labels ignoring case and accents, prefix first, then package names', () => {
  assert.deepEqual(filterLauncherApps(apps, '').map(a => a.label), ['Caméra', 'Chrome', 'Reset tools', 'Settings']);
  assert.deepEqual(filterLauncherApps(apps, 'set').map(a => a.label), ['Settings', 'Reset tools']);
  assert.deepEqual(filterLauncherApps(apps, 'CAMERA').map(a => a.label), ['Caméra']);
  assert.deepEqual(filterLauncherApps(apps, 'android').map(a => a.label), ['Chrome', 'Settings']);
  assert.deepEqual(filterLauncherApps(apps, 'zzz'), []);
});
test('opening reads apps with icons and the dial handler, and launches only on an explicit tap', async () => {
  const {launcher, calls} = stub();
  await launcher.load();
  const snap = launcher.snapshot();
  assert.equal(snap.status, 'ready');
  assert.equal(snap.apps.length, 4);
  assert.equal(snap.dial.packageName, 'com.android.dialer');
  assert.deepEqual(calls, [['list', {icons: true}], ['resolveDefault', 'dial']]);
  await launcher.launch(snap.apps[0]);
  await launcher.openDial();
  assert.deepEqual(calls.slice(2), [['launch', 'com.android.settings'], ['openDefault', 'dial']]);
});
test('an empty device list is a ready empty state, not a failure', async () => {
  const {launcher} = stub({list: async () => ({apps: []})});
  await launcher.load();
  assert.equal(launcher.snapshot().status, 'ready');
  assert.deepEqual(launcher.snapshot().apps, []);
});
test('a failed or malformed list is an explicit failure and is never retried automatically', async () => {
  for (const list of [async () => { throw Error('Bridge down'); }, async () => ({apps: 'nope'})]) {
    let reads = 0;
    const {launcher} = stub({list: async () => { reads++; return list(); }});
    await launcher.load();
    assert.equal(launcher.snapshot().status, 'failed');
    assert.equal(reads, 1);
  }
});
test('invalid entries, duplicate packages and non-PNG icons are dropped', async () => {
  const {launcher} = stub({list: async () => ({apps: [apps[0], apps[0], {label: 'No package'}, {packageName: 'x.y', label: 'Bad icon', icon: 'javascript:alert(1)'}, {packageName: 'p.q', label: 7}]})});
  await launcher.load();
  assert.deepEqual(launcher.snapshot().apps.map(a => a.packageName), ['com.android.settings']);
});
test('a missing dialer or a platform without default resolution hides the Phone shortcut', async () => {
  for (const resolveDefault of [async () => ({role: 'dial', available: false}), async () => { throw Error('not implemented'); }, undefined]) {
    const {launcher} = stub({resolveDefault});
    await launcher.load();
    assert.equal(launcher.snapshot().dial, null);
    assert.equal(launcher.snapshot().status, 'ready');
  }
});
test('launch failures stay visible and repeated taps during a launch are ignored', async () => {
  let release;
  const calls = [];
  const {launcher} = stub({launch: input => { calls.push(input.packageName); return new Promise((_, reject) => { release = () => reject(Error('App is unavailable')); }); }});
  await launcher.load();
  const first = launcher.launch(apps[2]);
  await launcher.launch(apps[0]);
  assert.deepEqual(calls, ['com.android.chrome']);
  release(); await first;
  assert.equal(launcher.snapshot().launching, null);
  assert.equal(launcher.snapshot().launchError, 'Chrome could not be opened. App is unavailable');
  launcher.reset();
  assert.equal(launcher.snapshot().launchError, null);
});
test('a stale list read cannot overwrite a newer one', async () => {
  const pending = [];
  const {launcher} = stub({list: () => new Promise(resolve => pending.push(resolve))});
  const older = launcher.load(), newer = launcher.load();
  pending[1]({apps: [apps[0]]}); await newer;
  pending[0]({apps}); await older;
  assert.deepEqual(launcher.snapshot().apps.map(a => a.label), ['Settings']);
});
