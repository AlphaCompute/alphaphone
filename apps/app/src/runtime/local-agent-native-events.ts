/** Live, voice-only native events. No replay, persistence or automatic resubscription. */
export interface NativeVoiceEventPort {
 addListener(name: 'alphaVoiceEvent', listener: (value: any) => void): Promise<{remove(): Promise<void>}>;
 subscribeVoiceEvents(input: {subscriptionId: string; ownerId: string}): Promise<{subscriptionId: string}>;
 unsubscribeVoiceEvents(input: {subscriptionId: string}): Promise<unknown>;
}
export function subscribeNativeVoiceEvents(port: NativeVoiceEventPort, ownerId: string, listener: (envelope: unknown) => void): () => void {
 const subscriptionId=crypto.randomUUID();
 let active=true,dispatched=false,remove:(()=>Promise<void>)|undefined;
 const quiet=(work:Promise<unknown>)=>{void work.catch(()=>{});};
 const close=()=>{if(!active)return;active=false;if(remove)quiet(remove());if(dispatched)quiet(port.unsubscribeVoiceEvents({subscriptionId}));};
 void (async()=>{
  try{
   const handle=await port.addListener('alphaVoiceEvent',value=>{
    if(!active||value?.subscriptionId!==subscriptionId)return;
    if(value.type==='end'){close();return;}
    const envelope=value.event;
    if(value.type==='event'&&envelope?.type==='agent_event'&&envelope.stream==='voice-transcript')listener(envelope);
   });
   remove=()=>handle.remove();
   if(!active){quiet(remove());return;}
   dispatched=true;
   const result=await port.subscribeVoiceEvents({subscriptionId,ownerId});
   if(result.subscriptionId!==subscriptionId)close();
   // Stop may race native admission. Cancel again after acknowledgement.
   if(!active)quiet(port.unsubscribeVoiceEvents({subscriptionId}));
  }catch{close();}
 })();
 return close;
}
