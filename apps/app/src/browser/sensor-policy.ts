import {cachedDevicePreferences,readDevicePreferences,initializeDevicePreferences} from './device-preferences';
export type BrowserSensor='microphoneEnabled'|'locationEnabled';
export function browserSensorEnabled(sensor:BrowserSensor){return cachedDevicePreferences()?.[sensor]===true;}
/** Own a microphone permission request and its eventual stream across policy changes. */
export class BrowserMicrophone {
 private closed=false;
 private stream?:MediaStream;
 private abort=new AbortController();
 private changed=()=>{if(!browserSensorEnabled('microphoneEnabled'))this.cancel();};
 constructor(private cancel:()=>void){initializeDevicePreferences();window.addEventListener('alpha:device-settings',this.changed);}
 async open(){
  let enabled=false;try{enabled=(await readDevicePreferences(this.abort.signal)).microphoneEnabled;}catch(error){this.close();throw error;}
  if(this.closed||!enabled){this.close();throw new DOMException('Microphone is off. Turn it on in device controls.','NotAllowedError');}
  const signal=this.abort.signal;
  return new Promise<MediaStream>((resolve,reject)=>{
   const cancelled=()=>reject(new DOMException('Recording cancelled','AbortError'));signal.addEventListener('abort',cancelled,{once:true});
   let request:Promise<MediaStream>;try{request=navigator.mediaDevices.getUserMedia({audio:true,video:false});}catch(error){signal.removeEventListener('abort',cancelled);this.close();reject(error);return;}
   request.then(stream=>{signal.removeEventListener('abort',cancelled);if(this.closed){stream.getTracks().forEach(track=>track.stop());return;}this.stream=stream;resolve(stream);},error=>{signal.removeEventListener('abort',cancelled);this.close();reject(error);});
  });
 }
 close(){if(this.closed)return;this.closed=true;window.removeEventListener('alpha:device-settings',this.changed);this.abort.abort();this.stream?.getTracks().forEach(track=>track.stop());this.stream=undefined;}
}
