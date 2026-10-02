import { BrowserReviews } from './review';
import { validateCalendarOperation, type CalendarFields, type CalendarResult } from '../runtime/calendar-contract';
import { WebPlugin } from '@capacitor/core';
import { editStore, readStore, revision } from './store';
type EventRow={id:string;calendarId:string;title:string;body:string;location:string;begin:number;end:number;revision:string;allDay?:boolean;timeZone?:string};
type State={sourceRevision:string;events:EventRow[];receipts?:Record<string,{binding:string;result:CalendarResult}>};
const key='alpha.browser.calendar.v1',initial=():State=>({sourceRevision:revision(),events:[]});
const source={id:'local',name:'Browser calendar',account:'Alpha Phone',local:true,writable:true};
const matches=(row:EventRow,expected:Partial<EventRow>|undefined)=>!!expected&&(['title','body','location','begin','end'] as const).every(k=>row[k]===expected[k]);
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
      const data=readStore(key,initial),row=operation.type==='calendar_create'?undefined:data.events.find(e=>e.id===operation.target.eventId);
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
        const before=operation.type==='calendar_create'?undefined:current.events.find(e=>e.id===operation.target.eventId);
        if(current.sourceRevision!==identity.sourceRevision||operation.type!=='calendar_create'&&(!before||before.revision!==operation.target.revision))return {status:'conflict'};
        let result:CalendarResult;
        if(operation.type==='calendar_create'||operation.type==='calendar_update'){
          const f=operation.fields,event:EventRow={id:before?.id||crypto.randomUUID(),calendarId:'local',title:f.title,body:f.description,location:f.location,begin:Date.parse(f.start),end:Date.parse(f.end),timeZone:f.timeZone,revision:revision()};
          current.events=current.events.filter(e=>e.id!==event.id);current.events.push(event);
          result={version:1,kind:operation.type,sourceId:'local',eventId:event.id,revision:event.revision};
        }else{
          result={version:1,kind:operation.type,sourceId:'local',eventId:before!.id,revision:before!.revision};
          if(operation.type==='calendar_delete')current.events=current.events.filter(e=>e!==before);
          else result.fields=fields(before!);
        }
        (current.receipts??={})[input.operationId]={binding,result};return {status:'applied',result};
      });
    } finally {if(this.active.get(input.operationId)===ticket)this.active.delete(input.operationId);}
  }
  async requestAccess(){return {status:'granted'};}
  async requestWorkflowReadAccess(){return {status:'granted'};}
  async workflowCalendars(){return {status:'ready',calendars:[source]};}
  async list(input:{begin:number;end:number}) {return editStore(key,initial,data=>({status:'ready',calendars:[source],events:data.events.filter(e=>e.begin<input.end&&e.end>input.begin),truncated:false}));}
  async prepareAgentSource(){return editStore(key,initial,data=>({status:'ready',sourceId:'local',sourceRevision:data.sourceRevision}));}
  async save(input:Partial<EventRow>&{expected?:Partial<EventRow>}) {
    if(!input.title?.trim()||!Number.isFinite(input.begin)||!Number.isFinite(input.end)||input.end!<=input.begin!||input.calendarId!=='local')throw Error('Review the event title, calendar and dates.');
    return editStore(key,initial,data=>{
      const old=data.events.find(e=>e.id===input.id);
      if(input.id&&(!old||!matches(old,input.expected)))return {status:'conflict'};
      const row:EventRow={id:old?.id||crypto.randomUUID(),calendarId:'local',title:input.title!.trim(),body:input.body||'',location:input.location||'',begin:input.begin!,end:input.end!,revision:revision(),timeZone:old?.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone};
      data.events=data.events.filter(e=>e.id!==row.id);data.events.push(row);return {status:'saved',id:row.id};
    });
  }
  async inspect(input:{id:string;calendarId:string;expected?:Partial<EventRow>}) {const data=readStore(key,initial),row=data.events.find(e=>e.id===input.id&&e.calendarId===input.calendarId);return row&&matches(row,input.expected)?{status:'ready',revision:row.revision,sourceRevision:data.sourceRevision}:{status:'conflict'};}
  async remove(input:{id:string;calendarId:string;expected:Partial<EventRow>;revision:string}) {return editStore(key,initial,data=>{const row=data.events.find(e=>e.id===input.id&&e.calendarId===input.calendarId);if(!row||row.revision!==input.revision||!matches(row,input.expected))return {status:'conflict'};data.events=data.events.filter(e=>e!==row);return {status:'deleted'};});}
  async readWorkflowRange(input:{calendarIds:string[];start:string;end:string;maximumEvents:number}) {const {events}=await this.list({begin:Date.parse(input.start),end:Date.parse(input.end)});return {status:'ready',events:events.filter(e=>input.calendarIds.includes(e.calendarId)).slice(0,input.maximumEvents).map(e=>({...e,start:new Date(e.begin).toISOString(),end:new Date(e.end).toISOString(),allDay:!!e.allDay}))};}
  async open(){window.dispatchEvent(new CustomEvent('alpha:browser-open-view',{detail:'calendar'}));return {status:'opened'};}
}
