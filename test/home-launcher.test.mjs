import {test} from 'node:test';
import assert from 'node:assert/strict';
const {createLauncher, filterLauncherApps, describeLauncherApps, appKey, localFavorites, FAVORITES_KEY, MAX_FAVORITES} = await import('../apps/app/src/prototype/home-launcher.ts');

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
  launcher.clearError();
  assert.equal(launcher.snapshot().launchError, null);
});
test('typing a search while apps are still loading does not strand the drawer in its loading state', async () => {
  let release;
  const {launcher} = stub({list: () => new Promise(resolve => { release = resolve; })});
  const loading = launcher.load();
  assert.equal(launcher.snapshot().status, 'loading');
  launcher.clearError();
  release({apps}); await loading;
  assert.equal(launcher.snapshot().status, 'ready');
  assert.equal(launcher.snapshot().apps.length, 4);
});
test('a stale list read cannot overwrite a newer one', async () => {
  const pending = [];
  const {launcher} = stub({list: () => new Promise(resolve => pending.push(resolve))});
  const older = launcher.load(), newer = launcher.load();
  pending[1]({apps: [apps[0]]}); await newer;
  pending[0]({apps}); await older;
  assert.deepEqual(launcher.snapshot().apps.map(a => a.label), ['Settings']);
});

/** In-memory favorites store; `fail` makes the next writes throw like a full or blocked storage. */
function memoryFavorites(initial = []) {
  const store = {keys: [...initial], writes: 0, fail: false,
    read() { return [...store.keys]; },
    write(keys) { if (store.fail) throw Error('QuotaExceededError'); store.writes++; store.keys = [...keys]; }};
  return store;
}
const twins = [
  {packageName: 'org.example.notes', activityName: 'org.example.notes.Main', label: 'Notes'},
  {packageName: 'com.vendor.notes', activityName: 'com.vendor.notes.Launch', label: 'Notes'},
  {packageName: 'com.vendor.suite', activityName: 'com.vendor.suite.MailActivity', label: 'Suite'},
  {packageName: 'com.vendor.suite', activityName: 'com.vendor.suite.CalendarActivity', label: 'Suite'},
  {packageName: 'com.vendor.notes', activityName: 'com.vendor.notes.Launch', label: 'Notes', user: '10', profile: 'work', locked: true},
  {packageName: 'com.android.settings', activityName: 'com.android.settings.Settings', label: 'Settings'},
];

test('an entry is identified by package, activity and profile, never by its label', async () => {
  assert.equal(appKey({packageName: 'a.b'}), 'a.b');
  assert.equal(appKey(twins[0]), 'org.example.notes/org.example.notes.Main');
  assert.equal(appKey(twins[4]), 'com.vendor.notes/com.vendor.notes.Launch#10');
  const calls = [];
  const {launcher} = stub({list: async () => ({apps: [...twins, twins[1]]}), launch: async input => { calls.push(input); }});
  await launcher.load();
  assert.equal(launcher.snapshot().apps.length, 6, 'same-label and same-package entries all stay; only an identical component is dropped');
  await launcher.launch(twins[1]);
  await launcher.launch(twins[3]);
  await launcher.launch(twins[4]);
  assert.deepEqual(calls, [
    {packageName: 'com.vendor.notes', activityName: 'com.vendor.notes.Launch'},
    {packageName: 'com.vendor.suite', activityName: 'com.vendor.suite.CalendarActivity'},
    {packageName: 'com.vendor.notes', activityName: 'com.vendor.notes.Launch', user: '10'},
  ]);
});
test('entries with the same label are told apart by package, activity or profile', () => {
  const details = describeLauncherApps(twins);
  assert.deepEqual(details.get(appKey(twins[0])), ['org.example.notes']);
  assert.deepEqual(details.get(appKey(twins[1])), ['com.vendor.notes']);
  assert.deepEqual(details.get(appKey(twins[2])), ['MailActivity']);
  assert.deepEqual(details.get(appKey(twins[3])), ['CalendarActivity']);
  assert.deepEqual(details.get(appKey(twins[4])), ['Work · locked']);
  assert.deepEqual(details.get(appKey(twins[5])), []);
  assert.deepEqual(describeLauncherApps([{packageName: 'a.b', label: 'Mail', user: '10', profile: 'work', locked: false}]).get('a.b#10'), ['Work']);
});
test('malformed component, profile or lock fields drop the entry', async () => {
  const bad = [
    {packageName: 'a.b', label: 'A', activityName: ''}, {packageName: 'a.c', label: 'B', activityName: 7},
    {packageName: 'a.d', label: 'C', user: 'ten'}, {packageName: 'a.e', label: 'D', user: 10},
    {packageName: 'a.f', label: 'E', profile: 'admin'}, {packageName: 'a.g', label: 'F', locked: 'yes'},
  ];
  const {launcher} = stub({list: async () => ({apps: [...bad, twins[4]]})});
  await launcher.load();
  assert.deepEqual(launcher.snapshot().apps.map(appKey), ['com.vendor.notes/com.vendor.notes.Launch#10']);
});
test('favorites keep their order, persist through the store and survive a new launcher', async () => {
  const favorites = memoryFavorites();
  const bridge = {list: async () => ({apps: twins}), launch: async () => {}};
  const launcher = createLauncher(bridge, () => {}, {favorites});
  await launcher.load();
  launcher.toggleFavorite(twins[5]); launcher.toggleFavorite(twins[1]); launcher.toggleFavorite(twins[3]);
  assert.deepEqual(launcher.favoriteApps().map(a => a.activityName), ['com.android.settings.Settings', 'com.vendor.notes.Launch', 'com.vendor.suite.CalendarActivity']);
  assert.equal(launcher.isFavorite(twins[1]), true);
  assert.equal(launcher.isFavorite(twins[0]), false, 'the other Notes is a different app');
  assert.equal(launcher.isFavorite(twins[4]), false, 'the work copy is a different entry');
  launcher.moveFavorite(twins[3], -1);
  launcher.moveFavorite(twins[5], -1); // already first: no change
  launcher.moveFavorite(twins[0], 1);  // not a favorite: no change
  assert.deepEqual(favorites.keys, [appKey(twins[5]), appKey(twins[3]), appKey(twins[1])]);
  launcher.toggleFavorite(twins[5]);
  assert.deepEqual(favorites.keys, [appKey(twins[3]), appKey(twins[1])]);
  // A new launcher (process restart) reads the same order before any list arrives.
  const restarted = createLauncher(bridge, () => {}, {favorites});
  assert.deepEqual(restarted.snapshot().favorites, [appKey(twins[3]), appKey(twins[1])]);
  assert.deepEqual(restarted.favoriteApps(), [], 'nothing is shown as a favorite until the device lists it');
  await restarted.load();
  assert.deepEqual(restarted.favoriteApps().map(a => a.activityName), ['com.vendor.suite.CalendarActivity', 'com.vendor.notes.Launch']);
});
test('a removed favorite disappears, keeps its place, and returns only when the device lists it again', async () => {
  const favorites = memoryFavorites([appKey(twins[5]), appKey(twins[0]), appKey(twins[2])]);
  let listed = twins;
  const launcher = createLauncher({list: async () => ({apps: listed}), launch: async () => {}}, () => {}, {favorites});
  await launcher.load();
  listed = twins.filter(app => app !== twins[0]);
  await launcher.refresh();
  assert.deepEqual(launcher.favoriteApps().map(a => a.label), ['Settings', 'Suite']);
  launcher.moveFavorite(twins[2], -1);
  assert.deepEqual(favorites.keys, [appKey(twins[2]), appKey(twins[0]), appKey(twins[5])], 'reordering swaps only installed favorites');
  listed = twins;
  await launcher.refresh();
  assert.deepEqual(launcher.favoriteApps().map(a => a.label), ['Suite', 'Notes', 'Settings']);
});
test('a favorite that cannot be saved is not shown as saved', async () => {
  const favorites = memoryFavorites();
  const launcher = createLauncher({list: async () => ({apps: twins}), launch: async () => {}}, () => {}, {favorites});
  await launcher.load();
  favorites.fail = true;
  launcher.toggleFavorite(twins[5]);
  assert.deepEqual(launcher.snapshot().favorites, []);
  assert.equal(launcher.snapshot().launchError, 'Favorites could not be saved. Nothing changed.');
  favorites.fail = false;
  launcher.toggleFavorite(twins[5]);
  assert.deepEqual(launcher.snapshot().favorites, [appKey(twins[5])]);
  assert.equal(launcher.snapshot().launchError, null);
  const none = createLauncher({list: async () => ({apps: twins}), launch: async () => {}}, () => {});
  await none.load(); none.toggleFavorite(twins[5]);
  assert.deepEqual(none.snapshot().favorites, []);
  assert.equal(none.snapshot().launchError, 'Favorites cannot be saved on this device.');
});
test('the favorites limit is enforced and uninstalled favorites make room first', async () => {
  const many = Array.from({length: MAX_FAVORITES + 1}, (_, i) => ({packageName: `org.example.app${i}`, label: `App ${i}`}));
  const favorites = memoryFavorites(['gone.one', 'gone.two']);
  const launcher = createLauncher({list: async () => ({apps: many}), launch: async () => {}}, () => {}, {favorites});
  await launcher.load();
  for (const app of many.slice(0, MAX_FAVORITES)) launcher.toggleFavorite(app);
  assert.equal(favorites.keys.length, MAX_FAVORITES);
  assert.equal(favorites.keys.includes('gone.one'), false);
  launcher.toggleFavorite(many[MAX_FAVORITES]);
  assert.equal(favorites.keys.length, MAX_FAVORITES);
  assert.match(launcher.snapshot().launchError, /^You can keep 24 favorites\. Remove one to add App 24\.$/);
});
test('localStorage favorites round-trip and unreadable or malformed data reads as none', () => {
  const data = new Map();
  const storage = {getItem: key => data.has(key) ? data.get(key) : null, setItem: (key, value) => { data.set(key, String(value)); }};
  const store = localFavorites(() => storage);
  assert.deepEqual(store.read(), []);
  store.write(['a.b/a.b.Main', 'c.d']);
  assert.deepEqual(JSON.parse(data.get(FAVORITES_KEY)), {version: 1, keys: ['a.b/a.b.Main', 'c.d']});
  assert.deepEqual(store.read(), ['a.b/a.b.Main', 'c.d']);
  for (const raw of ['{', '[]', '{"version":2,"keys":["a"]}', '{"version":1,"keys":"a"}']) { data.set(FAVORITES_KEY, raw); assert.deepEqual(store.read(), []); }
  data.set(FAVORITES_KEY, JSON.stringify({version: 1, keys: ['a', 'a', 7, '', 'b']}));
  assert.deepEqual(store.read(), ['a', 'b']);
  assert.deepEqual(localFavorites(() => { throw Error('SecurityError'); }).read(), []);
});
test('a refresh after an outside change replaces the list without a loading state and keeps the launch error', async () => {
  let listed = twins, release;
  const statuses = [];
  const launcher = createLauncher({
    list: () => release ? new Promise(resolve => { const value = listed; release.push(() => resolve({apps: value})); }) : Promise.resolve({apps: listed}),
    launch: async () => { throw Error('This app is no longer installed.'); },
  }, () => statuses.push(launcher?.snapshot().status));
  await launcher.refresh();
  assert.equal(launcher.snapshot().status, 'idle', 'nothing is read before the drawer was ever opened');
  await launcher.load();
  await launcher.launch(twins[0]);
  assert.equal(launcher.snapshot().launchError, 'Notes could not be opened. This app is no longer installed.');
  statuses.length = 0; release = [];
  listed = twins.slice(1);
  const refreshing = launcher.refresh();
  assert.equal(launcher.snapshot().status, 'ready');
  assert.equal(launcher.snapshot().apps.length, 6);
  release[0](); await refreshing;
  assert.equal(launcher.snapshot().apps.length, 5);
  assert.equal(statuses.includes('loading'), false);
  assert.equal(launcher.snapshot().launchError, 'Notes could not be opened. This app is no longer installed.');
});
test('a failed launch re-reads the device so a removed app leaves the list, and it cannot be opened again', async () => {
  let listed = twins;
  const launches = [];
  const launcher = createLauncher({
    list: async () => ({apps: listed}),
    launch: async input => { launches.push(input.packageName); listed = twins.filter(app => app.packageName !== input.packageName); const error = Error('This app is no longer installed.'); error.code = 'not-installed'; throw error; },
  }, () => {});
  await launcher.load();
  await launcher.launch(twins[5]);
  assert.equal(launcher.snapshot().apps.some(app => app.packageName === 'com.android.settings'), false);
  assert.equal(launcher.snapshot().launching, null);
  await launcher.launch(twins[5]);
  assert.deepEqual(launches, ['com.android.settings'], 'an entry missing from the current list is never sent to Android');
  assert.equal(launcher.snapshot().launchError, 'Settings is no longer installed.');
});
test('a failed re-read after a failed launch clears the list instead of keeping a stale one', async () => {
  let reads = 0;
  const launcher = createLauncher({list: async () => { if (reads++) throw Error('Package manager unavailable'); return {apps: twins}; }, launch: async () => { throw Error('App could not be opened'); }}, () => {});
  await launcher.load();
  await launcher.launch(twins[5]);
  assert.equal(launcher.snapshot().status, 'failed');
  assert.deepEqual(launcher.snapshot().apps, []);
  await launcher.load();
  assert.equal(launcher.snapshot().status, 'failed');
  await launcher.refresh();
  assert.deepEqual(launcher.snapshot().apps, [], 'a failed refresh never restores an older inventory');
});
test('a locked work-profile entry reports the profile state Android gave and launches nothing', async () => {
  const launcher = createLauncher({list: async () => ({apps: twins}), launch: async () => { const error = Error('Work apps are paused or locked. Turn on work apps in Android, then try again.'); error.code = 'profile-locked'; throw error; }}, () => {});
  await launcher.load();
  await launcher.launch(twins[4]);
  assert.equal(launcher.snapshot().launchError, 'Notes could not be opened. Work apps are paused or locked. Turn on work apps in Android, then try again.');
  assert.equal(launcher.snapshot().launching, null);
});
test('a launch that fails while the drawer is still reading ends in a settled list, never a stuck loading state', async () => {
  let listed = twins, hold = null;
  const launcher = createLauncher({
    list: () => hold ? new Promise(resolve => hold.push(() => resolve({apps: listed}))) : Promise.resolve({apps: listed}),
    launch: async () => { listed = twins.slice(1); throw Error('This app is no longer installed.'); },
  }, () => {});
  await launcher.load();
  // Reopening the drawer starts a full read; the previous rows are still on screen and one is tapped.
  hold = [];
  const reopening = launcher.load();
  assert.equal(launcher.snapshot().status, 'loading');
  const launching = launcher.launch(twins[0]);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(hold.length, 2, 'the failed launch started its own read of the device');
  hold[1](); await launching;
  hold[0](); await reopening;
  assert.equal(launcher.snapshot().status, 'ready');
  assert.equal(launcher.snapshot().apps.length, twins.length - 1);
  assert.equal(launcher.snapshot().launchError, 'Notes could not be opened. This app is no longer installed.');
});
test('same-label entries stay distinguishable when packages, activities and profiles overlap', () => {
  const mixed = [
    {packageName: 'org.example.notes', activityName: 'org.example.notes.Main', label: 'Notes'},
    {packageName: 'com.vendor.notes', activityName: 'com.vendor.notes.One', label: 'Notes'},
    {packageName: 'com.vendor.notes', activityName: 'com.vendor.notes.Two', label: 'Notes'},
    {packageName: 'com.vendor.suite', activityName: 'com.vendor.suite.mail.Main', label: 'Suite'},
    {packageName: 'com.vendor.suite', activityName: 'com.vendor.suite.calendar.Main', label: 'Suite'},
    {packageName: 'com.vendor.chat', activityName: 'com.vendor.chat.Main', label: 'Chat', user: '10', profile: 'work', locked: false},
    {packageName: 'com.vendor.chat', activityName: 'com.vendor.chat.Main', label: 'Chat', user: '11', profile: 'work', locked: false},
  ];
  const details = describeLauncherApps(mixed);
  assert.deepEqual(mixed.map(app => details.get(appKey(app))), [
    ['org.example.notes'], ['com.vendor.notes', 'One'], ['com.vendor.notes', 'Two'],
    ['com.vendor.suite.mail.Main'], ['com.vendor.suite.calendar.Main'],
    ['Work', 'com.vendor.chat.Main', 'profile 10'], ['Work', 'com.vendor.chat.Main', 'profile 11'],
  ]);
  assert.equal(new Set(mixed.map(app => `${app.label}|${details.get(appKey(app)).join('|')}`)).size, mixed.length, 'no two rows read the same');
});
