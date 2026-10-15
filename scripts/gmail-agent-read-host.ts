/** Host reads for owner-only Inbox tools. Provider credentials remain in the
 * existing private Cloud store. No mailbox cache or mutation path is created. */
import {createHash} from 'node:crypto';
import {CloudProtocol} from '../apps/app/src/runtime/cloud-protocol.ts';
import {createBrowserCloudDevHandler} from './browser-cloud-dev-bridge.ts';
import {decodeBasicHtmlEntities} from '../vendor/eliza/plugins/plugin-assistant/src/utils/html-entities.ts';
export function createGmailAgentReadHost(profile:string){
 const host=createBrowserCloudDevHandler({profile});
 const refuseWrite=()=>{throw Error('Gmail agent reads cannot change credentials or mail.');};
 async function verified<T>(run:(client:CloudProtocol,grantId:string,scope:string,signal:AbortSignal)=>Promise<T>,parent?:AbortSignal,capability='google.gmail.triage'){
  const credential=await host.agentCredential();if(!credential)throw Error('Sign in to Eliza Cloud before reading Gmail.');
  const identity=JSON.stringify(credential),signal=parent?AbortSignal.any([parent,AbortSignal.timeout(30000)]):AbortSignal.timeout(30000);
  const current=async()=>{signal.throwIfAborted();if(JSON.stringify(await host.agentCredential())!==identity)throw Error('Cloud account changed while reading Gmail.');};
  const client=new CloudProtocol('production',host.agentRead,{acceptsReferences:true,read:async()=>{await current();return credential;},write:async()=>refuseWrite(),clear:async()=>refuseWrite()},async()=>refuseWrite());
  const owner=await client.identity(signal);await current();
  if(owner.userId!==credential.userId||owner.organizationId!==credential.organizationId)throw Error('Cloud owner could not be verified for Gmail.');
  const accounts=(await client.gmailAccounts(signal)).filter(a=>a.connected&&a.connectionId&&a.grantedCapabilities.includes(capability));
  await current();if(accounts.length!==1)throw Error(accounts.length?'More than one Gmail account is connected. Select an account before an agent read.':'No readable Gmail account is connected.');
  const grantId=accounts[0].connectionId!,scope=createHash('sha256').update(identity+':'+grantId).digest('hex'),value=await run(client,grantId,scope,signal);await current();
  const latest=await client.gmailAccounts(signal);if(!latest.some(a=>a.connectionId===grantId&&a.connected&&a.grantedCapabilities.includes(capability)))throw Error('Gmail permission changed.');await current();return value;
 }
 return {
  async calendarSources(parent?:AbortSignal){
   return verified(async(client,grantId,scope,signal)=>{
    const account=(await client.gmailAccounts(signal)).find(a=>a.connectionId===grantId)!;
    return (await client.googleCalendars(grantId,signal)).filter(row=>['reader','writer','owner'].includes(row.accessRole)).map(row=>({...row,provider:'google',side:'owner',grantId:`alpha-google:${scope}`,connectorAccountId:`alpha-google:${scope}`,accountEmail:account.label,includeInFeed:true,selectionVersion:1}));
   },parent,'google.calendar.read');
  },
  async calendarFeed(input:{grantId:string;calendarId:string;timeMin:string;timeMax:string;timeZone:string},parent?:AbortSignal){
   return verified(async(client,grantId,scope,signal)=>{
    if(input.grantId!==`alpha-google:${scope}`)throw Error('Select a calendar from the current owner connection.');
    const calendar=(await client.googleCalendars(grantId,signal)).find(row=>row.calendarId===input.calendarId&&['reader','writer','owner'].includes(row.accessRole));
    if(!calendar)throw Error('This calendar is not currently readable.');
    const result=await client.googleCalendarFeed(grantId,input.calendarId,{timeMin:input.timeMin,timeMax:input.timeMax,timeZone:input.timeZone},signal);
    const key={provider:'google',side:'owner',grantId:input.grantId,connectorAccountId:input.grantId,calendarId:input.calendarId};
    return {...result,source:'synced',state:'complete',timeMin:input.timeMin,timeMax:input.timeMax,
     sources:[{key,summary:calendar.summary,accessRole:calendar.accessRole,visibility:'details',status:'fresh',syncedAt:result.syncedAt,error:null}],
     events:result.events.map(event=>({...event,id:`${input.grantId}:${event.externalId}`,agentId:'',provider:'google',side:'owner',grantId:input.grantId,connectorAccountId:input.grantId,syncedAt:result.syncedAt,updatedAt:typeof event.metadata.updated==='string'?event.metadata.updated:result.syncedAt,calendarSummary:calendar.summary}))};
   },parent,'google.calendar.read');
  },
  async list({limit=25,query='',since}:{limit?:number;query?:string;since?:string},parent?:AbortSignal){
   if(!Number.isSafeInteger(limit)||limit<1||limit>51||typeof query!=='string'||query.length>4096)throw Error('Choose a Gmail read limit from 1 to 50 plus its overflow probe.');
   const parts=[query||'in:inbox'];if(since!==undefined){const date=Date.parse(since);if(!Number.isFinite(date))throw Error('Invalid Gmail read date.');parts.push(`after:${Math.floor(date/1000)}`);}
   return verified(async(client,grantId,scope,signal)=>{
    const result=await client.gmailSearch(grantId,parts.join(' '),signal,limit<=10?10:limit<=25?25:50);
    const rows=[...result.messages];
    if(rows.length<limit&&result.nextPageToken){
     if(!result.mailboxHistoryId)throw Error('The mailbox cannot verify this paged read. Use a smaller limit.');
     const next=await client.gmailSearch(grantId,parts.join(' '),signal,10,result.nextPageToken);
     if(next.mailboxHistoryId!==result.mailboxHistoryId)throw Error('The Gmail mailbox changed during this read. Search again.');
     const ids=new Set(rows.map(row=>row.id));for(const row of next.messages)if(!ids.has(row.id)){ids.add(row.id);rows.push(row);}
    }
    return rows.slice(0,limit).map(row=>{if(!Number.isFinite(Date.parse(row.receivedAt)))throw Error('Gmail returned an invalid received date.');return {id:`alpha-gmail:${scope}:${row.id}`,platform:'gmail' as const,channel:'gmail',senderName:row.from,snippet:decodeBasicHtmlEntities(row.snippet),receivedAt:row.receivedAt,threadTopic:decodeBasicHtmlEntities(row.subject),unread:row.unread};});
   },parent);
  },
  async message(messageId:string,parent?:AbortSignal){
   return verified(async(client,grantId,scope,signal)=>{
    const prefix=`alpha-gmail:${scope}:`;if(!messageId.startsWith(prefix))throw Error('Select an email from the current owner and Gmail account.');
    const providerId=messageId.slice(prefix.length);if(!/^[A-Za-z0-9_-]{1,160}$/.test(providerId))throw Error('Invalid Gmail message identity.');
    const result=await client.gmailRead(grantId,providerId,signal);return {id:messageId,from:result.message.from,subject:decodeBasicHtmlEntities(result.message.subject),bodyText:result.bodyText,receivedAt:result.message.receivedAt,unread:result.message.unread,hasAttachments:result.message.hasAttachments===true};
   },parent);
  }
 };
}
