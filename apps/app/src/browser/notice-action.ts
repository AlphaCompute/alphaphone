import {browserScreenLocked} from './screen-locked';
export const noticeActionBlocked=()=>document.hidden||document.documentElement.dataset.devBackground==='true'||!!browserScreenLocked();
/** A user action owns its queued write and any subsequent navigation. */
export function beginNoticeAction(){
 const controller=new AbortController(),retire=()=>controller.abort(),hidden=()=>{if(document.hidden)retire();};
 const events=['alpha-back','pagehide','launcher-home','alpha:device-state','alpha:dev-incoming-call','alpha:browser-open-view'];
 for(const event of events)window.addEventListener(event,retire,true);document.addEventListener('visibilitychange',hidden);hidden();
 return {signal:controller.signal,dispose:()=>{for(const event of events)window.removeEventListener(event,retire,true);document.removeEventListener('visibilitychange',hidden);}};
}
