import { WebPlugin } from '@capacitor/core';
export class BrowserLocation extends WebPlugin {
 private watches=new Map<string,number>();
 async checkPermissions(){try{const status=await navigator.permissions.query({name:'geolocation'});return {location:status.state,accuracy:status.state==='granted'?'precise':'none'};}catch{return {location:'prompt',accuracy:'none'};}}
 async requestPermissions(){return new Promise(resolve=>navigator.geolocation.getCurrentPosition(()=>resolve({location:'granted',accuracy:'precise'}),()=>resolve({location:'denied',accuracy:'none'}),{timeout:10000}));}
 async watchPosition(){const watchId=crypto.randomUUID();const watch=navigator.geolocation.watchPosition(position=>void this.notifyListeners('locationChange',{coords:{latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy,timestamp:position.timestamp},cached:false}),error=>void this.notifyListeners('error',{code:error.code===1?'PERMISSION_DENIED':'UNAVAILABLE'}),{enableHighAccuracy:true,maximumAge:0,timeout:10000});this.watches.set(watchId,watch);return {watchId};}
 async clearWatch(input:{watchId:string}){const watch=this.watches.get(input.watchId);if(watch!==undefined)navigator.geolocation.clearWatch(watch);this.watches.delete(input.watchId);}
}
