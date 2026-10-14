import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

// In-app Eliza Cloud sign-in (owner directive 2026-10-14). The pure policy runs on a plain JVM; the
// Android wiring is checked from source. This builds no APK, runs nothing on Android, verifies no App
// Link, and contacts neither Eliza Cloud nor Google.
const root=resolve(import.meta.dirname,'..');
const read=file=>readFileSync(join(root,file),'utf8');
const between=(text,start,end)=>{const from=text.indexOf(start),to=text.indexOf(end,from+start.length);assert.ok(from>=0&&to>from,`${start} … ${end} located`);return text.slice(from,to);};
const java=process.env.JAVA_HOME||(process.platform==='darwin'?'/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home':'');const binary=name=>java?join(java,'bin',name):name;
const native='android/app/src/main/java/ai/elizaresearch/alphaphone/';

test('PKCE, state, authorize URL, strict App Link return, pending record and routes (plain JVM)',()=>{
 const temporary=mkdtempSync(join(tmpdir(),'cloud-sign-in-'));
 try{
  execFileSync(binary('javac'),['--release','11','-d',temporary,join(root,native,'CloudSignInFlow.java'),join(root,native,'ConnectionRoutes.java'),join(root,'test/fixtures/CloudSignInFlowTest.java')],{timeout:60000});
  assert.match(execFileSync(binary('java'),['-cp',temporary,'ai.elizaresearch.alphaphone.CloudSignInFlowTest'],{encoding:'utf8',timeout:60000}),/^PASS cloud sign-in flow \(\d+ checks\)/);
 }finally{rmSync(temporary,{recursive:true,force:true});}
});

test('the production manifest verifies only the eliza.app return; staging lives in the test-mocks overlay',()=>{
 const strip=text=>text.replace(/<!--[\s\S]*?-->/g,'');
 const main=strip(read('android/app/src/main/AndroidManifest.xml')),mocks=strip(read('android/app/src/testMocks/AndroidManifest.xml'));
 const filter=host=>`<intent-filter android:autoVerify="true"><action android:name="android.intent.action.VIEW"/><category android:name="android.intent.category.DEFAULT"/><category android:name="android.intent.category.BROWSABLE"/><data android:scheme="https" android:host="${host}" android:path="/alphaphone/auth/callback"/></intent-filter>`;
 const activity=between(main,'<activity android:name=".MainActivity"','</activity>');
 assert.ok(activity.includes(filter('eliza.app')),'MainActivity owns the verified production return');
 assert.ok(!main.includes('staging.eliza.app'),'no staging host in a product manifest');
 assert.ok(activity.includes('<data android:scheme="alphaphone" android:host="cloud-delegation"/>'),'the delegation return is unchanged');
 assert.ok(main.includes('<intent><action android:name="android.support.customtabs.action.CustomTabsService"/></intent>'),'Custom Tabs providers are visible');
 assert.ok(mocks.includes(filter('staging.eliza.app'))&&mocks.includes('<activity android:name=".MainActivity" tools:node="merge">'),'the staging return merges into MainActivity in test-mocks builds');
 const assetlinks=JSON.parse(read('android/app/src/main/assetlinks.template.json'));
 assert.equal(assetlinks[0].target.package_name,'ai.elizaresearch.alphaphone');
 assert.deepEqual(assetlinks[0].relation,['delegate_permission/common.handle_all_urls']);
});

test('the native sign-in client owns every secret, stores before ack, burns pending state and never logs',()=>{
 const plugin=read(native+'AlphaCloudSignInPlugin.java');
 assert.match(read(native+'MainActivity.java'),/registerPlugin\(AlphaCloudSignInPlugin\.class\);/);
 assert.match(read(native+'RendererCredentialSlots.java'),/"cloud-signin"/,'pending and receipt slots are native-only');
 assert.doesNotMatch(plugin,/android\.util\.Log|System\.out|printStackTrace|Log\.[dewiv]\(/,'nothing is logged');
 // The renderer receives only these outcome fields.
 for(const resolved of plugin.match(/\.resolve\([^;]*;/g)||[])assert.doesNotMatch(resolved,/token|secret|verifier|refresh|code"/i,resolved);
 const finish=between(plugin,'finish(current, new JSObject()','));');assert.doesNotMatch(finish,/secret|token\b/);
 // Fixed routes only, no redirects, origin and route checked before any connection.
 const post=between(plugin,'private Response post(Attempt current, CloudSignInFlow.Environment environment,','private static byte[] readBounded(');
 assert.ok(post.indexOf('ConnectionRoutes.signInOrigin(')<post.indexOf('openConnection()')&&post.indexOf('ConnectionRoutes.signInRoute(')<post.indexOf('openConnection()'));
 assert.match(post,/setInstanceFollowRedirects\(false\)/);
 // Google: pending record encrypted before the browser opens; burned before the exchange.
 const google=between(plugin,'@PluginMethod public void startGoogle(','/** Custom Tab in a browser');
 assert.ok(google.indexOf('writeCredentialSlot(PENDING_SLOT')<google.indexOf('openBrowser(url)'));
 const capture=between(plugin,'private boolean captureCallback(','private void burnUnclaimedPending()');
 assert.ok(capture.indexOf('intent.setData(null)')>0&&capture.indexOf('intent.setData(null)')<capture.indexOf('run(() ->'),'the return is consumed once');
 assert.ok(capture.indexOf('store.removeCredentialSlot(PENDING_SLOT)')<capture.indexOf('"/steward/auth/oauth/exchange"'),'single use before any network request');
 assert.match(capture,/!pending\.matches\(received, now\)/);
 assert.match(capture,/\.put\("codeVerifier", pending\.verifier\)/);
 // Tail: receipt and key stored before ack; bounded ack; Steward session revoked and never stored.
 const tail=between(plugin,'private void complete(Attempt current, JSONObject session)','/** Bounded retry:');
 const key=tail.indexOf('credentials.writeCredentialSlot("cloud:" + environment.name'),ack=tail.indexOf('acknowledge(current, proof');
 assert.ok(tail.indexOf('receipts.writeCredentialSlot(receiptSlot(environment)')<key&&key<ack,'receipt, then key, then ack');
 assert.match(tail,/AlphaLocalAgentPlugin\.reserveCredentialIntent\(\)/,'the key write follows the credential-intent rule');
 assert.match(tail,/"\/steward\/auth\/logout"/);
 assert.doesNotMatch(tail,/writeCredentialSlot\([^)]*(refresh|token\b)/,'the Steward session is never stored');
 assert.match(plugin,/for \(int round = 0; round < CloudSignInFlow\.ACK_ATTEMPTS; round\+\+\)/);
 assert.match(plugin,/@Override public void load\(\) \{[\s\S]*?run\(this::resumeAcknowledgements\);/,'an interrupted ack resumes on the next start');
 // Cancel burns the pending record; returning without a callback ends the attempt.
 assert.match(between(plugin,'@PluginMethod public void cancel(','@PluginMethod public void status('),/burnUnclaimedPending\(\);/);
 assert.match(between(plugin,'@Override protected void handleOnResume()','@Override protected void handleOnDestroy()'),/end\(current, "browser-closed"\)/);
 // One sign-in at a time.
 assert.match(google,/if \(attempt != null\) \{ call\.reject\("Another sign-in is in progress", "login-active"\); return; \}/);
});

test('the retired browser hand-off is a test-mocks fallback only',()=>{
 const connection=read(native+'AlphaConnectionPlugin.java');
 assert.match(connection,/if\(BuildConfig\.ELIZA_DEV_ALLOW_TEST_MOCKS&&"\/api\/auth\/cli-session"\.equals\(path\)\)operation=RequestOperation\.CLI_CREATE;/);
 assert.match(connection,/boolean cliLogin=BuildConfig\.ELIZA_DEV_ALLOW_TEST_MOCKS&&/);
 assert.match(connection,/if\(!BuildConfig\.ELIZA_DEV_ALLOW_TEST_MOCKS&&"\/auth\/cli-login"\.equals\(url\.getPath\(\)\)\)throw new IllegalArgumentException\(\);/);
 const routes=read('apps/app/src/runtime/managed-service-routes.ts');
 assert.doesNotMatch(routes,/cli-session/,'the product renderer allowlist has no browser hand-off');
 const protocol=read('apps/app/src/runtime/cloud-protocol.ts');
 assert.doesNotMatch(protocol.replace(/\/\*[\s\S]*?\*\//g,''),/cli-session|cli-login/,'the shipped protocol has no browser hand-off');
 assert.match(read('apps/app/src/runtime/development-cloud-agents.ts'),/export class DevelopmentCloudAgentProtocol extends LegacyCliLoginProtocol/);
 const ui=read('apps/app/src/runtime/connection-ui.tsx');
 assert.match(ui,/async signInDiagnostic\(environment: CloudEnvironment = state\.signIn\?\.environment \?\? cloud\.environment\) \{\n\s+if \(!testMocksEnabled\) return;/);
 assert.match(ui,/extra=\{testMocksEnabled\?<button/);
 const audit=read('scripts/audit-production-bundle.mjs');
 for(const marker of ["'/api/auth/cli-session'","'/auth/cli-login'","'Browser sign-in (diagnostic)'"])assert.ok(audit.includes(marker),marker);
});
