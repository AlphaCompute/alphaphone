// Real Inbox adapter lifecycle with an account-bound provider fixture, no real mail.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {composerKind,composerContent,reviewBinding,reviewBindingRefusal, InboxOperation } from '../apps/app/src/runtime/inbox-operation.ts';
import { reviewMailAttachment } from '../apps/app/src/runtime/inbox-attachment.ts';
import { reviewMailContext, validateMailContext } from '../apps/app/src/runtime/reviewed-mail-context.ts';
import { CloudProtocolError, safeMailLink } from '../apps/app/src/runtime/cloud-protocol.ts';
import { reviewOpaqueAttachment, checkOutgoingAttachments, outgoingAttachmentLimits } from '../apps/app/src/runtime/inbox-operation.ts';
import * as mailbox from '../apps/app/src/runtime/gmail-mailbox.ts';
import { presentHomeInboxStatus } from '../apps/app/src/prototype/home-cards.ts';
import { formatTime } from '../apps/app/src/prototype/locale-time.ts';
let session='account-a',agent='remote-a',releaseSearch,delay=false,failNext=null,connected=true,confirmAnswer=true;
const slots=new Map(),searches=[],disconnects=[],toasts=[],events=[],initiates=[],handoffs=[];
// Authorization handoff: off until the reconnect section turns it on. `handoff` holds the browser open.
let oauthUrl=null,handoff=null;
const mail=(id,extra={})=>({id,threadId:'thread-'+id,subject:'Fixture '+id,from:'Sender',fromEmail:'sender@example.invalid',to:['fixture@example.invalid'],snippet:'Preview',receivedAt:'2026-09-30T00:00:00Z',unread:false,...extra});
const pages={'in:inbox':[[mail('mail-1',{unread:true}),mail('mail-2')],[mail('mail-2'),mail('mail-3')]],'in:sent':[[mail('sent-1',{to:['friend@example.invalid']})]],'from:fixture':[[mail('mail-1')]]};
const client={
 gmailAccounts:async()=>[{connectionId:'grant-a',label:'Fixture account',connected,grantedCapabilities:connected?['google.gmail.triage']:[]}],
 gmailSearch:async(_grant,query,_signal,size,pageToken)=>{searches.push({query,size,pageToken:pageToken??null});if(failNext){const error=failNext;failNext=null;throw error;}
  const list=pages[query]||[[]],index=pageToken?Number(pageToken.slice(5)):0,result={messages:list[index]||[],syncedAt:'revision',nextPageToken:index+1<list.length?'page-'+(index+1):null};
  if(delay)return new Promise(resolve=>{releaseSearch=()=>resolve(result);});return result;},
 gmailRead:async(_grant,id)=>({message:Object.values(pages).flat(2).find(m=>m.id===id),bodyText:'Fixture body'}),
 disconnectGmail:async(id)=>{disconnects.push(id);connected=false;},
 initiateGmail:async(...args)=>{initiates.push(args.slice(1));if(!oauthUrl)throw new Error('No automatic OAuth');return oauthUrl;},
};
const listeners=new Set();
const controller={getCloudClient:()=>session?{client,sessionId:session}:null,getSnapshot:()=>({session:{sessionId:agent},cloudAccount:session?{environment:'production',userId:'fixture-owner',sessionId:session}:null}),subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},rejectCloudSession:()=>false,open:()=>{}};
class Shell{renderVals(){return {};}constructor(){this.st={q:null,compose:null};}componentDidMount(){}componentWillUnmount(){}vset(_,p){Object.assign(this.st,p);}}
const views={inbox:{state:{}}};
const strip=async(file,name)=>{let source=await readFile(new URL(`../apps/app/src/prototype/${file}`,import.meta.url),'utf8');source=source.replace(/^import .*;\n/gm,'').replace(/^export (?=(?:async )?function |const |let |interface |type )/gm,'')+`\n${[].concat(name).map(n=>`globalThis.${n}=${n};`).join('')}`;return '{'+stripTypeScriptTypes(source,{mode:'transform'})+'}';};
const windowFixture={addEventListener:(name,fn)=>events.push({name,fn}),removeEventListener:()=>{},dispatchEvent:event=>{events.push({dispatched:event.type,detail:event.detail});return true;},confirm:()=>confirmAnswer};
class CustomEvent{constructor(type,init){this.type=type;this.detail=init?.detail;}}
const inboxUnsaved=()=>({ready:Promise.resolve(),available:false,conflict:false,error:false,status:'',edit(){},clear:async()=>{},retire(){},resume(){}});
const sandbox={URL,presentHomeInboxStatus,inboxUnsaved,InboxOperation,composerKind,composerContent,reviewBinding,reviewBindingRefusal,safeMailLink,reviewOpaqueAttachment,checkOutgoingAttachments,outgoingAttachmentLimits,reviewMailAttachment,reviewMailContext,validateMailContext,...mailbox,registerPlugin:()=>({cancel:async()=>{}}),crypto:globalThis.crypto,TextEncoder,structuredClone,secureConnectionStore:{read:async key=>slots.get(key)??null,compareExchange:async(key,prior,next)=>{if(JSON.stringify(slots.get(key)??null)!==JSON.stringify(prior))return {status:'conflict'};if(next===null)slots.delete(key);else slots.set(key,next);return {status:'saved'};}},connectionController:controller,DailyApps:{addListener:async()=>({remove:async()=>{}})},openConnectionBrowser:async(url,signal)=>{handoffs.push(url);if(!oauthUrl)throw new Error('No automatic OAuth');if(handoff)await new Promise((resolve,reject)=>{handoff.resolve=resolve;signal.addEventListener('abort',()=>reject(signal.reason),{once:true});});},queueMicrotask,setTimeout,AbortController,DOMException,Date,console,window:windowFixture,CustomEvent,document:{documentElement:{dataset:{connectionMode:'live'}}}};
vm.createContext(sandbox);
for(const [file,name] of [['inbox-provider-controls.ts','inboxProviderControls'],['inbox-drafts.ts','inboxDrafts'],['inbox-cloud-adapter.ts',['installInboxCloudAdapter','inboxAttention','openInbox','linkifyMailText','linkTextMismatch']]])vm.runInContext(await strip(file,name),sandbox);
sandbox.installInboxCloudAdapter(Shell,views);
const shell=new Shell();shell.componentDidMount();
const swipes=new Map();const api={sw:fn=>{const handlers={down(){},up(){}};swipes.set(handlers,fn);return handlers;},swallowed:()=>false,get:()=>shell.st,isActive:()=>true,set:p=>shell.vset('inbox',p),toast:text=>toasts.push(text)};
const render=()=>views.inbox.render(shell.st,api);const tick=async()=>{for(let i=0;i<6;i++)await new Promise(r=>setTimeout(r,0));};
const local=value=>JSON.parse(JSON.stringify(value));// vm-realm arrays compare by value
const chip=label=>{const found=render().chips.find(c=>c.label===label);assert.ok(found,`chip ${label} in ${render().chips.map(c=>c.label)}`);return found;};

assert.equal(shell.renderVals().homeInboxTitle,'Inbox');assert.equal(searches.length,0,'Home does not discover accounts or read mail');
// Home's read time is the completed first-page read; a later page or a local recount never moves it.
const realNow=Date.now,noon=new Date();noon.setHours(12,0,0,0);const clock=minutes=>{const value=noon.getTime()+minutes*60000;Date.now=()=>value;return formatTime(new Date(value));};
const firstRead=clock(0);
render();await tick();
assert.equal(shell.renderVals().homeInboxStatus,`From loaded messages · Read ${firstRead}`,'a partial page names its read time');
assert.equal(shell.renderVals().homeInboxCount,'1+ unread');assert.deepEqual(local(shell.renderVals().homeInboxRows),[{subject:'Fixture mail-1',from:'Sender'}]);
assert.deepEqual(searches.map(s=>s.query),['in:inbox'],'opening Inbox loads the connected account without another tap');
assert.equal(render().rows.length,2);assert.equal(views.inbox.badge(),true,'badge reflects a real unread provider message');
assert.equal(render().hasMore,true,'provider page token offers Load more');
const laterPage=clock(7);assert.notEqual(laterPage,firstRead);
render().loadMore();await tick();
assert.deepEqual(searches.at(-1),{query:'in:inbox',size:25,pageToken:'page-1'},'Load more sends the opaque provider page token');
assert.match(shell.renderVals().homeInboxStatus,new RegExp(` · Read ${firstRead.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}$`),'a later page keeps the time of the oldest data counted');
assert.equal(shell.renderVals().homeInboxDescription,shell.renderVals().homeInboxStatus);
assert.deepEqual(local(render().rows.map(r=>r.subj)),['Fixture mail-1','Fixture mail-2','Fixture mail-3'],'pages append without duplicates');
assert.equal(render().hasMore,false,'last page has no Load more');
assert.equal(shell.renderVals().homeInboxCount,'1 unread','complete paging removes the lower-bound qualifier');const homeSearches=searches.length;for(let i=0;i<5;i++)shell.renderVals();assert.equal(searches.length,homeSearches,'Home rerenders never fetch mail');
render();[...swipes.values()].at(-1)(-120,4);await tick();assert.match(toasts.at(-1),/Authorize mailbox changes/,'swipe without the grant changes nothing');
const refreshed=clock(19);
chip('Refresh').pick();await tick();assert.deepEqual(searches.at(-1),{query:'in:inbox',size:25,pageToken:null},'Refresh restarts from the first page');
assert.match(shell.renderVals().homeInboxStatus,new RegExp(`Read ${refreshed.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}$`),'a completed refresh moves the read time');Date.now=realNow;
assert.equal(render().rows.length,2);
render().rows[0].open();await tick();assert.equal(render().d.body,'Fixture body');
agent='remote-b';for(const fn of listeners)fn();assert.equal(shell.st.nativeMailSelection,null,'target change clears observation authority');assert.equal(render().d.body,'Fixture body','Cloud mailbox remains independent');
views.inbox.back(shell.st,api);
chip('Sent').pick();await tick();assert.equal(searches.at(-1).query,'in:sent','Sent folder uses an in:sent query');
assert.equal(render().rows[0].name,'To: friend@example.invalid','Sent rows show recipients');assert.equal(views.inbox.badge(),true,'Sent results do not clear the Inbox badge');assert.deepEqual(local(shell.renderVals().homeInboxRows),[{subject:'Fixture mail-1',from:'Sender'}],'Sent does not replace cached Inbox metadata');
chip('Inbox').pick();await tick();assert.equal(searches.at(-1).query,'in:inbox');
render().openSearch();assert.equal(render().rows.length,0,'entering search clears prior-query results');render().onQ({target:{value:'from:fixture'}});
delay=true;chip('Search Gmail').pick();await tick();assert.match(shell.renderVals().homeInboxStatus,/Updating email/);session='account-b';for(const fn of listeners)fn();releaseSearch();await tick();assert.equal(render().rows.length,0,'late previous-account results discarded');
assert.equal(views.inbox.badge(),false,'account change clears the badge');assert.equal(shell.renderVals().homeInboxHasRows,false,'account change retires cached subjects');
delay=false;session='account-a';for(const fn of listeners)fn();render().closeSearch();await tick();assert.equal(shell.st.q,null);
render();await tick();assert.equal(render().rows.length,2,'re-bound account loads again');

// Classified failures each offer an explicit Retry; nothing retries on its own.
for(const [error,kind,text] of [[new TypeError('Failed to fetch'),'offline',/offline/],[new CloudProtocolError('http',409),'revoked',/revoked or needs authorization/],[new CloudProtocolError('http',503),'unavailable',/unavailable/]]){
 failNext=error;const before=searches.length;chip('Refresh').pick();await tick();
 assert.equal(searches.length,before+1,'one attempt only');assert.match(render().emptyText,text,kind);assert.match(shell.renderVals().homeInboxStatus,/retry/,'Home keeps failure distinct from an empty Inbox');if(kind==='revoked')assert.equal(shell.renderVals().homeInboxHasRows,false,'revoked access drops cached subjects');
 if(kind==='revoked')chip('Reconnect Gmail');
 chip('Retry').pick();await tick();assert.equal(searches.length,before+2,'Retry is the explicit second attempt');assert.equal(render().rows.length,2);
}

// Reconnect and Authorize hand off to the system browser once per tap with the selected account's
// grants, then wait for Check connection. No mailbox read happens until then. Synthetic URL only.
oauthUrl='https://accounts.google.com/o/oauth2/v2/auth?client_id=fixture&state=synthetic';
const handoffReads=()=>searches.length;
failNext=new CloudProtocolError('http',409);chip('Refresh').pick();await tick();
for(const [label,permission] of [['Reconnect Gmail','read'],['Authorize Gmail sending','send'],['Authorize Gmail drafts','drafts'],['Authorize mailbox changes','mailbox']]){
 const before=initiates.length,reads=handoffReads();
 chip(label).pick();await tick();
 assert.deepEqual(local(initiates.slice(before)),[[permission,['google.gmail.triage']]],`${label}: one initiate with the permission and the selected account's grants`);
 assert.deepEqual(handoffs.slice(before),[oauthUrl],`${label}: the exact authorization URL opens once`);
 assert.equal(render().emptyText,'After authorizing Gmail, tap Check connection.',`${label}: the next step is named`);
 assert.equal(handoffReads(),reads,`${label}: nothing is read until Check connection`);
 if(label==='Reconnect Gmail'){chip('Check connection').pick();await tick();assert.equal(handoffReads(),reads+1,'Check connection reads the mailbox again');}
}
// A handoff the user cancels reports the cancellation, not a pending authorization.
handoff={};const cancelledAt=initiates.length;chip('Authorize Gmail sending').pick();await tick();
assert.equal(handoffs.length,cancelledAt+1);chip('Cancel').pick();await tick();
assert.equal(render().emptyText,'Gmail request cancelled');assert.notEqual(render().emptyText,'After authorizing Gmail, tap Check connection.');
// The Cloud account changes while the browser is open: the late result is not applied to the new one.
const switchedReads=handoffReads();chip('Authorize Gmail drafts').pick();await tick();
session='account-b';for(const fn of listeners)fn();handoff.resolve();await tick();
assert.notEqual(render().emptyText,'After authorizing Gmail, tap Check connection.','a handoff from the previous account is not applied');
assert.equal(handoffReads(),switchedReads,'nothing is read for the previous account');
handoff=null;oauthUrl=null;session='account-a';for(const fn of listeners)fn();render();await tick();
assert.equal(render().rows.length,2,'the account loads again after the switch back');

assert.equal(mailbox.classifyGmailFailure(new CloudProtocolError('http',409),'operation').kind,'stale','operation 409 is a stale review');
assert.equal(mailbox.classifyGmailFailure(new CloudProtocolError('http',500),'read',false).kind,'offline','browser offline wins');

// Content shared from Notes becomes a reviewed local draft, not a silent no-op.
shell.st.compose={to:'Speaker name',subject:'Shared note',body:'· line one'};render();await tick();render();await tick();
assert.equal(shell.st.compose,null,'shared compose request is consumed once');
const composed=render();assert.equal(composed.composing,true,'shared content opens a composer');assert.equal(composed.c.subject,'Shared note');assert.equal(composed.c.body,'· line one');
assert.deepEqual(local(composed.c.chips),[],'non-address recipients are not guessed');assert.match(composed.c.status,/nothing has been sent/);
assert.equal(composed.c.multi,false,'From switcher only appears with more than one account');
assert.deepEqual(local(views.inbox.suggestions(shell.st)),['Help me write this email']);
views.inbox.back(shell.st,api);composed.c.discard();render().c.confirmDiscard();await tick();
assert.deepEqual(local(views.inbox.suggestions(shell.st)),['Help me write an email'],'no unwired inbox automation chips (organize-inbox removed)');
assert.equal(render().composing,false,'discarded shared draft is gone');
shell.st.compose={subject:'Photo',body:'',attach:['photo-1']};render();await tick();render();await tick();
assert.equal(render().c.subject,'Photo');assert.deepEqual(local(render().c.atts),[],'prototype item ids are never turned into attachments');assert.match(render().c.status,/not attached automatically/);
views.inbox.back(shell.st,api);render().c.discard();render().c.confirmDiscard();await tick();
const discardsBefore=toasts.length;shell.st.compose={subject:'Second share',body:''};render();await tick();render();await tick();assert.equal(render().c.subject,'Second share');
shell.st.compose={subject:'Third share',body:''};render();await tick();render();await tick();assert.equal(render().c.subject,'Second share','an open draft is never overwritten');assert.match(toasts.slice(discardsBefore).join(' '),/shared content was not added/);
views.inbox.back(shell.st,api);render().c.discard();render().c.confirmDiscard();await tick();

// Only a complete successful empty page can claim no unread mail.
pages['in:inbox']=[[]];chip('Refresh').pick();await tick();assert.equal(shell.renderVals().homeInboxTitle,'No unread email');assert.equal(shell.renderVals().homeInboxHasRows,false);
views.inbox.onLeave();const leftSearches=searches.length;assert.equal(shell.renderVals().homeInboxTitle,'No unread email','Home retains metadata after full messages are retired');assert.equal(searches.length,leftSearches,'returning Home never fetches mail');render();await tick();

// Disconnect requires confirmation and reports the read-back state.
confirmAnswer=false;chip('Disconnect Gmail').pick();await tick();assert.deepEqual(disconnects,[],'cancelled confirmation sends nothing');
confirmAnswer=true;chip('Disconnect Gmail').pick();await tick();
assert.deepEqual(disconnects,['grant-a']);assert.match(render().emptyText,/is disconnected/);assert.equal(render().rows.length,0);
assert.equal(shell.renderVals().homeInboxTitle,'Connect email');assert.equal(render().chips.some(c=>c.label==='Disconnect Gmail'),false);assert.ok(events.some(e=>e.dispatched==='alpha:gmail-accounts-changed'&&e.detail.source==='inbox'));
shell.componentWillUnmount();
console.log('PASS: Inbox auto-load, Refresh, provider paging, Sent folder, unread badge, account/query fences, classified errors with explicit Retry, Reconnect/Authorize handoff with the selected grants, shared compose prefill, honest chips and confirmed disconnect. Provider fixture only.');
