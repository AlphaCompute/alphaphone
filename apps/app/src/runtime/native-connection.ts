import { registerPlugin } from '@capacitor/core';
import type { CloudNativeRequest, CloudCredentialStore, CloudCredential } from './cloud-protocol';
import type { RemoteRequester, RemoteCredentialStore } from './remote-protocol';

const native = registerPlugin<{
  request(input: { requestId: string; url: string; method: string; headers: Record<string,string>; body?: string }): Promise<{status:number;data:unknown}>;
  cancel(input:{requestId:string}):Promise<void>;
  secureRead(input:{slot:string}):Promise<{value:string|null}>;
  secureWrite(input:{slot:string;value:string}):Promise<void>;
  secureCompareExchange(input:{slot:string;expectedValue:string|null;value:string|null}):Promise<{status:"saved"|"conflict"}>;
  secureRemove(input:{slot:string}):Promise<void>;
  openExternal(input:{url:string}):Promise<void>;
}>('AlphaConnection');

export const secureConnectionStore = {
  async read<T>(slot:string):Promise<T|null> {
    const result=await native.secureRead({slot});
    return result.value===null ? null : JSON.parse(result.value) as T;
  },
  async write(slot:string,value:unknown) { await native.secureWrite({slot,value:JSON.stringify(value)}); },
  async compareExchange(slot:string,expected:unknown|null,value:unknown|null) { return native.secureCompareExchange({slot,expectedValue:expected===null?null:JSON.stringify(expected),value:value===null?null:JSON.stringify(value)}); },
  async remove(slot:string) { await native.secureRemove({slot}); },
};
// Serialize credential operations so a cancellation cleanup cannot erase a later login.
let storageQueue:Promise<unknown>=Promise.resolve();
function serial<T>(operation:()=>Promise<T>):Promise<T> {
  const result=storageQueue.then(operation,operation);storageQueue=result.catch(()=>{});return result;
}
export const cloudCredentialStore:CloudCredentialStore={
  read:environment=>serial(async()=>{
    const value=await secureConnectionStore.read<CloudCredential>(`cloud:${environment}`);
    if(value&&!value.credentialId){value.credentialId=crypto.randomUUID();await secureConnectionStore.write(`cloud:${environment}`,value);}
    return value;
  }),
  write:(environment,value,signal)=>serial(async()=>{
    signal.throwIfAborted();
    await secureConnectionStore.write(`cloud:${environment}`,{...value,credentialId:crypto.randomUUID()});
    if(signal.aborted){await secureConnectionStore.remove(`cloud:${environment}`);signal.throwIfAborted();}
  }),
  clear:environment=>serial(()=>secureConnectionStore.remove(`cloud:${environment}`)),
};
export const remoteCredentialStore:RemoteCredentialStore={
  read:origin=>serial(()=>secureConnectionStore.read(`remote:${origin}`)),
  write:record=>serial(()=>secureConnectionStore.write(`remote:${record.origin}`,record)),
  remove:origin=>serial(()=>secureConnectionStore.remove(`remote:${origin}`)),
};
export const nativeCloudRequest:CloudNativeRequest=async input=>{
  input.signal.throwIfAborted();
  const requestId=crypto.randomUUID();
  let rejectAbort:(reason:unknown)=>void=()=>{};
  const interrupted=new Promise<never>((_,reject)=>{rejectAbort=reject;});
  const cancel=()=>{void native.cancel({requestId}).catch(()=>{});rejectAbort(input.signal.reason||new DOMException('Cancelled','AbortError'));};
  input.signal.addEventListener('abort',cancel,{once:true});
  const timer=setTimeout(()=>{void native.cancel({requestId}).catch(()=>{});rejectAbort(new Error('Connection timed out'));},input.timeoutMs);
  try {
    // Issue first, then check again: native cancel targets an already-dispatched ID.
    const response=native.request({requestId,url:input.url,method:input.method,headers:input.headers,...(input.body===undefined?{}:{body:JSON.stringify(input.body)})});
    if(input.signal.aborted)cancel();
    return await Promise.race([response,interrupted]);
  }finally{clearTimeout(timer);input.signal.removeEventListener('abort',cancel);}
};
export const nativeRemoteRequest:RemoteRequester=async input=>{
  const response=await nativeCloudRequest({url:input.url,method:input.method,headers:input.headers,
    body:input.body===undefined?undefined:JSON.parse(input.body),signal:input.signal||new AbortController().signal,timeoutMs:120000,redirect:'error'});
  return {status:response.status,body:response.data};
};
export async function openConnectionBrowser(url:string,signal:AbortSignal) {
  signal.throwIfAborted();await native.openExternal({url});signal.throwIfAborted();
}
