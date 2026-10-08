/// <reference lib="webworker" />
import * as ort from 'onnxruntime-web/wasm';
import {createWhisperRecognizer,type WhisperGeneration} from './whisper-engine';
import type {SpeechManifest,SpeechWorkerRequest,SpeechWorkerMessage} from './speech-protocol';

// The page owns cancellation by terminating this worker; there is no cross-request state
// except the loaded model, which is verified once against the build's manifest.
let recognizer:Promise<{manifest:SpeechManifest;transcribe:(samples:Float32Array)=>Promise<{text:string;noSpeech:boolean}>}>|undefined;
const post=(message:SpeechWorkerMessage,transfer:Transferable[]=[])=>(self as unknown as DedicatedWorkerGlobalScope).postMessage(message,transfer);
const hex=(bytes:ArrayBuffer)=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');

async function fetchVerified(base:string,file:{path:string;bytes:number;sha256:string},progress:(bytes:number)=>void){
 const response=await fetch(new URL(file.path,base),{credentials:'same-origin',cache:'default'});
 if(!response.ok||!response.body)throw Error(`Speech model file unavailable (${response.status})`);
 const output=new Uint8Array(file.bytes),reader=response.body.getReader();let offset=0;
 for(;;){const {done,value}=await reader.read();if(done)break;if(offset+value.length>file.bytes)throw Error('Speech model file is larger than recorded');output.set(value,offset);offset+=value.length;progress(value.length);}
 if(offset!==file.bytes)throw Error('Speech model file is incomplete');
 if(hex(await crypto.subtle.digest('SHA-256',output))!==file.sha256)throw Error('Speech model file failed verification');
 return output;
}

async function load(id:string,manifestUrl:string){
 const response=await fetch(manifestUrl,{credentials:'same-origin',cache:'no-cache'});
 if(!response.ok)throw Error('This build does not include the speech model');
 const manifest=await response.json() as SpeechManifest;
 if(manifest?.version!==1||manifest.engine!=='whisper'||manifest.language!=='en'||!manifest.files)throw Error('Unsupported speech model manifest');
 const files=manifest.files,total=Object.values(files).reduce((sum,file)=>sum+file.bytes,0);let loaded=0;
 post({type:'progress',id,phase:'download',loaded,total});
 const progress=(bytes:number)=>{loaded+=bytes;post({type:'progress',id,phase:'download',loaded,total});};
 const [wasm,encoder,decoder,vocab,generation]=await Promise.all([files.wasm,files.encoder,files.decoder,files.vocab,files.generation].map(file=>fetchVerified(manifestUrl,file,progress)));
 post({type:'progress',id,phase:'initialize'});
 ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;ort.env.wasm.wasmBinary=wasm.buffer;
 ort.env.wasm.wasmPaths={mjs:new URL(files.glue.path,manifestUrl).href};
 const decodeJson=(bytes:Uint8Array)=>JSON.parse(new TextDecoder().decode(bytes));
 const engine=await createWhisperRecognizer(ort as never,{encoder,decoder,vocab:decodeJson(vocab) as Record<string,number>,generation:decodeJson(generation) as WhisperGeneration});
 return {manifest,transcribe:(samples:Float32Array)=>engine.transcribe(samples)};
}

self.addEventListener('message',(event:MessageEvent<SpeechWorkerRequest>)=>{
 const request=event.data;if(request?.type!=='transcribe')return;
 const {id}=request;
 void (async()=>{
  let stage:'load'|'transcribe'='load';
  try{
   if(!recognizer){recognizer=load(id,request.manifestUrl);recognizer.catch(()=>{recognizer=undefined;});}
   const owned=await recognizer;stage='transcribe';
   post({type:'progress',id,phase:'transcribe'});
   const result=await owned.transcribe(request.samples);
   const {manifest}=owned;
   post({type:'result',id,text:result.noSpeech?'':result.text,noSpeech:result.noSpeech,engine:manifest.engine,model:manifest.model,modelRevision:manifest.revision,runtime:manifest.runtime,language:manifest.language});
  }catch(error){post({type:'error',id,code:stage==='load'?'model-load-failed':'recognition-failed',message:error instanceof Error?error.message:String(error)});}
 })();
});
