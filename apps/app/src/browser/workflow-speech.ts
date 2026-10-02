import {registerPlugin} from '../platform-plugins';
/** Wait for this utterance's terminal event; never stop a replacement owned by another consumer. */
export async function speakWorkflowText(text:string,signal:AbortSignal){
 signal.throwIfAborted();const voice=registerPlugin<any>('AlphaVoiceCloud');
 const {playbackId}=await voice.synthesizeLocal({text});signal.throwIfAborted();
 const listeners:Array<{remove:()=>Promise<void>}>=[];let settle:(error?:Error)=>void=()=>{};
 let timer:ReturnType<typeof setTimeout>|undefined;
 const finished=new Promise<void>((resolve,reject)=>{settle=error=>error?reject(error):resolve();});
 void finished.catch(()=>{});
 const cancel=()=>{settle(new DOMException('Speech cancelled','AbortError'));void voice.stopPlayback({playbackId});};
 try{
  for(const event of ['playbackEnded','playbackFailed','playbackStopped']){
   listeners.push(await voice.addListener(event,(value:{playbackId:string})=>{if(value.playbackId!==playbackId)return;settle(event==='playbackEnded'?undefined:Error(event==='playbackStopped'?'Speech was stopped before completion.':'Speech playback failed.'));}));
   signal.throwIfAborted();
  }
  signal.addEventListener('abort',cancel,{once:true});signal.throwIfAborted();
  timer=setTimeout(()=>settle(Error('Speech did not finish. Try the step again.')),20*60*1000);
  await voice.play({playbackId});await finished;
 }finally{
  clearTimeout(timer);signal.removeEventListener('abort',cancel);
  await Promise.all(listeners.map(listener=>listener.remove()));
  await voice.stopPlayback({playbackId});
 }
}
