import { DailyApps, type Reminder } from '../daily';
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
    return { id: 'reminder:' + r.id, alphaReminderId: r.id, reminderBody:r.body, reminderAt:r.at, reminderOccurrence:r.occurrenceId, reminderRecurrence:r.recurrence, reminderHistory:r.history, reminderStatus:r.status, off: Math.round((day.getTime()-today.getTime())/86400000), t: date.getHours()+date.getMinutes()/60, d: .25, title:r.title, cal:'personal', who:[], repeat:'none', alert:r.recurrence?.leadMinutes || 0, notes:[r.body, r.snoozedAt && r.status==='scheduled' ? `Snoozed until ${new Date(r.at).toLocaleString()} · approximate delivery` : '', r.recurrence ? `${r.recurrence.rule} · ${r.recurrence.zone}. Next occurrence is scheduled after Done. Future missing clock times use the first valid time after the gap; repeated clock times use the earlier offset.` : '', r.status === 'scheduling-failed' ? 'Saved, scheduling failed. Tap Snooze 10 minutes to retry.' : '', r.status === 'completed' ? 'Completed · no further alarm scheduled' : r.status === 'posted' ? 'Notification posted' : r.status === 'permission-denied' ? 'Not delivered · notifications were disabled. Enable notifications in Android settings, then edit this reminder to choose a new time and save.' : 'Scheduled · approximate delivery'].filter(Boolean).join('\n') };
  });
  p.refreshReminders = async function (openId?: string, occurrenceId?: string) {
    if (Capacitor.getPlatform() === 'web' && !Capacitor.isPluginAvailable('DailyApps')) {
      this.vset('calendar', { reminderStale: false });
      return;
    }
    // Resume and calendar refresh may supersede the notification's fetch.
    // Keep its navigation intent until the latest successful fetch consumes it.
    if (openId) {this.pendingReminderOpenId = openId;this.pendingReminderOccurrenceId=occurrenceId;}
    const generation = this.reminderRefreshGeneration = (this.reminderRefreshGeneration || 0) + 1;
    try {
      const result = await DailyApps.listReminders();
      if (!this.live || generation !== this.reminderRefreshGeneration) return;
      this.reminderTargets=new Map(result.reminders.map(r=>[r.id,r.target]));
      const rows = [...(this.nativeCalendarRows || []), ...events(result.reminders)];
      this.reminderRefreshFailed = false;
      this.vset('calendar', { events: rows, reminderStale:false });
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
    if(out.f) {
      const f=state.form;
      out.f.cals.push({name:'Reminders',dot:'var(--acc)',css:f.cal==='alpha-reminders'?'background:var(--fg);color:var(--bg)':'background:var(--bg)',pick:()=>api.set({form:{...api.get('calendar').form,cal:'alpha-reminders',repeat:'none',alert:0}})});
      if(f.cal==='alpha-reminders') out.f.save=async()=>{
        if(owner?.reminderSaving)return;
        const current=api.get('calendar').form;
        if(current?.alphaReminderId&&(api.get('calendar').reminderStale||owner?.reminderRefreshFailed)){api.toast('Refresh reminders before changing this saved reminder.');void owner?.refreshReminders();return;}
        if(!current?.title?.trim())return;

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
      const decide=async(action:'done'|'snooze')=>{
        if(!requireFresh())return;
        if(owner?.reminderSaving)return;
        if(owner)owner.reminderSaving=true;
        try {
          const result=await DailyApps.reminderDecision({id:event.alphaReminderId,occurrenceId:event.reminderOccurrence,action});
          if(result.status==='failed')throw Error();
          await owner?.refreshReminders(event.alphaReminderId);
          api.toast(result.status==='stale'?'This occurrence changed. Refreshed the reminder.':result.status==='permission-denied'?'Saved, notifications disabled. Enable notifications then tap Snooze 10 minutes to retry.':result.status==='scheduling-failed'?'Saved, scheduling failed. Tap Snooze 10 minutes to retry.':action==='done'?(event.reminderRecurrence?'Completed. Next occurrence scheduled.':'Completed. No further alarm scheduled.'):'Snoozed 10 minutes · approximate delivery');
        }catch{api.toast('The reminder action could not be saved.');}
        finally{if(owner)owner.reminderSaving=false;}
      };
      out.ev.reminderDone=()=>decide('done');out.ev.reminderSnooze=()=>decide('snooze');
      out.ev.edit=()=>{if(!requireFresh())return;api.set({form:{...event,repeat:event.reminderRecurrence?.rule || 'none',id:event.id,cal:'alpha-reminders',where:'',video:false,who:[],notes:event.reminderBody||'',alphaReminderId:event.alphaReminderId}});};
      out.ev.del=async()=>{
        if(!requireFresh())return;
        try {const result=await DailyApps.cancelReminder({id:event.alphaReminderId});if(result.status==='failed')throw Error();api.set({open:null});await owner?.refreshReminders();api.toast('Reminder cancelled');}
        catch {api.toast('The reminder could not be cancelled.');}
      };
    }
    return out;
  };
}
