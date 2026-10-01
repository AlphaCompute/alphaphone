// Real Inbox adapter lifecycle with an account-bound provider fixture, no real mail.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
let session='account-a',agent='remote-a',releaseSearch,reads=0,delay=false;
const listeners=new Set(),mail={id:'mail-1',threadId:'thread',subject:'Fixture',from:'Sender',to:['fixture@example.invalid'],snippet:'Preview',receivedAt:'2026-09-30T00:00:00Z',unread:true};
const client={gmailAccounts:async()=>[{connectionId:'grant-a',label:'Fixture account',connected:true,grantedCapabilities:['google.gmail.triage']}],gmailSearch:async()=>{reads++;if(delay)return new Promise(resolve=>{releaseSearch=resolve;});return {messages:[mail],syncedAt:'revision'};},gmailRead:async()=>({message:mail,bodyText:'Fixture body'}),initiateGmail:async()=>{throw new Error('No automatic OAuth');}};
const controller={getCloudClient:()=>session?{client,sessionId:session}:null,getSnapshot:()=>({session:{sessionId:agent}}),subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},rejectCloudSession:()=>false,open:()=>{}};
class Shell{constructor(){this.st={q:null};}componentDidMount(){}componentWillUnmount(){}vset(_,p){Object.assign(this.st,p);}}
const views={inbox:{state:{}}};let source=await readFile(new URL('../apps/app/src/prototype/inbox-cloud-adapter.ts',import.meta.url),'utf8');source=source.replace(/^import .*;\n/gm,'').replace('export function','function')+'\nglobalThis.install=installInboxCloudAdapter;';
let draftSource=await readFile(new URL('../apps/app/src/prototype/inbox-drafts.ts',import.meta.url),'utf8');draftSource=draftSource.replace(/^import .*;\n/gm,'').replace('export function','function')+'\nglobalThis.inboxDrafts=inboxDrafts;';
const sandbox={crypto:globalThis.crypto,TextEncoder,secureConnectionStore:{read:async()=>null},connectionController:controller,DailyApps:{addListener:async()=>({remove:async()=>{}})},openConnectionBrowser:async()=>{throw new Error('No automatic OAuth');},queueMicrotask,AbortController,Date,console};vm.createContext(sandbox);vm.runInContext(stripTypeScriptTypes(draftSource,{mode:'transform'}),sandbox);vm.runInContext(stripTypeScriptTypes(source,{mode:'transform'}),sandbox);sandbox.install(Shell,views);
const shell=new Shell();shell.componentDidMount();const api={get:()=>shell.st,isActive:()=>true,set:p=>shell.vset('inbox',p),toast:()=>{}};const render=()=>views.inbox.render(shell.st,api);const tick=()=>new Promise(r=>setTimeout(r,0));
render();await tick();assert.equal(reads,0,'status load does not read mailbox');
render().chips.find(c=>c.label==='Load Inbox').pick();await tick();assert.equal(render().rows.length,1);
render().rows[0].open();await tick();assert.equal(render().d.body,'Fixture body');
agent='remote-b';for(const fn of listeners)fn();assert.equal(shell.st.nativeMailSelection,null,'target change clears observation authority');assert.equal(render().d.body,'Fixture body','Cloud mailbox remains independent');
render().openSearch();assert.equal(render().rows.length,0,'entering search clears prior-query results');render().onQ({target:{value:'from:fixture'}});
delay=true;render().chips.find(c=>c.label==='Search Gmail').pick();await tick();session='account-b';for(const fn of listeners)fn();releaseSearch({messages:[mail],syncedAt:'stale'});await tick();assert.equal(render().rows.length,0,'late previous-account results discarded');
render().closeSearch();assert.equal(shell.st.q,null);assert.equal(render().rows.length,0);shell.componentWillUnmount();
console.log('PASS: Inbox explicit read, independent agent target, query transition clearing, cancelled account switch and stale callback exclusion. Provider fixture only.');
