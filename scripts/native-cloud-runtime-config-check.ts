import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const [sdk,module]=process.argv.slice(2);
if(!sdk||!module)throw Error('Prepared SDK and compiled host are required');
const state=fs.mkdtempSync(path.join(os.tmpdir(),'alpha-native-cloud-routing-'));
Object.assign(process.env,{ELIZA_STATE_DIR:state,ELIZA_CONFIG_PATH:path.join(state,'eliza.json'),ELIZA_PERSIST_CONFIG_PATH:path.join(state,'eliza.json'),ELIZA_PLATFORM:'android',ELIZAOS_CLOUD_USE_INFERENCE:'true',ELIZAOS_CLOUD_API_KEY:'synthetic-native-cloud-key',ELIZAOS_CLOUD_BASE_URL:'https://api.eliza.app/api/v1',ELIZAOS_CLOUD_SMALL_MODEL:'cerebras/qwen-3.8-27b',ELIZAOS_CLOUD_LARGE_MODEL:'cerebras/qwen-3.8-27b'});
fs.writeFileSync(process.env.ELIZA_CONFIG_PATH!,JSON.stringify({cloud:{enabled:false,apiKey:'stale-synthetic-key'},serviceRouting:{llmText:{backend:'eliza-local-inference',transport:'local'}},features:{shellEnabled:false}}));
fs.mkdirSync(path.join(state,'local-inference'));
fs.writeFileSync(path.join(state,'local-inference/routing.json'),JSON.stringify({version:1,preferences:{policy:{TEXT_SMALL:'local-only',TEXT_LARGE:'prefer-local'},preferredProvider:{TEXT_SMALL:'capacitor-llama',TEXT_EMBEDDING:'local-embedding-fixture'}}}));
let host:{close():Promise<void>}|undefined,providerRequests=0;
try{
 const {startNativeGoogleAgentHost}=await import(pathToFileURL(module).href);
 const user='11111111-1111-4111-8111-111111111111',org='22222222-2222-4222-8222-222222222222';
 host=await startNativeGoogleAgentHost({binding:{credentialId:'44444444-4444-4444-8444-444444444444',userId:user,organizationId:org,accountRef:JSON.stringify(['cloud','production',user,org]),sessionGeneration:'synthetic-generation',token:'synthetic-native-cloud-key'},apiToken:'Z_-q'.repeat(16),request:async()=>{providerRequests++;throw Error('Provider traffic forbidden in startup fixture');}});
 const actual=JSON.parse(fs.readFileSync(process.env.ELIZA_CONFIG_PATH!,'utf8'));
 assert.equal(actual.serviceRouting.llmText.backend,'elizacloud');assert.equal(actual.serviceRouting.llmText.transport,'cloud-proxy');assert.equal(actual.serviceRouting.llmText.smallModel,'cerebras/qwen-3.8-27b');assert.equal(actual.serviceRouting.llmText.largeModel,'cerebras/qwen-3.8-27b');assert.equal(actual.features.shellEnabled,false);
 const prefs=JSON.parse(fs.readFileSync(path.join(state,'local-inference/routing.json'),'utf8')).preferences;
 for(const slot of ['TEXT_SMALL','TEXT_LARGE']){assert.equal(prefs.preferredProvider[slot],'elizacloud');assert.equal(prefs.policy[slot],'manual');}
 for(const slot of ['TRANSCRIPTION','TEXT_TO_SPEECH'])assert.equal(prefs.policy[slot],'local-only');assert.equal(prefs.preferredProvider.TEXT_EMBEDDING,'local-embedding-fixture');
 const {AgentRuntime,ModelType}=await import(pathToFileURL(Bun.resolveSync('@elizaos/core',sdk)).href);
 const {installRouterHandler}=await import(pathToFileURL(path.join(sdk,'plugins/plugin-local-inference/src/services/router-handler.ts')).href);
 const runtime=new AgentRuntime({character:{name:'Native route QA'}});let cloudCalls=0,localCalls=0;const modelLogs:unknown[]=[];
 runtime.registerDatabaseAdapter({createLogs:async(rows:unknown[])=>{modelLogs.push(...rows);}});
 for(const slot of [ModelType.TEXT_SMALL,ModelType.TEXT_LARGE]){runtime.registerModel(slot,async()=>{cloudCalls++;return 'Cloud route selected';},'elizacloud',50);runtime.registerModel(slot,async()=>{localCalls++;throw Error('Local chat must not run');},'capacitor-llama',0);}
 installRouterHandler(runtime);
 for(const slot of [ModelType.TEXT_SMALL,ModelType.TEXT_LARGE])assert.equal(await runtime.useModel(slot,{prompt:'Synthetic route check'}),'Cloud route selected');
 assert.equal(cloudCalls,2);assert.equal(localCalls,0);assert.equal(modelLogs.length,2);assert.equal(providerRequests,0);
 const saved=fs.readFileSync(process.env.ELIZA_CONFIG_PATH!,'utf8');assert.ok(!saved.includes('synthetic-native-cloud-key'));assert.ok(!saved.includes('stale-synthetic-key'));
 console.log(JSON.stringify({compiledHostStartup:true,realRuntimeCloudSelections:cloudCalls,localTextCalls:localCalls,providerRequests,credentialPersisted:false}));
}finally{await host?.close();fs.rmSync(state,{recursive:true,force:true});}
