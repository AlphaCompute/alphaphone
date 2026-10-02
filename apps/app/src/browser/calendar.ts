import {calendarAlerts} from './calendar-alerts';
import {editCalendarResponse,calendarResponses} from './calendar-response';
import {openCalendarMeeting} from './calendar-meeting';
import {calendarRecord,calendarRange,remapCalendarExclusions,replaceCalendarRecord,deleteCalendarRecord,type CalendarRecord} from './calendar-records';
import { editCalendarEvent } from './calendar-editor';
import { BrowserReviews } from './review';
import { validateCalendarOperation, type CalendarFields, type CalendarResult } from '../runtime/calendar-contract';
import { WebPlugin } from '@capacitor/core';
import { editStore, readStore, revision } from './store';
type EventRow=CalendarRecord;
type State={alertDismissed?:Record<string,number>;preferences?:{visible:boolean;color:'acc'|'fg'|'mut'};sourceRevision:string;events:EventRow[];receipts?:Record<string,{binding:string;result:CalendarResult}>};
const key='alpha.browser.calendar.v1',initial=():State=>({sourceRevision:revision(),events:[]});
const source={id:'local',name:'Browser calendar',account:'Alpha Phone',local:true,writable:true};
const matches=(row:EventRow,expected:Partial<EventRow>|undefined)=>!!expected&&(!expected.revision||expected.revision===row.revision)&&(['title','body','location','begin','end'] as const).every(k=>row[k]===expected[k]);
export class BrowserCalendar extends WebPlugin {
  private reviews=new BrowserReviews();
  private active=new Map<string,{cancelled:boolean}>();
  async cancelAgent(input:{operationId:string}){const pending=this.active.get(input.operationId);if(pending)pending.cancelled=true;this.reviews.cancel(input.operationId);return {status:'cancelled'};}
  async executeAgent(input:{operation:unknown;operationId:string}) {
    if(!/^[A-Za-z0-9_-]{1,128}$/.test(input.operationId))throw Error('Invalid operation identity.');
    const operation=validateCalendarOperation(input.operation),binding=JSON.stringify(operation),identity=operation.type==='calendar_create'?operation.source:operation.target;
    const prior=readStore(key,initial).receipts?.[input.operationId];
    if(prior)return prior.binding===binding?{status:'applied',result:prior.result}:{status:'conflict'};
    if(this.active.has(input.operationId))return {status:'busy'};
    const ticket={cancelled:false};this.active.set(input.operationId,ticket);
    const fields=(row:EventRow):CalendarFields=>({title:row.title,description:row.body,location:row.location,start:new Date(row.begin).toISOString(),end:new Date(row.end).toISOString(),timeZone:row.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone});
    try {
      const data=readStore(key,initial),row=operation.type==='calendar_create'?undefined:calendarRecord(data.events,operation.target.eventId);
      if(identity.sourceId!=='local'||identity.sourceRevision!==data.sourceRevision||operation.type!=='calendar_create'&&(!row||row.revision!==operation.target.revision))return {status:'conflict'};
      const reviewed='fields' in operation?operation.fields:fields(row!);
      const approved=await this.reviews.confirm(input.operationId,operation.type==='calendar_read_selected'?'Share calendar event with agent?':'Review calendar change',`${operation.type.replaceAll('_',' ')}
${reviewed.title}
${reviewed.start} — ${reviewed.end}
${reviewed.timeZone}
${reviewed.location}
${reviewed.description}`);
      if(!approved||ticket.cancelled)return {status:'cancelled'};
      return await editStore(key,initial,current=>{
        if(ticket.cancelled||document.hidden)return {status:'cancelled'};
        const receipt=current.receipts?.[input.operationId];if(receipt)return receipt.binding===binding?{status:'applied',result:receipt.result}:{status:'conflict'};
        const before=operation.type==='calendar_create'?undefined:calendarRecord(current.events,operation.target.eventId);
        if(current.sourceRevision!==identity.sourceRevision||operation.type!=='calendar_create'&&(!before||before.revision!==operation.target.revision))return {status:'conflict'};
        let result:CalendarResult;
        if(operation.type==='calendar_create'||operation.type==='calendar_update'){
          const f=operation.fields,event:EventRow={...before,id:before?.id||crypto.randomUUID(),calendarId:'local',title:f.title,body:f.description,location:f.location,begin:Date.parse(f.start),end:Date.parse(f.end),timeZone:f.timeZone,revision:revision()};
          replaceCalendarRecord(current.events,event);
          result={version:1,kind:operation.type,sourceId:'local',eventId:event.id,revision:event.revision};
        }else{
          result={version:1,kind:operation.type,sourceId:'local',eventId:before!.id,revision:before!.revision};
          if(operation.type==='calendar_delete')current.events=deleteCalendarRecord(current.events,before!,revision());
          else result.fields=fields(before!);
        }
        (current.receipts??={})[input.operationId]={binding,result};return {status:'applied',result};
      });
    } finally {if(this.active.get(input.operationId)===ticket)this.active.delete(input.operationId);}
  }
  async changePreferences(input:{action:'visibility'|'color'}) {
    if(!['visibility','color'].includes(input.action))throw Error('Invalid calendar preference.');
    const result=await editStore(key,initial,data=>{
      const preferences=data.preferences??={visible:true,color:'acc'};
      if(input.action==='visibility')preferences.visible=!preferences.visible;
      else {const colors=['acc','fg','mut'] as const;preferences.color=colors[(colors.indexOf(preferences.color)+1)%colors.length];}
      return {...preferences};
    });
    window.dispatchEvent(new Event('alpha:calendar-preferences'));
    return result;
  }
  async edit(input:{id:string;revision:string;people?:{id:string;name:string}[]}) {
    const row=calendarRecord(readStore(key,initial).events,input.id);
    if(!row||row.revision!==input.revision)throw Error('This event changed. Reopen it before editing.');
    if(input.people!==undefined&&(!Array.isArray(input.people)||input.people.length>1000||input.people.some(p=>!p||typeof p.id!=='string'||!p.id||p.id.length>128||typeof p.name!=='string'||p.name.length>300)))throw Error('Review the attendee list.');
    return editCalendarEvent({...row,...(row.seriesId?{repeat:'none' as const}:{})},async(next,current)=>{
      await editStore(key,initial,data=>{if(!current())throw Error('Editing cancelled.');const before=calendarRecord(data.events,input.id);if(!before||before.revision!==input.revision)throw Error('This event changed. Reopen it before editing.');if((next.who?.length||0)>100)throw Error('Choose at most 100 attendees.');const updated={...before,...next,revision:revision()};if(updated.responses)updated.responses=Object.fromEntries(Object.entries(updated.responses).filter(([person])=>updated.who?.includes(person)));if(!before.seriesId&&before.repeat&&before.repeat!=='none')updated.excluded=remapCalendarExclusions(data.events,before,updated);replaceCalendarRecord(data.events,updated);});
    },input.people);
  }
  async editSeries(input:{id:string;revision:string;people?:{id:string;name:string}[]}){
    const data=readStore(key,initial),occurrence=calendarRecord(data.events,input.id),series=data.events.find(row=>row.id===occurrence?.seriesId);
    if(!occurrence||occurrence.revision!==input.revision||!series)throw Error('This series changed. Reopen it before editing.');
    if(!await this.reviews.confirm('edit-series-'+series.id,'Edit repeating series',`${series.title}\nChanges apply to the repeating schedule. Existing occurrence edits are kept.`))return {status:'cancelled'};
    return this.edit({id:series.id,revision:series.revision,people:input.people});
  }
  async removeSeries(input:{id:string;revision:string}){
    const data=readStore(key,initial),occurrence=calendarRecord(data.events,input.id),series=data.events.find(row=>row.id===occurrence?.seriesId);
    if(!occurrence||occurrence.revision!==input.revision||!series)return {status:'conflict'};
    if(!await this.reviews.confirm('delete-series-'+series.id,'Delete repeating series',`${series.title}\nDelete every occurrence, including edited dates?`))return {status:'cancelled'};
    return editStore(key,initial,current=>{const row=current.events.find(row=>row.id===series.id),selected=calendarRecord(current.events,input.id);if(!row||row.revision!==series.revision||selected?.revision!==input.revision)return {status:'conflict'};current.events=deleteCalendarRecord(current.events,row,revision());return {status:'deleted'};});
  }
  async editResponse(input:{id:string;revision:string;person:string;name:string}){
    const row=calendarRecord(readStore(key,initial).events,input.id);
    if(!row||row.revision!==input.revision||!row.who?.includes(input.person))throw Error('This guest list changed. Reopen the event.');
    return editCalendarResponse(input.name,row.responses?.[input.person]||'added',async(response,active)=>{
      if(!Object.hasOwn(calendarResponses,response))throw Error('Choose a guest response.');
      await editStore(key,initial,data=>{if(!active())throw Error('Response editing cancelled.');const before=calendarRecord(data.events,input.id);if(!before||before.revision!==input.revision||!before.who?.includes(input.person))throw Error('This guest list changed. Reopen the event.');replaceCalendarRecord(data.events,{...before,responses:{...before.responses,[input.person]:response},revision:revision()});});
    });
  }
  async joinMeeting(input:{id:string;revision:string;people?:string[]}){
    if(input.people!==undefined&&(!Array.isArray(input.people)||input.people.length>100||input.people.some(name=>typeof name!=='string'||name.length>300)))throw Error('Invalid meeting attendees.');
    const row=calendarRecord(readStore(key,initial).events,input.id);
    if(!row||row.revision!==input.revision||!row.video)throw Error('This meeting changed. Reopen the event.');
    return openCalendarMeeting(row.title,(input.people||row.who||[]).slice(0,100));
  }
  async listAlerts(){const data=readStore(key,initial);return {items:calendarAlerts(data.events,data.alertDismissed||{})};}
  async alertAction(input:{id:string;revision:string;open:boolean}){
    const data=readStore(key,initial),alert=calendarAlerts(data.events,data.alertDismissed||{}).find(row=>row.id===input.id&&row.revision===input.revision);
    if(!alert)throw Error('Calendar alert changed.');
    if(input.open){const result=await this.open({id:alert.eventId});if(result.status!=='opened')throw Error('Calendar navigation was cancelled.');}
    await editStore(key,initial,current=>{const active=calendarAlerts(current.events,current.alertDismissed||{}).find(row=>row.id===input.id&&row.revision===input.revision);if(!active)throw Error('Calendar alert changed.');current.alertDismissed=Object.fromEntries(Object.entries(current.alertDismissed||{}).filter(([,at])=>at>Date.now()-2*86400000));current.alertDismissed[active.receipt]=Date.now();});
    return {status:input.open?'opened':'dismissed'};
  }
  async requestAccess(){return {status:'granted'};}
  async requestWorkflowReadAccess(){return {status:'granted'};}
  async workflowCalendars(){return {status:'ready',calendars:[source]};}
  async list(input:{begin:number;end:number}) {return editStore(key,initial,data=>({status:'ready',calendars:[{...source,...(data.preferences??{visible:true,color:'acc'})}],...calendarRange(data.events,input)}));}
  async prepareAgentSource(){return editStore(key,initial,data=>({status:'ready',sourceId:'local',sourceRevision:data.sourceRevision}));}
  async save(input:Partial<EventRow>&{expected?:Partial<EventRow>}) {
    if(!input.title?.trim()||!Number.isFinite(input.begin)||!Number.isFinite(input.end)||input.end!<=input.begin!||input.calendarId!=='local')throw Error('Review the event title, calendar and dates.');
    if(input.alert!==undefined&&input.alert!==null&&![0,10,60].includes(input.alert))throw Error('Choose an event alert.');
    if(input.who!==undefined&&(!Array.isArray(input.who)||input.who.length>100||input.who.some(id=>typeof id!=='string'||!id||id.length>128)))throw Error('Review the event attendees.');
    if(input.video!==undefined&&typeof input.video!=='boolean')throw Error('Invalid meeting option.');
    if(input.allDay!==undefined&&typeof input.allDay!=='boolean')throw Error('Invalid all-day setting.');
    if(input.timeZone!==undefined)new Intl.DateTimeFormat('en',{timeZone:input.timeZone});
    if(input.repeat!==undefined&&!['none','daily','weekdays','weekly'].includes(input.repeat))throw Error('Invalid event repeat rule.');
    return editStore(key,initial,data=>{
      const old=input.id?calendarRecord(data.events,input.id):undefined;
      if(input.id&&(!old||!matches(old,input.expected)))return {status:'conflict'};
      const allDay=input.allDay??old?.allDay??false;
      if(allDay&&(input.begin!%86400000!==0||input.end!%86400000!==0))throw Error('All-day events require whole calendar dates.');
      const row:EventRow={...old,id:old?.id||crypto.randomUUID(),calendarId:'local',title:input.title!.trim(),body:input.body||'',location:input.location||'',begin:input.begin!,end:input.end!,allDay,revision:revision(),timeZone:old?.timeZone||input.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone,repeat:old?.seriesId?'none':input.repeat||old?.repeat||'none',who:input.who?[...new Set(input.who)]:old?.who||[],video:input.video??old?.video??false,alert:input.alert===undefined?old?.alert??null:input.alert};
      if(row.responses)row.responses=Object.fromEntries(Object.entries(row.responses).filter(([person])=>row.who?.includes(person)));
      replaceCalendarRecord(data.events,row);return {status:'saved',id:row.repeat&&row.repeat!=='none'?calendarRange([row],{begin:row.begin,end:row.begin+8*86400000}).events[0].id:row.id};
    });
  }
  async inspect(input:{id:string;calendarId:string;expected?:Partial<EventRow>}) {const data=readStore(key,initial),row=calendarRecord(data.events,input.id);return row&&row.calendarId===input.calendarId&&matches(row,input.expected)?{status:'ready',revision:row.revision,sourceRevision:data.sourceRevision}:{status:'conflict'};}
  async remove(input:{id:string;calendarId:string;expected:Partial<EventRow>;revision:string}) {return editStore(key,initial,data=>{const row=calendarRecord(data.events,input.id);if(!row||row.calendarId!==input.calendarId||row.revision!==input.revision||!matches(row,input.expected))return {status:'conflict'};data.events=deleteCalendarRecord(data.events,row,revision());return {status:'deleted'};});}
  async readWorkflowRange(input:{calendarIds:string[];start:string;end:string;maximumEvents:number}) {const {events}=await this.list({begin:Date.parse(input.start),end:Date.parse(input.end)});return {status:'ready',events:events.filter(e=>input.calendarIds.includes(e.calendarId)).slice(0,input.maximumEvents).map(e=>({...e,start:new Date(e.begin).toISOString(),end:new Date(e.end).toISOString(),allDay:!!e.allDay}))};}
  async open(input?:{id?:string}){
    const row=input?.id?calendarRecord(readStore(key,initial).events,input.id):undefined;
    if(input?.id&&!row)throw Error('This event no longer exists.');
    window.dispatchEvent(new CustomEvent('alpha:browser-open-view',{detail:'calendar'}));
    if(!row)return {status:'opened'};
    return new Promise<{status:'opened'|'cancelled'}>(resolve=>{const event=new CustomEvent('alpha:calendar-open',{cancelable:true,detail:{id:row.id,begin:row.begin,allDay:!!row.allDay,complete:(opened:boolean)=>resolve({status:opened?'opened':'cancelled'})}});window.dispatchEvent(event);if(!event.defaultPrevented)resolve({status:'cancelled'});});
  }
}
