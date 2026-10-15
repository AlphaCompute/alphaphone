import assert from 'node:assert/strict';
import {build} from 'esbuild';
const context={rows:new Map(),retained:new Map(),toasts:[],sessionId:'session-A',credentialId:'credential',providerCalls:0,failShelf:false};
globalThis.multipleDraftsFixture=context;globalThis.window={confirm:()=>true};
const mocks={
 'inbox-unsaved':`export function inboxUnsaved(owner,publish,restore){const s=globalThis.multipleDraftsFixture;return {ready:Promise.resolve(),get available(){return s.retained.has(owner)},peek(){return structuredClone(s.retained.get(owner)||null)},edit(v){s.retained.set(owner,structuredClone(v));},clear:async()=>{s.retained.delete(owner)},resume(){const v=s.retained.get(owner);if(v)restore(structuredClone(v));},retire(){},error:false,conflict:false,status:''};}`,
 'platform-plugins':`export const registerPlugin=()=>({});`,
 'daily':`export const DailyApps={perform(){throw Error('Unexpected external operation')}};`,
 'inbox-attachment':`export const reviewMailAttachment=()=>{throw Error('Unexpected attachment read')};`,
 'inbox-operation':`export const outgoingAttachmentLimits={maximumFiles:20,maximumTotalBytes:8*1024*1024};export const checkOutgoingAttachments=()=>{};export const attachmentBytes=()=>0;`,
 'inbox-local-store':`export const inboxLocalStore={read:async key=>structuredClone(globalThis.multipleDraftsFixture.rows.get(key)||null),compareExchange:async(key,before,next)=>{const s=globalThis.multipleDraftsFixture;if(s.failShelf&&key.includes(':shelf:'))throw Error('Synthetic storage failure');if(JSON.stringify(s.rows.get(key)||null)!==JSON.stringify(before))return {status:'conflict'};s.rows.set(key,structuredClone(next));return {status:'saved'};}};`,
 'connection-ui':`export const connectionController={getCloudClient:()=>({sessionId:globalThis.multipleDraftsFixture.sessionId,credentialId:'credential'}),getSnapshot:()=>({cloudAccount:{environment:'production',userId:'owner',organizationId:'organization',sessionId:globalThis.multipleDraftsFixture.sessionId}})};`,
};
const bundle=await build({entryPoints:['apps/app/src/prototype/inbox-drafts.ts'],bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'isolated-draft-ports',setup(b){b.onResolve({filter:/.*/},args=>{const name=args.path.split('/').at(-1);if(mocks[name])return {path:name,namespace:'fixture'};});b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:mocks[args.path],loader:'js'}));}}]});
const {inboxDrafts}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const make=()=>inboxDrafts(()=>{},text=>context.toasts.push(text),{prepare:async()=>{context.providerCalls++;},capabilities:()=>({send:true,providerDrafts:false,from:'owner@example.invalid'})});
const tick=()=>new Promise(resolve=>setImmediate(resolve));const chip=(label,pick)=>({label,pick});const field=(d,key,value)=>d.render().c[key]({target:{value}});
let d=make();await d.bind('grant-A','owner@example.invalid');assert.equal(await d.newEmail(),true);field(d,'onSubj','First email');field(d,'onBody','Preserve these unfinished edits');field(d,'onTo','partial-address');d.close();
assert.equal(await d.newEmail(),true);assert.equal(d.render().c.body,'');assert.equal(d.render().c.subject,'');
let first=d.chips(chip).find(row=>row.subject==='First email');assert.ok(first,'unfinished email becomes a Drafts entry');
field(d,'onSubj','Second email');field(d,'onBody','Keep the second draft too');d.close();first.pick();await tick();assert.equal(d.render().c.subject,'First email');assert.equal(d.render().c.body,'Preserve these unfinished edits');assert.equal(d.render().c.toQ,'partial-address');
d.close();d=make();await d.bind('grant-A','owner@example.invalid');assert.ok(d.chips(chip).some(row=>row.subject==='Second email'),'archived drafts survive a new composer instance');assert.equal(await d.newEmail(),true);
field(d,'onSubj','Storage failure draft');field(d,'onBody','Must remain current');context.failShelf=true;assert.equal(await d.newEmail(),false);assert.equal(d.render().c.body,'Must remain current');context.failShelf=false;
d.close();await d.bind('grant-B','other@example.invalid');assert.equal(d.chips(chip).length,0,'another Google grant sees no archived emails');await d.bind('grant-A','owner@example.invalid');assert.ok(d.chips(chip).some(row=>row.subject==='Second email'));
assert.equal(context.providerCalls,0,'archiving and composing never stage or send provider mail');
const before=[...context.rows.values()].filter(v=>v?.items).reduce((n,v)=>n+v.items.length,0);assert.equal(await d.newEmail(),true);assert.equal(await d.newEmail(),true);const after=[...context.rows.values()].filter(v=>v?.items).reduce((n,v)=>n+v.items.length,0);assert.equal(after,before+1,'only meaningful edits are retained; empty composers are not collected');
delete globalThis.multipleDraftsFixture;delete globalThis.window;
console.log('PASS multiple local drafts: preserve unsaved text/partial recipient, reopen, reload, account isolation, storage-failure retention, empty composer cleanup, zero provider operations.');
