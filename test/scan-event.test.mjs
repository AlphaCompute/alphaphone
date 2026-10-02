import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {stripTypeScriptTypes} from 'node:module';
const {suggestScanEvent,scanEventDraft}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(readFileSync('apps/app/src/prototype/scan-event.ts','utf8'))).toString('base64'));
test('scan event suggestions preserve text and leave ambiguous dates or time zones for review',()=>{
 assert.deepEqual(suggestScanEvent('Open studio\n2026-10-10\n18:30\nMain hall'),{title:'Open studio',date:'2026-10-10',time:'18:30',minutes:60,location:''});
 for(const text of ['Tomorrow at 7','July 3 at 7 PM','2026-10-10\n2026-10-11\n07:00 PM','2026-10-10T18:30Z','2026-10-10\n18:30 PST','Meet at 18:30-19:30'])assert.equal(suggestScanEvent(text).time,'');
 assert.equal(suggestScanEvent('2026-10-10\n2026-10-11').date,'');
});
test('reviewed draft keeps civil date across month/year boundaries without writing an event',()=>{
 const draft=scanEventDraft({title:' Reviewed event ',date:'2027-01-02',time:'23:45',minutes:90,location:' Hall '},'Exact reviewed OCR text',new Date(2026,11,31,12));
 assert.equal(draft.off,2);assert.equal(draft.t,23.75);assert.equal(draft.d,1.5);assert.equal(draft.title,'Reviewed event');assert.equal(draft.notes,'Exact reviewed OCR text');assert.equal(draft.where,'Hall');assert.equal(draft.cal,'native:local');assert.equal(draft.id,null);
});
test('invalid dates, missing times and durations cannot become calendar drafts',()=>{
 assert.throws(()=>scanEventDraft({title:'Event',date:'2026-10-10',time:'18:30',minutes:60,location:''},'x'.repeat(16001)),/16,000/);
 const valid={title:'Event',date:'2026-10-10',time:'18:30',minutes:60,location:''};
 for(const patch of [{title:''},{date:'2026-02-30'},{date:'2026-13-01'},{date:'1969-12-31'},{date:''},{time:'24:00'},{time:''},{minutes:0},{minutes:15.5},{minutes:1441}])assert.throws(()=>scanEventDraft({...valid,...patch},'text'));
});
