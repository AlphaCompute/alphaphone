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

test('English poster dates and AM/PM suggestions retain explicit civil meaning',()=>{
 for(const date of ['October 10, 2026','10 October 2026','Oct. 10th, 2026','10th Oct. 2026']){
  const result=suggestScanEvent(`Open studio\n${date}\nTime: 6:30 p.m.\nVenue: Main hall`);
  assert.deepEqual(result,{title:'Open studio',date:'2026-10-10',time:'18:30',minutes:60,location:'Main hall'});
 }
 assert.equal(suggestScanEvent('Event\n2026-10-10\n12 AM').time,'00:00');
 assert.equal(suggestScanEvent('Event\n2026-10-10\n12 PM').time,'12:00');
 assert.equal(suggestScanEvent('Event\n2026-10-10\nStart: 7 PM').time,'19:00');
 assert.equal(suggestScanEvent('Event\n2026-10-10\nLocation: A\nVenue: B').location,'');
});
test('poster extraction does not invent years or accept conflicting, invalid or zoned times',()=>{
 for(const date of ['October 10','10/11/2026','February 30, 2026','2026-02-30','2026-10-10\n11/10/2026','2026-10-10\nOctober 11','October 10, 2026\n11 October 2026'])assert.equal(suggestScanEvent(`Event\n${date}`).date,'',date);
 for(const time of ['0 PM','13 AM','18:30\n19:00','18:30\n25:00','18:30\n19:7','Time: 6 PM PST','18:30\nTimezone: America/New_York','18:30\nUTC','18:30\nTimezone: Unknown','18:30\nET','2026-10-10T18:30+02:00'])assert.equal(suggestScanEvent(`Event\n2026-10-10\n${time}`).time,'',time);
 assert.equal(suggestScanEvent('Event\nFebruary 29, 2028\n7 PM').date,'2028-02-29');
 assert.equal(suggestScanEvent('Event\nFebruary 29, 2027\n7 PM').date,'');
});

test('ordinary website paths and band names are not mistaken for time zones',()=>{assert.equal(suggestScanEvent('AC/DC tribute\nOctober 10, 2026\n6 PM\nhttps://example.com/events').time,'18:00');});


test('explicit same-day poster time ranges suggest duration without inventing meridiem or overnight dates',()=>{
 for(const range of ['6 PM - 8 PM','6PM-8PM','6 p.m. – 8 p.m.','18:00—20:00','18:00 to 20:00']){
  const fields=suggestScanEvent(`Studio\nOctober 10, 2026\nTime: ${range}`);assert.equal(fields.time,'18:00',range);assert.equal(fields.minutes,120,range);
 }
 for(const range of ['6 - 8 PM','11 PM - 1 AM','18:00 - 18:00','18:00 - 18:10','18:00 - 25:00','6 PM - 8 PM PST','18:00 - 20:00\n18:00 - 21:00']){
  const fields=suggestScanEvent(`Studio\nOctober 10, 2026\nTime: ${range}`);assert.equal(fields.time,'',range);assert.equal(fields.minutes,60,range);
 }
});
