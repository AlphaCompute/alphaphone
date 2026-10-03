import {browserDevProfile} from '../browser/dev-profile';
/** Workflow data scopes. These are never executable code or implicit grants. */
export interface WorkflowDeviceBinding { workflowId:string; versionId:string; runId:string; stepId:string; specDigest:string }
export interface WorkflowDeviceTarget { installationId:string; enrollmentId:string }
export type WorkflowReadOperation = {type:'read_selected_notes';notes:Array<{id:string;revision:string}>}
 | {type:'read_calendar_range';calendarIds:string[];start:string;end:string;timeZone:string;maximumEvents:number};
export type WorkflowReadResult = {kind:'notes';notes:Array<{id:string;revision:string;title:string;text:string}>}
 | {kind:'calendar';events:Array<{id:string;calendarId:string;revision:string;title:string;start:string;end:string;allDay:boolean}>};
export interface WorkflowPhoneReview {runId:string;workflowId:string;versionId:string;specDigest:string;spec:{device:WorkflowDeviceTarget;steps:Array<Record<string,any>>;[key:string]:unknown};status:string;finished:boolean;cancellationRequestedAt:string|null}
const fail=():never=>{throw new Error('Workflow phone scope could not be verified');};
export const workflowObject=(v:unknown):Record<string,any>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,any>:fail();
const exact=(p:Record<string,any>,keys:string[])=>{if(Object.keys(p).some(k=>!keys.includes(k))||keys.some(k=>!(k in p)))fail();};
const text=(v:unknown,max:number,empty=false):string=>typeof v==='string'&&v.length<=max&&!v.includes('\0')&&(empty||!!v.trim())?v:fail();
export const workflowId=(v:unknown):string=>{const s=text(v,128);return /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(s)?s:fail();};
/** Preserve existing public dev enrollment labels without broadening native identifiers. */
export function workflowEnrollmentId(value:unknown):string{if(browserDevProfile&&typeof value==='string'&&/^development-cloud\.(first|second)-enrollment$/.test(value))return value;return workflowId(value);}
const digest=(v:unknown):string=>{const s=text(v,64);return /^[a-f0-9]{64}$/.test(s)?s:fail();};
const utc=(v:unknown):string=>{const s=text(v,30);return Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s?s:fail();};
const list=(v:unknown,max:number):unknown[]=>Array.isArray(v)&&v.length>0&&v.length<=max?v:fail();
export function parseWorkflowBinding(value:unknown):WorkflowDeviceBinding{const p=workflowObject(value);exact(p,['workflowId','versionId','runId','stepId','specDigest']);return {workflowId:workflowId(p.workflowId),versionId:workflowId(p.versionId),runId:workflowId(p.runId),stepId:workflowId(p.stepId),specDigest:digest(p.specDigest)};}
export function parseWorkflowRead(value:unknown):WorkflowReadOperation{
 const p=workflowObject(value);
 if(p.type==='read_selected_notes'){exact(p,['type','notes']);const notes=list(p.notes,16).map(v=>{const n=workflowObject(v);exact(n,['id','revision']);return {id:workflowId(n.id),revision:digest(n.revision)};});if(new Set(notes.map(n=>n.id)).size!==notes.length)fail();return {type:p.type,notes};}
 if(p.type==='read_calendar_range'){exact(p,['type','calendarIds','start','end','timeZone','maximumEvents']);const calendarIds=list(p.calendarIds,16).map(workflowId),start=utc(p.start),end=utc(p.end),timeZone=text(p.timeZone,100);if(new Set(calendarIds).size!==calendarIds.length||Date.parse(end)<=Date.parse(start)||Date.parse(end)-Date.parse(start)>7*86400000||!Number.isInteger(p.maximumEvents)||p.maximumEvents<1||p.maximumEvents>200)fail();try{new Intl.DateTimeFormat('en-US',{timeZone}).format(0);}catch{fail();}return {type:p.type,calendarIds,start,end,timeZone,maximumEvents:p.maximumEvents};}
 return fail();
}
export async function workflowSha(value:unknown):Promise<string>{const bytes=new TextEncoder().encode(JSON.stringify(value));return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');}
export function workflowBytes(value:unknown):number{return new TextEncoder().encode(JSON.stringify(value)).length;}
export async function validateWorkflowResult(operation:WorkflowReadOperation,value:unknown):Promise<WorkflowReadResult>{
 if(workflowBytes(value)>65536)fail();const p=workflowObject(value);
 if(operation.type==='read_selected_notes'){exact(p,['kind','notes']);if(p.kind!=='notes'||!Array.isArray(p.notes)||p.notes.length!==operation.notes.length)fail();const notes=[];for(let i=0;i<p.notes.length;i++){const n=workflowObject(p.notes[i]);exact(n,['id','revision','title','text']);const item={id:workflowId(n.id),revision:digest(n.revision),title:text(n.title,256,true),text:text(n.text,32000,true)};if(item.id!==operation.notes[i].id||item.revision!==operation.notes[i].revision||await workflowSha([item.title,item.text])!==item.revision)fail();notes.push(item);}return {kind:'notes',notes};}
 exact(p,['kind','events']);if(p.kind!=='calendar'||!Array.isArray(p.events)||p.events.length>operation.maximumEvents)fail();const events=[];for(const raw of p.events){const e=workflowObject(raw);exact(e,['id','calendarId','revision','title','start','end','allDay']);const item={id:workflowId(e.id),calendarId:workflowId(e.calendarId),revision:digest(e.revision),title:text(e.title,1000,true),start:utc(e.start),end:utc(e.end),allDay:e.allDay};const start=Date.parse(item.start),end=Date.parse(item.end),begin=Date.parse(operation.start),finish=Date.parse(operation.end);if(typeof item.allDay!=='boolean'||!operation.calendarIds.includes(item.calendarId)||end<start||start>=finish||(end===start?start<begin:end<=begin)||await workflowSha([item.id,item.calendarId,item.title,item.start,item.end,item.allDay])!==item.revision)fail();events.push({...item,allDay:item.allDay as boolean});}if(new Set(events.map(e=>JSON.stringify([e.calendarId,e.id,e.start]))).size!==events.length)fail();return {kind:'calendar',events};
}
export async function parseWorkflowPhoneReview(value:unknown,expected:{id:string;workflowId:string;versionId:string}):Promise<WorkflowPhoneReview>{
 const p=workflowObject(value);if(p.runId!==expected.id||p.workflowId!==expected.workflowId||p.versionId!==expected.versionId||typeof p.finished!=='boolean'||!(p.cancellationRequestedAt===null||typeof p.cancellationRequestedAt==='string'))fail();const spec=workflowObject(p.spec);if(workflowBytes(spec)>65536||spec.version!==1||!Array.isArray(spec.steps)||!spec.steps.length||spec.steps.length>32||workflowObject(spec.trigger).kind!=='manual')fail();text(spec.name,200);text(spec.description,4000,true);const device=workflowObject(spec.device);exact(device,['installationId','enrollmentId']);workflowId(device.installationId);workflowEnrollmentId(device.enrollmentId);const ids=new Set<string>();for(const step of spec.steps){const s=workflowObject(step),id=workflowId(s.id);if(ids.has(id))fail();ids.add(id);if(!['Read','If','Write'].includes(s.kind)||!['selected_notes','calendar_range','save_note','supplied_text','contains','compose_draft','model_draft'].includes(s.operation))fail();}if(await workflowSha(spec)!==digest(p.specDigest))fail();return {runId:workflowId(p.runId),workflowId:workflowId(p.workflowId),versionId:workflowId(p.versionId),specDigest:p.specDigest,spec:spec as WorkflowPhoneReview['spec'],status:text(p.status,100),finished:p.finished,cancellationRequestedAt:p.cancellationRequestedAt};
}
export function assertWorkflowOperation(review:WorkflowPhoneReview,binding:WorkflowDeviceBinding,target:WorkflowDeviceTarget,operation:{type:string;[key:string]:any}){
 if(review.finished||review.cancellationRequestedAt||review.runId!==binding.runId||review.workflowId!==binding.workflowId||review.versionId!==binding.versionId||review.specDigest!==binding.specDigest||review.spec.device.installationId!==target.installationId||review.spec.device.enrollmentId!==target.enrollmentId)fail();const step=review.spec.steps.find(s=>s.id===binding.stepId);if(!step)return fail();
 if(operation.type==='read_selected_notes'){if(step.kind!=='Read'||step.operation!=='selected_notes'||JSON.stringify(parseWorkflowRead({type:operation.type,notes:step.notes}))!==JSON.stringify(operation))fail();}
 else if(operation.type==='read_calendar_range'){if(step.kind!=='Read'||step.operation!=='calendar_range'||JSON.stringify(parseWorkflowRead({type:operation.type,...workflowObject(step.range)}))!==JSON.stringify(operation))fail();}
 else if(operation.type==='create_note'){if(step.kind!=='Write'||step.operation!=='save_note'||step.title!==operation.title||typeof operation.body!=='string')fail();}
 else fail();
}
