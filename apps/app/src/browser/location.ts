import {readLocationSimulation,locationSimulationKey} from './location-simulation';
import { WebPlugin } from '@capacitor/core';
import {browserSensorEnabled} from './sensor-policy';
const foreground=()=>!document.hidden&&document.documentElement.dataset.devBackground!=='true'&&!document.querySelector('[aria-label="Unlock with fingerprint"], [aria-label="Wake"]')?.getClientRects().length;
export class BrowserLocation extends WebPlugin {
 private watches=new Map<string,{id:number;active:boolean;simulated?:boolean}>();
 private pending=new Map<string,()=>void>();
 constructor(){super();const changed=()=>{for(const [watchId,watch] of this.watches){let simulated=false;try{simulated=readLocationSimulation().mode==='coordinates';}catch{}if(!!watch.simulated!==simulated){void this.clearWatch({watchId});void this.notifyListeners('error',{code:'UNAVAILABLE'});}else if(simulated)this.simulatedFix();}};window.addEventListener('alpha:dev-location',changed);window.addEventListener('storage',event=>{if(event.key===locationSimulationKey)changed();});window.addEventListener('alpha:device-settings',()=>{if(!browserSensorEnabled('locationEnabled'))this.retire();});window.addEventListener('pagehide',()=>this.retire());window.addEventListener('alpha:device-state',()=>this.retire());document.addEventListener('visibilitychange',()=>{if(document.hidden)this.retire();});}
 private retire(){for(const cancel of [...this.pending.values()])cancel();const had=this.watches.size>0;for(const watch of this.watches.values()){watch.active=false;if(watch.simulated)clearInterval(watch.id);else navigator.geolocation.clearWatch(watch.id);}this.watches.clear();if(had)void this.notifyListeners('error',{code:'PERMISSION_DENIED'});}
 async checkPermissions(){if(readLocationSimulation().mode==='coordinates'&&browserSensorEnabled('locationEnabled'))return {location:'granted',accuracy:'precise'};if(!browserSensorEnabled('locationEnabled'))return {location:'denied',accuracy:'none'};try{const status=await navigator.permissions.query({name:'geolocation'});return {location:status.state,accuracy:status.state==='granted'?'precise':'none'};}catch{return {location:'prompt',accuracy:'none'};}}
 async requestPermissions(input?:{requestId?:string}){
  if(!browserSensorEnabled('locationEnabled')||!foreground())return {location:'denied',accuracy:'none'};
  if(readLocationSimulation().mode==='coordinates')return {location:'granted',accuracy:'precise'};
  const requestId=input?.requestId||crypto.randomUUID();
  return new Promise(resolve=>{let id:number|undefined,settled=false;const finish=(granted:boolean)=>{if(settled)return;settled=true;this.pending.delete(requestId);if(id!==undefined)navigator.geolocation.clearWatch(id);resolve({location:granted?'granted':'denied',accuracy:granted?'precise':'none'});};const cancel=()=>finish(false);this.pending.set(requestId,cancel);
   try{id=navigator.geolocation.watchPosition(()=>finish(browserSensorEnabled('locationEnabled')),()=>finish(false),{timeout:10000});if(settled)navigator.geolocation.clearWatch(id);}catch{finish(false);}
  });
 }
 async cancelPermissionRequest(input:{requestId:string}){this.pending.get(input.requestId)?.();}
 private simulatedFix(){if(!browserSensorEnabled('locationEnabled')||!foreground())return;try{const fix=readLocationSimulation();if(fix.mode==='coordinates')void this.notifyListeners('locationChange',{coords:{latitude:fix.latitude,longitude:fix.longitude,accuracy:fix.accuracy,timestamp:Date.now()},cached:false});}catch{void this.notifyListeners('error',{code:'UNAVAILABLE'});}}
 async watchPosition(){
  if(!browserSensorEnabled('locationEnabled')||!foreground())throw new DOMException('Location is off. Turn it on in device controls.','NotAllowedError');
  if(readLocationSimulation().mode==='coordinates'){const watchId=crypto.randomUUID(),watch={id:0,active:true,simulated:true};this.watches.set(watchId,watch);watch.id=window.setInterval(()=>{if(watch.active)this.simulatedFix();},1000);queueMicrotask(()=>{if(watch.active)this.simulatedFix();});return {watchId};}
  const watchId=crypto.randomUUID(),watch={id:0,active:true};this.watches.set(watchId,watch);
  try{watch.id=navigator.geolocation.watchPosition(position=>{if(watch.active&&browserSensorEnabled('locationEnabled'))void this.notifyListeners('locationChange',{coords:{latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy,timestamp:position.timestamp},cached:false});},error=>{if(watch.active)void this.notifyListeners('error',{code:error.code===1?'PERMISSION_DENIED':'UNAVAILABLE'});},{enableHighAccuracy:true,maximumAge:0,timeout:10000});return {watchId};}catch(error){watch.active=false;this.watches.delete(watchId);throw error;}
 }
 async clearWatch(input:{watchId:string}){const watch=this.watches.get(input.watchId);if(watch){watch.active=false;if(watch.simulated)clearInterval(watch.id);else navigator.geolocation.clearWatch(watch.id);}this.watches.delete(input.watchId);}
}
