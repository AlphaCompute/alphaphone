import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {createClockHandoffHistory,clockHandoffSlot} from '../apps/app/src/runtime/clock-handoff-history.ts';
const row=(id,status='opening')=>({id,action:'set',status,at:'2026-10-05T00:00:00Z'});
function fixture(raw=null){
 let legacy=raw,saved=null;
 const store={read:async()=>structuredClone(saved),compareExchange:async(slot,expected,value)=>{assert.equal(slot,clockHandoffSlot);if(JSON.stringify(expected)!==JSON.stringify(saved))return {status:'conflict'};saved=structuredClone(value);return {status:'saved'};}};
 return {store,history:createClockHandoffHistory(store,()=>legacy),saved:()=>structuredClone(saved),setSaved:value=>{saved=value;},legacy:()=>legacy,setLegacy:value=>{legacy=value;}};
}
test('Clock reads do not write; first admission preserves exact old bytes without a writable mirror',async()=>{
 const raw=' \n'+JSON.stringify(row('old','unknown'))+'\n',f=fixture(raw),initial=await f.history.read();assert.equal(f.saved(),null);
 const admitted=await f.history.save(initial,row('new'));await f.history.save(admitted,row('new','opened'));
 assert.equal(f.legacy(),raw);assert.equal(f.saved().legacy,raw);assert.equal(f.saved().record.status,'opened');
});
test('competing Clock admissions have one winner and late completion cannot replace a newer record',async()=>{
 const f=fixture(),a=await f.history.read(),b=await f.history.read();
 const first=await f.history.save(a,row('first'));await assert.rejects(f.history.save(b,row('competitor')),/changed/);
 const next=await f.history.save(await f.history.read(),row('next'));
 await assert.rejects(f.history.save(first,row('first','opened')),/changed/);assert.equal(f.saved().record.id,'next');
 await f.history.save(next,row('next','unknown'));assert.equal((await f.history.read()).record.status,'unknown');
});
test('malformed and changed legacy records remain untouched and block new handoffs',async()=>{
 for(const raw of ['', '{broken','null',JSON.stringify({...row('old'),status:'success'}),JSON.stringify({...row('old'),at:'bad'})]){
  const f=fixture(raw);await assert.rejects(f.history.read());assert.equal(f.legacy(),raw);assert.equal(f.saved(),null);
 }
 const f=fixture(),snapshot=await f.history.read();f.setLegacy(JSON.stringify(row('older-app')));await assert.rejects(f.history.save(snapshot,row('new')),/changed/);assert.equal(f.saved(),null);
 f.setLegacy(null);await f.history.save(await f.history.read(),row('saved'));f.setLegacy('changed');await assert.rejects(f.history.read(),/older app/);
});
test('a dropped native save is not confirmed and malformed secure data is never overwritten',async()=>{
 const f=fixture();f.store.compareExchange=async()=>({status:'saved'});await assert.rejects(f.history.save(await f.history.read(),row('new')),/unconfirmed/);
 for(const value of [{version:2,legacy:null,record:row('x')},{version:1,legacy:null,record:{...row('x'),extra:true}}]){f.setSaved(value);await assert.rejects(f.history.read());assert.deepEqual(f.saved(),value);}
});

const adapter=stripTypeScriptTypes(fs.readFileSync('apps/app/src/prototype/clock-adapter.ts','utf8').replace(/^import .*\n/gm,'').replace('export function installClockAdapter','function installClockAdapter'));
const settle=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
function screen(){
 const f=fixture(),document=new EventTarget(),window=new EventTarget(),effects=[];
 document.hidden=false;document.documentElement={dataset:{}};document.querySelector=()=>null;
 class Component{componentDidMount(){}componentWillUnmount(){}vset(){}}
 const views={calendar:{render:()=>({}),onLeave(){}}};let zone='UTC';
 // Live handoffs: the adapter is evaluated as a flag-off (production) build.
 const context={testMocksEnabled:false,createClockHandoffHistory,clockHandoffLegacyKey:'alphaphone:clock-handoff:v1',secureConnectionStore:f.store,localStorage:{getItem:f.legacy},createInlineModal:()=>({ref:()=>{}}),currentClockTimeZone:()=>zone,DailyApps:{clockHandoff:async request=>{effects.push(request);return {action:request.action,status:'opened',message:'Clock opened'};}},crypto:globalThis.crypto,Date,Intl,document,window};
 vm.runInNewContext(adapter+'\nglobalThis.install=installClockAdapter;',context);
 context.install(Component,views,{simulated:false});const component=new Component();component.componentDidMount();
 const view=()=>views.calendar.render({},{}),open=async()=>{await settle();view().openClock();await settle();view().clock.prepare();return view().clock.review.confirm;};
 return {...f,document,window,effects,context,views,view,open,setZone:value=>{zone=value;}};
}
test('Clock cannot dispatch until native retention is committed and read back',async()=>{
 const f=screen(),confirm=await f.open();f.store.compareExchange=async()=>({status:'saved'});await confirm();assert.equal(f.effects.length,0);assert.match(f.view().clock.message,/not sent/);assert.equal(f.view().clock.busy,false);
});
for(const retirement of ['leave','hidden-return','zone'])test(`Clock admission retired by ${retirement} never launches later`,async()=>{
 const f=screen(),confirm=await f.open(),cas=f.store.compareExchange;let release;f.store.compareExchange=async(...args)=>{await new Promise(resolve=>{release=resolve;});f.store.compareExchange=cas;return cas(...args);};
 const pending=confirm();await settle();assert.equal(f.effects.length,0);
 if(retirement==='leave')f.views.calendar.onLeave();
 else if(retirement==='hidden-return'){f.document.hidden=true;f.document.dispatchEvent(new Event('visibilitychange'));f.document.hidden=false;}
 else f.setZone('Europe/Paris');
 release();await pending;assert.equal(f.effects.length,0);assert.equal(f.saved().record.status,'failed');
});
test('Clock launch follows confirmed admission, suppresses duplicate clicks and keeps an uncertain result when reopened',async()=>{
 const f=screen(),confirm=await f.open();let release;f.context.DailyApps.clockHandoff=request=>{f.effects.push(request);return new Promise((_resolve,reject)=>{release=()=>reject(Error('lost reply'));});};
 const pending=confirm();await settle();await confirm();assert.equal(f.effects.length,1);assert.equal(f.saved().record.status,'opening');release();await pending;assert.equal(f.saved().record.status,'unknown');
 f.view().clock.close();f.view().openClock();await settle();assert.match(f.view().clock.message,/unknown/);assert.equal(f.effects.length,1);
});
test('late native completion cannot overwrite another reviewed request',async()=>{
 const f=screen(),confirm=await f.open();let release;f.context.DailyApps.clockHandoff=request=>new Promise(resolve=>{release=()=>resolve({action:request.action,status:'opened',message:'Opened'});});
 const pending=confirm();await settle();await f.history.save(await f.history.read(),row('newer'));release();await pending;
 assert.equal(f.saved().record.id,'newer');assert.match(f.view().clock.message,/could not be saved/);assert.equal(f.view().clock.busy,false);
});
