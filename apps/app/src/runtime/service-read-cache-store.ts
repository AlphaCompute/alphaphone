import {Capacitor} from '@capacitor/core';
import {secureConnectionStore} from './native-connection';
import {BrowserJsonDomainDocument} from '../browser/json-domain-document';
import {ServiceReadCache} from './service-read-cache';
export type ReadCacheOwner={environment:string;userId:string;organizationId:string;credentialId:string};
const opened=new Map<string,Promise<ServiceReadCache>>();
/** Cost: one SHA256 and one cached document handle per verified local account identity. */
export function serviceReadCache(owner:ReadCacheOwner):Promise<ServiceReadCache>{
 const identity=JSON.stringify([owner.environment,owner.userId,owner.organizationId,owner.credentialId]);
 if(Object.values(owner).some(v=>typeof v!=='string'||!v||v.length>1024))return Promise.reject(Error('Read cache owner is unavailable'));
 let result=opened.get(identity);if(result)return result;
 result=(async()=>{
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(identity))),v=>v.toString(16).padStart(2,'0')).join(''),slot='connected-read-cache:v1:'+hash;
  if(Capacitor.isNativePlatform())return new ServiceReadCache(identity,{read:()=>secureConnectionStore.read(slot),compareExchange:async(before,value)=>(await secureConnectionStore.compareExchange(slot,before,value)).status});
  const document=new BrowserJsonDomainDocument('alpha.browser.'+slot);
  return new ServiceReadCache(identity,{read:()=>document.readJson(),compareExchange:async(before,value)=>{let saved=false;await document.editJson(actual=>{if(JSON.stringify(actual)!==JSON.stringify(before))return actual;saved=true;return value;});return saved?'saved':'conflict';}});
 })();opened.set(identity,result);result.catch(()=>opened.delete(identity));return result;
}
