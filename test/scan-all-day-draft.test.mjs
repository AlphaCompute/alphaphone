import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {stripTypeScriptTypes} from 'node:module';
const {suggestScanEventDetails,scanAllDayEventDraft}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(readFileSync('apps/app/src/prototype/scan-event.ts','utf8'))).toString('base64'));
test('an all-day scan suggestion becomes an all-day Calendar draft, never a save',()=>{
 const now=new Date(2026,9,3,15),suggested=suggestScanEventDetails('Book fair\nOctober 10, 2026\nVenue: Library',{now});
 assert.equal(suggested.allDay,true);
 const draft=scanAllDayEventDraft({title:suggested.fields.title,date:suggested.fields.date,location:suggested.fields.location},'Book fair text',now);
 assert.deepEqual({allDay:draft.allDay,off:draft.off,t:draft.t,d:draft.d,cal:draft.cal,where:draft.where,repeat:draft.repeat,alert:draft.alert},{allDay:true,off:7,t:0,d:24,cal:'native:local',where:'Library',repeat:'none',alert:null});
 assert.equal(scanAllDayEventDraft({title:'Fair',date:'2026-10-10',location:'',repeat:'weekly'},'',now).repeat,'weekly');
});
test('all-day scan drafts validate the date, text and repeat',()=>{
 const now=new Date(2026,9,3);
 for(const date of ['','2026-02-30','1969-12-31','10/10/2026'])assert.throws(()=>scanAllDayEventDraft({title:'Fair',date,location:''},'',now));
 assert.throws(()=>scanAllDayEventDraft({title:' ',date:'2026-10-10',location:''},'',now),/title/);
 assert.throws(()=>scanAllDayEventDraft({title:'Fair',date:'2026-10-10',location:'',repeat:'monthly'},'',now),/repeat/);
 assert.throws(()=>scanAllDayEventDraft({title:'Fair',date:'2026-10-10',location:''},'x'.repeat(16001),now),/16,000/);
});
