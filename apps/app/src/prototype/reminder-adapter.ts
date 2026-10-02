import {reminderCreations,retainReminderCreation,discardUndispatchedCreation,checkReminderCreation,reconcileReminderCreations,type ReminderCreation} from '../runtime/reminder-creations';
import { DailyApps, type Reminder } from '../daily';
import { pendingReminderDeletions,retainReminderDeletion,acknowledgeReminderDeletion,reconcileReminderDeletions,discardUndispatchedReminderDeletion } from '../runtime/reminder-deletions';
import { Capacitor } from '@capacitor/core';
type Bag = any;
// Construct the requested civil fields independently of local DST normalization.
function reminderWallTime(off:number,hours:number):Date|null {
  if(!Number.isSafeInteger(off)||!Number.isFinite(hours))return null;
  const minutes=Math.round(hours*60),today=new Date();
  const target=new Date(Date.UTC(today.getFullYear(),today.getMonth(),today.getDate()+off,0,minutes));
  const date=new Date(target.getUTCFullYear(),target.getUTCMonth(),target.getUTCDate(),target.getUTCHours(),target.getUTCMinutes());
  return date.getFullYear()===target.getUTCFullYear()&&date.getMonth()===target.getUTCMonth()&&date.getDate()===target.getUTCDate()&&date.getHours()===target.getUTCHours()&&date.getMinutes()===target.getUTCMinutes()?date:null;
}
/** Native reminders use the reference calendar form, timeline and detail sheet. */
export function installReminderAdapter(Component: Bag, views: Bag) {
  const p = Component.prototype, mount = p.componentDidMount, unmount = p.componentWillUnmount;
  const render = views.calendar.render;
  views.calendar.state = { ...views.calendar.state, events: [] };
  let owner: Bag;
  const events = (rows: Reminder[]) => rows.filter(r => r.status === 'completed' || r.status === 'scheduled' || r.status === 'posted' || r.status === 'permission-denied' || r.status === 'scheduling-failed').map(r => {
    const date = new Date(r.dueAt || r.at), today = new Date(); today.setHours(0,0,0,0);
    const day = new Date(date); day.setHours(0,0,0,0);
    return { id: 'reminder:' + r.id, alphaReminderId: r.id, reminderBody:r.body, reminderAt:r.at, reminderOccurrence:r.occurrenceId, reminderRecurrence:r.recurrence, reminderHistory:r.history, reminderStatus:r.status, reminderTarget:r.target, off: Math.round((day.getTime()-today.getTime())/86400000), t: date.getHours()+date.getMinutes()/60, d: .25, title:r.title, cal:'personal', who:[], repeat:'none', alert:r.recurrence?.leadMinutes || 0, notes:[r.body, r.snoozedAt && r.status==='scheduled' ? `Snoozed until ${new Date(r.at).toLocaleString()} · approximate delivery` : '', r.recurrence ? `${r.recurrence.rule} · ${r.recurrence.zone}. Next occurrence is scheduled after Done. Future missing clock times use the first valid time after the gap; repeated clock times use the earlier offset.` : '', r.status === 'scheduling-failed' ? 'Saved, scheduling failed. Tap Snooze 10 minutes to retry.' : '', r.status === 'completed' ? 'Completed · no further alarm scheduled' : r.status === 'posted' ? 'Notification posted' : r.status === 'permission-denied' ? 'Not delivered · notifications were disabled. Enable notifications in Android settings, then edit this reminder to choose a new time and save.' : 'Scheduled · approximate delivery'].filter(Boolean).join('\n') };
  });
  p.refreshReminders = async function (openId?: string, occurrenceId?: string) {
    // Resume and calendar refresh may supersede the notification's fetch.
    // Keep its navigation intent until the latest successful fetch consumes it.
    if (openId) {this.pendingReminderOpenId = openId;this.pendingReminderOccurrenceId=occurrenceId;}
    const generation = this.reminderRefreshGeneration = (this.reminderRefreshGeneration || 0) + 1;
    try {
      const reminderDeleteUnknown=await reconcileReminderDeletions();
      let reminderCreateUnknown=Object.values(await reminderCreations()).filter(r=>r.state==='pending').length;
      try{reminderCreateUnknown=await reconcileReminderCreations();}catch{/* Retain creation uncertainty when readback is unavailable. */}
      if (!this.live || generation !== this.reminderRefreshGeneration) return;
      this.reminderCreateUnknown=reminderCreateUnknown;
      this.vset('calendar',{reminderCreateUnknown});
      this.reminderDeleteUnknown=reminderDeleteUnknown;
      this.vset('calendar',{reminderDeleteUnknown});
      if (Capacitor.getPlatform() === 'web' && !Capacitor.isPluginAvailable('DailyApps')) {this.vset('calendar',{reminderStale:false});return;}
      const result = await DailyApps.listReminders();
      if (!this.live || generation !== this.reminderRefreshGeneration) return;
      this.reminderTargets=new Map(result.reminders.map(r=>[r.id,r.target]));
      const rows = [...(this.nativeCalendarRows || []), ...events(result.reminders)];
      this.reminderRefreshFailed = false;
      this.vset('calendar', { events: rows, reminderStale:false, reminderDeleteUnknown });
      const pendingOpenId = this.pendingReminderOpenId;
      if (pendingOpenId) {
        const target = rows.find(e => e.alphaReminderId === pendingOpenId && (!this.pendingReminderOccurrenceId || e.reminderOccurrence===this.pendingReminderOccurrenceId));
        this.pendingReminderOpenId = undefined;this.pendingReminderOccurrenceId=undefined;
        this.openView('calendar', target ? { open:target.id, day:target.off, openDay:target.off, events:rows } : {events:rows});
      }
    } catch {
      if (!this.live || generation !== this.reminderRefreshGeneration) return;
      this.vset('calendar', {reminderStale:true});
      if (!this.reminderRefreshFailed) this.toast('Reminders could not refresh. Previously loaded reminders may be out of date.');
      this.reminderRefreshFailed = true;
    }
  };
  p.componentDidMount = function () {
    mount.call(this); owner=this;
    void this.refreshReminders();
    this.reminderCommittedHandler=()=>{if(this.live)void this.refreshReminders();};
    window.addEventListener('alpha:reminders-committed',this.reminderCommittedHandler);
    this.reminderListener=DailyApps.addListener('reminderOpened', r=>void this.refreshReminders(r.id,r.occurrenceId)).catch(()=>null);
    this.reminderResume=DailyApps.addListener('appResumed', ()=>void this.refreshReminders()).catch(()=>null);
  };
  p.componentWillUnmount = function () {
    void this.reminderListener?.then((l:Bag)=>l?.remove()); void this.reminderResume?.then((l:Bag)=>l?.remove());
    window.removeEventListener('alpha:reminders-committed',this.reminderCommittedHandler);
    if(owner===this)owner=null;unmount.call(this);
  };
  views.calendar.render = function (state: Bag, api: Bag) {
    const out = render(state,api);
    out.reminderDeleteUnknown=Number(owner?.reminderDeleteUnknown??state.reminderDeleteUnknown??0);
    out.checkReminderDeletions=()=>void owner?.refreshReminders();
    out.reminderCreateUnknown=Number(owner?.reminderCreateUnknown??state.reminderCreateUnknown??0);
    out.checkReminderCreations=()=>void owner?.refreshReminders();
    if(out.f) {
      const f=state.form;
      out.f.cals.push({name:'Reminders',dot:'var(--acc)',css:f.cal==='alpha-reminders'?'background:var(--fg);color:var(--bg)':'background:var(--bg)',pick:()=>api.set({form:{...api.get('calendar').form,cal:'alpha-reminders',repeat:'none',alert:0}})});
      if(f.cal==='alpha-reminders') out.f.save=async()=>{
        if(owner?.reminderSaving)return;
        const current=api.get('calendar').form;
        if(current?.alphaReminderId&&(api.get('calendar').reminderStale||owner?.reminderRefreshFailed)){api.toast('Refresh reminders before changing this saved reminder.');void owner?.refreshReminders();return;}
        if(!current?.title?.trim())return;

        if(current.reminderEditSession?.uncertain){api.toast('The previous save is unconfirmed. Cancel and reopen this reminder to review saved state.');return;}
        const unchangedSchedule=current.alphaReminderId&&current.reminderEditSchedule&&JSON.stringify([current.off,current.t,current.repeat,current.alert])===JSON.stringify(current.reminderEditSchedule);
        if(unchangedSchedule){
          if(!current.reminderEditTarget){api.toast('Refresh and reopen this reminder before saving.');return;}
          const editSession=current.reminderEditSession,saveOwner=owner;
          if(saveOwner)saveOwner.reminderSaving=true;
          try{
            const operation={type:'reminder_update' as const,target:current.reminderEditTarget,fields:{title:current.title.trim(),body:current.notes||''}};
            const bindingHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(operation))))).map(v=>v.toString(16).padStart(2,'0')).join('');
            if(!saveOwner?.live||owner!==saveOwner||document.hidden||api.get('calendar').form?.reminderEditSession!==editSession)return;
            // A metadata edit must not replace the occurrence, snooze or saved civil schedule.
            const result=await DailyApps.operateReminder({operationId:crypto.randomUUID(),bindingHash,operation});
            if(result.status!=='succeeded')throw Error('Unconfirmed reminder update');
            const sameEditor=owner===saveOwner&&saveOwner.live&&api.get('calendar').form?.reminderEditSession===editSession;
            if(sameEditor)api.set({form:null});
            if(owner===saveOwner&&saveOwner.live)await saveOwner.refreshReminders(sameEditor?current.alphaReminderId:undefined);if(sameEditor)api.toast('Reminder updated. Schedule unchanged.');
          }catch{editSession.uncertain=true;if(api.get('calendar').form?.reminderEditSession===editSession)api.toast('The reminder save could not be confirmed. Cancel and reopen it to review saved state.');}
          finally{if(saveOwner)saveOwner.reminderSaving=false;}
          return;
        }
        const date=reminderWallTime(Number(current.off||0),Number(current.t)),lead=Number(current.alert||0);
        if(!date||!Number.isFinite(lead)||lead<0){api.toast('This local time does not exist because the clocks change. Choose another reminder time. Nothing was saved.');return;}
        // Alert lead is elapsed time before a valid event instant, including across DST.
        const recurrence = current.repeat==='none' ? undefined : {
          rule:current.repeat,zone:Intl.DateTimeFormat().resolvedOptions().timeZone,
          date:`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`,
          time:`${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`,leadMinutes:lead
        };
        if(recurrence?.rule==='weekdays' && [0,6].includes(date.getDay())){api.toast('Choose a weekday for the first reminder. Nothing was saved.');return;}
        date.setTime(date.getTime()-lead*60000);
        if(!current.alphaReminderId){
          const createOwner=owner;if(!createOwner)return;
          createOwner.reminderSaving=true;
          const id=current.reminderCreationId||crypto.randomUUID();
          const request={id,title:current.title.trim(),body:current.notes||'',at:date.getTime(),...(recurrence?{recurrence}:{})};
          const signature=JSON.stringify([current.title,current.notes,current.off,current.t,current.repeat,current.alert,current.cal]);
          let matchesAttempt=true;
          const active=()=>matchesAttempt&&owner===createOwner&&createOwner.live&&!document.hidden&&api.isActive()&&api.get('calendar').form?.reminderCreationId===id&&JSON.stringify([api.get('calendar').form.title,api.get('calendar').form.notes,api.get('calendar').form.off,api.get('calendar').form.t,api.get('calendar').form.repeat,api.get('calendar').form.alert,api.get('calendar').form.cal])===signature;
          let created:ReminderCreation|null=null,dispatched=false,scheduled=false;
          try{
            if(!current.reminderCreationId){
              const pending=Object.values(await reminderCreations()).filter(row=>row.state==='pending');
              if(owner!==createOwner||!createOwner.live||!api.isActive()||api.get('calendar').form!==current||document.hidden)return;
              if(pending.length&&!window.confirm('A previous reminder creation is unconfirmed and may already exist. Create a separate new reminder? The previous attempt will remain available for status checks.'))return;
              if(owner!==createOwner||!createOwner.live||!api.isActive()||api.get('calendar').form!==current||document.hidden)return;
              api.set({form:{...current,reminderCreationId:id}});
              created={id,request,state:'pending'};
              await retainReminderCreation(created);
              if(!active())return;
              dispatched=true;
              try{const response=await DailyApps.scheduleReminder(request);scheduled=response.status==='scheduled'&&response.id===id;}catch{/* Recovery reads only; never reschedule an unknown attempt. */}
            }
            const retained=(await reminderCreations())[id];
            matchesAttempt=!!retained&&JSON.stringify(retained.request)===JSON.stringify(request);
            const found=await checkReminderCreation(id);
            if(found!=='found')throw Error('Creation outcome unknown');
            if(active())api.set({form:null});
            if(owner===createOwner&&createOwner.live){await createOwner.refreshReminders();api.toast(!matchesAttempt?'The previous reminder was found. This edited draft was not saved. Close it to start a separate reminder.':scheduled?'Reminder scheduled · approximate delivery':'The saved reminder was found. Delivery is not verified.');}
          }catch{
            if(owner===createOwner&&createOwner.live)api.toast('Reminder creation is unconfirmed. Check new reminder status in Calendar; it will not be created again automatically.');
          }finally{
            if(created&&!dispatched){
              try{await discardUndispatchedCreation(created);if(owner===createOwner&&api.get('calendar').form?.reminderCreationId===id)api.set({form:{...api.get('calendar').form,reminderCreationId:undefined}});}catch{/* Preserve uncertain persistence; never create again automatically. */}
            }
            if(owner===createOwner&&createOwner.live)try{createOwner.reminderCreateUnknown=Object.values(await reminderCreations()).filter(row=>row.state==='pending').length;api.set({reminderCreateUnknown:createOwner.reminderCreateUnknown});}catch{}
            createOwner.reminderSaving=false;
          }
          return;
        }
        const id=current.alphaReminderId||crypto.randomUUID();
        if(owner)owner.reminderSaving=true;
        try {
          const result=await DailyApps.scheduleReminder({id,title:current.title.trim(),body:current.notes||'',at:date.getTime(),...(recurrence?{recurrence}: {})});
          if(result.status==='scheduled') {api.set({form:null});await owner?.refreshReminders(id);api.toast('Reminder scheduled · approximate delivery');}
          else api.toast(result.message|| (result.status==='past'?'Choose a future reminder time.':'Allow notifications to schedule a reminder.'));
        } catch {api.toast('The reminder could not be scheduled.');}
        finally {if(owner)owner.reminderSaving=false;}
      };
    }
    const event=(state.events||[]).find((e:Bag)=>e.id===state.open);
    if(event?.alphaReminderId && out.ev) {
      out.ev.calName='Reminders';
      const requireFresh=()=>{if(!api.get('calendar').reminderStale&&!owner?.reminderRefreshFailed)return true;api.toast('Refresh reminders before changing this saved reminder.');void owner?.refreshReminders();return false;};
      if(state.reminderStale||owner?.reminderRefreshFailed){out.ev.hasNotes=true;out.ev.notes='This reminder may be out of date. Return to Calendar and tap Retry.\n'+(out.ev.notes||'');}
      out.ev.recurringReminder=!!event.reminderOccurrence;
      out.ev.reminderActionable=!!event.reminderOccurrence&&event.reminderStatus!=='completed';
      out.ev.reminderPolicy=event.reminderRecurrence ? `Repeats ${event.reminderRecurrence.rule} in ${event.reminderRecurrence.zone}. Next occurrence is scheduled after Done. Last 32 completion receipts are retained.` : event.reminderStatus==='completed'?'Completed · no further alarm scheduled. Last 32 completion receipts are retained.':'One-time reminder. Done completes it without scheduling another alarm.';
      out.ev.reminderHistory=(event.reminderHistory||[]).map((h:Bag)=>({text:`Completed ${new Date(h.completedAt).toLocaleString()} · due ${new Date(h.dueAt).toLocaleString()}${h.skippedDates?` · ${h.skippedDates} elapsed repeat dates skipped`:''}`}));
      const renderedDecisionTarget=event.reminderTarget?structuredClone(event.reminderTarget):undefined;
      const decide=async(action:'done'|'snooze')=>{
        if(!requireFresh()||owner?.reminderSaving)return;
        if(!renderedDecisionTarget){api.toast('Refresh and reopen this reminder before changing it.');return;}
        const decisionOwner=owner;
        const stillSelected=()=>owner===decisionOwner&&decisionOwner?.live&&!document.hidden&&api.isActive()&&api.get('calendar').open===event.id&&!api.get('calendar').form;
        if(!stillSelected())return;
        decisionOwner.reminderSaving=true;
        let createdInput:Bag=null,dispatched=false;
        try{
          const operation={type:action==='done'?'reminder_complete' as const:'reminder_snooze' as const,target:renderedDecisionTarget};
          const pending=Object.values(await pendingReminderDeletions()).find(input=>Object.keys(renderedDecisionTarget).every(key=>input.operation.target[key as keyof typeof input.operation.target]===renderedDecisionTarget[key]));
          if(pending&&pending.operation.type!==operation.type)throw Error('Another action on this revision is unconfirmed');
          let input=pending;
          if(!input){
            const current=await DailyApps.selectedReminder({id:event.alphaReminderId});
            if(Object.keys(renderedDecisionTarget).some(key=>current[key as keyof typeof current]!==renderedDecisionTarget[key])){await decisionOwner.refreshReminders();api.toast('This reminder changed. Review it again before changing it.');return;}
            if(!stillSelected())return;
            const bindingHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(operation))))).map(v=>v.toString(16).padStart(2,'0')).join('');
            if(!stillSelected())return;
            input={operationId:crypto.randomUUID(),bindingHash,operation};createdInput=input;
            await retainReminderDeletion(input);
            if(!stillSelected())return;
          }
          let response;
          if(pending)response=await DailyApps.reminderOperationReceipt(input);
          else try{dispatched=true;response=await DailyApps.operateReminder(input);}catch{response=await DailyApps.reminderOperationReceipt(input);}
          if(response.status!=='succeeded'||!response.result)throw Error('Unconfirmed reminder action');
          await acknowledgeReminderDeletion(input,response.result);
          if(owner===decisionOwner&&decisionOwner.live){
            await decisionOwner.refreshReminders();
            const status=response.result.status;
            api.toast(status==='permission-denied'?'Saved, notifications disabled. Enable notifications then review this reminder again.':status==='scheduling-failed'?'Saved, scheduling failed. Review this reminder before retrying.':action==='snooze'?'Snoozed 10 minutes · approximate delivery':status==='completed'?'Completed. No further alarm scheduled.':'Completed. Next occurrence scheduled.');
          }
        }catch{
          if(owner===decisionOwner&&decisionOwner.live)api.toast('Reminder action is unconfirmed. Check action status in Calendar; it will not be repeated.');
        }finally{
          if(createdInput&&!dispatched)try{await discardUndispatchedReminderDeletion(createdInput);}catch{/* Preserve uncertain storage; never clear another operation. */}
          if(owner===decisionOwner&&decisionOwner.live)try{decisionOwner.reminderDeleteUnknown=Object.keys(await pendingReminderDeletions()).length;api.set({reminderDeleteUnknown:decisionOwner.reminderDeleteUnknown});}catch{}
          decisionOwner.reminderSaving=false;
        }
      };
      out.ev.reminderDone=()=>decide('done');out.ev.reminderSnooze=()=>decide('snooze');
      out.ev.edit=()=>{if(!requireFresh())return;const repeat=event.reminderRecurrence?.rule||'none',target=owner?.reminderTargets?.get(event.alphaReminderId);api.set({form:{...event,repeat,id:event.id,cal:'alpha-reminders',where:'',video:false,who:[],notes:event.reminderBody||'',alphaReminderId:event.alphaReminderId,reminderEditSession:{uncertain:false},reminderEditTarget:target?structuredClone(target):undefined,reminderEditSchedule:[event.off,event.t,repeat,event.alert]}});};
      const renderedTarget=event.reminderTarget?structuredClone(event.reminderTarget):undefined;
      out.ev.del=async()=>{
        if(!requireFresh()||owner?.reminderSaving)return;
        if(!renderedTarget){api.toast('Refresh and reopen this reminder before deleting.');return;}
        const deleteOwner=owner;
        const stillSelected=()=>owner===deleteOwner&&deleteOwner?.live&&!document.hidden&&api.isActive()&&api.get('calendar').open===event.id;
        if(!stillSelected())return;
        deleteOwner.reminderSaving=true;
        let createdInput:Bag=null,dispatched=false;
        try {
          const pending=Object.values(await pendingReminderDeletions()).find(input=>Object.keys(renderedTarget).every(key=>input.operation.target[key as keyof typeof input.operation.target]===renderedTarget[key]));
          if(pending&&pending.operation.type!=='reminder_cancel')throw Error('Another action on this revision is unconfirmed');
          let input=pending;
          if(!input){
            const current=await DailyApps.selectedReminder({id:event.alphaReminderId});
            if(Object.keys(renderedTarget).some(key=>current[key as keyof typeof current]!==renderedTarget[key])){await deleteOwner.refreshReminders();api.toast('This reminder changed. Review it again before deleting.');return;}
            if(!stillSelected())return;
            const operation={type:'reminder_cancel' as const,target:renderedTarget};
            const bindingHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(operation))))).map(v=>v.toString(16).padStart(2,'0')).join('');
            if(!stillSelected())return;
            input={operationId:crypto.randomUUID(),bindingHash,operation};
            createdInput=input;
            await retainReminderDeletion(input);
            if(!stillSelected()){api.set({reminderDeleteUnknown:Object.keys(await pendingReminderDeletions()).length});return;}
          }
          // A repeat click reconciles the original receipt; it never replays an unknown effect.
          let result;
          if(pending)result=await DailyApps.reminderOperationReceipt(input);
          else try{dispatched=true;result=await DailyApps.operateReminder(input);}catch{result=await DailyApps.reminderOperationReceipt(input);}
          if(result.status!=='succeeded'||!result.result)throw Error('Unconfirmed reminder cancellation');
          await acknowledgeReminderDeletion(input,result.result);
          if(stillSelected())api.set({open:null});
          if(owner===deleteOwner&&deleteOwner.live){await deleteOwner.refreshReminders();api.toast('Reminder cancelled');}
        }catch{
          if(owner===deleteOwner&&deleteOwner.live){
            api.set({reminderDeleteUnknown:Object.keys(await pendingReminderDeletions()).length});
            api.toast('Deletion is unconfirmed. Check action status in Calendar; no cancellation will be repeated.');
          }
        }finally{
          if(createdInput&&!dispatched)try{await discardUndispatchedReminderDeletion(createdInput);}catch{/* Preserve uncertain storage; never clear another operation. */}
          if(owner===deleteOwner&&deleteOwner.live)try{deleteOwner.reminderDeleteUnknown=Object.keys(await pendingReminderDeletions()).length;api.set({reminderDeleteUnknown:deleteOwner.reminderDeleteUnknown});}catch{}
          deleteOwner.reminderSaving=false;
        }
      };
    }
    return out;
  };
}
