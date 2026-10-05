import {readDevicePreferences,initializeDevicePreferences} from './device-preferences';
import {browserScreenLocked} from './screen-locked';
import {readLocationSimulation,locationSimulationKey} from './location-simulation';
import { WebPlugin } from '@capacitor/core';
import {browserSensorEnabled} from './sensor-policy';
const foreground=()=>!document.hidden&&document.documentElement.dataset.devBackground!=='true'&&!browserScreenLocked();
export class BrowserLocation extends WebPlugin {
 private generation=0;
 private watches=new Map<string,{id:number;active:boolean;simulated?:boolean}>();
 private pending=new Map<string,()=>void>();
 constructor(){super();initializeDevicePreferences();const changed=()=>{for(const [watchId,watch] of this.watches){let simulated=false;try{simulated=readLocationSimulation().mode==='coordinates';}catch{}if(!!watch.simulated!==simulated){void this.clearWatch({watchId});void this.notifyListeners('error',{code:'UNAVAILABLE'});}else if(simulated)this.simulatedFix();}};window.addEventListener('alpha:dev-location',changed);window.addEventListener('storage',event=>{if(event.key===locationSimulationKey)changed();});window.addEventListener('alpha:device-settings',()=>{if(!browserSensorEnabled('locationEnabled'))this.retire();});window.addEventListener('pagehide',()=>this.retire());window.addEventListener('alpha:device-state',()=>this.retire());document.addEventListener('visibilitychange',()=>{if(document.hidden)this.retire();});}
 private retire(){this.generation++;for(const cancel of [...this.pending.values()])cancel();const had=this.watches.size>0;for(const watch of this.watches.values()){watch.active=false;if(watch.simulated)clearInterval(watch.id);else navigator.geolocation.clearWatch(watch.id);}this.watches.clear();if(had)void this.notifyListeners('error',{code:'PERMISSION_DENIED'});}
 async checkPermissions(){const enabled=(await readDevicePreferences()).locationEnabled;if(readLocationSimulation().mode==='coordinates'&&enabled)return {location:'granted',accuracy:'precise'};if(!enabled)return {location:'denied',accuracy:'none'};try{const status=await navigator.permissions.query({name:'geolocation'});return {location:status.state,accuracy:status.state==='granted'?'precise':'none'};}catch{return {location:'prompt',accuracy:'none'};}}
 async requestPermissions(input?:{requestId?:string}){
  const requestId=input?.requestId||crypto.randomUUID();this.pending.get(requestId)?.();
  let cancelled=false,finishPending:((granted:boolean)=>void)|undefined;const cancel=()=>{cancelled=true;finishPending?.(false);};this.pending.set(requestId,cancel);
  try{
   const settings=await readDevicePreferences();
   if(cancelled||!settings.locationEnabled||!foreground())return {location:'denied',accuracy:'none'};
   if(readLocationSimulation().mode==='coordinates')return {location:'granted',accuracy:'precise'};
   return await new Promise(resolve=>{let id:number|undefined,settled=false;const finish=(granted:boolean)=>{if(settled)return;settled=true;if(id!==undefined)navigator.geolocation.clearWatch(id);resolve({location:granted?'granted':'denied',accuracy:granted?'precise':'none'});};finishPending=finish;
    try{id=navigator.geolocation.watchPosition(()=>finish(!cancelled&&browserSensorEnabled('locationEnabled')),()=>finish(false),{timeout:10000});if(settled)navigator.geolocation.clearWatch(id);}catch{finish(false);}
   });
  }finally{if(this.pending.get(requestId)===cancel)this.pending.delete(requestId);}
 }
 async cancelPermissionRequest(input:{requestId:string}){this.pending.get(input.requestId)?.();}
 private simulatedFix(){if(!browserSensorEnabled('locationEnabled')||!foreground())return;try{const fix=readLocationSimulation();if(fix.mode==='coordinates')void this.notifyListeners('locationChange',{coords:{latitude:fix.latitude,longitude:fix.longitude,accuracy:fix.accuracy,timestamp:Date.now()},cached:false});}catch{void this.notifyListeners('error',{code:'UNAVAILABLE'});}}
 async watchPosition(){
  const generation=this.generation,settings=await readDevicePreferences();
  if(generation!==this.generation||!settings.locationEnabled||!foreground())throw new DOMException('Location is off. Turn it on in device controls.','NotAllowedError');
  if(readLocationSimulation().mode==='coordinates'){const watchId=crypto.randomUUID(),watch={id:0,active:true,simulated:true};this.watches.set(watchId,watch);watch.id=window.setInterval(()=>{if(watch.active)this.simulatedFix();},1000);queueMicrotask(()=>{if(watch.active)this.simulatedFix();});return {watchId};}
  const watchId=crypto.randomUUID(),watch={id:0,active:true};this.watches.set(watchId,watch);
  try{watch.id=navigator.geolocation.watchPosition(position=>{if(watch.active&&browserSensorEnabled('locationEnabled'))void this.notifyListeners('locationChange',{coords:{latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy,timestamp:position.timestamp},cached:false});},error=>{if(watch.active)void this.notifyListeners('error',{code:error.code===1?'PERMISSION_DENIED':'UNAVAILABLE'});},{enableHighAccuracy:true,maximumAge:0,timeout:10000});return {watchId};}catch(error){watch.active=false;this.watches.delete(watchId);throw error;}
 }
 async clearWatch(input:{watchId:string}){const watch=this.watches.get(input.watchId);if(watch){watch.active=false;if(watch.simulated)clearInterval(watch.id);else navigator.geolocation.clearWatch(watch.id);}this.watches.delete(input.watchId);}
}
