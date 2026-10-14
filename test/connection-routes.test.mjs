import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {nativeSource,fixture,runJvm} from './fixtures/jvm-tools.mjs';

// Plain-JVM compile and run of the native renderer-transport route policy. This does not build an
// APK, run on Android, or contact Eliza Cloud or any agent.
// The JDK is JAVA_HOME, else the Homebrew openjdk@21 on darwin when it is installed, else javac on PATH.
test('native transport refuses production pairing and non-Cloud origins and admits DELETE only for Cloud self-revocation',()=>{
 assert.match(runJvm([nativeSource('ConnectionRoutes.java'),fixture('ConnectionRoutesTest.java')],'ai.elizaresearch.alphaphone.ConnectionRoutesTest'),/^PASS connection routes/);
});

// Source-order check of the plugin that applies the policy; the policy itself is run on the JVM above.
test('the transport applies the origin policy before any connection and never touches a credential slot',()=>{
 const source=readFileSync(resolve(import.meta.dirname,'../android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaConnectionPlugin.java'),'utf8');
 const request=source.slice(source.indexOf('@PluginMethod public void request('),source.indexOf('@PluginMethod public void cancel('));
 const validated=request.indexOf('validatedUrl(call.getString("url"), true)');
 const guard=request.indexOf('if(!ConnectionRoutes.admittedOrigin(url.getScheme(),url.getHost(),url.getPort(),BuildConfig.ELIZA_DEV_ALLOW_TEST_MOCKS))throw new IllegalArgumentException();');
 assert.ok(validated>0&&guard>validated,'the origin guard follows URL validation');
 for(const later of ['openConnection()','call.getObject("headers"','call.getString("body")','foregroundLock.wait','ConnectionRoutes.retiredPairing('])
  assert.ok(request.indexOf(later)>guard,`${later} comes after the origin guard`);
 const service=request.indexOf('if(!ConnectionRoutes.managedService(');
 assert.ok(service>guard&&service<request.indexOf('openConnection()')&&service<request.indexOf('call.getObject("headers"'),'managed path admission precedes transport/header handling');
 assert.doesNotMatch(request,/storage\(|CredentialSlot|AlphaCredentialStore|secure(Read|Write|Remove)/,'request() has no credential-slot access');
});

// Source check that openExternal decides its host from ConnectionRoutes (run on the JVM above).
test('openExternal admits only the ConnectionRoutes hosts and reads the sign-in handoff from it',()=>{
 const source=readFileSync(resolve(import.meta.dirname,'../android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaConnectionPlugin.java'),'utf8');
 const open=source.slice(source.indexOf('@PluginMethod public void openExternal('),source.indexOf('@Override protected void handleOnPause('));
 const guard=open.indexOf('if (!ConnectionRoutes.externalHost(url.getScheme(), url.getHost(), url.getPort(), BuildConfig.ELIZA_DEV_ALLOW_TEST_MOCKS)) throw new IllegalArgumentException();');
 assert.ok(guard>0&&guard<open.indexOf('new Intent(Intent.ACTION_VIEW'),'the host rule precedes the intent');
 assert.match(open,/boolean cliLogin=ConnectionRoutes\.externalCliLogin\(url\.getHost\(\),url\.getPath\(\),BuildConfig\.ELIZA_DEV_ALLOW_TEST_MOCKS\);/);
 assert.doesNotMatch(open,/endsWith\("\.eliza\.app"\)|staging\.eliza\.app/,'no host rule remains in the plugin');
});
