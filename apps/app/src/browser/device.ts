import {browserDevProfile} from './dev-profile';
import {passwordProviderStatus,openPasswordProvider} from './password-provider';
import {focusActive} from './focus-state';
import {installBrowserAudioSettings} from './audio-settings';
import {installBrowserDisplay,applyBrowserDisplay} from './display';
import { browserApps } from './apps';
import { WebPlugin } from '@capacitor/core';
import { editStore, readStore } from './store';
const key='alpha.browser.device.v1';
const initial=()=>({wifiActive:true,bluetoothActive:false,cellularActive:false,airplaneMode:false,microphoneEnabled:true,locationEnabled:true,doNotDisturb:false,preAirplane:null as null|{wifiActive:boolean;bluetoothActive:boolean;cellularActive:boolean},powerSave:false,batteryPercent:100,charging:true,textScalePercent:100,brightness:100,music:70,ring:70,alarm:70});
export const browserDeviceState=()=>{const state={...initial(),...readStore(key,initial)};return {...state,doNotDisturb:state.doNotDisturb||focusActive()};};
export class BrowserDevice extends WebPlugin {
 constructor(){super();installBrowserAudioSettings();installBrowserDisplay();applyBrowserDisplay(readStore(key,initial));window.addEventListener('storage',event=>{if(event.key===key){applyBrowserDisplay(readStore(key,initial));window.dispatchEvent(new Event('alpha:device-settings'));window.dispatchEvent(new Event('focus'));}});}
 async setBrightness(input:{percent:number}){if(!Number.isFinite(input.percent))throw Error('Choose a brightness value.');const percent=Math.max(0,Math.min(100,Math.round(input.percent)));await editStore(key,initial,data=>{data.brightness=percent;});applyBrowserDisplay(readStore(key,initial));window.dispatchEvent(new Event('alpha:device-settings'));return {brightness:percent};}

 async setNetwork(input:{field:'wifiActive'|'bluetoothActive'|'cellularActive'|'airplaneMode';enabled?:boolean}){
  if(!['wifiActive','bluetoothActive','cellularActive','airplaneMode'].includes(input.field)||input.enabled!==undefined&&typeof input.enabled!=='boolean')throw Error('Choose a network control.');
  await editStore(key,initial,data=>{const enabled=input.enabled??!data[input.field];
   if(input.field==='airplaneMode'){
    if(enabled&&!data.airplaneMode){data.preAirplane={wifiActive:data.wifiActive,bluetoothActive:data.bluetoothActive,cellularActive:data.cellularActive};data.wifiActive=data.bluetoothActive=data.cellularActive=false;}
    else if(!enabled&&data.airplaneMode&&data.preAirplane){Object.assign(data,data.preAirplane);data.preAirplane=null;}
    data.airplaneMode=enabled;
   }else{if(input.field==='cellularActive'&&enabled&&data.airplaneMode)throw Error('Turn off airplane mode before enabling mobile data.');data[input.field]=enabled;}
  });window.dispatchEvent(new Event('alpha:device-settings'));window.dispatchEvent(new Event('focus'));return browserDeviceState();
 }
 async setSensor(input:{field:'microphoneEnabled'|'locationEnabled'|'doNotDisturb';enabled?:boolean}){
  if(!['microphoneEnabled','locationEnabled','doNotDisturb'].includes(input.field)||input.enabled!==undefined&&typeof input.enabled!=='boolean')throw Error('Choose a sensor control.');
  await editStore(key,initial,data=>{data[input.field]=input.enabled??!(data[input.field]??initial()[input.field]);});window.dispatchEvent(new Event('alpha:device-settings'));window.dispatchEvent(new Event('focus'));return browserDeviceState();
 }
 async getStatus(){const roles=readStore<Record<string,boolean>>('alpha.browser.roles.v1',()=>({}));return {packageName:'ai.elizaresearch.alphaphone',roles:['home','assistant','dialer','sms'].map(role=>({role,androidRole:role,held:!!roles[role],holders:roles[role]?['ai.elizaresearch.alphaphone']:[],available:true}))};}
 async requestRole(input:{role:string}){if(!['home','assistant','dialer','sms'].includes(input.role))throw Error('Choose a device role.');await editStore<Record<string,boolean>,void>('alpha.browser.roles.v1',()=>({}),roles=>{roles[input.role]=true;});return {role:input.role,held:true,resultCode:-1};}
 async snapshot(){
  const permissionStates:Record<string,string>={};for(const [label,name] of [['Camera','camera'],['Microphone','microphone'],['Location','geolocation']]){try{permissionStates[label]=(await navigator.permissions.query({name:name as PermissionName})).state;}catch{permissionStates[label]='unknown';}}
  return {...browserDeviceState(),...(browserDevProfile?{passwordProvider:passwordProviderStatus()}:{}),readAt:Date.now(),model:'Browser development device',manufacturer:navigator.platform,appVersion:'0.1.0',androidRelease:'Browser',build:'Development',securityPatch:'Browser managed',uptimeMs:performance.now(),permissionStates,permissions:Object.fromEntries(Object.entries(permissionStates).map(([name,state])=>[name,state==='granted'])),locationAccess:permissionStates.Location==='granted'?'browser':'none'};
 }

 async openPasswordProvider(input:{action:string}){return openPasswordProvider(input.action);}
 async setTextScale(input:{percent:number}){if(!Number.isFinite(input.percent))throw Error('Choose a text size.');const percent=Math.max(75,Math.min(150,Math.round(input.percent)));await editStore(key,initial,data=>{data.textScalePercent=percent;});applyBrowserDisplay(readStore(key,initial));return {textScalePercent:percent,effectiveTextZoom:percent};}
 async getDeviceSettings(){const data=readStore(key,initial);return {volumes:['music','ring','alarm'].map(stream=>({stream,current:data[stream as 'music'],max:100}))};}
 async openSettings(input:{page:string}={page:'device'}) {
  document.querySelector<HTMLDialogElement>('[data-browser-settings]')?.close();
  const dialog=document.createElement('dialog');dialog.dataset.browserSettings='true';dialog.setAttribute('aria-label',`${input.page} settings`);dialog.style.cssText='border:0;border-radius:18px;padding:24px;width:min(320px,85vw);background:var(--bg,#fff);color:var(--fg,#111);font:16px system-ui';
  const title=document.createElement('h2');title.textContent=input.page[0].toUpperCase()+input.page.slice(1);dialog.append(title);
  const state=browserDeviceState(),status=document.createElement('p'),inputs=new Map<string,HTMLInputElement>();status.setAttribute('role','status');
  const fields:Record<string,(keyof typeof state)[]>={privacy:['microphoneEnabled','locationEnabled'],wifi:['wifiActive','airplaneMode'],bluetooth:['bluetoothActive'],mobile:['cellularActive'],battery:['powerSave','batteryPercent','charging'],sound:['music','ring','alarm','doNotDisturb'],display:['brightness','textScalePercent']};
  for(const keyName of fields[input.page]||[]){const label=document.createElement('label'),control=document.createElement('input');label.style.cssText='display:flex;justify-content:space-between;align-items:center;margin:16px 0;gap:12px';inputs.set(keyName,control);label.textContent=keyName.replace(/([A-Z])/g,' $1');control.type=typeof state[keyName]==='boolean'?'checkbox':'range';if(control.type==='checkbox')control.checked=state[keyName] as boolean;else{control.min=keyName==='textScalePercent'?'75':'0';control.max=keyName==='textScalePercent'?'150':'100';control.value=String(state[keyName]);}control.onchange=async()=>{control.disabled=true;try{if(['microphoneEnabled','locationEnabled','doNotDisturb'].includes(keyName))await this.setSensor({field:keyName as 'microphoneEnabled',enabled:control.checked});else if(['wifiActive','bluetoothActive','cellularActive','airplaneMode'].includes(keyName))await this.setNetwork({field:keyName as 'wifiActive',enabled:control.checked});else await editStore(key,initial,data=>{Object.assign(data,{[keyName]:control.type==='checkbox'?control.checked:Number(control.value)});});applyBrowserDisplay(readStore(key,initial));window.dispatchEvent(new Event('alpha:device-settings'));window.dispatchEvent(new Event('focus'));status.textContent='';}catch{const saved=readStore(key,initial);if(control.type==='checkbox')control.checked=saved[keyName] as boolean;else control.value=String(saved[keyName]);status.textContent='The setting could not be saved. Try again.';}finally{control.disabled=false;}};label.append(control);dialog.append(label);}
  if(!fields[input.page]){const text=document.createElement('p');text.textContent=input.page==='privacy'?'Camera, microphone and location permissions are managed by your browser.':'Browser development device';dialog.append(text);}
  const sync=()=>{const saved=browserDeviceState();for(const [field,control] of inputs){if(control.disabled)continue;const value=saved[field as keyof typeof saved];if(control.type==='checkbox')control.checked=!!value;else control.value=String(value);}};window.addEventListener('alpha:device-settings',sync);
  dialog.append(status);
  const close=document.createElement('button');close.textContent='Done';close.onclick=()=>dialog.close();dialog.append(close);const previous=document.activeElement as HTMLElement|null;const back=(event:Event)=>{event.preventDefault();event.stopImmediatePropagation();dialog.close();};window.addEventListener('alpha-back',back,true);dialog.onclose=()=>{window.removeEventListener('alpha:device-settings',sync);window.removeEventListener('alpha-back',back,true);dialog.remove();previous?.focus();window.dispatchEvent(new Event('focus'));};document.body.append(dialog);dialog.showModal();return {status:'opened'};
 }
 async list(){return {apps:browserApps.map(({view,...app})=>app)};}
 async launch(input:{packageName:string}){const app=browserApps.find(app=>app.packageName===input.packageName);if(!app)throw Error('Choose an installed development app.');window.dispatchEvent(new CustomEvent('alpha:browser-open-view',{detail:app.view}));}
 async buildInfo(){return {launcher:false,version:'0.1.0'};}
}
