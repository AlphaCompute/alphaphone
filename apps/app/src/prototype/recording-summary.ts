/** Model output is only an editable proposal, never a persistence instruction. */
export function proposedRecordingSummary(text:string):{summary:string;actions:string[]}|undefined{
 if(typeof text!=='string'||text.length>48000)return;
 const raw=text.trim(),fenced=/^```(?:json)?\s*\n([\s\S]*?)\n```$/.exec(raw);
 try{
  const value=JSON.parse(fenced?fenced[1]:raw);
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='actions,summary'||typeof value.summary!=='string'||!value.summary.trim()||value.summary.length>32000||value.summary.includes('\0')||!Array.isArray(value.actions)||value.actions.length>20||value.actions.some((action:unknown)=>typeof action!=='string'||!action.trim()||action.length>500||/[\r\n\0]/.test(action)))return;
  const actions=value.actions.map((action:string)=>action.trim());
  if(actions.join('\n').length>4000)return;
  return {summary:value.summary,actions};
 }catch{return;}
}
