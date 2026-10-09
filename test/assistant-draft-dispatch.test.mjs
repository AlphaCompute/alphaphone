import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {stripTypeScriptTypes} from 'node:module';
const code=stripTypeScriptTypes(readFileSync('apps/app/src/prototype/assistant-draft-controller.ts','utf8'),{mode:'transform'});
const {AssistantDraftController}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const record=(text,revision='1')=>({version:1,binding:'test',revision,text});
function fixture(){let text='',saved=null;const store={async read(){return saved;},async save(expected,value){assert.deepEqual(expected,saved);return saved=record(value,String(Number(saved?.revision||0)+1));}};const c=new AssistantDraftController(async()=>store,()=>text,value=>{text=value;},()=>{});return {c,store,set:value=>{text=value;c.edit(value);},get:()=>text,saved:()=>saved,external:value=>{saved=record(value,'external');}};}
test('the saved draft keeps the text while a send is in flight and clears only after dispatch',async()=>{
 const f=fixture();f.external('Hello agent');await f.c.open('one');assert.equal(f.get(),'Hello agent');
 await f.c.hold('Hello agent');f.set('');await tick();
 assert.equal(f.saved().text,'Hello agent','clearing the composer for the in-flight message does not clear the saved draft');
 await f.c.commit();assert.equal(f.saved().text,'');assert.equal(f.get(),'');
});
test('a pre-dispatch failure returns the text to the composer and keeps it saved',async()=>{
 const f=fixture();f.external('Not yet sent');await f.c.open('one');await f.c.hold('Not yet sent');f.set('');await tick();
 f.c.release();await tick();
 assert.equal(f.get(),'Not yet sent');assert.equal(f.saved().text,'Not yet sent');assert.match(f.c.state.message,/back in the composer/);
});
test('typing during the send is kept after the restored text and after a commit',async()=>{
 const f=fixture();f.external('First');await f.c.open('one');await f.c.hold('First');f.set('');f.set('Second');await tick();
 f.c.release();await tick();assert.equal(f.get(),'First\nSecond');assert.equal(f.saved().text,'First\nSecond');
 await f.c.hold('First\nSecond');f.set('');f.set('Third');await tick();await f.c.commit();await tick();
 assert.equal(f.saved().text,'Third');assert.equal(f.get(),'Third');
});
test('holding refuses a changed draft and a second concurrent send',async()=>{
 const f=fixture();f.external('Draft');await f.c.open('one');
 await assert.rejects(f.c.hold('Other text'),/draft changed/);await assert.rejects(f.c.hold('Draft',()=>false),/draft changed/);
 await f.c.hold('Draft');await assert.rejects(f.c.hold('Draft'),/Review local draft storage/);
 f.c.release();assert.equal(f.saved().text,'Draft');
});
test('a reopened binding for the same conversation never offers the in-flight text again',async()=>{
 const f=fixture();f.external('In flight');await f.c.open('one');await f.c.hold('In flight');f.set('');await tick();
 f.c.retire();await f.c.open('one');assert.equal(f.get(),'','the in-flight text is not restored as a fresh draft');
 await f.c.commit();assert.equal(f.saved().text,'');
 f.set('Next message');await tick();assert.equal(f.saved().text,'Next message','the reopened binding saves with the committed receipt');
});
test('a connection change before dispatch keeps the text saved with its conversation and returns it to an empty composer',async()=>{
 const f=fixture();f.external('Unsent words');await f.c.open('one');await f.c.hold('Unsent words');f.set('');await tick();
 f.c.retire();f.set('');f.c.release();
 assert.equal(f.get(),'Unsent words');assert.equal(f.saved().text,'Unsent words');assert.match(f.c.state.message,/back in the composer/);
});
test('typing as the reply arrives is queued after the commit, never racing it into a conflict',async()=>{
 const f=fixture();f.external('Sent text');await f.c.open('one');await f.c.hold('Sent text');f.set('');await tick();
 const committing=f.c.commit();f.set('Typed during commit');await committing;await tick();await tick();
 assert.equal(f.c.state.conflict,false);assert.equal(f.c.state.error,false);
 assert.equal(f.saved().text,'Typed during commit');assert.equal(f.get(),'Typed during commit');
});
