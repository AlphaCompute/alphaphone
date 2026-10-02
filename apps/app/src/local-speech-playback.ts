import {Capacitor} from '@capacitor/core';
import {registerPlugin} from './platform-plugins';
/** Wait for this utterance's terminal event; never stop a replacement owned by another consumer. */
export async function speakLocalText(text:string,signal:AbortSignal,onStarted?:()=>void){
 signal.throwIfAborted();const voice=registerPlugin<any>('AlphaVoiceCloud');
 const requestId=crypto.randomUUID();let playbackId:string|undefined;
 const listeners:Array<{remove:()=>Promise<void>}>=[];let settle:(error?:Error)=>void=()=>{};
 let timer:ReturnType<typeof setTimeout>|undefined;
 const finished=new Promise<void>((resolve,reject)=>{settle=error=>error?reject(error):resolve();});
 void finished.catch(()=>{});
 const cancel=()=>{settle(new DOMException('Speech cancelled','AbortError'));if(Capacitor.isNativePlatform())void voice.cancel({requestId}).catch(()=>{});if(playbackId||Capacitor.isNativePlatform())void voice.stopPlayback({playbackId,requestId}).catch(()=>{});};
 signal.addEventListener('abort',cancel,{once:true});
 try{
  signal.throwIfAborted();({playbackId}=await voice.synthesizeLocal({text,requestId}));signal.throwIfAborted();
  for(const event of ['playbackEnded','playbackFailed','playbackStopped']){
   listeners.push(await voice.addListener(event,(value:{playbackId:string})=>{if(value.playbackId!==playbackId)return;settle(event==='playbackEnded'?undefined:Error(event==='playbackStopped'?'Speech was stopped before completion.':'Speech playback failed.'));}));
   signal.throwIfAborted();
  }
  signal.throwIfAborted();
  timer=setTimeout(()=>settle(Error('Speech did not finish. Try the step again.')),20*60*1000);
  await voice.play({playbackId});signal.throwIfAborted();onStarted?.();await finished;
 }finally{
  clearTimeout(timer);signal.removeEventListener('abort',cancel);
  await Promise.allSettled(listeners.map(listener=>listener.remove()));
  if(playbackId||Capacitor.isNativePlatform())await voice.stopPlayback({playbackId,requestId});
 }
}

