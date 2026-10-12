// Browser site permissions (UPSTREAM:site-permission-consolidation). Class S plus a host-JVM run of
// Alpha's sealed record read through the upstream BrowserSitePermissions at the pin. It does not
// exercise WebView prompts, Android runtime permissions or the Keystore seal.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {root,nativeSource,fixture,runJvm,jsonJarSkip} from './fixtures/jvm-tools.mjs';

const upstream=join(root,'vendor/eliza/plugins/plugin-native-browser-surface/android/src/main/java/ai/eliza/plugins/browsersurface');

test('old-format records (allow, deny, damaged, 200-origin bound) read through the upstream rules',{skip:jsonJarSkip},()=>{
 assert.match(runJvm([join(upstream,'BrowserSitePermissions.java'),join(upstream,'BrowserWebOrigin.java'),nativeSource('BrowserPermissionRecords.java'),fixture('BrowserSitePermissionsTest.java')],'ai.elizaresearch.alphaphone.BrowserSitePermissionsTest',{json:true}),/^PASS browser site permissions/);
});

test('the sealed store delegates decisions upstream and Alpha keeps its prompt and runtime rules',()=>{
 const store=readFileSync(nativeSource('BrowserSessionStore.java'),'utf8');
 assert.match(store,/MAX_PERMISSION_ORIGINS=BrowserSitePermissions\.MAX_ORIGINS/);
 assert.match(store,/BrowserPermissionRecords\.read\(frame\.open\(packed\)\)/,'the record is unsealed before it is read');
 assert.match(store,/frame\.seal\(BrowserPermissionRecords\.write\(/,'the record is sealed before it is stored');
 assert.match(store,/preferences\.getString\("permissions",null\)/,'the stored preference key is unchanged');
 assert.ok(!/origin\.matches\(/.test(store),'no local origin grammar remains');
 const plugin=readFileSync(nativeSource('AlphaBrowserPlugin.java'),'utf8');
 const decide=plugin.slice(plugin.indexOf('private void sitePermission('),plugin.indexOf('private void mediaPermission('));
 const shown=decide.indexOf('if(!promptable(t))'),stored=decide.indexOf('sessionStore.permission(origin,kind)');
 assert.ok(shown>0&&stored>shown,'only the selected, shown page may prompt or use a stored Allow');
 assert.match(decide,/if\(!t\.priv\)try\{stored=sessionStore\.permission/,'a private tab never reads a decision');
 assert.match(decide,/runtimePermissions\.launch\(/,'an Allow is chained to the Android runtime permission');
 assert.match(decide,/for\(String kind:decided\)if\(!androidGranted\(kind\)\)/);
});
