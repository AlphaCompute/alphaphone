import {Capacitor} from '@capacitor/core';
import type {BrowserDomainDocument} from '../browser/domain-document';
export const mediaCopyIntentKey='alpha.photos.pending-copy.v1';
export type MediaCopyIntent={token:string;revision?:string};
type Archive={raw:string|null;revision?:string};
const empty=():Archive=>({raw:null});
function decode(value:Archive):MediaCopyIntent|null{
 if(!value||typeof value!=='object'||!Object.hasOwn(value,'raw')||Object.keys(value).some(key=>!['raw','revision'].includes(key))||value.raw!==null&&(typeof value.raw!=='string'||!/^[-\w]{1,200}$/.test(value.raw))||value.revision!==undefined&&(typeof value.revision!=='string'||!/^[-a-f0-9]{36}$/.test(value.revision)))throw Error('Saved-copy request needs recovery');
 return value.raw===null?null:{token:value.raw,...(value.revision?{revision:value.revision}:{})};
}
let document:Promise<BrowserDomainDocument>|undefined;
export async function mediaCopyIntentDocument(){
 if(Capacitor.getPlatform()==='android')throw Error('Saved-copy recovery is unavailable on this device');
 return document??=Promise.all([import('../browser/domain-document'),import('../browser/documents')]).then(([{BrowserDomainDocument},{browserDocuments}])=>new BrowserDomainDocument(browserDocuments,mediaCopyIntentKey,()=>{const raw=localStorage.getItem(mediaCopyIntentKey);return raw===null?null:JSON.stringify({raw});}));
}
export async function readMediaCopyIntent(signal?:AbortSignal){
 signal?.throwIfAborted();return decode(Capacitor.getPlatform()==='android'?{raw:localStorage.getItem(mediaCopyIntentKey)}:await(await mediaCopyIntentDocument()).read(empty,signal));
}
async function replace(expected:MediaCopyIntent|null,next:MediaCopyIntent|null,signal?:AbortSignal){
 const update=(archive:Archive)=>{if(JSON.stringify(decode(archive))!==JSON.stringify(expected))throw Error('Another saved-copy request is unresolved. Check its outcome first.');archive.raw=next?.token??null;delete archive.revision;if(next?.revision)archive.revision=next.revision;};
 signal?.throwIfAborted();
 if(Capacitor.getPlatform()==='android'){
  const archive={raw:localStorage.getItem(mediaCopyIntentKey)};update(archive);if(archive.raw===null)localStorage.removeItem(mediaCopyIntentKey);else localStorage.setItem(mediaCopyIntentKey,archive.raw);if(localStorage.getItem(mediaCopyIntentKey)!==archive.raw)throw Error('Saved-copy request could not be confirmed');
 }else await(await mediaCopyIntentDocument()).edit(empty,update,signal);
}
export async function admitMediaCopyIntent(token:string,signal?:AbortSignal){
 const next={token,...(Capacitor.getPlatform()==='android'?{}:{revision:crypto.randomUUID()})};decode({raw:next.token,...(next.revision?{revision:next.revision}:{})});await replace(null,next,signal);return next;
}
export async function acknowledgeMediaCopyIntent(expected:MediaCopyIntent,signal?:AbortSignal){await replace(expected,null,signal);}
