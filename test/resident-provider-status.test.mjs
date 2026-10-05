import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

// Source-level guard for the non-secret resident provider status bridge. JVM behaviour is
// exercised by the Android build; this only proves the method cannot return the stored key.
const java=readFileSync(resolve('android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaLocalAgentPlugin.java'),'utf8');
const body=(start)=>{const at=java.indexOf(start);assert.ok(at>=0,start);let depth=0;for(let i=java.indexOf('{',at);i<java.length;i++){if(java[i]==='{')depth++;else if(java[i]==='}'&&--depth===0)return java.slice(at,i+1);}throw Error('unterminated '+start);};

test('provider status reports only provider, configuration and model identity',()=>{
 const identity=body('static JSObject providerIdentity(');
 const keys=[...identity.matchAll(/\.put\("([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual([...new Set(keys)].sort(),['configured','model','provider']);
 assert.doesNotMatch(identity,/"key"|apiKey|getString\(/);
 assert.match(identity,/put\("provider","cerebras"\)/);
 const method=body('@PluginMethod public void providerStatus(');
 assert.match(method,/providerIdentity\(/);
 assert.doesNotMatch(method,/"key"|apiKey|CEREBRAS_API_KEY/);
});
test('configured model validation matches provider configuration',()=>{
 assert.match(java,/static final String PROVIDER_MODEL_PATTERN="\[A-Za-z0-9\]\[A-Za-z0-9\._\/-\]\{0,127\}";/);
 assert.match(java,/!model\.matches\("\[A-Za-z0-9\]\[A-Za-z0-9\._\/-\]\{0,127\}"\)/);
});
test('renderer copies only provider and model from the status bridge',()=>{
 const adapter=readFileSync(resolve('apps/app/src/prototype/native-adapter.ts'),'utf8');
 assert.match(adapter,/residentProvider\.providerStatus\(\)/);
 assert.doesNotMatch(adapter,/status\??\.(apiKey|key)\b/);
 assert.doesNotMatch(adapter,/(big|sub|val)\s*[:=]\s*'(Redaction on|Identifiers replaced)/);
});
