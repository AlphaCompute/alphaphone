type Bag=Record<string,any>;
export function readWorkflowMessages(api:Bag,unreadOnly:boolean):Record<string,Bag[]>{
 const state={...api.get('messages'),...JSON.parse(localStorage.getItem('alpha.dev.app.messages')||'{}')};
 if(!unreadOnly)return structuredClone(state.threads);
 const result:Record<string,Bag[]>={};
 for(const [pid,count] of Object.entries(state.unread||{})){
  if(!Number.isSafeInteger(count)||Number(count)<0)throw Error('Unread message counts need recovery.');
  if(!count)continue;
  const incoming=(state.threads[pid]||[]).filter((row:Bag)=>!row.me);if(Number(count)>incoming.length)throw Error('Unread message counts need recovery.');const rows=incoming.slice(-Number(count));if(rows.length)Object.defineProperty(result,pid,{value:structuredClone(rows),enumerable:true});
 }
 return result;
}
