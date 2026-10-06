import test from 'node:test';
import assert from 'node:assert/strict';
import { requireStockVideoEvidence, videoMethods } from '../scripts/stock-video-evidence.mjs';
const appId = 'ai.elizaresearch.alphaphone';
const input = {serial:'emulator-5554',runId:'123',runAttempt:'2',artifactHashes:{'standalone-debug.apk':'b'.repeat(64),'standalone-androidTest.apk':'c'.repeat(64),'launcher-debug.apk':'d'.repeat(64),'launcher-androidTest.apk':'e'.repeat(64)},appId};
function fixture() {
 const instrumentation = videoMethods.flatMap(method => [1,0].flatMap(code => [`INSTRUMENTATION_STATUS: class=${appId}.VideoInstrumentedTest`,`INSTRUMENTATION_STATUS: test=${method}`,`INSTRUMENTATION_STATUS_CODE: ${code}`])).join('\n')+'\nOK (2 tests)';
 return {status:'passed',serial:input.serial,runId:input.runId,runAttempt:input.runAttempt,artifactHashes:{...input.artifactHashes},provider:{package:'com.android.webview',version:'124.0.6367.219',sha256:'a'.repeat(64)},cleanupVerified:true,variants:{standalone:{instrumentation},launcher:{instrumentation}}};
}
test('admits both video cases on both exact same-run APK pairs',()=>assert.equal(requireStockVideoEvidence(fixture(),input).status,'passed'));
for(const [name,mutate] of [
 ['skipped video',r=>r.variants.launcher.instrumentation=r.variants.launcher.instrumentation.replace('CODE: 0','CODE: -4')],
 ['missing start',r=>r.variants.standalone.instrumentation=r.variants.standalone.instrumentation.replace('CODE: 1','CODE: 2')],
 ['duplicate method',r=>r.variants.standalone.instrumentation=r.variants.standalone.instrumentation.replaceAll(videoMethods[1],videoMethods[0])],
 ['missing variant',r=>delete r.variants.launcher],
 ['different APK',r=>r.artifactHashes['standalone-androidTest.apk']='f'.repeat(64)],
 ['previous attempt',r=>r.runAttempt='1'],
 ['different emulator',r=>r.serial='emulator-5556'],
 ['replacement provider',r=>r.provider.version='157.0.8083.0'],
 ['uncertain cleanup',r=>r.cleanupVerified=false],
]) test(`rejects ${name}`,()=>{const r=fixture();mutate(r);assert.throws(()=>requireStockVideoEvidence(r,input));});
