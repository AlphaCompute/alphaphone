import { WebPlugin } from '@capacitor/core';
import { editStore, readStore } from './store';
const key='alpha.browser.device.v1';
const initial=()=>({wifiActive:true,bluetoothActive:false,cellularActive:false,powerSave:false,batteryPercent:100,charging:true,textScalePercent:100,brightness:100,music:70,ring:70,alarm:70});
export class BrowserDevice extends WebPlugin {
 async snapshot(){return {...readStore(key,initial),readAt:Date.now(),model:'Browser development device',manufacturer:navigator.platform,appVersion:'0.1.0',androidRelease:'Browser',build:'Development',securityPatch:'Browser managed',uptimeMs:performance.now(),permissions:{Camera:true,Microphone:true,Location:true},locationAccess:'approximate'};}
 async setTextScale(input:{percent:number}){const percent=Math.max(75,Math.min(150,Math.round(input.percent)));await editStore(key,initial,data=>{data.textScalePercent=percent;});document.documentElement.style.setProperty('--browser-text-scale',String(percent/100));return {textScalePercent:percent,effectiveTextZoom:percent};}
 async getDeviceSettings(){const data=readStore(key,initial);return {volumes:['music','ring','alarm'].map(stream=>({stream,current:data[stream as 'music'],max:100}))};}
 async openSettings(input:{page:string}) {
  document.querySelector('[data-browser-settings]')?.remove();
  const dialog=document.createElement('dialog');dialog.dataset.browserSettings='true';dialog.setAttribute('aria-label',`${input.page} settings`);dialog.style.cssText='border:0;border-radius:18px;padding:24px;width:min(320px,85vw);background:var(--bg,#fff);color:var(--fg,#111);font:16px system-ui';
  const title=document.createElement('h2');title.textContent=input.page[0].toUpperCase()+input.page.slice(1);dialog.append(title);
  const state=readStore(key,initial);
  const fields:Record<string,(keyof typeof state)[]>={wifi:['wifiActive'],bluetooth:['bluetoothActive'],mobile:['cellularActive'],battery:['powerSave','batteryPercent','charging'],sound:['music','ring','alarm'],display:['brightness','textScalePercent']};
  for(const keyName of fields[input.page]||[]){const label=document.createElement('label'),control=document.createElement('input');label.style.cssText='display:flex;justify-content:space-between;align-items:center;margin:16px 0;gap:12px';label.textContent=keyName.replace(/([A-Z])/g,' $1');control.type=typeof state[keyName]==='boolean'?'checkbox':'range';if(control.type==='checkbox')control.checked=state[keyName] as boolean;else{control.min=keyName==='textScalePercent'?'75':'0';control.max=keyName==='textScalePercent'?'150':'100';control.value=String(state[keyName]);}control.onchange=async()=>{await editStore(key,initial,data=>{Object.assign(data,{[keyName]:control.type==='checkbox'?control.checked:Number(control.value)});});if(keyName==='textScalePercent')await this.setTextScale({percent:Number(control.value)});window.dispatchEvent(new Event('focus'));};label.append(control);dialog.append(label);}
  if(!fields[input.page]){const text=document.createElement('p');text.textContent=input.page==='privacy'?'Camera, microphone and location permissions are managed by your browser.':'Browser development device';dialog.append(text);}
  const close=document.createElement('button');close.textContent='Done';close.onclick=()=>dialog.close();dialog.append(close);dialog.onclose=()=>{dialog.remove();window.dispatchEvent(new Event('focus'));};document.body.append(dialog);dialog.showModal();return {status:'opened'};
 }
 async list(){return {apps:['browser','calendar','camera','photos','files','maps','notes','settings'].map(name=>({packageName:`browser.${name}`,label:name[0].toUpperCase()+name.slice(1)}))};}
 async launch(input:{packageName:string}){const name=input.packageName.replace(/^browser\./,'');if(!(await this.list()).apps.some(a=>a.packageName===input.packageName))throw Error('Choose an installed development app.');window.dispatchEvent(new CustomEvent('alpha:browser-open-view',{detail:name}));}
 async buildInfo(){return {launcher:false,version:'0.1.0'};}
}
