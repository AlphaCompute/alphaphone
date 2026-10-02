import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));});
test('browser voice encodes audio, reviews a transcript, persists audio and reloads it',async({page})=>{
 await page.goto('/');
 await page.evaluate(async()=>{
  const ctx=new AudioContext(),osc=ctx.createOscillator(),sink=ctx.createMediaStreamDestination();osc.connect(sink);osc.start();await ctx.resume();
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>sink.stream,configurable:true});
  (window as any).audioFixture={ctx,osc,stream:sink.stream};
  const {registerPlugin}=await import('/src/platform-plugins.ts');const voice=registerPlugin<any>('AlphaVoiceCloud');
  await voice.startRecording();
 });
 // Allow the real MediaRecorder to encode several audio packets from the synthetic source.
 await page.waitForTimeout(400);
 const clip=await page.evaluate(async()=>{const {registerPlugin}=await import('/src/platform-plugins.ts');return registerPlugin<any>('AlphaVoiceCloud').stopRecording();});
 expect(clip.durationMs).toBeGreaterThan(0);
 await page.evaluate(async(id)=>{const {registerPlugin}=await import('/src/platform-plugins.ts');(window as any).transcript=registerPlugin<any>('AlphaVoiceCloud').transcribeLocalRecording({recordingId:id});},clip.recordingId);
 await page.getByRole('textbox',{name:'Transcript',exact:true}).fill('Reviewed local audio');await page.getByRole('button',{name:'Use transcript',exact:true}).click();
 const saved=await page.evaluate(async(id)=>{
  const {registerPlugin}=await import('/src/platform-plugins.ts');const voice=registerPlugin<any>('AlphaVoiceCloud'),transcript=await (window as any).transcript;
  const put=IDBObjectStore.prototype.put;let failed=false;
  IDBObjectStore.prototype.put=function(...args:any[]){const request=put.apply(this,args as any);if(this.name==='audio')this.transaction.abort();return request;};
  try{await voice.saveRecording({recordingId:id,noteId:'audio-test-note',transcript:transcript.text});}catch{failed=true;}finally{IDBObjectStore.prototype.put=put;}
  if(!failed)throw Error('Aborted storage transaction did not reject');
  const result=await voice.saveRecording({recordingId:id,noteId:'audio-test-note',transcript:transcript.text});
  const fixture=(window as any).audioFixture;const stopped=fixture.stream.getTracks().every((t:MediaStreamTrack)=>t.readyState==='ended');fixture.osc.stop();await fixture.ctx.close();
  return {...result,stopped};
 },clip.recordingId);
 expect(saved.stopped).toBe(true);expect(saved.transcript).toBe('Reviewed local audio');
 await page.evaluate(async(id)=>{const {registerPlugin}=await import('/src/platform-plugins.ts');(window as any).cancelledTranscript=registerPlugin<any>('AlphaVoiceCloud').transcribeLocalRecording({recordingId:id}).then(()=>false,()=>true);},clip.recordingId);
 await expect(page.getByRole('dialog',{name:'Recording transcript'})).toBeVisible();
 await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
 expect(await page.evaluate(()=>(window as any).cancelledTranscript)).toBe(true);
 await expect(page.getByRole('dialog',{name:'Recording transcript'})).toHaveCount(0);await page.reload();
 const retained=await page.evaluate(async(id)=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('alpha.browser.audio.v1');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const row:any=await new Promise((resolve,reject)=>{const r=db.transaction('audio').objectStore('audio').get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const ctx=new AudioContext(),decoded=await ctx.decodeAudioData(await row.blob.arrayBuffer());const result={size:row.blob.size,noteId:row.noteId,duration:decoded.duration};await ctx.close();db.close();return result;
 },saved.audioId);
 expect(retained.noteId).toBe('audio-test-note');expect(retained.size).toBeGreaterThan(0);expect(retained.duration).toBeGreaterThan(.1);
});
test('permission denial can retry; pagehide releases active audio and cancels pending permission',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {registerPlugin}=await import('/src/platform-plugins.ts');const voice=registerPlugin<any>('AlphaVoiceCloud');
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{throw new DOMException('Denied','NotAllowedError');},configurable:true});
  let denied=false;try{await voice.startRecording();}catch{denied=true;}
  let release!:(stream:MediaStream)=>void;
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:()=>new Promise<MediaStream>(resolve=>release=resolve),configurable:true});
  const pending=voice.startRecording().then(()=>false,()=>true);
  // Capacitor dispatches the web method asynchronously.
  while(!release)await new Promise(resolve=>setTimeout(resolve,0));
  window.dispatchEvent(new Event('pagehide'));
  const ctx=new AudioContext(),sink=ctx.createMediaStreamDestination();release(sink.stream);const cancelled=await pending;
  const released=sink.stream.getTracks().every(t=>t.readyState==='ended');
  const live=ctx.createMediaStreamDestination();Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>live.stream,configurable:true});await voice.startRecording();
  window.dispatchEvent(new Event('pagehide'));await new Promise(resolve=>setTimeout(resolve,0));
  const activeReleased=live.stream.getTracks().every(t=>t.readyState==='ended');await ctx.close();return {denied,cancelled,released,activeReleased};
 });expect(result).toEqual({denied:true,cancelled:true,released:true,activeReleased:true});
});
test('stored audio uses the real player, completes, and releases its URL on pagehide',async({page})=>{
 await page.goto('/');
 await page.evaluate(async()=>{
  const rate=8000,seconds=1,buffer=new ArrayBuffer(44+rate*seconds*2),view=new DataView(buffer);
  const text=(at:number,s:string)=>{for(let i=0;i<s.length;i++)view.setUint8(at+i,s.charCodeAt(i));};
  text(0,'RIFF');view.setUint32(4,buffer.byteLength-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,buffer.byteLength-44,true);
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('alpha.browser.audio.v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('audio',{keyPath:'audioId'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  await new Promise<void>((resolve,reject)=>{const tx=db.transaction('audio','readwrite');tx.objectStore('audio').put({audioId:'silent-fixture',noteId:'fixture',blob:new Blob([buffer],{type:'audio/wav'}),durationMs:1000});tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();
  const {registerPlugin}=await import('/src/platform-plugins.ts');const voice=registerPlugin<any>('AlphaNoteAudio');
  const revoked:string[]=[],events:any[]=[];const revoke=URL.revokeObjectURL.bind(URL);URL.revokeObjectURL=url=>{revoked.push(url);revoke(url);};
  await voice.addListener('playbackEnded',(event:any)=>events.push(event));(window as any).playbackFixture={voice,revoked,events};
  const button=document.createElement('button');button.textContent='Play stored fixture';button.style.cssText='position:fixed;top:4px;left:4px;z-index:99999';button.onclick=()=>{(window as any).playing=voice.play({audioId:'silent-fixture'});};document.body.append(button);
 });
 await page.getByRole('button',{name:'Play stored fixture'}).click();await page.evaluate(()=>(window as any).playing);
 expect(await page.evaluate(async()=>((window as any).playbackFixture.voice.state()))).toMatchObject({playing:true,audioId:'silent-fixture'});
 await expect.poll(()=>page.evaluate(()=>(window as any).playbackFixture.events.length)).toBe(1);
 expect(await page.evaluate(async()=>({state:await (window as any).playbackFixture.voice.state(),released:(window as any).playbackFixture.revoked.length}))).toMatchObject({state:{playing:false},released:1});
 await page.getByRole('button',{name:'Play stored fixture'}).click();await page.evaluate(()=>(window as any).playing);
 await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
 await expect.poll(()=>page.evaluate(async()=>(await (window as any).playbackFixture.voice.state()).playing)).toBe(false);
 expect(await page.evaluate(()=>(window as any).playbackFixture.revoked.length)).toBe(2);
});
