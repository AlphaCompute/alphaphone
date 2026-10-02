import {registerPlugin} from '../platform-plugins';
type Bag=Record<string,any>;
/** Local seed messages have transcripts rather than recordings. Read them with the local voice. */
export function installSimulatedVoicemail(phone:Bag){
 const Voice=registerPlugin<any>('AlphaVoiceCloud');
 let generation=0,owned=false,id:string|undefined,api:Bag|undefined;
 let listeners:Array<{remove:()=>Promise<void>}>=[];
 const stop=(finished=false)=>{
  generation++;id=undefined;const old=listeners;listeners=[];for(const listener of old)void listener.remove();
  if(owned){owned=false;void Voice.stopPlayback().catch(()=>{});}
  api?.set({playing:null,vpos:finished?1:0});
 };
 const play=async(row:Bag,currentApi:Bag)=>{
  if(currentApi.get('phone').playing===row.id){stop();return;}
  stop();api=currentApi;const epoch=generation;owned=true;api.set({playing:row.id,vpos:0});
  try{
   for(const event of ['playbackEnded','playbackFailed']){
    const listener=await Voice.addListener(event,(result:Bag)=>{if(epoch!==generation||result.playbackId!==id)return;stop(event==='playbackEnded');if(event==='playbackFailed')currentApi.toast('Read the voicemail transcript or try playback again.');});
    if(epoch!==generation){void listener.remove();return;}listeners.push(listener);
   }
   const prepared=await Voice.synthesizeLocal({text:row.text});if(epoch!==generation)return;id=prepared.playbackId;
   await Voice.play({playbackId:id});
  }catch{if(epoch===generation){stop();currentApi.toast('Read the voicemail transcript or try playback again.');}}
 };
 const render=phone.render,leave=phone.onLeave,back=phone.back;
 phone.render=(state:Bag,currentApi:Bag)=>{
  const out=render(state,currentApi);
  const wrap=(fn:()=>unknown)=>()=>{stop();return fn();};
  out.vms=out.vms.map((item:Bag,index:number)=>({...item,recordingOnlyCss:'display:none',readingLabel:state.playing===state.vms[index].id?'Reading transcript':'Local transcript',playLabel:state.playing===state.vms[index].id?'Stop reading':'Read voicemail',play:()=>void play(state.vms[index],currentApi),toggle:wrap(item.toggle),del:wrap(item.del),call:wrap(item.call),msg:wrap(item.msg)}));
  out.tabs=out.tabs.map((tab:Bag)=>({...tab,pick:wrap(tab.pick)}));return out;
 };
 phone.onLeave=(currentApi:Bag)=>{stop();return leave?.(currentApi);};
 phone.back=(state:Bag,currentApi:Bag)=>{if(state.vmOpen)stop();return back?.(state,currentApi);};
 const retire=()=>stop(),visibility=()=>{if(document.hidden)stop();};
 window.addEventListener('pagehide',retire);window.addEventListener('alpha:device-state',retire);document.addEventListener('visibilitychange',visibility);window.addEventListener('alpha:dev-incoming-call',retire);
 return ()=>{stop();api=undefined;window.removeEventListener('pagehide',retire);window.removeEventListener('alpha:device-state',retire);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('alpha:dev-incoming-call',retire);};
}
