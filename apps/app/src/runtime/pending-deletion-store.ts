import {Capacitor} from '@capacitor/core';
import {secureConnectionStore} from './native-connection';
import type {PendingDeletionDocument,PendingDeletionStore} from './pending-deletions';
/** Android: encrypted renderer slot, compare-and-exchange (allowlisted in AlphaConnectionPlugin). */
export const PENDING_DELETIONS_SLOT='pending-deletions:v1:device';
export const browserPendingDeletionsKey='alpha.browser.pending-deletions.v1';
const browserDocument=async()=>{const {BrowserJsonDomainDocument}=await import('../browser/json-domain-document');return browserStore??=new BrowserJsonDomainDocument(browserPendingDeletionsKey);};
let browserStore:import('../browser/json-domain-document').BrowserJsonDomainDocument|undefined;
const same=(a:unknown,b:unknown)=>JSON.stringify(a??null)===JSON.stringify(b??null);
/** Durable pending-deletion intents. Survives process death; never synced or backed up. */
export const pendingDeletionStore:PendingDeletionStore={
 async read(){
  if(Capacitor.getPlatform()==='android')return secureConnectionStore.read<PendingDeletionDocument>(PENDING_DELETIONS_SLOT);
  return (await browserDocument()).readJson<PendingDeletionDocument>();
 },
 async compareExchange(expected,next){
  if(Capacitor.getPlatform()==='android')return (await secureConnectionStore.compareExchange(PENDING_DELETIONS_SLOT,expected,next)).status==='saved';
  let saved=false;
  await (await browserDocument()).editJson<PendingDeletionDocument>(current=>{if(!same(current,expected))return current;saved=true;return next;});
  return saved;
 },
};
