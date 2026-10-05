/** Alpha's local composer record; no source handles, approvals or message receipts. */
export type AssistantDraft={version:1;binding:string;revision:string;text:string};
export const assistantDraftLimit=64000;
export function readAssistantDraft(value:unknown,binding:string):AssistantDraft|null{
 if(value===null)return null;
 const row=value as AssistantDraft;
 if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).sort().join(',')!=='binding,revision,text,version'||row.version!==1||row.binding!==binding||typeof row.revision!=='string'||!row.revision||typeof row.text!=='string'||new TextEncoder().encode(row.text).length>assistantDraftLimit)throw Error('Saved assistant draft needs recovery.');
 return row;
}
export function replaceAssistantDraft(actual:unknown,expected:AssistantDraft|null,binding:string,text:string,revision:()=>string){
 const saved=readAssistantDraft(actual,binding);readAssistantDraft(expected,binding);
 if(typeof text!=='string'||new TextEncoder().encode(text).length>assistantDraftLimit)throw Error('Draft is too large to save locally.');
 if(JSON.stringify(saved)!==JSON.stringify(expected))throw Error('This draft changed in another view. Review the saved copy before replacing it.');
 // Retain a revisioned empty record so clearing does not allow an old empty receipt to match again.
 return saved?.text===text?saved:{version:1 as const,binding,revision:revision(),text};
}
