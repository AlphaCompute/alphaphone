import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
// Opt-in provider measurement using the actual paired agent and Cloud route.
test('paired Cloud TTS measures three identical phrases without a model or recording',async({page},info)=>{
 test.skip(process.env.ALPHA_LIVE_CLOUD_VOICE_QA!=='1','Requires explicit live Cloud speech opt-in');test.setTimeout(120000);
 const receipt:any={startedAt:new Date().toISOString(),text:'Hello. Welcome back to Alpha.',calls:[],responses:[]},requests=new Map();
 page.on('request',request=>{try{if(request.url().endsWith('/__alpha-local-agent')&&JSON.parse(request.postData()||'{}').path==='/api/tts/cloud')requests.set(request,Date.now());}catch{}});
 page.on('response',async response=>{const at=requests.get(response.request());if(!at)return;try{const data=await response.json(),body=JSON.parse(data.body||'{}');receipt.responses.push({status:data.status,doneMs:Date.now()-at,provider:body.provider,route:body.route,moderationCache:data.moderationCache,timings:data.timings,audioBase64Bytes:body.audioBase64?.length});}catch{receipt.responses.push({status:response.status(),invalidEnvelope:true});}});
 await page.goto('/');await expect.poll(()=>page.evaluate(async()=>{const {connectionController:c}=await import('/src/runtime/connection-ui.tsx');return !!c.getBrowserSpeechAgent()?.session&&!c.getSnapshot().busy&&!c.getSnapshot().open;}),{timeout:30000}).toBe(true);
 try{for(let i=0;i<3;i++){const result=await page.evaluate(async text=>{const {connectionController:c}=await import('/src/runtime/connection-ui.tsx');const agent=c.getBrowserSpeechAgent();if(!agent)throw Error('Paired speech agent unavailable');const started=performance.now(),audio=await agent.developmentCloudSpeech({kind:'tts',text},AbortSignal.timeout(25000));if(!(audio instanceof Blob))throw Error('Cloud TTS did not return audio');return {doneMs:performance.now()-started,bytes:audio.size,contentType:audio.type};},receipt.text);receipt.calls.push(result);expect(result.bytes).toBeGreaterThan(0);expect(result.contentType).toBe('audio/mpeg');}
 await expect.poll(()=>receipt.responses.length).toBe(3);for(const row of receipt.responses){expect(row.status).toBe(200);expect(row.provider).toBe('cartesia');expect(row.route).toBe('cloud');}
 }finally{await writeFile(info.outputPath('receipt.json'),JSON.stringify(receipt,null,2));}
});
