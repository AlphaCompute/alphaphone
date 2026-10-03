import {browserScreenLocked} from './screen-locked';
import {editStore,readStore,revision} from './store';
type Row={id:string;revision:string;title:string;text:string;at:number;phase:'posted'|'dismissed'|'opened'};
const key='alpha.browser.workflow-notices.v1';
type Receipt=Omit<Row,'text'> & {digest:string};
type State={rows:Row[];archived?:Receipt[]};
const initial=():State=>({rows:[]});
const digest=async(text:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(text)))),byte=>byte.toString(16).padStart(2,'0')).join('');
function validate(state:State){
 const ids=new Set<string>();
 if(!state||!Array.isArray(state.rows)||state.rows.length>200||state.archived!==undefined&&!Array.isArray(state.archived))throw Error('Notification history needs recovery. Download its saved data before making changes.');
 for(const row of [...state.rows,...state.archived||[]]){
  if(!row||typeof row.id!=='string'||!/^workflow:[\w-]{1,128}$/.test(row.id)||ids.has(row.id)||typeof row.revision!=='string'||!row.revision||typeof row.title!=='string'||!row.title.trim()||row.title.length>200||row.title.includes('\0')||!Number.isFinite(row.at)||!['posted','dismissed','opened'].includes(row.phase))throw Error('Notification history needs recovery. Download its saved data before making changes.');
  ids.add(row.id);
 }
 if(state.rows.some(row=>typeof row.text!=='string'||!row.text.trim()||row.text.length>16000)||(state.archived||[]).some(row=>row.phase==='posted'||typeof row.digest!=='string'||!/^[a-f0-9]{64}$/.test(row.digest)))throw Error('Notification history needs recovery. Download its saved data before making changes.');
}
export function workflowNoticeHistory(){const raw=localStorage.getItem(key);const state:State=raw?JSON.parse(raw):initial();validate(state);return {raw,state,eligible:state.rows.filter(row=>row.phase!=='posted').length};}
export function savedWorkflowNoticeHistory(){return localStorage.getItem(key)||JSON.stringify(initial());}
export async function compactWorkflowNotices(expected:string|null,signal:AbortSignal){
 const count=await editStore(key,initial,async state=>{
  signal.throwIfAborted();if(blocked())throw Error('Return to Alpha Phone before changing history.');
  if(localStorage.getItem(key)!==expected)throw Error('Notification history changed. Close and reopen history.');
  validate(state);const rows=state.rows.filter(row=>row.phase!=='posted');
  const receipts=await Promise.all(rows.map(async({text,...row})=>({...row,digest:await digest(text)})));
  signal.throwIfAborted();if(blocked()||localStorage.getItem(key)!==expected)throw Error('Notification history changed. Close and reopen history.');
  state.archived=[...state.archived||[],...receipts];state.rows=state.rows.filter(row=>row.phase==='posted');return rows.length;
 },signal);changed();return count;
}
const blocked=()=>document.hidden||document.documentElement.dataset.devBackground==='true'||!!browserScreenLocked();
const changed=()=>window.dispatchEvent(new Event('focus'));
export async function publishWorkflowNotice(id:string,text:string,signal:AbortSignal,title='Workflow result'){
 signal.throwIfAborted();if(typeof title!=='string'||!title.trim()||title.length>200||title.includes('\0'))throw Error('Choose a notification title between 1 and 200 characters.');if(!/^[\w-]{1,128}$/.test(id)||!text.trim()||text.length>16000)throw Error('Choose notification text between 1 and 16000 characters.');
 const result=await editStore(key,initial,async state=>{
  signal.throwIfAborted();validate(state);const prior=state.rows.find(row=>row.id==='workflow:'+id);
  if(prior){if(prior.text!==text||prior.title!==title)throw Error('Saved notification receipt does not match this step.');return prior;}
  const receipt=state.archived?.find(row=>row.id==='workflow:'+id);if(receipt){if(receipt.title!==title||receipt.digest!==await digest(text))throw Error('Saved notification receipt does not match this step.');const {digest:_,...row}=receipt;return {...row,text};}
  if(state.rows.length>=200)throw Error('Workflow notification history is full. Open Workflow history and free notification space after reviewing or dismissing notices.');
  const row:Row={id:'workflow:'+id,revision:revision(),title,text,at:Date.now(),phase:'posted'};state.rows.push(row);return row;
 },signal);changed();return result;
}
export function listWorkflowNotices(){const hidden=blocked();const state=readStore(key,initial);validate(state);return state.rows.filter(row=>row.phase==='posted').map(row=>({...row,source:'own' as const,appLabel:'Workflows',title:hidden?'Workflows':row.title,text:hidden?'':row.text,clearable:true,canOpen:!hidden}));}
export async function actOnWorkflowNotice(input:{id:string;revision:string},open:boolean){
 await editStore(key,initial,state=>{validate(state);const row=state.rows.find(row=>row.id===input.id);if(blocked()||!row||row.phase!=='posted'||row.revision!==input.revision)throw Error('Notification changed.');row.phase=open?'opened':'dismissed';row.revision=revision();});
 changed();if(open)window.dispatchEvent(new CustomEvent('alpha:browser-open-view',{detail:'workflows'}));
}
