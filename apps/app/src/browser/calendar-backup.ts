import type {CalendarRecord} from './calendar-records';
/** Alpha backup policy: copy reviewed events, never replay historical operation receipts. */
export function prepareCalendarBackup(raw:string,nextRevision:()=>string){
 if(new TextEncoder().encode(raw).length>5*1024*1024)throw Error('Calendar backup must be 5 MB or smaller.');
 const fail=():never=>{throw Error('This is not a supported calendar backup. No events were changed.');};
 let value:any;try{value=JSON.parse(raw);}catch{return fail();}
 if(value?.version===1&&typeof value.value==='string'){try{value=JSON.parse(value.value);}catch{return fail();}}
 if(!value||!Array.isArray(value.events)||value.events.length>10000)return fail();
 const text=(v:unknown,max:number)=>{if(typeof v!=='string'||v.length>max)return fail();return v;};
 const instant=(v:unknown)=>{if(typeof v!=='number'||!Number.isSafeInteger(v)||v< -62135596800000||v>253402214400000)return fail();return v;};
 const ids=new Map<string,string>(),rows=new Map<string,any>(),sourceRevision=nextRevision();
 for(const row of value.events){if(!row||typeof row!=='object')return fail();const id=text(row.id,512);if(!id||ids.has(id))return fail();ids.set(id,`restored-${sourceRevision}-${ids.size}`);rows.set(id,row);}
 const events:CalendarRecord[]=value.events.map((row:any)=>{
  const begin=instant(row.begin),end=instant(row.end);if(end<=begin)return fail();
  const title=text(row.title,500);if(!title.trim())return fail();
  for(const field of ['allDay','video'])if(row[field]!==undefined&&typeof row[field]!=='boolean')return fail();
  const zone=row.timeZone===undefined?'UTC':text(row.timeZone,100);try{new Intl.DateTimeFormat('en',{timeZone:zone});}catch{return fail();}
  const repeat=row.repeat??'none';if(!['none','daily','weekdays','weekly'].includes(repeat))return fail();
  if(row.who!==undefined&&(!Array.isArray(row.who)||row.who.length>256))return fail();
  const who=(row.who??[]).map((v:unknown)=>text(v,500));
  const responses:Record<string,any>=Object.create(null);
  if(row.responses!==undefined){if(!row.responses||typeof row.responses!=='object'||Array.isArray(row.responses))return fail();for(const [name,response] of Object.entries(row.responses)){if(!who.includes(name)||!['added','invited','yes','maybe','no'].includes(String(response)))return fail();responses[name]=response;}}
  if(row.excluded!==undefined&&(!Array.isArray(row.excluded)||row.excluded.length>10000))return fail();
  const excluded=(row.excluded??[]).map(instant);
  const result:CalendarRecord={id:ids.get(row.id)!,calendarId:'local',revision:nextRevision(),title,body:text(row.body??'',16000),location:text(row.location??'',2000),begin,end,timeZone:zone,allDay:row.allDay??false,repeat,who,responses,video:row.video??false,alert:null,excluded};
  if(row.seriesId!==undefined){const seriesId=text(row.seriesId,512),parent=rows.get(seriesId);if(!parent||parent.seriesId!==undefined||!['daily','weekdays','weekly'].includes(parent.repeat)||repeat!=='none')return fail();const occurrenceBegin=instant(row.occurrenceBegin);if(row.id!==`${seriesId}:occ:${occurrenceBegin}`)return fail();result.seriesId=ids.get(seriesId)!;result.occurrenceBegin=occurrenceBegin;result.id=`${result.seriesId}:occ:${occurrenceBegin}`;}
  return result;
 });
 // Every restored event receives a fresh identity/revision. Invitations, alerts,
 // creation/action receipts and preferences are not imported from a file.
 return {sourceRevision,events};
}
