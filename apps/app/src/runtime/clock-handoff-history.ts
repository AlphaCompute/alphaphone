/** Latest reviewed native handoff, not an alarm database or replay journal. */
export const clockHandoffLegacyKey='alphaphone:clock-handoff:v1';
export const clockHandoffSlot='clock-handoff:v1:device';
export type ClockHandoffRecord={id:string;action:'set'|'show'|'snooze'|'dismiss';status:'opening'|'opened'|'unavailable'|'denied'|'failed'|'unknown';at:string};
type Envelope={version:1;legacy:string|null;record:ClockHandoffRecord};
export type ClockHandoffSnapshot={stored:Envelope|null;legacy:string|null;record:ClockHandoffRecord|null};
type Storage={read<T>(slot:string):Promise<T|null>;compareExchange(slot:string,expected:unknown|null,value:unknown|null):Promise<{status:'saved'|'conflict'}>};
function record(value:unknown):ClockHandoffRecord{
 const row=value as ClockHandoffRecord;
 if(!row||typeof row!=='object'||Array.isArray(row)||typeof row.id!=='string'||!row.id||row.id.length>100||!['set','show','snooze','dismiss'].includes(row.action)||!['opening','opened','unavailable','denied','failed','unknown'].includes(row.status)||typeof row.at!=='string'||!Number.isFinite(Date.parse(row.at))||Object.keys(row).some(key=>!['id','action','status','at'].includes(key)))throw Error('Clock handoff history is unreadable');
 return row;
}
export function createClockHandoffHistory(storage:Storage,legacy:()=>string|null){
 const read=async():Promise<ClockHandoffSnapshot>=>{
  const stored=await storage.read<Envelope>(clockHandoffSlot),raw=legacy();
  if(stored===null)return {stored,legacy:raw,record:raw===null?null:record(JSON.parse(raw))};
  if(stored.version!==1||!(stored.legacy===null||typeof stored.legacy==='string')||Object.keys(stored).some(key=>!['version','legacy','record'].includes(key)))throw Error('Clock handoff history is unreadable');
  if(stored.legacy!==raw)throw Error('Clock handoff history changed in an older app');
  return {stored,legacy:raw,record:record(stored.record)};
 };
 const save=async(expected:ClockHandoffSnapshot,value:ClockHandoffRecord)=>{
  record(value);
  if(legacy()!==expected.legacy)throw Error('Clock handoff history changed');
  const next:Envelope={version:1,legacy:expected.legacy,record:value};
  if((await storage.compareExchange(clockHandoffSlot,expected.stored,next)).status!=='saved')throw Error('Clock handoff history changed');
  const saved=await read();
  if(JSON.stringify(saved.stored)!==JSON.stringify(next))throw Error('Clock handoff save unconfirmed');
  return saved;
 };
 return {read,save};
}
