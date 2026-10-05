import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const source=stripTypeScriptTypes(readFileSync('apps/app/src/browser/domain-document.ts','utf8'));
const {BrowserDomainDocument}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

// This in-memory CAS checks product migration policy. Actual transactional and
// multi-tab behavior is separately exercised by the upstream browser harness.
function fixture(raw){
 let legacy=raw,snapshot,revision=0;
 const copy=value=>structuredClone(value);
 const documents={
  async read(){return copy(snapshot);},
  async readOrCreate(_key,raw,signal){signal?.throwIfAborted();if(!snapshot)snapshot={revision:String(++revision),raw};return copy(snapshot);},
  async compareExchange(_key,expected,raw,signal){signal?.throwIfAborted();assert.deepEqual(expected,snapshot,'saved document changed');snapshot={revision:String(++revision),raw};return copy(snapshot);},
  async edit(key,callback,signal){signal?.throwIfAborted();const before=await this.read(),next=await callback(before);await this.compareExchange(key,before,next.raw,signal);return next.result;},
 };
 const domain=new BrowserDomainDocument(documents,'calendar',()=>legacy);
 return {domain,documents,legacy:()=>legacy,setLegacy:value=>{legacy=value;},saved:()=>copy(snapshot)};
}

test('migration and edits preserve the exact legacy bytes without a writable mirror',async()=>{
 const original='  { "count" : 7 }\n',f=fixture(original);
 assert.deepEqual(await f.domain.read(()=>({count:0})),{count:7});
 const migrated=f.saved();assert.equal(JSON.parse(migrated.raw).value,original);
 assert.equal(await f.domain.edit(()=>({count:0}),data=>++data.count),8);
 assert.equal(f.legacy(),original);
 assert.deepEqual(await f.domain.read(()=>({count:0})),{count:8});
 assert.equal(JSON.parse(f.saved().raw).legacy,original);
});

test('empty reads do not claim a migration before legacy data exists',async()=>{
 const f=fixture(null);assert.deepEqual(await f.domain.read(()=>({count:0})),{count:0});assert.equal(f.saved(),undefined);
 f.setLegacy('{"count":7}');assert.deepEqual(await f.domain.read(()=>({count:0})),{count:7});assert.equal(JSON.parse(f.saved().raw).legacy,'{"count":7}');
});

test('concurrent first readers import once and keep recovery receipts stable',async()=>{
 const original='  { "count" : 7 }\n',f=fixture(original);
 const reads=await Promise.all(Array.from({length:20},()=>f.domain.read(()=>({count:0}))));
 assert.deepEqual(reads,Array.from({length:20},()=>({count:7})));
 assert.equal(f.saved().revision,'1');
 const capture=await f.domain.capture();
 await Promise.all(Array.from({length:20},()=>f.domain.read(()=>({count:0}))));
 assert.deepEqual(await f.domain.capture(),capture);
 await f.domain.reset(capture);assert.equal((await f.domain.capture()).raw,null);
 assert.equal(f.legacy(),original);
});

test('malformed and empty legacy bytes are retained for backup, never treated as empty data',async()=>{
 for(const original of ['{ invalid\n\u0000','']){
  const f=fixture(original);let initialized=false;
  await assert.rejects(f.domain.read(()=>{initialized=true;return {};}),SyntaxError);
  assert.equal(initialized,false);assert.equal(f.legacy(),original);
  const capture=await f.domain.capture();assert.equal(capture.raw,original);assert.equal(capture.format,'domain');
  assert.equal(JSON.parse(f.saved().raw).value,original);
 }
});

test('legacy changes refuse access without overwriting either version',async()=>{
 const f=fixture('{"count":1}');await f.domain.edit(()=>({count:0}),data=>{data.count=2;});
 const saved=f.saved();f.setLegacy('{"count":3}');let edited=false;
 await assert.rejects(f.domain.read(()=>({})),/Older browser data changed/);
 await assert.rejects(f.domain.edit(()=>({}),()=>{edited=true;}),/Older browser data changed/);
 assert.equal(edited,false);assert.deepEqual(f.saved(),saved);
 const capture=await f.domain.capture();assert.equal(capture.raw,'{"count":2}');assert.equal(capture.legacy,'{"count":3}');assert.equal(capture.legacyChanged,true);
});

test('a legacy change during an async edit discards the edit',async()=>{
 const f=fixture('{"count":1}');await f.domain.read(()=>({}));const before=f.saved();
 await assert.rejects(f.domain.edit(()=>({count:0}),async data=>{data.count=99;f.setLegacy('{"count":2}');}),/Older browser data changed/);
 assert.deepEqual(f.saved(),before);assert.equal(f.legacy(),'{"count":2}');
});

test('reset preserves the legacy backup and does not reimport it after reopening',async()=>{
 const original='{"count":7}',f=fixture(original),capture=await f.domain.capture();
 await f.domain.reset(capture);assert.equal(f.legacy(),original);
 const reopened=new BrowserDomainDocument(f.documents,'calendar',f.legacy);
 assert.deepEqual(await reopened.read(()=>({count:0})),{count:0});
 assert.equal((await reopened.capture()).raw,null);
});

test('reset rejects a stale canonical snapshot or changed legacy bytes',async()=>{
 const f=fixture('{"count":1}');await f.domain.read(()=>({}));const capture=await f.domain.capture();
 await f.domain.edit(()=>({count:0}),data=>{data.count=2;});const current=f.saved();
 await assert.rejects(f.domain.reset(capture),/saved document changed/);assert.deepEqual(f.saved(),current);
 const newer=await f.domain.capture();f.setLegacy('{"count":3}');
 await assert.rejects(f.domain.reset(newer),/Older browser data changed/);assert.deepEqual(f.saved(),current);
});

test('a first import after a recovery capture requires a fresh capture before reset',async()=>{
 const f=fixture('{"count":7}'),capture=await f.domain.capture();
 assert.equal(capture.snapshot,undefined);
 await f.domain.read(()=>({count:0}));const saved=f.saved();
 await assert.rejects(f.domain.reset(capture),/saved document changed/);
 assert.deepEqual(f.saved(),saved);
 await f.domain.reset(await f.domain.capture());assert.equal((await f.domain.capture()).raw,null);
});

test('unreadable canonical metadata can be backed up exactly and explicitly reset',async()=>{
 const f=fixture('{"count":1}'),raw='{"version":99,"unrecognized":"retain me"}';
 await f.documents.compareExchange('calendar',undefined,raw);
 await assert.rejects(f.domain.read(()=>({})),/metadata needs recovery/);
 const capture=await f.domain.capture();assert.equal(capture.raw,raw);assert.equal(capture.format,'unrecognized');
 await f.domain.reset(capture);assert.deepEqual(await f.domain.read(()=>({count:0})),{count:0});
 assert.equal(f.legacy(),'{"count":1}');
});

test('cancellation and editor failure do not persist partial data',async()=>{
 const f=fixture('{"count":1}');await f.domain.read(()=>({}));const before=f.saved();
 const abort=new AbortController();
 await assert.rejects(f.domain.edit(()=>({count:0}),data=>{data.count=9;abort.abort();},abort.signal),{name:'AbortError'});
 await assert.rejects(f.domain.reset(await f.domain.capture(),abort.signal),{name:'AbortError'});
 await assert.rejects(f.domain.edit(()=>({count:0}),data=>{data.count=9;throw Error('failed editor');}),/failed editor/);
 assert.deepEqual(f.saved(),before);
});

test('cancellation during asynchronous initialization prevents a later edit or read result',async()=>{
 const f=fixture(null),abort=new AbortController();let edited=false;
 await assert.rejects(f.domain.edit(async()=>{abort.abort();return {};},()=>{edited=true;},abort.signal),{name:'AbortError'});
 assert.equal(edited,false);assert.equal(f.saved(),undefined);
 const readAbort=new AbortController();
 await assert.rejects(f.domain.read(async()=>{readAbort.abort();return {};},readAbort.signal),{name:'AbortError'});
 assert.equal((await f.domain.capture()).raw,null);
});
