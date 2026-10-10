import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

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

function rendererFixture(status,{native=true,kind='resident'}={}){
 let connection={kind,session:{sessionId:'owned-resident'}},reads=0;
 const source=readFileSync(resolve('apps/app/src/prototype/native-adapter.ts'),'utf8').replace(/^import .*;\n/gm,'');
 const box={Capacitor:{isNativePlatform:()=>native},browserDevProfile:false,DailyApps:{},connectionController:{getSnapshot:()=>connection},registerPlugin:()=>({providerStatus:()=>{reads++;return Promise.resolve(status);}})};
 vm.runInNewContext(stripTypeScriptTypes(source,{mode:'transform'}).replace(/\bexport /g,'')+'\nglobalThis.install=installPrototypeNativeAdapters;',box);
 const render=()=>({stack:['Models','About'].map(title=>({title,groups:[{rows:[{label:'Inference model',val:'Not reported by agent'}]}]}))});
 const views={settings:{render}};box.install({},views);
 // Settings installs later in the real app; the native honesty pass must stay outermost.
 views.settings.render=render;
 return {render:()=>views.settings.render({page:'models'},{set(){}}),reads:()=>reads,connection:patch=>{connection={...connection,...patch};}};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function labels(out){return out.stack.map(page=>page.groups[0].rows[0].val);}
for(const [provider,model,label] of [['elizacloud','cerebras/qwen-3.8-27b','Eliza Cloud · cerebras/qwen-3.8-27b'],['cerebras','qwen-3.8-27b','Cerebras · qwen-3.8-27b']])test(`native Models and About display verified ${provider} identity`,async()=>{
 const f=rendererFixture({provider,model,configured:true,apiKey:'synthetic-must-not-display'});
 assert.deepEqual(labels(f.render()),['Not reported by agent','Not reported by agent']);await flush();
 assert.deepEqual(labels(f.render()),[label,label]);assert.equal(f.reads(),1);assert.ok(!JSON.stringify(f.render()).includes('synthetic-must-not-display'));
});
for(const status of [{provider:'elizacloud',model:'cerebras/qwen-3.8-27b',configured:false},{provider:'cerebras',model:'qwen',configured:false},{provider:'unknown',model:'qwen',configured:true},{provider:'elizacloud',model:'bad model\nvalue',configured:true},{}])test(`unknown or unconfigured provider retains honest fallback: ${JSON.stringify(status)}`,async()=>{
 const f=rendererFixture(status);f.render();await flush();assert.deepEqual(labels(f.render()),['Not reported by agent','Not reported by agent']);assert.equal(f.reads(),1);
});
for(const options of [{native:false},{kind:'remote'},{kind:'offline'}])test(`other connection surfaces keep existing model fallback: ${JSON.stringify(options)}`,async()=>{
 const f=rendererFixture({provider:'cerebras',model:'qwen',configured:true},options);f.render();await flush();assert.deepEqual(labels(f.render()),['Not reported by agent','Not reported by agent']);assert.equal(f.reads(),0);
});
