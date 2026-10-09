// Inbox attention summary, bounded unread probe, links, folders, provider drafts, multi/forwarded
// attachments, opaque save and "Use in email" against the real adapter with a closed provider
// fixture. No network, real account or mail; nothing is dispatched.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import { InboxOperation, reviewOpaqueAttachment, checkOutgoingAttachments, outgoingAttachmentLimits } from '../apps/app/src/runtime/inbox-operation.ts';
import { reviewMailAttachment } from '../apps/app/src/runtime/inbox-attachment.ts';
import { reviewMailContext, validateMailContext } from '../apps/app/src/runtime/reviewed-mail-context.ts';
import { safeMailLink } from '../apps/app/src/runtime/cloud-protocol.ts';
import * as mailbox from '../apps/app/src/runtime/gmail-mailbox.ts';

const strip=async(file,names)=>{let source=await readFile(new URL(`../apps/app/src/prototype/${file}`,import.meta.url),'utf8');source=source.replace(/^import .*;\n/gm,'').replace(/^export (?=(?:async )?function |const |let |interface |type )/gm,'')+`\n${[].concat(names).map(n=>`globalThis.${n}=${n};`).join('')}`;return '{'+stripTypeScriptTypes(source,{mode:'transform'})+'}';};
const digest=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
// vm-realm values compare by JSON value.
const deq=(actual,expected,message)=>assert.deepEqual(actual===undefined?undefined:JSON.parse(JSON.stringify(actual)),expected,message);
const b64=text=>Buffer.from(text).toString('base64');
// The adapter compares against the fixture clock below, so "today" is that clock's local day.
const FIXTURE_NOW=Date.UTC(2026,9,8,12);
const today=new Date(FIXTURE_NOW);today.setHours(9,41,0,0);
const mail=(id,extra={})=>({id,threadId:'thread-'+id,subject:'Fixture '+id,from:'Sender',fromEmail:'sender@example.invalid',to:['owner@example.invalid'],snippet:'Preview',receivedAt:'2026-09-30T00:00:00Z',unread:false,...extra});
const inboxPage=[mail('m1',{unread:true,hasAttachments:true,receivedAt:today.toISOString()}),mail('m2',{unread:true}),mail('m3')];

function scenario({caps={},accounts=null}={}){
 let session='session-a',clock=FIXTURE_NOW,probeFail=null,probeGate=null;
 const calls=[],toasts=[],prepared=[],dispatched=[],opened=[],saved=[],navigations=[],confirms=[],resume=[];let confirmAnswer=true;
 const defaultAccounts=[{connectionId:'grant-a',label:'Fixture account',connected:true,grantedCapabilities:['google.gmail.triage']}];
 const capabilities={version:1,from:'owner@example.invalid',threads:true,send:true,providerDrafts:true,mailboxMutations:true,attachments:true,providerExactlyOnce:false,atomicDraftReplacement:false,readState:false,draftsList:false,forwardAttachments:false,opaqueAttachments:false,searchTrash:false,attachmentPolicy:{maximumOutgoing:1,maximumBytes:5242880,maximumTotalBytes:5242880},...caps};
 const bodies={m1:{bodyText:'See https://docs.example.org/plan?x=1. and the old http://insecure.example.net page',links:[{href:'https://tracker.attacker.invalid/r',text:'www.bank.example.com'},{href:'https://docs.example.org/plan?x=1',text:'the plan'}],attachments:[{partId:'1',name:'report.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',size:12,supported:false},{partId:'2',name:'notes.txt',mimeType:'text/plain',size:5,supported:true}]}};
 const client={
  gmailAccounts:async()=>{calls.push('accounts');return accounts||defaultAccounts;},
  gmailSearch:async(_grant,query,_signal,size,pageToken)=>{calls.push(['search',query,size,pageToken??null]);if(query==='in:inbox is:unread'&&probeGate)await probeGate;if(query==='in:inbox is:unread'&&probeFail){throw probeFail;}
   if(query==='in:inbox is:unread')return {messages:inboxPage.filter(m=>m.unread),syncedAt:'2026-10-08T12:00:00Z',nextPageToken:null};
   if(query==='in:inbox')return {messages:inboxPage,syncedAt:'2026-10-08T12:01:00Z',nextPageToken:null};
   return {messages:query==='in:archive'?[mail('arch-1')]:query==='in:trash'?[mail('trash-1')]:[],syncedAt:'2026-10-08T12:02:00Z',nextPageToken:null};},
  gmailRead:async(_grant,id)=>{calls.push(['read',id]);const m=inboxPage.find(x=>x.id===id)||mail(id);return {message:m,bodyText:bodies[id]?.bodyText||'Plain body',links:bodies[id]?.links||[]};},
  gmailThread:async(_grant,threadId)=>{calls.push(['thread',threadId]);const id=threadId.slice(7),m=inboxPage.find(x=>x.id===id)||mail(id);return {messages:[{message:m,bodyText:bodies[id]?.bodyText||'Plain body',links:bodies[id]?.links||[],historyId:'h-'+id,attachments:bodies[id]?.attachments||[]}],total:1,offset:0,historyId:'th',nextOffset:null};},
  gmailInboxCapabilities:async()=>capabilities,
  gmailDrafts:async()=>{calls.push('drafts');return {drafts:[{draftId:'d1',messageId:'dm1',subject:'Plan draft',to:['friend@example.invalid'],snippet:'Draft body',updatedAt:today.toISOString()},{draftId:'d2',messageId:'dm2',subject:'Re: thread',to:[],snippet:'',updatedAt:null}],nextPageToken:null};},
  gmailDraftContent:async(_grant,draftId)=>{calls.push(['draft',draftId]);return draftId==='d1'?{draftId,messageId:'dm1',providerDigest:'a'.repeat(64),to:['friend@example.invalid'],cc:[],bcc:[],subject:'Plan draft',bodyText:'Draft body',threaded:false,attachmentCount:0,plainText:true}:{draftId,messageId:'dm2',providerDigest:'b'.repeat(64),to:[],cc:[],bcc:[],subject:'Re: thread',bodyText:'',threaded:true,attachmentCount:0,plainText:true};},
  gmailOpaqueAttachment:async(_grant,messageId,partId,historyId)=>{calls.push(['opaque',messageId,partId,historyId]);const data=b64('PK\u0003\u0004docx');return {name:'report.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',dataBase64:data,size:8,sha256:await digest('PK\u0003\u0004docx'),opaque:true};},
  gmailAttachment:async()=>{calls.push('attachment');throw new Error('not used');},
  gmailPrepareOperation:async(grant,requestId,proposal)=>{prepared.push(structuredClone(proposal));const files=await Promise.all((proposal.attachments||[]).map(async f=>{const {text,...m}=await reviewMailAttachment(f);return m;}));
   const review={...proposal,from:'owner@example.invalid',attachments:files,...(proposal.forwardAttachments?{forwardSource:{messageId:proposal.forwardAttachments.messageId,historyId:proposal.forwardAttachments.historyId},forwardedAttachments:proposal.forwardAttachments.partIds.map(partId=>({partId,name:'notes.txt',mimeType:'text/plain',size:5,sha256:'c'.repeat(64)}))}:{})};
   delete review.forwardAttachments;return {receipt:{requestId,kind:proposal.kind,state:'prepared',reviewDigest:await digest(JSON.stringify(review)),providerResult:null,rejectionCode:null},review};},
  gmailDispatchOperation:async()=>{dispatched.push(1);throw new Error('No dispatch in this fixture');},
  gmailOperation:async()=>{throw new Error('No receipt');},
 };
 const listeners=new Set(),slots=new Map();
 const controller={getCloudClient:()=>session?{client,sessionId:session}:null,getSnapshot:()=>({session:null,cloudAccount:session?{environment:'production',userId:'fixture-owner',sessionId:session}:null}),subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},rejectCloudSession:()=>false,open:()=>{}};
 class Shell{constructor(){this.st={q:null,compose:null};this.opened=[];}componentDidMount(){}componentWillUnmount(){}vset(_,p){Object.assign(this.st,p);}openView(view,patch){this.opened.push([view,patch]);}browserNavigateApproved(href){navigations.push(href);return Promise.resolve();}}
 const views={inbox:{state:{}}};
 let selectionCount=0;const files=[{name:'a.txt',mimeType:'text/plain',text:'alpha'},{name:'b.txt',mimeType:'text/plain',text:'bravo'},{name:'c.txt',mimeType:'text/plain',text:'charlie'}];
 const native={cancel:async()=>{},openReviewed:async input=>{opened.push(input);return {message:'opened'};},saveReviewed:async input=>{saved.push(input);return {status:'saved',message:'Saved to the chosen destination. Exact bytes verified.'};},
  readSelected:async({selectionId})=>{const f=files[Number(selectionId.slice(4))%3];return {name:f.name,mimeType:f.mimeType,dataBase64:b64(f.text),size:f.text.length,sha256:await digest(f.text)};}};
 class FixedDate extends Date{constructor(...a){super(...(a.length?a:[clock]));}static now(){return clock;}}
 const windowFixture={addEventListener(){},removeEventListener(){},dispatchEvent(){return true;},confirm:text=>{confirms.push(text);return confirmAnswer;}};
 const inboxUnsaved=()=>({ready:Promise.resolve(),available:false,conflict:false,error:false,status:'',edit(){},clear:async()=>{},retire(){},resume(){}});
 const sandbox={URL,Date:FixedDate,inboxUnsaved,InboxOperation,reviewMailAttachment,reviewOpaqueAttachment,checkOutgoingAttachments,outgoingAttachmentLimits,safeMailLink,reviewMailContext,validateMailContext,...mailbox,
  registerPlugin:()=>native,crypto:globalThis.crypto,TextEncoder,structuredClone,
  secureConnectionStore:{read:async key=>structuredClone(slots.get(key)??null),compareExchange:async(key,prior,next)=>{if(JSON.stringify(slots.get(key)??null)!==JSON.stringify(prior))return {status:'conflict'};if(next===null)slots.delete(key);else slots.set(key,structuredClone(next));return {status:'saved'};}},
  connectionController:controller,
  DailyApps:{addListener:async(name,fn)=>{if(name==='appResumed')resume.push(fn);return {remove:async()=>{}};},perform:async()=>({status:'selected',selectionId:'sel-'+(selectionCount++),name:'file'}),forgetSelected:async()=>{}},
  openConnectionBrowser:async()=>{throw new Error('No OAuth');},queueMicrotask,setTimeout,AbortController,DOMException,console,window:windowFixture,CustomEvent:class{constructor(t,i){this.type=t;this.detail=i?.detail;}},document:{documentElement:{dataset:{connectionMode:'live'}}},atob,btoa};
 return {sandbox,client,calls,toasts,prepared,dispatched,opened,saved,navigations,confirms,resume,views,Shell,listeners,slots,
  setSession:v=>{session=v;for(const fn of listeners)fn();},advance:ms=>{clock+=ms;},gate:()=>{let open;probeGate=new Promise(r=>{open=r;});return ()=>{probeGate=null;open();};},failProbe:e=>{probeFail=e;},answer:v=>{confirmAnswer=v;}};
}
async function boot(options){
 const s=scenario(options);vm.createContext(s.sandbox);
 for(const [file,names] of [['inbox-provider-controls.ts','inboxProviderControls'],['inbox-drafts.ts','inboxDrafts'],['inbox-cloud-adapter.ts',['installInboxCloudAdapter','inboxAttention','openInbox','linkifyMailText','linkTextMismatch','INBOX_PROBE_FLOOR_MS']]])vm.runInContext(await strip(file,names),s.sandbox);
 const attentionBefore=JSON.parse(JSON.stringify(s.sandbox.inboxAttention()));
 s.sandbox.installInboxCloudAdapter(s.Shell,s.views);const shell=new s.Shell();
 let active=false;const api={sw:()=>({down(){},up(){}}),swallowed:()=>false,get:()=>shell.st,isActive:()=>active,set:p=>shell.vset('inbox',p),toast:t=>s.toasts.push(t)};
 const tick=async()=>{for(let i=0;i<40;i++)await new Promise(r=>setTimeout(r,0));};
 const render=()=>s.views.inbox.render(shell.st,api);
 const chip=label=>{const found=render().chips.find(c=>c.label===label);assert.ok(found,`chip ${label} in ${render().chips.map(c=>c.label)}`);return found;};
 return {...s,shell,api,tick,render,chip,attentionBefore,setActive:v=>{active=v;},attention:()=>JSON.parse(JSON.stringify(s.sandbox.inboxAttention())),mount:()=>shell.componentDidMount()};
}
const searches=t=>t.calls.filter(c=>Array.isArray(c)&&c[0]==='search');

// 1. Attention summary and the bounded unread probe.
{
 const t=await boot();
 deq(t.attentionBefore,{state:'not-connected',unread:0,unreadMore:false,source:null,updatedAt:null},'not connected before install');
 t.mount();await t.tick();
 deq(searches(t),[['search','in:inbox is:unread',10,null]],'cold start: one bounded unread metadata query');
 deq(t.attention(),{state:'ready',unread:2,unreadMore:false,source:'Fixture account',updatedAt:'2026-10-08T12:00:00Z'});
 assert.equal(t.views.inbox.badge(),true,'badge from the probe');
 assert.equal(t.calls.some(c=>Array.isArray(c)&&c[0]==='read'),false,'the probe reads no message body');
 for(const fn of t.resume)fn();await t.tick();
 assert.equal(searches(t).length,1,'resume inside the 5 minute floor sends nothing');
 t.advance(5*60*1000);t.failProbe(Object.assign(new Error('Service unavailable'),{name:'CloudProtocolError',code:'http',status:503}));
 for(const fn of t.resume)fn();for(const fn of t.resume)fn();await t.tick();
 assert.equal(searches(t).length,2,'one probe per resume after the floor, never two in flight');
 assert.equal(t.calls.filter(c=>c==='accounts').length,1,'a later resume reuses the resolved account: only the unread query is sent');
 assert.equal(t.attention().state,'error');assert.equal(t.views.inbox.badge(),false,'a failed probe never shows an old badge');
 t.failProbe(null);t.advance(5*60*1000);
 // Opening Inbox loads in:inbox; its unread rows set the summary.
 t.setActive(true);t.render();await t.tick();
 assert.equal(searches(t).at(-1)[1],'in:inbox');
 deq(t.attention(),{state:'ready',unread:2,unreadMore:false,source:'Fixture account',updatedAt:'2026-10-08T12:01:00Z'});
 const rows=t.render().rows;assert.equal(rows[0].clip,true,'search hasAttachments shows the clip');assert.match(rows[0].label,/has attachments/);assert.equal(rows[1].clip,false);
 assert.match(rows[0].time,/9:41|09:41/,'today shows a time');assert.doesNotMatch(rows[1].time,/:/,'older mail shows a date');
 // Leaving marks the summary stale; the leave probe is subject to the same floor.
 t.setActive(false);t.views.inbox.onLeave();
 assert.equal(t.attention().state,'stale');assert.equal(t.views.inbox.badge(),true,'a just-loaded value stays visible while younger than the floor');
 await t.tick();assert.equal(t.views.inbox.badge(),true,'the leave probe confirms the current unread state');
 assert.equal(searches(t).filter(c=>c[1]==='in:inbox is:unread').length,3,'leaving after the floor probes once');
 assert.equal(t.attention().state,'ready');
 t.views.inbox.onLeave();await t.tick();
 assert.equal(t.attention().state,'stale','a second leave inside the floor stays stale');
 assert.equal(searches(t).filter(c=>c[1]==='in:inbox is:unread').length,3);
 assert.equal(t.views.inbox.badge(),true);t.advance(5*60*1000);assert.equal(t.views.inbox.badge(),false,'a stale value older than the floor is never shown');
 t.sandbox.openInbox();deq(JSON.parse(JSON.stringify(t.shell.opened)),[['inbox',{open:null,q:null}]],'openInbox opens the Inbox list for goTriage');
 t.setSession(null);await t.tick();assert.equal(t.attention().state,'not-connected','signing out clears the summary');
 t.shell.componentWillUnmount();
}
// 1b. A probe answer that arrives after an open Inbox loaded in:inbox never replaces the loaded summary.
{
 const t=await boot();const release=t.gate();
 t.mount();await t.tick();assert.equal(t.attention().state,'loading');
 t.setActive(true);t.render();await t.tick();
 deq(t.attention(),{state:'ready',unread:2,unreadMore:false,source:'Fixture account',updatedAt:'2026-10-08T12:01:00Z'},'the loaded list sets the summary');
 release();await t.tick();
 assert.equal(t.attention().updatedAt,'2026-10-08T12:01:00Z','the late probe answer is dropped');
 t.shell.componentWillUnmount();
}
// 2. No readable account: not-connected without a mail query.
{
 const t=await boot({accounts:[{connectionId:'grant-x',label:'Calendar only',connected:true,grantedCapabilities:[]}]});
 t.mount();await t.tick();
 assert.equal(t.attention().state,'not-connected');assert.equal(searches(t).length,0,'no mail query without a Gmail grant');
 t.shell.componentWillUnmount();
}
// 3. Links: provider links and plain-text https URLs, origin review, Browser only, no remote loads.
{
 deq(JSON.parse(JSON.stringify((await boot()).sandbox.linkifyMailText('Go to https://a.example.org/x). Or (https://b.example.org/y_(z)) and http://c.example.org'))).map(l=>l.href),['https://a.example.org/x','https://b.example.org/y_(z)']);
 const t=await boot({caps:{opaqueAttachments:true,forwardAttachments:true,attachmentPolicy:{maximumOutgoing:10,maximumBytes:5242880,maximumTotalBytes:5242880}}});
 t.mount();t.setActive(true);t.render();await t.tick();
 t.render().rows[0].open();await t.tick();
 const d=t.render().d;assert.equal(d.hasLinks,true);
 deq(d.links.map(l=>[l.href,l.mismatch]),[['https://tracker.attacker.invalid/r',true],['https://docs.example.org/plan?x=1',false]],'HTML links first, plain-text URL deduplicated, http dropped');
 t.answer(false);d.links[0].open();assert.equal(t.navigations.length,0,'declined review opens nothing');assert.match(t.confirms.at(-1),/tracker\.attacker\.invalid/);assert.match(t.confirms.at(-1),/Warning: the email shows/);
 t.answer(true);d.links[1].open();await t.tick();deq(t.navigations,['https://docs.example.org/plan?x=1'],'approved link opens in Alpha Browser');
 // Unsupported attachment: opaque byte copy, Save to Files only, no preview or viewer.
 assert.match(d.atts[0].size,/No preview · Save to Files/);
 d.atts[0].open();await t.tick();const review=t.render().attachment;assert.ok(review,'opaque review shown');assert.equal(review.external,false,'no viewer handoff for opaque bytes');
 assert.match(review.text,/not previewed/);review.save();await t.tick();
 assert.equal(t.saved.length,1);assert.equal(t.saved[0].opaque,true);assert.equal(t.saved[0].reviewed,true);assert.equal(t.opened.length,0);
 deq(t.calls.filter(c=>Array.isArray(c)&&c[0]==='opaque'),[['opaque','m1','1','h-m1']],'opaque download bound to message, part and historyId');
 t.render().attachment.close();
 // Forward lists the source attachments; each can be removed; the proposal binds them to the message.
 t.render().d.forward();await t.tick();
 let c=t.render().c;deq(c.atts.map(a=>a.name),['report.docx (original)','notes.txt (original)']);assert.match(c.status,/Forwarding 2 original attachments/);
 c.atts[0].rm();c=t.render().c;deq(c.atts.map(a=>a.name),['notes.txt (original)'],'remove one forwarded file');
 c.chips;c.onTo({target:{value:'friend@example.invalid'}});c.toKey({key:'Enter',preventDefault(){}});
 t.render().c.send();await t.tick();
 deq(t.prepared.at(-1).forwardAttachments,{messageId:'m1',historyId:'h-m1',partIds:['2']});assert.equal(t.prepared.at(-1).mode,'forward');
 assert.equal(t.dispatched.length,0,'review only: nothing is sent without explicit confirmation');
 assert.equal(t.render().providerReview,true,'the exact review is shown');assert.equal(t.render().provider.canConfirm,true);
 t.shell.componentWillUnmount();
}
// 4. Multiple attachments added and removed individually; old single-attachment servers refuse a second.
for(const maximumOutgoing of [10,1]){
 const t=await boot({caps:{attachmentPolicy:{maximumOutgoing,maximumBytes:5242880,maximumTotalBytes:5242880}}});
 t.mount();t.setActive(true);t.render();await t.tick();
 t.render().compose();await t.tick();
 for(let i=0;i<3;i++){t.render().c.attach();await t.tick();}
 let c=t.render().c;
 if(maximumOutgoing===1){deq(c.atts.map(a=>a.name),['a.txt']);assert.match(t.toasts.at(-1),/one attachment per email/);assert.match(c.attachLabel,/Attach one/);t.shell.componentWillUnmount();continue;}
 deq(c.atts.map(a=>a.name),['a.txt','b.txt','c.txt'],'three attachments');assert.equal(c.attachLabel,'Attach PDFs, images or text files');
 c.atts[1].rm();c=t.render().c;deq(c.atts.map(a=>a.name),['a.txt','c.txt'],'remove the middle one only');
 c.atts[0].rm();t.render().c.attach();await t.tick();c=t.render().c;deq(c.atts.map(a=>a.name),['c.txt','a.txt']);
 c.onTo({target:{value:'friend@example.invalid'}});c.toKey({key:'Enter',preventDefault(){}});t.render().c.send();await t.tick();
deq(t.prepared.at(-1).attachments.map(a=>a.name),['c.txt','a.txt']);assert.equal(t.dispatched.length,0);
 assert.throws(()=>checkOutgoingAttachments(Array.from({length:11},(_,i)=>({name:i+'.txt',dataBase64:'YQ=='}))),/at most 10/);
 assert.throws(()=>checkOutgoingAttachments([{name:'x.txt',dataBase64:'YQ=='},{name:'X.TXT',dataBase64:'YQ=='}]),/same name/);
 assert.throws(()=>checkOutgoingAttachments([{name:'big.txt',dataBase64:'A'.repeat(7*1024*1024)}]),/in total/);
 t.shell.componentWillUnmount();
}
// 5. Folders: Drafts, Archive and Trash load the matching lists; opening a draft edits it as a provider draft.
{
 const plain=await boot();plain.mount();plain.setActive(true);plain.render();await plain.tick();
 deq(plain.render().chips.filter(c=>['Drafts','Archive','Trash'].includes(c.label)).map(c=>c.label),['Archive'],'old servers: only the query-based Archive folder');
 plain.shell.componentWillUnmount();
 const t=await boot({caps:{draftsList:true,searchTrash:true}});t.mount();t.setActive(true);t.render();await t.tick();
 t.chip('Archive').pick();await t.tick();assert.equal(searches(t).at(-1)[1],'in:archive');deq(t.render().rows.map(r=>r.subj),['Fixture arch-1']);
 t.chip('Trash').pick();await t.tick();assert.equal(searches(t).at(-1)[1],'in:trash');deq(t.render().rows.map(r=>r.subj),['Fixture trash-1']);
 t.chip('Drafts').pick();await t.tick();assert.ok(t.calls.includes('drafts'));
 const rows=t.render().rows;deq(rows.map(r=>r.name),['Draft to friend@example.invalid','Draft (no recipients)']);
 rows[1].open();await t.tick();assert.match(t.toasts.at(-1),/is a reply, has attachments or formatting/);assert.equal(t.render().composing,false,'threaded drafts stay in Gmail');
 t.render().rows[0].open();await t.tick();
 const c=t.render().c;assert.equal(t.render().composing,true);assert.equal(c.subject,'Plan draft');assert.equal(c.body,'Draft body');assert.match(c.status,/Saved locally|provider draft/i);
 c.saveProvider();await t.tick();
 deq({kind:t.prepared.at(-1).kind,draftId:t.prepared.at(-1).draftId,expectedDigest:t.prepared.at(-1).expectedDigest},{kind:'draft-replace',draftId:'d1',expectedDigest:'a'.repeat(64)},'editing replaces the same provider draft after review');
 assert.equal(t.dispatched.length,0);
 t.shell.componentWillUnmount();
}
// 6. Use in email: an agent suggestion becomes a local reply draft for the open message; nothing is sent.
{
 const t=await boot();t.mount();t.setActive(true);t.render();await t.tick();
 t.render().rows[1].open();await t.tick();
 assert.equal(t.views.inbox.useInEmail('Thanks, I will review it today.'),true);
 const c=t.render().c;assert.equal(c.body,'Thanks, I will review it today.');assert.equal(c.subject,'Re: Fixture m2');deq(c.chips.map(r=>r.name),['sender@example.invalid']);
 assert.match(c.status,/nothing has been sent/);assert.equal(t.prepared.length,0);assert.equal(t.dispatched.length,0);
 assert.equal(t.views.inbox.useInEmail('Second suggestion'),false,'an edited open draft is never overwritten');assert.match(t.toasts.at(-1),/not added/);
 deq(JSON.parse(JSON.stringify(t.views.inbox.suggestions(t.shell.st))),['Help me write this email']);
 t.shell.componentWillUnmount();
}
console.log('PASS: Inbox attention (not-connected/ready/error/stale), bounded unread probe with 5-minute floor, openInbox, reviewed HTTPS links in Browser, clip/time rows, Archive/Trash/Drafts folders, provider draft editing, three-attachment add/remove, forwarded source attachments, opaque Save to Files and Use in email. Fixture only; zero dispatches.');
