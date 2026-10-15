import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';

test('aborting while native start is pending sends Stop before startup resolves', async () => {
 const listeners=new Map();let settleStart, captureId, stops=0, cancelled=0;
 const plugin={
  async addListener(name,handler){listeners.set(name,handler);return {remove:async()=>listeners.delete(name)};},
  startLiveCapture(input){captureId=input.captureId;return new Promise(resolve=>{settleStart=resolve;});},
  async stopLiveCapture(){stops++;listeners.get('liveCaptureEnded')?.({captureId});return {captureId};},
 };
 const fixture={Capacitor:{isNativePlatform:()=>true,isPluginAvailable:()=>true},registerPlugin:()=>plugin,
  connectionController:{getResidentLiveVoice:()=>({sessionId:'owner',request:async()=>({})})},
  createLiveSegmentStream:()=>({cancel(){cancelled++;},accept:async()=>{},cutoff(){},close:async()=>{},speaking:()=>false}),LIVE_ASR_PATH:'/live',LIVE_ASR_STATUS_PATH:'/status'};
 globalThis.__alphaNativeStartFixture=fixture;
 try{
  // Execute the production adapter with only its platform/transport imports replaced by ports.
  const source=fs.readFileSync(new URL('../apps/app/src/runtime/native-live-voice.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
  const prefix='const {Capacitor,registerPlugin,connectionController,createLiveSegmentStream,LIVE_ASR_PATH,LIVE_ASR_STATUS_PATH}=globalThis.__alphaNativeStartFixture;\n';
  const module=await import('data:text/javascript;base64,'+Buffer.from(prefix+stripTypeScriptTypes(source)).toString('base64'));
  const controller=new AbortController();
  const opening=module.openNativeLiveStream({signal:controller.signal,echoCancel:false,onSegment(){},onLost(){}});
  for(let i=0;i<10&&!settleStart;i++)await Promise.resolve();
  assert.equal(typeof settleStart,'function');controller.abort();
  await Promise.resolve();assert.equal(stops,1,'Stop cannot wait for start acknowledgement');assert.ok(cancelled>0);
  settleStart({captureId,sampleRate:16000,echoCancelled:false});
  await assert.rejects(opening,{name:'AbortError'});assert.equal(listeners.size,0);
 }finally{delete globalThis.__alphaNativeStartFixture;}
});
