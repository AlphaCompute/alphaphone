export type InboxUnsaved={version:1;owner:string;baseRevision:string|null;draft:Record<string,any>;toQ:string};
export const inboxUnsavedLimit=8*1024*1024-16384;
const fail=()=>{throw Error('Retained email edits need recovery.');};
const keys=(v:any,allowed:string[])=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>allowed.includes(k));
export function readInboxUnsaved(raw:string,owner:string):InboxUnsaved{
 if(new TextEncoder().encode(raw).length>inboxUnsavedLimit)fail();const value=JSON.parse(raw),d=value?.draft;
 if(!keys(value,['version','owner','baseRevision','draft','toQ'])||value.version!==1||value.owner!==owner||value.baseRevision!==null&&(typeof value.baseRevision!=='string'||!value.baseRevision)||typeof value.toQ!=='string'||value.toQ.length>4096)fail();
 if(!keys(d,['version','id','revision','owner','to','cc','bcc','attachments','provider','subject','body','mode','reply'])||d.version!==1||d.owner!==owner||typeof d.id!=='string'||!d.id||typeof d.revision!=='string'||!d.revision||typeof d.subject!=='string'||d.subject.length>4096||typeof d.body!=='string'||d.body.length>64000)fail();
 for(const list of [d.to,d.cc||[],d.bcc||[]])if(!Array.isArray(list)||list.length>20||list.some(a=>typeof a!=='string'||a.length>4096))fail();
 if(d.mode!==undefined&&!['compose','reply','reply-all','forward'].includes(d.mode))fail();
 if(d.reply&&(!keys(d.reply,['messageId','threadId'])||typeof d.reply.messageId!=='string'||typeof d.reply.threadId!=='string'))fail();
 if(d.provider&&(!keys(d.provider,['draftId','providerDigest'])||typeof d.provider.draftId!=='string'||typeof d.provider.providerDigest!=='string'))fail();
 if(d.attachments!==undefined&&(!Array.isArray(d.attachments)||d.attachments.length>20||d.attachments.some((a:any)=>!keys(a,['name','mimeType','dataBase64'])||['name','mimeType','dataBase64'].some(k=>typeof a[k]!=='string'))))fail();
 return value;
}
export function encodeInboxUnsaved(value:InboxUnsaved){const raw=JSON.stringify(value);readInboxUnsaved(raw,value.owner);return raw;}
