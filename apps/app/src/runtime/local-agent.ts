import { registerPlugin } from '../platform-plugins';
import { Capacitor } from '@capacitor/core';
import type { VerifiedSession } from './alpha-client';
import type { RemoteChatReply, RemoteConversation } from './remote-protocol';
import { readLocalAgentStream } from './local-agent-stream';
import { streamNativeAgent, type NativeStreamPort } from './local-agent-native-stream';

export interface LocalAgentBridge {
  start(): Promise<unknown>;
  stop?():Promise<unknown>;
  getStatus?():Promise<{packaged?:boolean;state?:string;serviceActive?:boolean;socketListening?:boolean}>;
  configureProvider?(input:{apiKey:string;model:string}):Promise<unknown>;
  configureCloudProvider?(input:{credentialId:string;model:string}):Promise<unknown>;
  request(input: { path: string; audioBase64?:string;requestId?:string;ownerId?:string; method: 'GET' | 'POST'; headers: Record<string,string>; body?: string; timeoutMs: number }, signal?:AbortSignal): Promise<{status:number;body?:string}>;
  stream?(input:{path:string;ownerId:string;headers:Record<string,string>;body:string},signal:AbortSignal,onText:(text:string)=>void):Promise<RemoteChatReply>;
}
const native = registerPlugin<LocalAgentBridge & NativeStreamPort>('Agent');
// Capacitor proxies synthesize functions for unknown methods. Do not use that
// proxy to feature-detect streaming before the native IPC adapter implements it.
const nativeBridge:LocalAgentBridge={start:()=>native.start(),request:input=>native.request(input),stream:(input,signal,onText)=>streamNativeAgent(native,input,signal,onText)};
// The host bridge at /__alpha-local-agent exists only on the development server
// with ELIZA_DEV_ALLOW_TEST_MOCKS=1 (devSurfacesEnabled in build-flags.ts). This
// module is also imported by Node contract tests, where import.meta.env is absent.
const developmentBridgeAllowed: boolean = import.meta.env !== undefined && import.meta.env.DEV === true && import.meta.env.VITE_ELIZA_DEV_ALLOW_TEST_MOCKS === '1';
export const browserLocalAgentEnabled: boolean = developmentBridgeAllowed && import.meta.env.VITE_LOCAL_AGENT === '1';
export const localAgentAvailable = () => Capacitor.isNativePlatform()
  ? Capacitor.isPluginAvailable('Agent') : browserLocalAgentEnabled;
/** Packaging availability only; it does not prove startup or inference readiness. */
export async function localAgentPackaged():Promise<boolean> {
  if(!localAgentAvailable())return false;
  if(!Capacitor.isNativePlatform())return browserLocalAgentEnabled;
  try{return (await native.getStatus?.())?.packaged===true;}catch{return false;}
}
const unavailableBridge: LocalAgentBridge = {
  async start() { throw new Error('On-device agent is unavailable in this browser. Connect a remote agent or use Eliza Cloud.'); },
  async request() { throw new Error('On-device agent is unavailable in this browser. Connect a remote agent or use Eliza Cloud.'); },
};
const browserBridge: LocalAgentBridge | null = developmentBridgeAllowed ? {
  async start() { return { state: 'host-managed' }; },
  async stream(input,signal,onText){
    const bounded=AbortSignal.any([signal,AbortSignal.timeout(120000)]);
    const response=await fetch('/__alpha-local-agent',{method:'POST',headers:{'Content-Type':'application/json','X-Alpha-Local-Agent':'1'},
      body:JSON.stringify({...input,method:'POST',stream:true}),signal:bounded,redirect:'error'});
    return readLocalAgentStream(response,bounded,onText);
  },
  async request(input, signal) {
    const response = await fetch('/__alpha-local-agent', {
      method:'POST', headers:{'Content-Type':'application/json','X-Alpha-Local-Agent':'1'},
      body:JSON.stringify(input), signal:signal ? AbortSignal.any([signal,AbortSignal.timeout(input.timeoutMs)]) : AbortSignal.timeout(input.timeoutMs), redirect:'error',
    });
    if (!response.ok) throw new Error('Local agent development bridge unavailable. Check the development server.');
    return response.json();
  },
} : null;
function record(value:unknown):Record<string,any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid local agent response.');
  return value as Record<string,any>;
}
function identifier(value:unknown):string {
  if (typeof value !== 'string' || !value || value.length>512) throw new Error('Invalid local agent identity.');
  return value;
}

/** Same app-host conversation API on both platforms. The native service or
 * development server injects credentials; no bearer token reaches the renderer. */
export class LocalAgentProtocol {
  readonly origin = Capacitor.isNativePlatform() ? 'https://device.alpha.invalid' : 'https://development.alpha.invalid';
  session: VerifiedSession | null = null;
  private generation = 0;
  private streams = new Set<AbortController>();
  deviceHeaders:Record<string,string>={};
  constructor(private bridge:LocalAgentBridge = Capacitor.isNativePlatform() ? nativeBridge : browserBridge ?? unavailableBridge) {}
  async request(path:string, body:unknown|undefined, signal:AbortSignal, headers:Record<string,string> = {}):Promise<any> {
    signal.throwIfAborted();
    const generation=this.generation;
    let cancel:()=>void=()=>{};
    const cancelled=new Promise<never>((_,reject)=>{cancel=()=>reject(signal.reason||new DOMException('Cancelled','AbortError'));});
    signal.addEventListener('abort',cancel,{once:true});
    let response:{status:number;body?:string};
    try { response=await Promise.race([this.bridge.request({path,...(this.session?{ownerId:this.session.ownerId}:{}),method:body===undefined?'GET':'POST',headers:{Accept:'application/json',...this.deviceHeaders,...headers},
      ...(body===undefined?{}:{body:JSON.stringify(body)}),timeoutMs:120000},signal),cancelled]); } finally { signal.removeEventListener('abort',cancel); }
    signal.throwIfAborted();
    if(generation!==this.generation)throw new Error('Local agent connection changed.');
    if(response.status<200||response.status>=300)throw Object.assign(new Error(`Local agent request failed (HTTP ${response.status}).`),{status:response.status,data:(()=>{try{return JSON.parse(response.body||'{}');}catch{return {};}})()});
    return JSON.parse(response.body || '{}');
  }
  async connect(signal:AbortSignal) {
    signal.throwIfAborted();
    const generation=this.generation;
    let cancel:()=>void=()=>{};
    const cancelled=new Promise<never>((_,reject)=>{cancel=()=>reject(signal.reason||new DOMException('Cancelled','AbortError'));});
    signal.addEventListener('abort',cancel,{once:true});
    try{await Promise.race([this.bridge.start(),cancelled]);}finally{signal.removeEventListener('abort',cancel);}
    signal.throwIfAborted();
    if(generation!==this.generation)throw Error('Local agent connection changed.');
    const who=record(await this.request('/api/auth/me',undefined,signal));
    const identity=record(who.identity),access=record(who.access);
    // Only the explicitly selected native/host bridge may establish local trust.
    if(identity.kind!=='owner'||access.role!=='OWNER'||!['local','session'].includes(access.mode))throw new Error('The local runtime did not verify local owner access.');
    const result=record(await this.request('/api/agents',undefined,signal));
    if(!Array.isArray(result.agents)||result.agents.length!==1)throw new Error('The local runtime must expose exactly one agent.');
    const agent=record(result.agents[0]);
    if(agent.status!=='running')throw Error('The local agent is still starting. Try again when it is ready.');
    if(generation!==this.generation)throw Error('Local agent connection changed.');
    this.session={ownerId:identifier(identity.id),agentId:identifier(agent.id),sessionId:crypto.randomUUID(),origin:this.origin};
    return {session:this.session,name:typeof agent.name==='string'?agent.name:'Local agent'};
  }
  get browserSpeechAvailable(){return browserLocalAgentEnabled&&browserBridge!==null&&this.bridge===browserBridge;}
  async speechRequest(audio:Uint8Array|undefined,signal:AbortSignal){
    if(!this.browserSpeechAvailable||!this.session)throw Error('Connect the local agent first.');
    const session=this.session,generation=this.generation,controller=new AbortController();
    this.streams.add(controller);
    const bounded=AbortSignal.any([signal,controller.signal]);
    try{
      bounded.throwIfAborted();
      let audioBase64:string|undefined;
      if(audio){
        if(!audio.byteLength||audio.byteLength>2*1024*1024)throw Error('Recording is too large.');
        let binary='';for(let i=0;i<audio.length;i+=8192)binary+=String.fromCharCode(...audio.subarray(i,i+8192));
        audioBase64=btoa(binary);
      }
      const requestId=audio?crypto.randomUUID():undefined;
      const response=await this.bridge.request({path:'/api/asr/whisper'+(audio?'':'/status'),method:audio?'POST':'GET',ownerId:session.ownerId,
        headers:{},timeoutMs:120000,...(audio?{audioBase64,requestId}:{})},bounded);
      bounded.throwIfAborted();
      if(session!==this.session||generation!==this.generation)throw new DOMException('Voice selection changed','AbortError');
      if(response.status!==200)throw Error(`Local speech failed (HTTP ${response.status}).`);
      const result=JSON.parse(response.body||'{}');
      if(result.provider!=='standalone-whisper.cpp'||(audio&&(result.local!==true||result.requestId!==requestId||typeof result.text!=='string'||!result.text.trim()||result.text.length>16000)))throw Error('Invalid local speech response.');
      return result;
    }finally{this.streams.delete(controller);}
  }
  async synthesizeSpeech(text:string,signal:AbortSignal):Promise<Blob>{
    if(!this.browserSpeechAvailable||!this.session)throw Error('Connect the local agent first.');
    if(typeof text!=='string'||!text.trim()||text.length>500)throw Error('Local agent speech accepts up to 500 characters per phrase.');
    const session=this.session,generation=this.generation,controller=new AbortController(),requestId=crypto.randomUUID();
    this.streams.add(controller);const bounded=AbortSignal.any([signal,controller.signal]);
    try{
      bounded.throwIfAborted();
      const response=await this.bridge.request({path:'/api/tts/kokoro',ownerId:session.ownerId,method:'POST',headers:{},requestId,body:JSON.stringify({text}),timeoutMs:45000},bounded);
      bounded.throwIfAborted();if(session!==this.session||generation!==this.generation)throw new DOMException('Voice selection changed','AbortError');
      if(response.status!==200)throw Error(`Local agent speech unavailable (HTTP ${response.status}).`);
      const result=JSON.parse(response.body||'{}');
      if(result.requestId!==requestId||result.provider!=='standalone-kokoro'||result.contentType!=='audio/wav'||typeof result.audioBase64!=='string'||result.audioBase64.length>1920060)throw Error('Invalid local speech response.');
      const bytes=Uint8Array.from(atob(result.audioBase64),c=>c.charCodeAt(0));
      if(bytes.length<44||String.fromCharCode(...bytes.subarray(0,4))!=='RIFF'||String.fromCharCode(...bytes.subarray(8,12))!=='WAVE'||new DataView(bytes.buffer).getUint32(4,true)+8!==bytes.length)throw Error('Invalid local speech audio.');
      return new Blob([bytes],{type:'audio/wav'});
    }finally{this.streams.delete(controller);}
  }
  async disconnect() { this.generation++; this.session=null; for(const controller of this.streams)controller.abort();this.streams.clear(); }
  private async json(path:string,body:unknown|undefined,signal?:AbortSignal) {
    if(!this.session)throw new Error('Start the local agent first.');
    return record(await this.request(path,body,signal||new AbortController().signal));
  }
  async listConversations(signal?:AbortSignal):Promise<RemoteConversation[]> {
    const value=await this.json('/api/conversations',undefined,signal);
    if(!Array.isArray(value.conversations))throw new Error('Invalid local conversation list.');
    return value.conversations.map((item:unknown)=>{const row=record(item);return {...row,id:identifier(row.id)};});
  }
  async createConversation(title:string,signal?:AbortSignal):Promise<RemoteConversation> {
    const value=record((await this.json('/api/conversations',{title},signal)).conversation);
    return {...value,id:identifier(value.id)};
  }
  async messages(id:string,signal?:AbortSignal):Promise<{messages:Record<string,unknown>[]}> {
    const value=await this.json(`/api/conversations/${encodeURIComponent(identifier(id))}/messages`,undefined,signal);
    if(!Array.isArray(value.messages))throw new Error('Invalid local conversation history.');
    return {messages:value.messages.map(record)};
  }
  async send(id:string,text:string,options:{metadata?:Record<string,unknown>;clientMessageId?:string;signal?:AbortSignal;onText?:(text:string)=>void}={}):Promise<RemoteChatReply> {
    if(this.bridge.stream&&options.onText){
      if(!this.session)throw Error('Start the local agent first.');
      const controller=new AbortController();this.streams.add(controller);
      const generation=this.generation,session=this.session,signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal;
      try{
      const valid=()=>{signal.throwIfAborted();if(generation!==this.generation||session!==this.session)throw Error('Local agent connection changed.');};
      valid();
      const result=await this.bridge.stream({path:`/api/conversations/${encodeURIComponent(identifier(id))}/messages/stream`,ownerId:session.ownerId,headers:this.deviceHeaders,
        body:JSON.stringify({text,channelType:'DM',streamProtocol:'delta-v2',metadata:options.metadata,clientMessageId:options.clientMessageId})},signal,value=>{valid();options.onText!(value);});
      valid();return result;
      }finally{this.streams.delete(controller);}
    }
    const value=await this.json(`/api/conversations/${encodeURIComponent(identifier(id))}/messages`,{text,channelType:'DM',metadata:options.metadata,clientMessageId:options.clientMessageId},options.signal);
    if(typeof value.text!=='string'||typeof value.agentName!=='string')throw new Error('Invalid local agent reply.');
    return value as RemoteChatReply;
  }
}

export async function configureLocalProvider(apiKey:string,model:string) {
  if(!Capacitor.isNativePlatform())throw Error('Configure the development provider on the host.');
  if(!await localAgentPackaged())throw Error('On-device agent is unavailable in this version. Connect a remote agent or use Eliza Cloud.');
  if(!native.configureProvider)throw Error('Model provider setup is unavailable.');
  return native.configureProvider({apiKey,model});
}

export async function configureLocalCloudProvider(credentialId:string) {
  if(!Capacitor.isNativePlatform() || !await localAgentPackaged()) throw Error('The on-device runtime is unavailable in this build.');
  await stopLocalAgent();
  if(!native.configureCloudProvider)throw Error('Cloud billing is unavailable in this version.');
  await native.configureCloudProvider({credentialId,model:'cerebras/qwen-3.8-27b'});
}

export async function stopLocalAgent() {
  if(!Capacitor.isNativePlatform()||!native.stop)throw Error('Stop browser development with Ctrl-C in its terminal.');
  await native.stop();
  const deadline=performance.now()+30000;
  while(performance.now()<deadline){
    const status=await native.getStatus?.();
    if(status?.state==='stopped'&&status.serviceActive===false&&status.socketListening===false)return;
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  throw Error('Shutdown is still pending. Check local agent status before starting again.');
}
