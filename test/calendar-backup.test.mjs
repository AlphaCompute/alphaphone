import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const code=stripTypeScriptTypes(readFileSync('apps/app/src/browser/calendar-backup.ts','utf8'));
const {prepareCalendarBackup,prepareCalendarSalvage}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const row={id:'event',calendarId:'local',revision:'old',title:'Restored appointment',body:'Details',location:'Library',begin:1800000000000,end:1800003600000,timeZone:'America/New_York',repeat:'weekly',alert:10};
const prepare=value=>{let n=0;return prepareCalendarBackup(JSON.stringify(value),()=>String(++n));};
test('backup copies events with new identities and no effects or historical receipts',()=>{
 const state=prepare({events:[row],creations:{old:'receipt'},receipts:{old:'receipt'},preferences:{visible:false}});
 assert.equal(state.events[0].title,row.title);assert.notEqual(state.events[0].id,row.id);assert.notEqual(state.events[0].revision,row.revision);assert.equal(state.events[0].alert,null);assert.equal(state.receipts,undefined);assert.equal(state.creations,undefined);assert.equal(state.preferences,undefined);
 assert.equal(prepare({version:1,value:JSON.stringify({events:[row]}),legacy:null}).events.length,1);
});
test('series exclusions and edited occurrences survive remapped identities',()=>{
 const occurrence=row.begin+7*86400000;
 const state=prepare({events:[{...row,excluded:[occurrence+7*86400000]},{...row,id:`event:occ:${occurrence}`,seriesId:'event',occurrenceBegin:occurrence,repeat:'none',title:'Moved appointment'}]});
 assert.equal(state.events[1].seriesId,state.events[0].id);assert.equal(state.events[1].id,`${state.events[0].id}:occ:${occurrence}`);assert.deepEqual(state.events[0].excluded,[occurrence+7*86400000]);
});
for(const [name,events] of Object.entries({duplicate:[row,row],badInterval:[{...row,end:0}],badZone:[{...row,timeZone:'Not/AZone'}],badTitle:[{...row,title:''}],badRepeat:[{...row,repeat:'sometimes'}],missingParent:[{...row,seriesId:'missing'}],badGuests:[{...row,who:'guest'}],badResponses:[{...row,responses:{unknown:'yes'}}],badExclusion:[{...row,excluded:['tomorrow']}]}))test(`refuses invalid backup: ${name}`,()=>assert.throws(()=>prepare({events}),/supported calendar backup/));
test('malformed, oversized and unsupported documents are rejected without partial salvage',()=>{
 assert.throws(()=>prepareCalendarBackup('{',()=>''));assert.throws(()=>prepareCalendarBackup(' '.repeat(5*1024*1024+1),()=>''),/5 MB/);assert.throws(()=>prepare({}));assert.throws(()=>prepare({events:[row,null]}));
});

test('rejects non-string RSVP values instead of coercing arrays',()=>{
 for(const response of [['yes'],{},null,1,true])assert.throws(()=>prepare({events:[{...row,who:['Guest'],responses:{Guest:response}}]}),/supported calendar backup/);
 assert.equal(prepare({events:[{...row,who:['Guest'],responses:{Guest:'yes'}}]}).events[0].responses.Guest,'yes');
});

const salvage=value=>{let n=0;return prepareCalendarSalvage(JSON.stringify(value),()=>String(++n));};
test('explicit salvage keeps valid independent records and reports exact skipped positions',()=>{
 const result=salvage({events:[row,{...row,id:'broken',end:0},null],receipts:{effect:'must not replay'}});
 assert.equal(result.state.events.length,1);assert.equal(result.state.events[0].alert,null);
 assert.deepEqual(result.skipped.map(r=>r.index),[2,3]);assert.equal(result.state.receipts,undefined);
 assert.throws(()=>prepare({events:[row,null]}));
});
test('salvage rejects the entire damaged recurring series instead of reviving its base occurrence',()=>{
 const occurrence=row.begin+86400000;
 const result=salvage({events:[row,{...row,id:`event:occ:${occurrence}`,seriesId:'event',occurrenceBegin:occurrence,repeat:'none',end:0},{...row,id:'independent',title:'Keep me'}]});
 assert.deepEqual(result.state.events.map(r=>r.title),['Keep me']);assert.deepEqual(result.skipped.map(r=>r.index),[1,2]);
});
test('a valid recurring series is retained together with its remapped exceptions',()=>{
 const occurrence=row.begin+86400000;
 const result=salvage({version:1,value:JSON.stringify({events:[{...row,id:`event:occ:${occurrence}`,seriesId:'event',occurrenceBegin:occurrence,repeat:'none'},row,{...row,id:'bad',who:'invalid'}]})});
 assert.equal(result.state.events[0].seriesId,result.state.events[1].id);assert.deepEqual(result.skipped.map(r=>r.index),[3]);
});
test('all duplicate identities and their dependent series are excluded',()=>{
 const occurrence=row.begin+86400000,id=`event:occ:${occurrence}`;
 const result=salvage({events:[row,{...row,id,seriesId:'event',occurrenceBegin:occurrence,repeat:'none'},{...row,id},{...row,id:'safe',title:'Safe'}]});
 assert.deepEqual(result.state.events.map(r=>r.title),['Safe']);assert.deepEqual(result.skipped.map(r=>r.index),[1,2,3]);
 assert.ok(result.skipped.every(r=>r.reason==='Ambiguous duplicate identity'));
});
test('salvage refuses unparseable, oversized, empty and wholly damaged input',()=>{
 for(const value of [{},{events:[]},{events:[null]},{events:[{...row,seriesId:'missing'}]},{events:[row,row]}])assert.throws(()=>salvage(value));
 assert.throws(()=>prepareCalendarSalvage('{',()=>''));assert.throws(()=>prepareCalendarSalvage(' '.repeat(5*1024*1024+1),()=>''),/5 MB/);
});
