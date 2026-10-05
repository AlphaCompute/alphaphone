import {browserDocuments} from './documents';
import {BrowserDomainDocument,type DomainRecovery} from './domain-document';
import {revision} from './store';

type Selection={packageName:string;preview:boolean};
type History={id:string;appLabel:string;packageName:string;at:number;state:string};
type DeviceEvent={id:string;revision:string;source:'external';appLabel:string;title:string;text:string;at:number;clearable:boolean;canOpen:boolean;packageName:string;sourceKey:string;autoCancel:boolean;secret:boolean};
export type NotificationState={revision:string;epoch:string;enabled:boolean;paused:boolean;history:boolean;accessGranted:boolean;apps:Selection[];events:History[];dismissed:string[];appEnabled:boolean;channels:Record<string,boolean>;deviceEvents:DeviceEvent[]};
export const notificationStorageKey='alpha.browser.notifications.v2';
// v2 superseded the old partial policy. Preserve whichever legacy source was active.
const legacy=()=>localStorage.getItem(notificationStorageKey)??localStorage.getItem('alpha.browser.notification-policy.v1');
const domain=new BrowserDomainDocument(browserDocuments,notificationStorageKey,legacy);
const channel=typeof BroadcastChannel==='undefined'?null:new BroadcastChannel('alpha.browser.documents.v1');
if(channel)channel.onmessage=event=>{if(event.data?.key===notificationStorageKey)window.dispatchEvent(new Event('alpha:notifications-document-changed'));};
const changed=()=>channel?.postMessage({key:notificationStorageKey});
const initial=():NotificationState=>({revision:revision(),epoch:revision(),enabled:false,paused:false,history:false,accessGranted:true,apps:[],events:[],dismissed:[],appEnabled:true,channels:{reminders:true,calendar:true},deviceEvents:[]});
function normalize(value:NotificationState):NotificationState{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Notification data needs recovery.');
 const state={...initial(),...value,channels:{reminders:true,calendar:true,...value.channels},deviceEvents:value.deviceEvents??[]};
 for(const flag of ['enabled','paused','history','accessGranted','appEnabled'] as const)if(typeof state[flag]!=='boolean')throw Error('Notification policy needs recovery.');
 if(typeof state.revision!=='string'||typeof state.epoch!=='string'||!Array.isArray(state.apps)||!Array.isArray(state.events)||!Array.isArray(state.dismissed)||!Array.isArray(state.deviceEvents)||!state.channels||typeof state.channels!=='object'||Object.values(state.channels).some(value=>typeof value!=='boolean'))throw Error('Notification data needs recovery.');
 return state;
}
export const notificationDocument={
 readRaw:(signal?:AbortSignal)=>domain.readRaw(signal),
 capture:(signal?:AbortSignal)=>domain.capture(signal),
 async reset(expected:DomainRecovery,signal?:AbortSignal){await domain.reset(expected,signal);changed();},
 async edit<R>(edit:(state:NotificationState)=>R|Promise<R>,signal?:AbortSignal):Promise<R>{
  let modified=false;
  const result=await domain.edit(initial,async value=>{const before=JSON.stringify(value),state=normalize(value);Object.assign(value,state);const result=await edit(value);modified=before!==JSON.stringify(value);return result;},signal);
  if(modified)changed();return result;
 }
};
/** Persist authority once; ordinary policy reads never advance its document revision. */
export async function notificationState(signal?:AbortSignal):Promise<NotificationState>{
 const raw=await domain.readRaw(signal);
 if(raw!==null){const value=JSON.parse(raw),state=normalize(value);if(Object.keys(state).every(key=>JSON.stringify(value[key])===JSON.stringify(state[key as keyof NotificationState])))return state;}
 return notificationDocument.edit(state=>state,signal);
}
