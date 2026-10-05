import {browserDocuments} from './documents';
import {BrowserDomainDocument} from './domain-document';
import {browserDevProfile} from './dev-profile';
import {assertDevelopmentIdentity,verifyDevelopmentIdentity,type DevelopmentIdentity} from './development-identity';
import type {DevelopmentDelegation} from './digest-delegation';
import type {DigestResult,DigestSource,DigestLoop} from '../runtime/hosted-digests';
export type DevelopmentDigestSource=DigestSource&{text:string};
export type DevelopmentDigestLoop=DigestLoop&{createdAt:number;lastOccurrence?:string};
export type DevelopmentDigestState={delegation?:DevelopmentDelegation;liveRevision?:string;sources:DevelopmentDigestSource[];loops:DevelopmentDigestLoop[];receipts:Array<{id:string;input:string;result:unknown}>;results:DigestResult[];cursor:number;acks:Record<string,number>};
export const initialDevelopmentDigests=():DevelopmentDigestState=>({sources:[],loops:[],receipts:[],results:[],cursor:0,acks:{}});
export function validateDevelopmentDigests(state:DevelopmentDigestState){
 if(!state||!Array.isArray(state.sources)||state.sources.length>100||!Array.isArray(state.loops)||state.loops.length>100||!Array.isArray(state.receipts)||state.receipts.length>500||!Array.isArray(state.results)||state.results.length>100||!Number.isSafeInteger(state.cursor)||state.cursor<0||!state.acks||typeof state.acks!=='object'||Array.isArray(state.acks)||Object.keys(state.acks).length>100||Object.values(state.acks).some(value=>!Number.isSafeInteger(value)||value<0)||state.delegation&&(!Array.isArray(state.delegation.requests)||!Array.isArray(state.delegation.grants)||state.delegation.requests.length>100||state.delegation.grants.length>100))throw Error('Development digest data needs recovery.');return state;
}
export function developmentDigestDocument(identity:DevelopmentIdentity){
 if(!browserDevProfile||!/^(local|remote|cloud(?:\.(first|second))?)$/.test(identity.namespace))throw Error('Choose a development profile.');
 const key=`alpha.browser.digests.${identity.namespace}.v1`;return new BrowserDomainDocument(browserDocuments,key,()=>localStorage.getItem(key));
}
export async function readDevelopmentDigests(identity:DevelopmentIdentity,signal?:AbortSignal){
 signal?.throwIfAborted();await verifyDevelopmentIdentity(identity,signal);assertDevelopmentIdentity(identity);const data=await developmentDigestDocument(identity).read(initialDevelopmentDigests,signal);signal?.throwIfAborted();await verifyDevelopmentIdentity(identity,signal);assertDevelopmentIdentity(identity);return validateDevelopmentDigests(data);
}
