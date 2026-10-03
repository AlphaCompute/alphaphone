import {openCalendarRecovery} from '../browser/calendar-recovery';
import { registerPlugin } from '../platform-plugins';
import { Capacitor } from '@capacitor/core';
import { DailyApps } from '../daily';
type Bag = Record<string, any>;
const calendar = registerPlugin<any>('AlphaCalendar');
const DAY=86400000;
const civilDay=(date:Date,utc=false)=>Date.UTC(utc?date.getUTCFullYear():date.getFullYear(),utc?date.getUTCMonth():date.getMonth(),utc?date.getUTCDate():date.getDate());
/** Date setters normalize missing DST wall times; reject that normalization. */
function wallTime(off:number,hours:number):Date|null {
  if(!Number.isSafeInteger(off)||!Number.isFinite(hours))return null;
  const minutes=Math.round(hours*60),today=new Date();
  const target=new Date(Date.UTC(today.getFullYear(),today.getMonth(),today.getDate()+off,0,minutes));
  const date=new Date(target.getUTCFullYear(),target.getUTCMonth(),target.getUTCDate(),target.getUTCHours(),target.getUTCMinutes());
  return date.getFullYear()===target.getUTCFullYear()&&date.getMonth()===target.getUTCMonth()&&date.getDate()===target.getUTCDate()&&date.getHours()===target.getUTCHours()&&date.getMinutes()===target.getUTCMinutes()?date:null;
}

/** Android CalendarProvider data in the original calendar presentation. */
export function installCalendarAdapter(Component: any, views: Bag) {
  const p=Component.prototype, mount=p.componentDidMount, unmount=p.componentWillUnmount;
  const render=views.calendar.render;
  let owner:any, calendars:Bag[]=[], status='Not connected', loading=false, generation=0, loadFailed=false;
  let creationPending:Bag[]|null=null,creationRecoveryFailed=false,creationDraftEpoch=0,creationReadEpoch=0;
  async function readCreations(){const token=++creationReadEpoch,readingOwner=owner,draftEpoch=creationDraftEpoch;const value=await calendar.pendingCreations();if(value.status!=='ready'||!Array.isArray(value.creations))throw Error('Calendar creation recovery unavailable');if(owner===readingOwner&&draftEpoch===creationDraftEpoch&&token===creationReadEpoch){creationPending=value.creations;creationRecoveryFailed=false;}return value.creations as Bag[];}
  let agentSelection:Bag|undefined,agentSelectionKey='',agentSelectionEpoch=0;
  p.calendarSelection=function(){const state=this.vget('calendar');if(agentSelection?.kind==='calendar-source')return state.form?.cal===agentSelection.formCal?{kind:'calendar-source',id:agentSelection.id,revision:agentSelection.revision,accountId:agentSelection.id,sourceRevision:agentSelection.revision}:undefined;return agentSelection&&state.open===agentSelection.open?{kind:'calendar-event',id:agentSelection.id,revision:agentSelection.revision,accountId:agentSelection.accountId,sourceRevision:agentSelection.sourceRevision}:undefined;};
  type Range={begin:number;end:number;key:string};
  const rangeFor=(state:Bag):Range=>{const today=new Date(),date=new Date(today.getFullYear(),today.getMonth(),today.getDate()+Number(state.day||0));date.setDate(1);if(state.month!=null)date.setMonth(date.getMonth()+Number(state.month||0));const begin=new Date(date.getFullYear(),date.getMonth()-1,1).getTime(),end=new Date(date.getFullYear(),date.getMonth()+2,1).getTime();return {begin:Math.max(0,begin),end,key:`${begin}:${end}`};};
  let desired:Range|undefined,loadedKey='',attemptedKey='',scheduled=false,runningToken=0,truncated=false;
  const schedule=()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;if(owner&&!loading&&desired?.key!==attemptedKey)void refresh();});};
  const mapEvent=(event:Bag)=>{
    const begin=new Date(event.begin),end=new Date(event.end),today=new Date(),allDay=!!event.allDay;
    const off=(civilDay(begin,allDay)-civilDay(today))/DAY;
    return {id:`calendar:${event.id}:${event.begin}`,alphaCalendarId:event.id,nativeEvent:event,
      off,t:allDay?0:begin.getHours()+begin.getMinutes()/60,
      d:allDay?0:Math.max(.25,(civilDay(end)-civilDay(begin))/DAY*24+end.getHours()+end.getMinutes()/60-begin.getHours()-begin.getMinutes()/60),
      nativeAllDayEndOff:allDay?off+Math.max(1,Math.ceil((event.end-event.begin)/DAY)):undefined,
      title:event.title||'Untitled event',notes:event.body||'',where:event.location||'',
      cal:'personal',who:event.who||[],video:event.video?'Local meeting room':false,repeat:'none',alert:event.alert??null,allDay};
  };
  async function refresh(request=false, force=false) {
    if(!owner || (loading&&!force))return;
    if (Capacitor.getPlatform() === 'web' && !Capacitor.isPluginAvailable('AlphaCalendar')) {
      desired=rangeFor(owner.vget('calendar'));attemptedKey=desired.key;
      status='Device calendars are available in the Android app.';
      owner.vset('calendar',{nativeCalendarStatus:status});return;
    }
    agentSelection=undefined;agentSelectionKey='';agentSelectionEpoch++;
    const currentOwner=owner,range=desired||rangeFor(owner.vget('calendar')), token=++generation;desired=range;attemptedKey=range.key;runningToken=token;loading=true;loadFailed=false;status='Loading calendars…';
    try {
      if(request) {const permission=await calendar.requestAccess();if(owner!==currentOwner||token!==generation)return;if(permission.status!=='granted'){loadedKey='';status='Calendar access denied';calendars=[];currentOwner.nativeCalendarRows=[];await currentOwner.refreshReminders();return;}}
      const result=await calendar.list({begin:range.begin,end:range.end});
      if(owner!==currentOwner||token!==generation)return;
      if(result.status!=='ready'){loadedKey='';status='Connect device calendars';calendars=[];currentOwner.nativeCalendarRows=[];await currentOwner.refreshReminders();return;}
      try{await readCreations();}catch{if(owner===currentOwner&&token===generation){creationPending=null;creationRecoveryFailed=true;}}
      if(owner!==currentOwner||token!==generation)return;
      loadedKey=range.key;truncated=!!result.truncated;calendars=result.calendars;status=result.truncated?'Calendar range limited to 2,000 events':'Device calendars connected';
      currentOwner.nativeCalendarRows=result.events.map(mapEvent);
      await currentOwner.refreshReminders();
      if(request)currentOwner.calendarWriteUncertain=false;
    }catch{if(owner===currentOwner&&token===generation){loadedKey='';loadFailed=true;status=Capacitor.isNativePlatform()?'Calendar range could not be loaded. Open device calendars to retry.':'Browser calendar could not be loaded. Retry or open Calendar recovery.';}}
    finally{if(runningToken===token){loading=false;if(token!==generation&&attemptedKey===range.key)attemptedKey='';}if(owner===currentOwner){currentOwner.vset('calendar',{nativeCalendarStatus:status});if(desired?.key!==attemptedKey)schedule();}}
  }
  let navigationEpoch=0;
  const openCalendarEvent=(event:Event)=>{
    const request=(event as CustomEvent).detail,currentOwner=owner,epoch=++navigationEpoch;
    if(!currentOwner||typeof request?.id!=='string'||!Number.isFinite(request.begin)||typeof request.complete!=='function')return;
    event.preventDefault();
    void (async()=>{let opened=false;try{
      const day=(civilDay(new Date(request.begin),request.allDay)-civilDay(new Date()))/DAY;
      currentOwner.vset('calendar',{day,month:null,open:null,openDay:null,form:null});desired=rangeFor({day});
      await refresh(false,true);
      if(owner!==currentOwner||epoch!==navigationEpoch||document.hidden||currentOwner.S().view!=='calendar'||currentOwner.vget('calendar').day!==day)return;
      const row=currentOwner.nativeCalendarRows?.find((row:Bag)=>row.alphaCalendarId===request.id);
      if(!row)return;
      currentOwner.vset('calendar',{open:row.id,openDay:day});opened=true;
    }finally{request.complete(opened);}})();
  };
  const calendarCommitted=()=>{if(owner){owner.vset('calendar',{open:null,openDay:null});void refresh(false,true);}};
  p.refreshAgentCalendar=function(){return refresh(false,true);};
  p.componentDidMount=function(){mount.call(this);owner=this;void refresh();this.calendarPreferenceChanged=(event:Event)=>{if(event.type==='storage'){const e=event as StorageEvent;if(e.key!=='alpha.browser.calendar.v1')return;try{if(JSON.stringify(JSON.parse(e.oldValue||'{}').preferences)===JSON.stringify(JSON.parse(e.newValue||'{}').preferences))return;}catch{return;}}void refresh(false,true);};if(!Capacitor.isNativePlatform()){window.addEventListener('alpha:calendar-open',openCalendarEvent);window.addEventListener('alpha:calendar-committed',calendarCommitted);window.addEventListener('alpha:calendar-preferences',this.calendarPreferenceChanged);window.addEventListener('storage',this.calendarPreferenceChanged);}this.calendarResume=DailyApps.addListener('appResumed',()=>void refresh()).catch(()=>null);};
  p.componentWillUnmount=function(){if(owner===this){agentSelection=undefined;agentSelectionKey='';agentSelectionEpoch++;owner=null;++creationReadEpoch;creationPending=null;creationRecoveryFailed=false;loading=false;calendars=[];status='Not connected';desired=undefined;loadedKey='';attemptedKey='';++generation;}void this.calendarResume?.then((l:any)=>l?.remove());if(!Capacitor.isNativePlatform()){++navigationEpoch;window.removeEventListener('alpha:calendar-open',openCalendarEvent);window.removeEventListener('alpha:calendar-committed',calendarCommitted);window.removeEventListener('alpha:calendar-preferences',this.calendarPreferenceChanged);window.removeEventListener('storage',this.calendarPreferenceChanged);}unmount.call(this);};
  views.calendar.render=(state:Bag,api:Bag)=>{
    const range=rangeFor(state);
    if(desired?.key!==range.key){desired=range;++generation;status='Loading calendars…';schedule();}
    const rangeReady=loadedKey===range.key,reminderStale=!!state.reminderStale||!!owner?.reminderRefreshFailed;
    if(!rangeReady)state={...state,events:(state.events||[]).filter((e:Bag)=>!e.alphaCalendarId)};
    const providerState=state;
    const browserCalendar=!Capacitor.isNativePlatform()?calendars.find(c=>c.id==='local'):undefined;
    if(browserCalendar){state={...state,calPrefs:{...state.calPrefs,personal:{on:browserCalendar.visible!==false,color:browserCalendar.color||'acc'}},events:browserCalendar.visible===false?(state.events||[]).filter((e:Bag)=>!e.alphaCalendarId):state.events};}
    const out=render(state,api);
    if(browserCalendar?.visible===false&&state.open){const detail=render(providerState,api);out.ev=detail.ev;out.detail=detail.detail;}
    out.emptyText=rangeReady?(truncated?'Calendar results incomplete. Some events may be missing.':reminderStale?'Reminders unavailable. Retry before relying on this schedule.':'Free all day'):status;
    out.nativeStatusLabel=[rangeReady&&truncated?'Calendar results incomplete. Some events may be missing.':'',reminderStale?'Reminders may be out of date. Tap to retry.':''].filter(Boolean).join(' ');
    out.nativeStatusRetry=()=>{void refresh(false,true);void owner?.refreshReminders();};
    out.browserRecovery=!Capacitor.isNativePlatform()&&loadFailed&&!loading;out.openBrowserRecovery=openCalendarRecovery;
    if(!rangeReady&&!state.open&&!state.form)out.empty=true;
    const allDay=(state.events||[]).filter((e:Bag)=>e.alphaCalendarId&&e.allDay);
    const day=Number(state.day||0),onDay=(off:number)=>allDay.filter((e:Bag)=>off>=e.off&&off<e.nativeAllDayEndOff);
    const timed=(state.events||[]).filter((e:Bag)=>e.alphaCalendarId&&!e.allDay);
    const bounds=(off:number)=>{const now=new Date(api.now);return [new Date(now.getFullYear(),now.getMonth(),now.getDate()+off).getTime(),new Date(now.getFullYear(),now.getMonth(),now.getDate()+off+1).getTime()];};
    const timedOn=(off:number)=>{const [start,end]=bounds(off);return timed.filter((e:Bag)=>e.nativeEvent.begin<end&&e.nativeEvent.end>start);};
    const [dayStart,dayEnd]=bounds(day);
    const segments=timedOn(day).map((e:Bag)=>{
      const start=new Date(Math.max(dayStart,e.nativeEvent.begin)),end=new Date(Math.min(dayEnd,e.nativeEvent.end));
      const t=start.getHours()+start.getMinutes()/60,finish=end.getTime()===dayEnd?24:end.getHours()+end.getMinutes()/60;
      // A repeated-hour interval may have a nonpositive wall span. Its visual
      // height uses actual elapsed time; detail always retains original instants.
      const d=Math.min(24-t,Math.max(.25,finish>t?finish-t:(end.getTime()-start.getTime())/3600000));
      return {...e,off:day,t,d};
    });
    const timeline=[...(state.events||[]).filter((e:Bag)=>!e.alphaCalendarId),...segments];
    // Temporary per-day layout only: provider IDs, original timestamps and
    // selected-object identity stay in the durable state, never in split copies.
    if(allDay.length||timed.length)out.events=render({...state,events:timeline},api).events;
    const realDay=timeline.filter((e:Bag)=>(e.alphaCalendarId||e.alphaReminderId)&&!e.allDay&&e.off===day&&Number.isFinite(e.t)&&e.t>=0);
    const first=Math.min(7,...realDay.map((e:Bag)=>Math.floor(e.t))),last=Math.max(23,...realDay.map((e:Bag)=>Math.min(24,Math.ceil(e.t+e.d))));
    if(first<7||last>23){
      const shift=(7-first)*56;
      out.events=out.events.map((e:Bag)=>({...e,top:e.top+shift}));
      const added=[];
      for(let hour=first;hour<7;hour++)added.push({top:(hour-first)*56+8,lt:(hour-first)*56,label:`${hour%12||12} am`});
      out.hours=[...added,...out.hours.map((h:Bag)=>({...h,top:h.top+shift,lt:h.lt+shift}))];
      if(last===24)out.hours.push({top:(24-first)*56+8,lt:(24-first)*56,label:'Midnight'});
      out.nowTop+=shift;out.nativeTimelineHeight=`${Math.max(912+shift,(last-first)*56+16)}px`;
      const now=new Date(api.now),time=now.getHours()+now.getMinutes()/60;
      out.showNow=day===0&&time>=first&&time<=last;
    }
    const occupied=(off:number)=>onDay(off).length>0||timedOn(off).length>0;
    if(segments.length)out.empty=false;
    out.nativeAllDay=onDay(day).map((e:Bag)=>({title:e.title,open:()=>api.set({open:e.id,openDay:day})}));
    out.hasNativeAllDay=out.nativeAllDay.length>0;
    if(out.hasNativeAllDay)out.empty=false;
    const selectedDate=new Date(api.now);selectedDate.setDate(selectedDate.getDate()+day);
    const weekStart=day-(selectedDate.getDay()+6)%7;
    out.week=out.week.map((w:Bag,i:number)=>occupied(weekStart+i)?{...w,dot:weekStart+i===0?'var(--acct)':'var(--mut)'}:w);
    const monthBase=new Date(selectedDate);monthBase.setDate(1);monthBase.setMonth(monthBase.getMonth()+Number(state.month||0));
    const gridStart=new Date(monthBase);gridStart.setDate(1-(monthBase.getDay()+6)%7);
    const gridOff=(civilDay(gridStart)-civilDay(new Date(api.now)))/DAY;
    out.mdays=out.mdays.map((d:Bag,i:number)=>occupied(gridOff+i)?{...d,dot:gridOff+i===0?'var(--acct)':'var(--fg)'}:d);
    const connect=()=>void refresh(true);
    out.calRows=[{name:'Device calendars',sub:loading?'Loading calendars…':status,on:calendars.length>0,sw:'var(--acc)',track:api.track(calendars.length>0),kx:api.kx(calendars.length>0),dim:'',toggle:connect,color:connect},
      ...calendars.map(c=>{const browser=!Capacitor.isNativePlatform(),on=!browser||c.visible!==false;
        const change=async(action:'visibility'|'color')=>{try{await calendar.changePreferences({action});}catch{api.toast('Calendar settings could not be saved. Try again.');}};
        return {name:c.name,sub:c.local?'On this device':c.account,on,sw:browser?(({acc:'var(--acct)',fg:'var(--fg)',mut:'var(--mut)'} as Record<string,string>)[c.color]||'var(--acct)'):'var(--acc)',track:api.track(on),kx:api.kx(on),dim:on?'':'opacity:.5',toggle:()=>browser?void change('visibility'):api.toast('Manage calendar visibility in Android Calendar.'),color:()=>browser?void change('color'):api.toast('Manage calendar colors in Android Calendar.')};})];
    const newEvent=async(separateCreation=false)=>{
      const activeOwner=owner,now=new Date(),day=Number(state.day||0),hour=now.getHours()+now.getMinutes()/60;
      const draft={id:null,creationId:crypto.randomUUID(),separateCreation,title:'',off:day,t:day===0?Math.min(21,Math.ceil(hour+.01)):10,d:1,where:'',video:false,who:[],cal:'native:local',repeat:'none',alert:null,notes:''};
      ++creationDraftEpoch;api.set({month:null,form:draft});
      const token=++agentSelectionEpoch;agentSelection=undefined;agentSelectionKey='';
      const current=()=>owner===activeOwner&&!document.hidden&&api.isActive()&&api.get('calendar').form?.creationId===draft.creationId;
      try{const permission=await calendar.requestAccess();if(permission.status!=='granted'||!current())return;const source=await calendar.prepareAgentSource();if(current()&&token===agentSelectionEpoch&&source.status==='ready'&&api.get('calendar').form?.cal==='native:local'){agentSelection={kind:'calendar-source',id:source.sourceId,revision:source.sourceRevision,formCal:'native:local'};api.set({nativeAgentSourceRevision:source.sourceRevision});}}catch{if(current())api.toast('Calendar source unavailable for agent actions.');}
    };
    out.newEvent=()=>newEvent();
    out.creationRecovery=creationRecoveryFailed||Boolean(creationPending?.length);
    out.creationRecoveryText=creationRecoveryFailed?'Calendar creation receipts could not be checked. Nothing was retried.':`${creationPending?.length||0} previous event creation(s) need review. Refresh never retries them.`;
    out.checkCreations=async()=>{
      const recoveryOwner=owner,recoveryForm=api.get('calendar').form,epoch=creationDraftEpoch;
      const current=()=>owner===recoveryOwner&&!document.hidden&&api.isActive()&&creationDraftEpoch===epoch&&api.get('calendar').form===recoveryForm;
      try{
        const receipts=await readCreations();if(!current())return;const confirmed=receipts.filter(row=>row.status==='saved');
        for(const row of confirmed){if(!current())return;const result=await calendar.acknowledgeCreation({creationId:row.creationId});if(result.status!=='acknowledged')throw Error('Receipt acknowledgement unavailable');}
        if(!current())return;
        if(confirmed.length)api.toast('Previous event creation confirmed. No event was recreated.');
        await refresh(false,true);
        if(current()&&creationPending?.some(row=>row.status!=='saved'))api.toast('A previous event may exist. Check Calendar; it will not be retried.');
      }catch{if(current()){creationRecoveryFailed=true;api.toast('Calendar creation recovery unavailable. Nothing was retried.');api.set({});}}
    };
    out.separateCreation=()=>{
      if(!window.confirm('A previous event may already exist. Create a separate event with a new identity? The previous request will remain in recovery history.'))return;
      return newEvent(true);
    };
    if(out.f&&state.form){
      const f=state.form;
      const reviewedDate=wallTime(Number(f.off||0),12);
      out.f.nativeReviewDate=reviewedDate?reviewedDate.toLocaleDateString(undefined,{weekday:'long',year:'numeric',month:'long',day:'numeric'}):'Choose a valid local date';
      const destinations=[{id:'local',name:(Capacitor.isNativePlatform()?'On this phone':'In this browser')},...calendars.filter(c=>c.writable&&!c.local).map(c=>({id:c.id,name:c.name}))];
      out.f.cals=f.alphaCalendarId ? [{name:(Capacitor.isNativePlatform()?'On this phone':'In this browser'),dot:'var(--acc)',css:'background:var(--fg);color:var(--bg)',pick:()=>{}}] : [...out.f.cals.filter((c:Bag)=>c.name==='Reminders'),...destinations.map(c=>({name:c.name,dot:'var(--acc)',css:f.cal===`native:${c.id}`?'background:var(--fg);color:var(--bg)':'background:var(--bg)',pick:()=>api.set({form:{...api.get('calendar').form,cal:`native:${c.id}`,alert:null}})}))];
      if(f.cal?.startsWith('native:'))out.f.save=async()=>{
        if(owner?.calendarSaving)return;
        if(owner?.calendarWriteUncertain&&api.get('calendar').form?.alphaCalendarId){api.toast('Refresh device calendars and check the previous event before saving again.');return;}
        const current=api.get('calendar').form,currentOwner=owner;
        if(!current?.title?.trim()||!currentOwner)return;
        if((Capacitor.isNativePlatform()&&(current.repeat!=='none'||current.video||current.who?.length||current.alert!=null))){api.toast('Recurring events, invitations, video calls and alerts currently require Android Calendar.');return;}
        const date=wallTime(Number(current.off||0),Number(current.t)),end=wallTime(Number(current.off||0),Number(current.t)+Number(current.d));
        if(!date||!end||end.getTime()<=date.getTime()){api.toast('This local time does not exist because the clocks change. Choose another start or end time. Nothing was saved.');return;}
        const epoch=creationDraftEpoch;let submittedForm=current;
        const ownsForm=()=>owner===currentOwner&&!document.hidden&&api.isActive()&&creationDraftEpoch===epoch&&api.get('calendar').form===submittedForm;
        currentOwner.calendarSaving=true;
        try{
          const permission=await calendar.requestAccess();if(!ownsForm())return;if(permission.status!=='granted'){api.toast('Calendar access was not granted. Nothing was saved.');return;}
          let creationId:string|undefined;
          if(!current.alphaCalendarId){
            const previous=await readCreations();
            if(!ownsForm())return;
            if(previous.length&&!current.separateCreation){api.toast('Check previous event creation receipts before saving, or explicitly create a separate event.');api.set({});return;}
            creationId=current.creationId||crypto.randomUUID();
            if(!current.creationId){submittedForm={...current,creationId};api.set({form:submittedForm});}
          }
          const result=await calendar.save({creationId,separateCreation:current.separateCreation===true,id:current.alphaCalendarId || '',expected:current.expected,calendarId:current.cal.slice(7),title:current.title.trim(),body:current.notes||'',location:current.where||'',begin:date.getTime(),end:end.getTime(),...(!Capacitor.isNativePlatform()?{repeat:current.repeat,who:current.who||[],video:!!current.video,alert:current.alert??null,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone}:{})});
          if(!ownsForm())return;
          if(result.status==='pending-creation'){await readCreations();api.toast('Another creation needs recovery. Nothing was retried.');api.set({});return;}
          if(result.status==='conflict'){api.toast('This event changed. Reload it before editing. Nothing was overwritten.');return;}
          if(result.status!=='saved')throw Error('Unconfirmed calendar write');
          if(creationId&&result.creationId!==creationId)throw Error('Mismatched creation receipt');
          const targetDay=Number(current.off||0);
          // Retire only this exact submitted draft before an acknowledgement can be lost.
          api.set({form:null,open:null,day:targetDay,month:null});
          const ownsCompletion=()=>owner===currentOwner&&!document.hidden&&api.isActive()&&creationDraftEpoch===epoch&&!api.get('calendar').form&&!api.get('calendar').open&&Number(api.get('calendar').day||0)===targetDay&&api.get('calendar').month==null;
          // Edits have not yielded since ownsForm: React may not have committed form:null yet.
          // Creation acknowledgement yields, so recheck its completion before starting refresh.
          if(creationId){const ack=await calendar.acknowledgeCreation({creationId});if(ack.status!=='acknowledged')throw Error('Unconfirmed receipt acknowledgement');if(!ownsCompletion())return;}
          desired=rangeFor({...currentOwner.vget('calendar'),day:targetDay,month:null});await refresh(false,true);
          if(!ownsCompletion())return;
          const saved=currentOwner.nativeCalendarRows?.find((e:Bag)=>e.alphaCalendarId===result.id);
          if(saved)api.set({open:saved.id,day:saved.off,openDay:saved.off});
          api.toast(Capacitor.isNativePlatform()?'Event saved and verified in Android Calendar.':'Event saved.');
        }catch{if(current.alphaCalendarId)currentOwner.calendarWriteUncertain=true;else{try{await readCreations();}catch{if(owner===currentOwner&&creationDraftEpoch===epoch){creationPending=null;creationRecoveryFailed=true;}}}if(owner===currentOwner&&!document.hidden&&api.isActive()&&creationDraftEpoch===epoch)api.toast('The calendar write was not confirmed. Check creation receipts before creating another event.');}
        finally{currentOwner.calendarSaving=false;if(owner===currentOwner)api.set({});}
      };
    }
    const selected=providerState.events?.find((e:Bag)=>e.id===state.open);
    if(selected?.alphaCalendarId&&out.ev){
      const key=JSON.stringify([selected.id,selected.nativeEvent]);
      if(agentSelectionKey!==key){agentSelectionKey=key;agentSelection=undefined;const token=++agentSelectionEpoch,currentOwner=owner,event=selected.nativeEvent;queueMicrotask(async()=>{try{const value=await calendar.inspect({id:event.id,calendarId:event.calendarId,expected:{title:event.title||'',body:event.body||'',location:event.location||'',begin:event.begin,end:event.end}});if(owner===currentOwner&&token===agentSelectionEpoch&&api.get('calendar').open===selected.id&&value.status==='ready'){agentSelection={kind:'calendar-event',id:event.id,open:selected.id,revision:value.revision,accountId:event.calendarId,sourceRevision:value.sourceRevision};api.set({nativeAgentRevision:value.revision});}}catch{}});}
      out.ev.close=()=>{agentSelection=undefined;agentSelectionKey='';agentSelectionEpoch++;api.set({open:null,openDay:null,day:state.openDay??state.day??selected.off});};
      if(selected.allDay){
        out.ev.when='All day';
        const options:Intl.DateTimeFormatOptions={weekday:'short',month:'short',day:'numeric',year:'numeric',timeZone:'UTC'};
        const first=new Date(selected.nativeEvent.begin).toLocaleDateString(undefined,options),last=new Date(selected.nativeEvent.end-DAY).toLocaleDateString(undefined,options);
        out.ev.day=first===last?first:`${first} – ${last}`;
      }
      if(!selected.allDay){
        const begin=new Date(selected.nativeEvent.begin),end=new Date(selected.nativeEvent.end);
        const crossDate=civilDay(begin)!==civilDay(end),offsetChanged=begin.getTimezoneOffset()!==end.getTimezoneOffset();
        const time=(date:Date)=>date.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
        const date=(value:Date)=>value.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'});
        const offset=(value:Date)=>{const minutes=-value.getTimezoneOffset();return `UTC${minutes<0?'-':'+'}${String(Math.floor(Math.abs(minutes)/60)).padStart(2,'0')}:${String(Math.abs(minutes)%60).padStart(2,'0')}`;};
        // Never derive a provider event's end from a clamped layout duration.
        const distortedEnd=Math.round((selected.t+selected.d)*60)%1440!==end.getHours()*60+end.getMinutes();
        if(crossDate||offsetChanged||distortedEnd)out.ev.when=`${time(begin)}${offsetChanged?' '+offset(begin):''} – ${time(end)}${offsetChanged?' '+offset(end):''}`;
        if(crossDate)out.ev.day=`${date(begin)} – ${date(end)}`;
      }
      out.ev.calName=calendars.find(c=>c.id===selected.nativeEvent.calendarId)?.name||'Android Calendar';
      const external=()=>void calendar.open({id:selected.alphaCalendarId,begin:selected.nativeEvent.begin,end:selected.nativeEvent.end}).catch(()=>api.toast('Android Calendar could not open this event.'));
      // Complex edits keep their native recurrence and account semantics.
      out.ev.edit=async()=>{
        const event=selected.nativeEvent,source=calendars.find(c=>c.id===event.calendarId);
        const begin=new Date(event.begin),end=new Date(event.end);
        const representedBegin=wallTime(selected.off,selected.t),representedEnd=wallTime(selected.off,selected.t+selected.d);
        const complex=civilDay(begin)!==civilDay(end)||begin.getTimezoneOffset()!==end.getTimezoneOffset()||representedBegin?.getTime()!==event.begin||representedEnd?.getTime()!==event.end;
        if(!Capacitor.isNativePlatform()&&(event.seriesId||event.allDay||complex)){
          try{const result=await calendar.edit({id:event.id,revision:event.revision,people:out.attendeeChoices||[]});if(result.status==='saved'){api.set({open:null,openDay:null});await refresh(false,true);api.toast('Event saved.');}}catch{api.toast('This event changed or could not be opened. Refresh and try again.');}return;
        }
        if(!source?.local||source.account!=='Alpha Phone'||event.recurring||event.allDay||complex){
          api.toast('Edit this event in Android Calendar to preserve its dates and time zone.');external();return;
        }
        const expected={title:event.title||'',body:event.body||'',location:event.location||'',begin:event.begin,end:event.end};
        const currentOwner=owner;
        try {
          const inspected=await calendar.inspect({id:event.id,calendarId:event.calendarId,expected});
          if(owner!==currentOwner||api.get('calendar').open!==selected.id)return;
          if(inspected.status==='external'){api.toast('Edit this event in Android Calendar.');external();return;}
          if(inspected.status!=='ready'){api.toast('This event changed or access is unavailable. Refresh before editing.');await refresh(false,true);return;}
          api.set({form:{...selected,id:selected.id,alphaCalendarId:event.id,expected:{...expected,revision:inspected.revision},cal:`native:${event.calendarId}`,video:!Capacitor.isNativePlatform()&&!!event.video,who:!Capacitor.isNativePlatform()?event.who||[]:[],repeat:'none',alert:!Capacitor.isNativePlatform()?event.alert??null:null}});
        }catch{api.toast('Calendar review unavailable. Nothing was changed.');}
      };
      if(!Capacitor.isNativePlatform()&&selected.nativeEvent.seriesId){
        out.ev.day+=' · Repeating event · edits and deletion apply to this occurrence';out.ev.browserSeries=true;
        const seriesAction=async(remove:boolean)=>{try{const event=selected.nativeEvent;const result=await (remove?calendar.removeSeries({id:event.id,revision:event.revision}):calendar.editSeries({id:event.id,revision:event.revision,people:out.attendeeChoices||[]}));if(result.status==='saved'||result.status==='deleted'){api.set({open:null,openDay:null});await refresh(false,true);}else if(result.status==='conflict')api.toast('This series changed. Refresh and try again.');}catch{api.toast('The series could not be changed. Refresh and try again.');}};
        out.ev.editSeries=()=>void seriesAction(false);out.ev.deleteSeries=()=>void seriesAction(true);
      }
      if(!Capacitor.isNativePlatform())out.ev.people=(out.ev.people||[]).map((person:Bag,index:number)=>{const event=selected.nativeEvent,id=event.who?.[index],labels:Record<string,string>={added:'Added',invited:'Invited',yes:'Going',maybe:'Maybe',no:'Declined'};return {...person,st:labels[event.responses?.[id]||'added'],canRespond:true,response:async()=>{try{const result=await calendar.editResponse({id:event.id,revision:event.revision,person:id,name:person.name});if(result.status==='saved')await refresh(false,true);}catch{api.toast('This guest list changed. Reopen the event.');}}};});
      if(!Capacitor.isNativePlatform()&&selected.nativeEvent.video)out.ev.join=()=>void calendar.joinMeeting({id:selected.nativeEvent.id,revision:selected.nativeEvent.revision,people:(out.ev.people||[]).map((person:Bag)=>person.name)}).catch(()=>api.toast('This meeting changed. Reopen the event.'));
      out.ev.busy=Boolean(owner?.calendarSaving||owner?.calendarWriteUncertain);
      out.ev.del=async()=>{
        if(!owner||owner.calendarSaving||owner.calendarWriteUncertain)return;
        const currentOwner=owner,event=selected.nativeEvent,expected={title:event.title||'',body:event.body||'',location:event.location||'',begin:event.begin,end:event.end};
        currentOwner.calendarSaving=true;api.set({});let dispatched=false;
        try{
          const inspected=await calendar.inspect({id:event.id,calendarId:event.calendarId,expected});
          if(owner!==currentOwner||api.get('calendar').open!==selected.id)return;
          if(inspected.status==='external'){api.toast('Manage deletion and recurrence in Android Calendar. No event was deleted here.');external();return;}
          if(inspected.status!=='ready'){api.toast('This event changed or access is unavailable. Refresh before deleting.');await refresh(false,true);return;}
          dispatched=true;
          const result=await calendar.remove({id:event.id,calendarId:event.calendarId,expected,revision:inspected.revision});
          if(owner!==currentOwner)return;
          if(result.status==='deleted'){
            // The receipt belongs to the deleted event, not a newer detail or draft.
            const current=api.get('calendar');
            if(!document.hidden&&api.isActive()&&current.open===selected.id&&!current.form){
              api.set({open:null,openDay:null});api.toast('Local event deleted and verified.');
            }
            await refresh(false,true);
          }
          else if(result.status==='conflict'){api.toast('This event changed. Nothing was deleted.');await refresh(false,true);}
          else if(result.status==='unknown'){currentOwner.calendarWriteUncertain=true;api.toast('Deletion could not be confirmed. Refresh and check before another change.');}
          else if(result.status!=='cancelled')api.toast('Calendar deletion unavailable. Nothing was deleted.');
        }catch{if(dispatched){currentOwner.calendarWriteUncertain=true;api.toast('Deletion could not be confirmed. Refresh and check before another change.');}else api.toast('Calendar review unavailable. Nothing was changed.');}
        finally{currentOwner.calendarSaving=false;if(owner===currentOwner)api.set({});}
      };
    }
    return out;
  };
}
