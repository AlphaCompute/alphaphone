import {editStore,readStore,revision} from './store';
type Row={id:string;revision:string;title:string;text:string;at:number;phase:'posted'|'dismissed'|'opened'};
const key='alpha.browser.workflow-notices.v1';
const initial=():{rows:Row[]}=>({rows:[]});
const blocked=()=>document.hidden||document.documentElement.dataset.devBackground==='true'||!!document.querySelector('[aria-label="Unlock with fingerprint"], [aria-label="Wake"]')?.getClientRects().length;
const changed=()=>window.dispatchEvent(new Event('focus'));
export async function publishWorkflowNotice(id:string,text:string,signal:AbortSignal){
 signal.throwIfAborted();if(!/^[\w-]{1,128}$/.test(id)||!text.trim()||text.length>16000)throw Error('Choose notification text between 1 and 16000 characters.');
 const result=await editStore(key,initial,state=>{
  signal.throwIfAborted();const prior=state.rows.find(row=>row.id==='workflow:'+id);
  if(prior){if(prior.text!==text)throw Error('Saved notification receipt does not match this step.');return prior;}
  if(state.rows.length>=200)throw Error('Workflow notification history is full.');
  const row:Row={id:'workflow:'+id,revision:revision(),title:'Workflow result',text,at:Date.now(),phase:'posted'};state.rows.push(row);return row;
 },signal);changed();return result;
}
export function listWorkflowNotices(){const hidden=blocked();return readStore(key,initial).rows.filter(row=>row.phase==='posted').map(row=>({...row,source:'own' as const,appLabel:'Workflows',title:hidden?'Workflows':row.title,text:hidden?'':row.text,clearable:true,canOpen:!hidden}));}
export async function actOnWorkflowNotice(input:{id:string;revision:string},open:boolean){
 await editStore(key,initial,state=>{const row=state.rows.find(row=>row.id===input.id);if(blocked()||!row||row.phase!=='posted'||row.revision!==input.revision)throw Error('Notification changed.');row.phase=open?'opened':'dismissed';row.revision=revision();});
 changed();if(open)window.dispatchEvent(new CustomEvent('alpha:browser-open-view',{detail:'workflows'}));
}
