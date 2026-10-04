import { registerPlugin } from '../platform-plugins';
import { Capacitor } from '@capacitor/core';
type Bag = Record<string, any>;
type Notice = { id: string; revision:string; source:'own'|'external'|'hosted'; appLabel:string; title: string; text: string; at: number; clearable: boolean; canOpen: boolean };
const native = registerPlugin<{list(): Promise<{items: Notice[]; scope: string; calendarStatus?:string}>;open(options:{id:string;revision:string;source:string}):Promise<void>;dismiss(options:{id:string;revision:string;source:string}):Promise<void>;clear(options:{items:Array<{id:string;revision:string;source:string}>}):Promise<{outcomes:Array<{status:string}>}>}>('AlphaNotifications');
/** Active rows only. Android access and per-app opt-in are enforced natively. */
export function installNotificationsAdapter(Component: any) {
 const p=Component.prototype, render=p.renderVals, mount=p.componentDidMount, unmount=p.componentWillUnmount;
 p.componentDidMount=function(){mount?.call(this);this.alphaNotices=[];this.alphaNoticesLive=true;this.alphaNoticeEpoch=0;
  this.alphaNoticeVisibility=()=>{this.alphaNoticeEpoch++;if(document.hidden){this.alphaNotices=[];}else{this.setState({nativeNoticeRevision:Date.now()});if(this.S().shade)void this.refreshAlphaNotices();}};
  document.addEventListener('visibilitychange',this.alphaNoticeVisibility);
  this.alphaNoticeDeviceState=()=>{this.alphaNoticeEpoch++;this.alphaNotices=[];this.setState({nativeNoticeRevision:Date.now()});};
  if(!Capacitor.isNativePlatform())window.addEventListener('alpha:device-state',this.alphaNoticeDeviceState);
  this.alphaNoticeTimer=window.setInterval(()=>{if(this.alphaNoticesLive&&this.S().shade&&!document.hidden)void this.refreshAlphaNotices();},1000);
 };
 p.componentWillUnmount=function(){this.alphaNoticesLive=false;this.alphaNoticeEpoch++;document.removeEventListener('visibilitychange',this.alphaNoticeVisibility);window.removeEventListener('alpha:device-state',this.alphaNoticeDeviceState);clearInterval(this.alphaNoticeTimer);unmount?.call(this);};
 p.refreshAlphaNotices=async function(){
  if(this.alphaNoticesBusy||!this.alphaNoticesLive||document.hidden)return;this.alphaNoticesBusy=true;const epoch=this.alphaNoticeEpoch;
  try{const result=await native.list();if(!this.alphaNoticesLive||document.hidden||epoch!==this.alphaNoticeEpoch)return;if(result.calendarStatus==='unavailable'){if(!this.alphaCalendarAlertError)this.toast('Calendar alerts could not load. Open Calendar to review the problem.');this.alphaCalendarAlertError=true;}else this.alphaCalendarAlertError=false;const next=result.items;if(JSON.stringify(next)!==JSON.stringify(this.alphaNotices)){this.alphaNotices=next;this.setState({nativeNoticeRevision:Date.now()});}this.alphaNoticeError=false;}
  catch{if(this.alphaNoticesLive&&!document.hidden&&epoch===this.alphaNoticeEpoch&&!this.alphaNoticeError){this.alphaNoticeError=true;this.alphaNotices=[];this.setState({nativeNoticeRevision:Date.now()});this.toast('Alpha Phone notifications are unavailable.');}}
  finally{this.alphaNoticesBusy=false;}
 };
 p.renderVals=function(){
  const out=render.call(this),self=this;
  const action=async(task:()=>Promise<void>)=>{try{await task();await self.refreshAlphaNotices();}catch{if(self.alphaNoticesLive&&!document.hidden){self.toast('The notification changed or could not be updated.');await self.refreshAlphaNotices();}}};
  const shadeN=(this.alphaNotices||[]).map((n:Notice)=>{
   const swipe=this.sw(()=>{if(n.clearable)void action(()=>native.dismiss({id:n.id,revision:n.revision,source:n.source}));else this.toast('This is an ongoing notification.');},{axis:'x'});
   return {id:n.id,d:out.ic.bell,who:n.source==='external'?n.appLabel:n.title||'Alpha Phone',text:n.source==='external'&&n.title!==n.appLabel?[n.title,n.text].filter(Boolean).join(' · '):n.text,time:new Date(n.at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}),tx:0,op:1,down:swipe.down,up:swipe.up,open:()=>{if(this.swallowed())return;if(!n.canOpen){this.toast('This notification has no available action.');return;}void action(()=>native.open({id:n.id,revision:n.revision,source:n.source}));}};
  });
  return {...out,shadeN,clearAll:()=>{const items=(this.alphaNotices||[]).filter((n:Notice)=>n.clearable).map((n:Notice)=>({id:n.id,revision:n.revision,source:n.source}));void action(async()=>{const result=await native.clear({items});if(result.outcomes.some(row=>row.status==='unavailable'))self.toast('Some notifications changed. Review the refreshed list.');});}};
 };
}
