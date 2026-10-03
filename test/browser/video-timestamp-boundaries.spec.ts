import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const moduleUrl='/fixture-mediabunny.mjs',bundle=readFileSync(new URL('../../bundles/mediabunny.mjs',import.meta.resolve('mediabunny')),'utf8');
test('trim preserves only the chosen color frames and audio tone across timestamp boundaries',async({page})=>{
 await page.route('**/fixture-mediabunny.mjs',route=>route.fulfill({contentType:'text/javascript',body:bundle}));
 await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));await page.goto('/');
 const source=await page.evaluate(async moduleUrl=>{
  const m=await import(moduleUrl),target=new m.BufferTarget(),output=new m.Output({target,format:new m.WebMOutputFormat()});
  const canvas=document.createElement('canvas');canvas.width=160;canvas.height=120;const ctx=canvas.getContext('2d')!;
  const video=new m.CanvasSource(canvas,{codec:'vp8',bitrate:500000}),audio=new m.AudioBufferSource({codec:'opus',bitrate:128000});output.addVideoTrack(video);output.addAudioTrack(audio);await output.start();
  const buffer=new AudioBuffer({numberOfChannels:1,length:48000,sampleRate:48000}),samples=buffer.getChannelData(0);
  for(let i=0;i<samples.length;i++){const time=i/48000,freq=time<.25?440:time<.75?880:1760;samples[i]=.5*Math.sin(2*Math.PI*freq*time);}
  for(let i=0;i<20;i++){ctx.fillStyle=i<5?'#ff0000':i<15?'#00ff00':'#0000ff';ctx.fillRect(0,0,160,120);await video.add(i/20,.05);}
  await audio.add(buffer);await output.finalize();
  const source=await new Promise<string>(resolve=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.readAsDataURL(new Blob([target.buffer],{type:'video/webm'}));});
  return source;
 },moduleUrl);
 await page.reload();
 const result=await page.evaluate(async source=>{
  const {renderVideoEdit}=await import('/src/browser/video-edit.ts');const copy=await renderVideoEdit({path:source,duration:1},{start:.25,end:.75,rotation:90,crop:true},new AbortController().signal);
  const bytes=await(await fetch(copy.path)).arrayBuffer(),ac=new AudioContext();let duration:number,tones:number[];
  try{const decoded=await ac.decodeAudioData(bytes.slice(0)),data=decoded.getChannelData(0);duration=decoded.duration;tones=[.04,.2,.36].map(start=>{const from=Math.floor(start*decoded.sampleRate),to=Math.floor((start+.08)*decoded.sampleRate);let crossings=0;for(let i=from+1;i<to;i++)if(data[i-1]<=0&&data[i]>0)crossings++;return crossings/.08;});}finally{await ac.close();}
  return {duration,tones,width:copy.width,height:copy.height,path:copy.path};
 },source);
 await page.reload();
 const colors=await page.evaluate(async({moduleUrl,path})=>{const m=await import(moduleUrl),input=new m.Input({source:new m.BlobSource(await(await fetch(path)).blob()),formats:m.ALL_FORMATS});try{const track=await input.getPrimaryVideoTrack(),sink=new m.CanvasSink(track),colors=[];for(const at of [0,.2,.45]){const frame=await sink.getCanvas(at);if(!frame)throw Error('Export has no decoded video frame at '+at+' seconds');const c=frame.canvas;colors.push([...c.getContext('2d').getImageData(Math.floor(c.width/2),Math.floor(c.height/2),1,1).data]);}return colors;}finally{input.dispose();}},{moduleUrl,path:result.path});
 expect(result.duration).toBeGreaterThanOrEqual(.48);expect(result.duration).toBeLessThan(.56);for(const tone of result.tones)expect(tone).toBeGreaterThan(830),expect(tone).toBeLessThan(930);for(const [r,g,b] of colors){expect(g).toBeGreaterThan(200);expect(r).toBeLessThan(35);expect(b).toBeLessThan(35);}expect(result.height).toBeGreaterThan(result.width);
});
