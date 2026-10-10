type Form=Record<string,any>;
const fields=['title','notes','where','t','d','video','who','cal','repeat','alert','creationId','reminderCreationId'] as const;
/** Backup may retain invalid edits, but never adds proposal/source authority. */
export function snapshotCalendarForm(form:Form){return Object.fromEntries([...fields,'off'].filter(key=>form[key]!==undefined).map(key=>[key,form[key]]));}
const day=(date:Date)=>Date.UTC(date.getFullYear(),date.getMonth(),date.getDate());
const fail=()=>{throw Error('Saved calendar form needs recovery.');};
function validate(value:any,requireCreation=true){
 if(!value||value.version!==1||Object.keys(value).some(key=>!['version','date','zone','form'].includes(key))||typeof value.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value.date)||!Number.isFinite(Date.parse(value.date))||new Date(value.date).toISOString().slice(0,10)!==value.date||typeof value.zone!=='string')fail();
 try{new Intl.DateTimeFormat('en',{timeZone:value.zone});}catch{fail();}
 const f=value.form;if(!f||Array.isArray(f)||Object.keys(f).some(key=>!fields.includes(key as any)))fail();
 for(const key of ['title','notes','where'])if(typeof f[key]!=='string'||f[key].length>(key==='notes'?32768:2048))fail();
 if(!Number.isFinite(f.t)||f.t<0||f.t>=24||!Number.isFinite(f.d)||f.d<=0||f.d>168||typeof f.video!=='boolean'||!Array.isArray(f.who)||f.who.length>100||f.who.some((id:any)=>typeof id!=='string'||id.length>256))fail();
 if(typeof f.cal!=='string'||f.cal.length>256||!(f.cal==='alpha-reminders'||f.cal.startsWith('native:'))||!['none','daily','weekdays','weekly'].includes(f.repeat)||f.alert!==null&&(!Number.isFinite(f.alert)||f.alert<0||f.alert>10080))fail();
 for(const key of ['creationId','reminderCreationId'])if(f[key]!==undefined&&(typeof f[key]!=='string'||!/^[-a-zA-Z0-9_]{1,100}$/.test(f[key])))fail();
 if(requireCreation&&!f.creationId)fail();
 if(new TextEncoder().encode(JSON.stringify(value)).length>64000)fail();
 return value as {version:1;date:string;zone:string;form:Form};
}
/** Only editable creation fields and original idempotency IDs; no selected-source authority. */
export function encodeCalendarForm(form:Form,anchor=new Date()){
 if(form.id||form.alphaCalendarId||form.alphaReminderId||!Number.isSafeInteger(form.off))fail();
 const payload={version:1,date:new Date(day(anchor)+form.off*86400000).toISOString().slice(0,10),zone:Intl.DateTimeFormat().resolvedOptions().timeZone,form:Object.fromEntries(fields.filter(key=>form[key]!==undefined).map(key=>[key,form[key]]))};
 return JSON.stringify(validate(payload));
}
export function calendarEditFields(form:Form,anchor=new Date()){
 if(!Number.isSafeInteger(form.off))fail();
 const payload={version:1,date:new Date(day(anchor)+form.off*86400000).toISOString().slice(0,10),zone:Intl.DateTimeFormat().resolvedOptions().timeZone,form:Object.fromEntries(fields.filter(key=>!['creationId','reminderCreationId'].includes(key)&&form[key]!==undefined).map(key=>[key,form[key]]))};
 return validate(payload,false);
}
export function decodeCalendarForm(raw:string,now=new Date(),requireCreation=true){
 const payload=validate(JSON.parse(raw),requireCreation);
 const form:Form={...payload.form,id:null,off:(Date.parse(payload.date)-day(now))/86400000,separateCreation:false};
 return {form,date:payload.date,zone:payload.zone};
}
/** Why a form's start/end cannot be saved, or '' when it can. A form whose own duration is
 * zero or negative is a user-correctable end time; only a positive duration that resolves to a
 * missing or non-advancing wall time is a clock change. */
export function calendarFormTimeProblem(start:Date|null,end:Date|null,hours:number):string{
 if(!Number.isFinite(hours)||hours<=0)return 'Choose an end time after the start. Nothing was saved.';
 if(!start||!end||end.getTime()<=start.getTime())return 'This local time does not exist because the clocks change. Choose another start or end time. Nothing was saved.';
 return '';
}
