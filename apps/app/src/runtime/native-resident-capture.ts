import {parseLiveFinal, parseVoiceTranscriptEnvelope, type LiveVoiceLatency} from './live-voice.ts';

export interface NativeResidentPort {
 addListener(name: 'liveCaptureFrames'|'liveCaptureEnded'|'liveCaptureTranscript', callback:(event:any)=>void):Promise<{remove():Promise<void>}>;
 startLiveCapture(input:{captureId:string;echoCancel:boolean;nativeAsr:true;ownerId:string;roomId?:string}):Promise<{captureId?:unknown;sampleRate?:unknown;echoCancelled?:unknown;nativeAsr?:unknown}>;
 stopLiveCapture(input:{captureId:string;discard:boolean;cutoffMs:number}):Promise<{serverClosed?:unknown}>;
}
/** Native PCM never enters these events. Only levels, VAD, transcript and close acknowledgement do. */
export async function openNativeResidentCapture(port:NativeResidentPort,input:{
 signal:AbortSignal;echoCancel:boolean;ownerId:string;roomId?:string;
 current():boolean;subscribe?(listener:(envelope:unknown)=>void):()=>void;
 onSpeechStart?(at:number):void;onSpeechEnd?(at:number):void;onSegment(text:string|null,latency?:LiveVoiceLatency):void;
 onInterim?(text:string):void;onLevel?(peak:number):void;onLost(error:unknown):void;
}){
 const captureId=crypto.randomUUID(),handles:Array<{remove():Promise<void>}>=[];
 let active=true,stopping=false,discarded=false,speaking=false,cutoff=Infinity,expected=0,startedAt=Date.now(),stopped:Promise<void>|undefined,unsubscribe:(()=>void)|undefined;
 let partialTurn='',partialSeq=0,partials=0;
 const finished=new Set<string>(),pending:Array<ReturnType<typeof parseLiveFinal>|null>=[];
 const detach=async()=>{unsubscribe?.();input.signal.removeEventListener('abort',abort);await Promise.all(handles.splice(0).map(h=>h.remove().catch(()=>{})));};
 const stop=(discard:boolean,at=Date.now())=>{
  const wasDiscarded=discarded;
  if(discard){discarded=true;active=false;pending.length=0;}
  // Abort can overtake graceful close while its server request is still pending.
  if(stopped){if(discard&&!wasDiscarded)void port.stopLiveCapture({captureId,discard:true,cutoffMs:at}).catch(()=>{});return stopped;}
  stopping=true;
  return stopped=(async()=>{
   try{const ack=await port.stopLiveCapture({captureId,discard,cutoffMs:at});if(!discard&&ack.serverClosed!==true)throw Error('Native transcription close was not confirmed.');}
   finally{active=false;await detach();}
  })();
 };
 const abort=()=>{void stop(true).catch(()=>{});};
 const lose=(error:unknown)=>{if(!active||stopping)return;void stop(true).catch(()=>{});input.onLost(error);};
 const admitted=()=>{if(!active)return false;if(!input.current()){lose(Error('The agent session changed.'));return false;}return true;};
 const drain=()=>{while(active&&expected>0&&pending.length){expected--;const final=pending.shift();input.onInterim?.('');input.onSegment(final?.text??null,final?{mode:final.mode,partials,...(final.asrFinalFromSpeechEndMs!==null?{asrFinalFromSpeechEndMs:final.asrFinalFromSpeechEndMs}:{})}:undefined);partials=0;}};
 const end=(at:number)=>{if(!speaking)return;speaking=false;expected++;input.onSpeechEnd?.(at);drain();};
 try{
  input.signal.throwIfAborted();
  handles.push(await port.addListener('liveCaptureFrames',event=>{
   if(event?.captureId!==captureId||!admitted())return;
   // Never read a frames/PCM field, including from a mismatched older native implementation.
   if(typeof event.peak==='number'&&Number.isFinite(event.peak))input.onLevel?.(Math.max(0,Math.min(1,event.peak)));
   if(Array.isArray(event.vad))for(const edge of event.vad){if(!Number.isFinite(edge?.timestampMs)||edge.timestampMs>cutoff)continue;if(edge.type==='speech-start'&&!speaking){speaking=true;input.onSpeechStart?.(edge.timestampMs);}else if(edge.type==='speech-end')end(edge.timestampMs);}
  }));
  handles.push(await port.addListener('liveCaptureTranscript',event=>{
   if(event?.captureId!==captureId||!admitted())return;
   if(event.error){if(event.error==='ASR_FAILED'){if(pending.length>=8){lose(Error('Native transcription session limit reached.'));return;}pending.push(null);drain();}else lose(Error('Native transcription unavailable.'));return;}
   const final=parseLiveFinal(event.final);if(!final||finished.has(final.turnId))return;
   if(finished.size>=512||pending.length>=8){lose(Error('Native transcription session limit reached.'));return;}
   finished.add(final.turnId);if(partialTurn===final.turnId){partialTurn='';partialSeq=0;}pending.push(final);drain();
  }));
  handles.push(await port.addListener('liveCaptureEnded',event=>{
   if(event?.captureId!==captureId||!admitted())return;
   if(stopping)end(Math.min(cutoff,Date.now()));else lose(Error('The microphone stopped.'));
  }));
  unsubscribe=input.subscribe?.(envelope=>{
   if(!admitted())return;const event=parseVoiceTranscriptEnvelope(envelope,captureId);if(!event)return;
   // HTTP responses are authoritative finals/errors; feed events provide display-only partials.
   if(event.phase==='speech-start'){partialTurn=event.turnId;partialSeq=0;return;}
   if(event.phase!=='partial'||finished.has(event.turnId))return;
   if(!partialTurn)partialTurn=event.turnId;
   if(event.turnId!==partialTurn||event.seq<=partialSeq)return;partialSeq=event.seq;partials++;input.onInterim?.(event.text);
  });
  input.signal.throwIfAborted();input.signal.addEventListener('abort',abort,{once:true});
  const result=await port.startLiveCapture({captureId,echoCancel:input.echoCancel,nativeAsr:true,ownerId:input.ownerId,...(input.roomId?{roomId:input.roomId}:{})});
  input.signal.throwIfAborted();
  if(!active||!input.current()||result.captureId!==captureId||result.sampleRate!==16000||result.nativeAsr!==true)throw Error('Native voice binding changed.');
  startedAt=Date.now();
  return {startedAt,echoCancelled:input.echoCancel&&result.echoCancelled===true,speaking:()=>speaking,
   async close(at=Date.now()){cutoff=Math.min(cutoff,at);end(at);await stop(false,at);if(!discarded)while(expected>0){expected--;input.onSegment(null);}return {durationMs:Math.max(0,at-startedAt)};},
   async cancel(){await stop(true);},
  };
 }catch(error){await stop(true).catch(()=>{});throw error;}
}
