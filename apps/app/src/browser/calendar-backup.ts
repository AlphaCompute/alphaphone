import type {CalendarRecord} from './calendar-records';
function encodedSeriesId(id:string){
 const match=/^(.*):occ:(-?\d+)$/.exec(id);
 return match&&Number.isSafeInteger(Number(match[2]))&&String(Number(match[2]))===match[2]?match[1]:undefined;
}
function readBackup(raw:string){
 if(new TextEncoder().encode(raw).length>5*1024*1024)throw Error('Calendar backup must be 5 MB or smaller.');
 const fail=():never=>{throw Error('This is not a supported calendar backup. No events were changed.');};
 let value:any;try{value=JSON.parse(raw);}catch{return fail();}
 if(value?.version===1&&typeof value.value==='string'){try{value=JSON.parse(value.value);}catch{return fail();}}
 if(!value||!Array.isArray(value.events)||value.events.length>10000)return fail();
 return value;
}
/** Alpha backup policy: copy reviewed events, never replay historical operation receipts. */
export function prepareCalendarBackup(raw:string,nextRevision:()=>string){
 const value=readBackup(raw);
 const fail=():never=>{throw Error('This is not a supported calendar backup. No events were changed.');};
 const text=(v:unknown,max:number)=>{if(typeof v!=='string'||v.length>max)return fail();return v;};
 const instant=(v:unknown)=>{if(typeof v!=='number'||!Number.isSafeInteger(v)||v< -62135596800000||v>253402214400000)return fail();return v;};
 const ids=new Map<string,string>(),rows=new Map<string,any>(),sourceRevision=nextRevision();
 for(const row of value.events){if(!row||typeof row!=='object')return fail();const id=text(row.id,512);if(!id||ids.has(id))return fail();ids.set(id,`restored-${sourceRevision}-${ids.size}`);rows.set(id,row);}
 const events:CalendarRecord[]=value.events.map((row:any)=>{
  const encodedParent=encodedSeriesId(row.id);
  if(encodedParent!==undefined&&rows.has(encodedParent)&&row.seriesId!==encodedParent)return fail();
  const begin=instant(row.begin),end=instant(row.end);if(end<=begin)return fail();
  const title=text(row.title,500);if(!title.trim())return fail();
  for(const field of ['allDay','video'])if(row[field]!==undefined&&typeof row[field]!=='boolean')return fail();
  const zone=row.timeZone===undefined?'UTC':text(row.timeZone,100);try{new Intl.DateTimeFormat('en',{timeZone:zone});}catch{return fail();}
  const repeat=row.repeat??'none';if(!['none','daily','weekdays','weekly'].includes(repeat))return fail();
  if(row.who!==undefined&&(!Array.isArray(row.who)||row.who.length>256))return fail();
  const who=(row.who??[]).map((v:unknown)=>text(v,500));
  const responses:Record<string,any>=Object.create(null);
  if(row.responses!==undefined){if(!row.responses||typeof row.responses!=='object'||Array.isArray(row.responses))return fail();for(const [name,response] of Object.entries(row.responses)){if(!who.includes(name)||typeof response!=='string'||!['added','invited','yes','maybe','no'].includes(response))return fail();responses[name]=response;}}
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

/** Explicit best-effort import. A recurring series is an indivisible recovery unit:
 * a damaged exception must not silently reappear as its original occurrence. */
export function prepareCalendarSalvage(raw:string,nextRevision:()=>string){
 const value=readBackup(raw),counts=new Map<string,number>(),groups=new Map<string,number[]>(),parents=new Map<string,string>();
 const validId=(id:unknown):id is string=>typeof id==='string'&&id.length>0&&id.length<=512;
 for(const row of value.events)if(validId(row?.id))counts.set(row.id,(counts.get(row.id)||0)+1);
 const root=(key:string):string=>{let result=key;while(parents.has(result))result=parents.get(result)!;while(parents.has(key)){const next=parents.get(key)!;parents.set(key,result);key=next;}return result;};
 const join=(a:string,b:string)=>{a=root(a);b=root(b);if(a!==b)parents.set(a,b);};
 const keyOf=(index:number)=>validId(value.events[index]?.id)?JSON.stringify(['id',value.events[index].id]):JSON.stringify(['invalid',index]);
 const inferredParent=(row:any)=>{
  if(!validId(row?.id))return undefined;
  const parent=encodedSeriesId(row.id);
  return parent!==undefined&&counts.has(parent)?parent:undefined;
 };
 // Follow both explicit references and the generated occurrence identity. A
 // corrupted/missing reference must not detach an exception from its parent.
 for(let index=0;index<value.events.length;index++){
  const row=value.events[index],key=keyOf(index),inferred=inferredParent(row);
  if(validId(row?.seriesId))join(key,JSON.stringify(['id',row.seriesId]));
  if(inferred!==undefined)join(key,JSON.stringify(['id',inferred]));
 }
 for(let index=0;index<value.events.length;index++){
  const key=root(keyOf(index));
  const group=groups.get(key);if(group)group.push(index);else groups.set(key,[index]);
 }
 const accepted=new Set<number>(),skipped:{index:number;reason:string}[]=[];
 for(const indexes of groups.values()){
  const rows=indexes.map(index=>value.events[index]);
  const duplicate=rows.some(row=>validId(row?.id)&&(counts.get(row.id)||0)>1);
  let valid=!duplicate;
  if(valid)try{prepareCalendarBackup(JSON.stringify({events:rows}),()=> 'validation');}catch{valid=false;}
  if(valid)for(const index of indexes)accepted.add(index);
  else for(const index of indexes)skipped.push({index:index+1,reason:duplicate?'Ambiguous duplicate identity':'Invalid event or incomplete recurring series'});
 }
 if(!accepted.size)throw Error('No complete valid events or series could be recovered. No events were changed.');
 const state=prepareCalendarBackup(JSON.stringify({events:value.events.filter((_:unknown,index:number)=>accepted.has(index))}),nextRevision);
 return {state,skipped:skipped.sort((a,b)=>a.index-b.index)};
}
