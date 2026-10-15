import {Capacitor} from '@capacitor/core';
import {devSurfacesEnabled} from '../build-flags';
import {connectionController} from './connection-ui';
import type {VoiceConversationBinding} from './alpha-client';
export const developmentCartesiaVoiceEnabled=import.meta.env.DEV===true&&devSurfacesEnabled&&!Capacitor.isNativePlatform()&&import.meta.env.VITE_ALPHA_DEV_CARTESIA==='1';
/** Canonical self-hosted voice owns the runtime turn; this adapter never sends its transcript twice. */
export async function developmentCartesiaConversation(input:{binding:VoiceConversationBinding;assertCurrent:()=>void;onState:(phase:string)=>void;onTranscript:(text:string)=>void;onError:(error:Error)=>void;onPlaybackUnlockChange?:()=>void;getUiContext?:()=>import('@elizaos/host/protocol').VoiceUiContext;onNavigate?:(event:{viewId:string;viewPath?:string;subview?:string;traceId:string})=>Promise<void>}){
 if(!developmentCartesiaVoiceEnabled)throw Error('Direct developer speech is disabled.');
 const agent=connectionController.getBrowserSpeechAgent();if(!agent)throw Error('Connect the local developer agent first.');
 const lifecycle=new AbortController(),minted=new Set<string>();let stopped=false,stopPromise:Promise<void>|undefined,rendererId:string|undefined;
 let renderer:WebSocket|undefined,pendingRenderer:WebSocket|undefined,rendererRenewal:ReturnType<typeof setTimeout>|undefined,rendererTask:Promise<void>|undefined;
 const current=()=>{lifecycle.signal.throwIfAborted();input.assertCurrent();if(agent!==connectionController.getBrowserSpeechAgent()||!connectionController.voiceConversationCurrent(input.binding)||rendererId!==undefined&&rendererId!==connectionController.voiceRendererClientId())throw new DOMException('Developer voice connection changed','AbortError');};
 const request=async(path:string,body?:unknown,signal:AbortSignal=lifecycle.signal)=>{current();const result=await agent.request(path,body,signal);current();return result;};
 const health=await request('/api/v1/voice/session/health?conversationId='+encodeURIComponent(input.binding.conversationId));if(health.ready!==true||health.conversationId!==input.binding.conversationId||health.agentId!==input.binding.session.agentId)throw Error('The selected developer speech service is unavailable.');
 const {createVoiceSessionClient}=await import('@elizaos/ui/voice/voice-session-client');current();
 rendererId=connectionController.voiceRendererClientId();if(!rendererId)throw Error('The voice renderer is not bound.');
 let refreshTask:Promise<void>|undefined,refreshAgain=false;
 const reconcile=()=>{if(refreshTask){refreshAgain=true;return;}refreshTask=(async()=>{do{refreshAgain=false;current();await connectionController.refreshDeveloperVoiceHistory(input.binding,lifecycle.signal);current();}while(refreshAgain&&!stopped);})().catch(error=>{if(!stopped)input.onError(error instanceof Error?error:Error('Voice history could not be verified.'));}).finally(()=>{refreshTask=undefined;});};
 const submitted=new Set<string>(),navigated=new Set<string>();let currentTurn:string|undefined;let navigationTask=Promise.resolve();let phase='idle';
 // OG's targeted renderer channel owns early delivery. The voice terminal
 // suppresses its duplicate once that transport has accepted the frame.
 const navigate=(event:{viewId:string;viewPath?:string;subview?:string;traceId:string})=>{
  if(currentTurn!==event.traceId||!submitted.has(event.traceId)||navigated.has(event.traceId)||!input.onNavigate)return;
  if(navigated.size>=64)navigated.delete(navigated.values().next().value!);navigated.add(event.traceId);
  navigationTask=navigationTask.then(async()=>{current();if(currentTurn!==event.traceId)return;await input.onNavigate!(event);current();}).catch(error=>{if(!stopped)input.onError(error instanceof Error?error:Error('Voice navigation could not be verified.'));});
 };
 const rendererHandoffs=new Set<string>();
 const receiveNavigation=(message:MessageEvent)=>{
  if(stopped||typeof message.data!=='string')return;
  try{current();const frame=JSON.parse(message.data);
   if(frame?.type!=='shell:navigate:view'||frame.source!=='agent'||frame.viewType!=='gui'||typeof frame.viewId!=='string'||frame.action||frame.payload!==undefined||frame.views||frame.layout||frame.placement||frame.alwaysOnTop||!currentTurn||!submitted.has(currentTurn))return;
   const id=frame.completedActionHandoffId;if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)||rendererHandoffs.has(id))return;
   if(rendererHandoffs.size>=64)rendererHandoffs.delete(rendererHandoffs.values().next().value!);rendererHandoffs.add(id);
   navigate({viewId:frame.viewId,viewPath:frame.viewPath,subview:frame.subview,traceId:currentTurn});
  }catch(error){if(!stopped)input.onError(error instanceof Error?error:Error('Voice navigation could not be verified.'));}
 };
 const client=createVoiceSessionClient({agentId:input.binding.session.agentId,conversationId:input.binding.conversationId,preLiveMaxReconnects:0,preLiveMaxAttempts:1,getUiContext:()=>{current();const uiClientId=connectionController.voiceRendererClientId();if(!uiClientId)throw Error('The voice renderer is not bound.');return {...input.getUiContext?.(),uiClientId};},
  getConsentNonce:async()=>{const result=await request('/api/v1/voice/session/consent',{});return typeof result.consentNonce==='string'?result.consentNonce:null;},
  fetch:async(path,init={})=>{if(path!=='/api/v1/voice/session'||init.method!=='POST'||typeof init.body!=='string')throw Error('Unsupported developer voice request');const body=JSON.parse(init.body);if(body.agentId!==input.binding.session.agentId||body.conversationId!==input.binding.conversationId||body.transport!=='websocket')throw Error('Developer voice binding changed');return Response.json(await request(path,body,init.signal??lifecycle.signal));},
  onMinted:result=>{minted.add(result.sessionId);try{current();}catch{void stop().catch(error=>input.onError(error instanceof Error?error:Error('Developer voice retirement was not confirmed.')));}},
  onState:state=>{if(!stopped){current();phase=state.phase;input.onState(state.phase);}},
  onServerEvent:event=>{if(stopped)return;current();if(event.t==='stt_partial'||event.t==='stt_final')input.onTranscript(event.text);
   if(event.t==='stt_partial'||event.t==='stt_final')currentTurn=event.traceId;
   if(event.t==='interrupted'&&currentTurn===event.traceId)currentTurn=undefined;
   if(event.t==='stt_final'){if(submitted.size>=64)submitted.delete(submitted.values().next().value!);submitted.add(event.traceId);}
   if(['ready','stt_final','speaking_start','reply_complete','usage'].includes(event.t))reconcile();
   if(event.t==='navigate_view')navigate(event);
  },
  onPlaybackUnlockChange:()=>{if(!stopped)input.onPlaybackUnlockChange?.();},
  onError:error=>{if(!stopped)input.onError(error);},
 });
 const stop=()=>{if(stopPromise)return stopPromise;stopped=true;if(rendererRenewal)clearTimeout(rendererRenewal);rendererRenewal=undefined;lifecycle.abort();renderer?.close();pendingRenderer?.close();stopPromise=(async()=>{await client.stop();for(const id of minted){if(agent!==connectionController.getBrowserSpeechAgent())throw Error('Developer voice retirement could not be confirmed after connection change.');try{const result=await agent.request(`/api/v1/voice/session/${id}/revoke`,{},new AbortController().signal);if(result.revoked!==true)throw Error('Developer voice retirement was not confirmed.');}catch(error){const failure=error as {status?:number;data?:{code?:string}};if(failure.status!==404||failure.data?.code!=='voice_session_not_found')throw error;}}})();return stopPromise;};
 // Renderer authority is independent of the canonical audio socket. Renew its
 // short, single-use ticket without restarting capture or resetting turn deduplication.
 const renewRenderer=():Promise<void>=>{
  if(rendererTask)return rendererTask;
  rendererTask=(async()=>{
   current();const reply=await request('/api/views/voice-channel',{clientId:rendererId});current();
   const url=new URL(reply.wsUrl),expiresAt=reply.expiresAt;
   if(url.protocol!=='ws:'||url.host!==location.host||url.pathname!=='/__alpha-local-renderer/ws'||typeof expiresAt!=='number'||!Number.isFinite(expiresAt)||expiresAt<=Date.now()+10000||expiresAt>Date.now()+125000)throw Error('Invalid voice renderer channel.');
   const next=new WebSocket(url);pendingRenderer=next;
   await new Promise<void>((resolve,reject)=>{
    let settled=false;
    const finish=(error?:Error)=>{if(settled)return;settled=true;clearTimeout(timeout);lifecycle.signal.removeEventListener('abort',aborted);next.onopen=null;next.onerror=null;next.onclose=null;if(error){next.close();reject(error);}else resolve();};
    const aborted=()=>finish(new DOMException('Developer voice stopped','AbortError'));
    const timeout=setTimeout(()=>finish(Error('The voice renderer could not connect.')),5000);
    next.onopen=()=>finish();next.onerror=()=>finish(Error('The voice renderer could not connect.'));next.onclose=()=>finish(Error('The voice renderer disconnected.'));
    lifecycle.signal.addEventListener('abort',aborted,{once:true});if(lifecycle.signal.aborted)aborted();
   });
   try{current();}catch(error){next.close();throw error;}
   const previous=renderer;renderer=next;pendingRenderer=undefined;
   next.onmessage=event=>{if(renderer===next)receiveNavigation(event);};
   next.onclose=()=>{if(!stopped&&renderer===next){void stop().catch(error=>input.onError(error));input.onError(Error('The voice renderer disconnected. Start voice again.'));}};
   previous?.close();
   rendererRenewal=setTimeout(()=>{rendererRenewal=undefined;void renewRenderer().catch(error=>{if(!stopped){void stop().catch(failure=>input.onError(failure));input.onError(error instanceof Error?error:Error('The voice renderer could not renew.'));}});},expiresAt-Date.now()-10000);
  })().finally(()=>{rendererTask=undefined;});return rendererTask;
 };
 try{await renewRenderer();current();}catch(error){await stop();throw error;}
 return {start:async()=>{try{current();await client.start();current();}catch(error){await stop();throw error;}},recheck:()=>{try{current();}catch{void stop().catch(error=>input.onError(error instanceof Error?error:Error('Developer voice retirement was not confirmed.')));}},resume:()=>false,
  get microphoneAutomaticallyMuted(){return phase==='speaking';},get microphoneMuted(){return client.microphoneMuted;},setMicrophoneMuted:(muted:boolean)=>{current();client.setMicrophoneMuted(muted);},
  get needsPlaybackUnlock(){return client.needsPlaybackUnlock;},unlockPlayback:async()=>{current();await client.unlockPlayback();current();},
  stop,
 };
}
