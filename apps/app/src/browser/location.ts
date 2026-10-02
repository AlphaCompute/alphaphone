import { WebPlugin } from '@capacitor/core';
import {browserSensorEnabled} from './sensor-policy';
export class BrowserLocation extends WebPlugin {
 private watches=new Map<string,{id:number;active:boolean}>();
 private pending=new Set<()=>void>();
 constructor(){super();window.addEventListener('alpha:device-settings',()=>{if(!browserSensorEnabled('locationEnabled'))this.retire();});window.addEventListener('pagehide',()=>this.retire());window.addEventListener('alpha:device-state',()=>this.retire());document.addEventListener('visibilitychange',()=>{if(document.hidden)this.retire();});}
 private retire(){for(const cancel of [...this.pending])cancel();const had=this.watches.size>0;for(const watch of this.watches.values()){watch.active=false;navigator.geolocation.clearWatch(watch.id);}this.watches.clear();if(had)void this.notifyListeners('error',{code:'PERMISSION_DENIED'});}
 async checkPermissions(){if(!browserSensorEnabled('locationEnabled'))return {location:'denied',accuracy:'none'};try{const status=await navigator.permissions.query({name:'geolocation'});return {location:status.state,accuracy:status.state==='granted'?'precise':'none'};}catch{return {location:'prompt',accuracy:'none'};}}
 async requestPermissions(){
  if(!browserSensorEnabled('locationEnabled')||document.hidden)return {location:'denied',accuracy:'none'};
  return new Promise(resolve=>{let id:number|undefined,settled=false;const finish=(granted:boolean)=>{if(settled)return;settled=true;this.pending.delete(cancel);if(id!==undefined)navigator.geolocation.clearWatch(id);resolve({location:granted?'granted':'denied',accuracy:granted?'precise':'none'});};const cancel=()=>finish(false);this.pending.add(cancel);
   try{id=navigator.geolocation.watchPosition(()=>finish(browserSensorEnabled('locationEnabled')),()=>finish(false),{timeout:10000});if(settled)navigator.geolocation.clearWatch(id);}catch{finish(false);}
  });
 }
 async watchPosition(){
  if(!browserSensorEnabled('locationEnabled')||document.hidden)throw new DOMException('Location is off. Turn it on in device controls.','NotAllowedError');
  const watchId=crypto.randomUUID(),watch={id:0,active:true};this.watches.set(watchId,watch);
  try{watch.id=navigator.geolocation.watchPosition(position=>{if(watch.active&&browserSensorEnabled('locationEnabled'))void this.notifyListeners('locationChange',{coords:{latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy,timestamp:position.timestamp},cached:false});},error=>{if(watch.active)void this.notifyListeners('error',{code:error.code===1?'PERMISSION_DENIED':'UNAVAILABLE'});},{enableHighAccuracy:true,maximumAge:0,timeout:10000});return {watchId};}catch(error){watch.active=false;this.watches.delete(watchId);throw error;}
 }
 async clearWatch(input:{watchId:string}){const watch=this.watches.get(input.watchId);if(watch){watch.active=false;navigator.geolocation.clearWatch(watch.id);}this.watches.delete(input.watchId);}
}
