import {Capacitor} from '@capacitor/core';
import {devSurfacesEnabled} from '../build-flags';
import {connectionController} from './connection-ui';
import type {VoiceConversationBinding} from './alpha-client';
export const developmentCartesiaVoiceEnabled=import.meta.env.DEV===true&&devSurfacesEnabled&&!Capacitor.isNativePlatform()&&import.meta.env.VITE_ALPHA_DEV_CARTESIA==='1';
/** Canonical self-hosted voice owns the runtime turn; this adapter never sends its transcript twice. */
export async function developmentCartesiaConversation(input:{binding:VoiceConversationBinding;assertCurrent:()=>void;onState:(phase:string)=>void;onTranscript:(text:string)=>void;onError:(error:Error)=>void;onPlaybackUnlockChange?:()=>void;getUiContext?:()=>import('@elizaos/host/protocol').VoiceUiContext;onNavigate?:(event:{viewId:string;viewPath?:string;subview?:string;traceId:string})=>Promise<void>}){
 if(!developmentCartesiaVoiceEnabled)throw Error('Direct developer speech is disabled.');
 const agent=connectionController.getBrowserSpeechAgent();if(!agent)throw Error('Connect the local developer agent first.');
 const lifecycle=new AbortController(),minted=new Set<string>();let stopped=false,stopPromise:Promise<void>|undefined;
 const current=()=>{lifecycle.signal.throwIfAborted();input.assertCurrent();if(agent!==connectionController.getBrowserSpeechAgent()||!connectionController.voiceConversationCurrent(input.binding))throw new DOMException('Developer voice connection changed','AbortError');};
 const request=async(path:string,body?:unknown,signal:AbortSignal=lifecycle.signal)=>{current();const result=await agent.request(path,body,signal);current();return result;};
 const health=await request('/api/v1/voice/session/health?conversationId='+encodeURIComponent(input.binding.conversationId));if(health.ready!==true||health.conversationId!==input.binding.conversationId||health.agentId!==input.binding.session.agentId)throw Error('The selected developer speech service is unavailable.');
 const {createVoiceSessionClient}=await import('@elizaos/ui/voice/voice-session-client');current();
 const rendererId=connectionController.voiceRendererClientId();if(!rendererId)throw Error('The voice renderer is not bound.');
 const rendererReply=await request('/api/views/voice-channel',{clientId:rendererId});
 const rendererUrl=new URL(rendererReply.wsUrl);if(rendererUrl.protocol!=='ws:'||rendererUrl.host!==location.host||rendererUrl.pathname!=='/__alpha-local-renderer/ws')throw Error('Invalid voice renderer channel.');
 const renderer=new WebSocket(rendererUrl);
 await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>{renderer.close();reject(Error('The voice renderer could not connect.'));},5000);renderer.onopen=()=>{clearTimeout(timer);resolve();};renderer.onerror=()=>{clearTimeout(timer);renderer.close();reject(Error('The voice renderer could not connect.'));};});
 try{current();}catch(error){renderer.close();throw error;}
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
 renderer.onmessage=message=>{
  if(stopped||typeof message.data!=='string')return;
  try{current();const frame=JSON.parse(message.data);
   if(frame?.type!=='shell:navigate:view'||frame.source!=='agent'||frame.viewType!=='gui'||typeof frame.viewId!=='string'||frame.action||frame.payload!==undefined||frame.views||frame.layout||frame.placement||frame.alwaysOnTop||!currentTurn||!submitted.has(currentTurn))return;
   const id=frame.completedActionHandoffId;if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)||rendererHandoffs.has(id))return;
   if(rendererHandoffs.size>=64)rendererHandoffs.delete(rendererHandoffs.values().next().value!);rendererHandoffs.add(id);
   navigate({viewId:frame.viewId,viewPath:frame.viewPath,subview:frame.subview,traceId:currentTurn});
  }catch(error){if(!stopped)input.onError(error instanceof Error?error:Error('Voice navigation could not be verified.'));}
 };
 const client=createVoiceSessionClient({agentId:input.binding.session.agentId,conversationId:input.binding.conversationId,maxReconnects:0,preLiveMaxAttempts:1,getUiContext:()=>{current();const uiClientId=connectionController.voiceRendererClientId();if(!uiClientId)throw Error('The voice renderer is not bound.');return {...input.getUiContext?.(),uiClientId};},
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
 renderer.onclose=()=>{if(!stopped){void stop().catch(error=>input.onError(error));input.onError(Error('The voice renderer disconnected. Start voice again.'));}};
 const stop=()=>{if(stopPromise)return stopPromise;stopped=true;renderer.close();lifecycle.abort();stopPromise=(async()=>{await client.stop();for(const id of minted){if(agent!==connectionController.getBrowserSpeechAgent())throw Error('Developer voice retirement could not be confirmed after connection change.');try{const result=await agent.request(`/api/v1/voice/session/${id}/revoke`,{},new AbortController().signal);if(result.revoked!==true)throw Error('Developer voice retirement was not confirmed.');}catch(error){const failure=error as {status?:number;data?:{code?:string}};if(failure.status!==404||failure.data?.code!=='voice_session_not_found')throw error;}}})();return stopPromise;};
 return {start:async()=>{try{current();await client.start();current();}catch(error){await stop();throw error;}},recheck:()=>{try{current();}catch{void stop().catch(error=>input.onError(error instanceof Error?error:Error('Developer voice retirement was not confirmed.')));}},resume:()=>false,
  get microphoneAutomaticallyMuted(){return phase==='speaking';},get microphoneMuted(){return client.microphoneMuted;},setMicrophoneMuted:(muted:boolean)=>{current();client.setMicrophoneMuted(muted);},
  get needsPlaybackUnlock(){return client.needsPlaybackUnlock;},unlockPlayback:async()=>{current();await client.unlockPlayback();current();},
  stop,
 };
}
