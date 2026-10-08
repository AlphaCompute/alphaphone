// Consumer review/receipt copy; contracts and exact date formatting stay upstream.
import test from 'node:test';
import assert from 'node:assert/strict';
import {presentDeviceRecordOperation} from '../apps/app/src/runtime/device-record-presentation.ts';

const event={type:'calendar_create',source:{sourceId:'private-source-id',sourceRevision:'private-revision'},fields:{title:'Calendar review',description:'Bring the blue folder.',location:'',start:'2026-10-08T16:00:00.000Z',end:'2026-10-08T16:15:00.000Z',timeZone:'America/Los_Angeles'}};
test('Calendar review and receipt retain the event zone without exposing identifiers or empty fields',()=>{
 const before=structuredClone(event),value=presentDeviceRecordOperation(event,'Asia/Tokyo');
 assert.equal(value.title,'Create event');
 assert.match(value.description,/October 8, 2026 at 9:00 AM PDT/);
 assert.match(value.description,/9:15 AM PDT/);
 assert.match(value.description,/America\/Los_Angeles/);
 assert.match(value.description,/Bring the blue folder\./);
 assert.doesNotMatch(value.description,/Location:|private-source|private-revision|2026-10-08T|\{|\}/);
 assert.match(value.appliedSummary,/Created event “Calendar review”/);
 assert.match(value.appliedSummary,/9:00 AM PDT/);
 assert.ok(!value.appliedSummary.includes(event.fields.description));
 assert.deepEqual(event,before);
});
test('Calendar fallback hour and exact seconds preserve distinct instants',()=>{
 const value=presentDeviceRecordOperation({...event,fields:{...event.fields,start:'2026-11-01T08:30:00.000Z',end:'2026-11-01T09:30:00.000Z'}});
 assert.match(value.description,/1:30 AM PDT/);assert.match(value.description,/1:30 AM PST/);
 const exact=presentDeviceRecordOperation({...event,fields:{...event.fields,start:'2026-10-08T16:00:12.345Z'}});
 assert.match(exact.description,/9:00:12\.345 AM PDT/);
});
test('Reminder copy preserves message, no-alert state, lead alert and recurrence zone',()=>{
 const reminder={type:'reminder_create',fields:{title:'Bring the folder',body:'Bring the blue folder.',schedule:{dueAt:Date.parse('2026-10-08T16:00:00.000Z'),at:Date.parse('2026-10-08T16:00:00.000Z'),alertMinutes:null,recurrence:null}}};
 const before=structuredClone(reminder),value=presentDeviceRecordOperation(reminder,'America/Los_Angeles');
 assert.match(value.description,/Bring the blue folder\./);assert.match(value.description,/9:00 AM PDT \(America\/Los_Angeles\)/);assert.match(value.description,/No alert; saved task only\./);assert.match(value.description,/Does not repeat\./);assert.doesNotMatch(value.description,/Alert October|\{|\}/);
 assert.match(value.appliedSummary,/No alert/);assert.ok(!value.appliedSummary.includes(reminder.fields.body));assert.deepEqual(reminder,before);
 const repeated=presentDeviceRecordOperation({...reminder,fields:{...reminder.fields,schedule:{...reminder.fields.schedule,at:Date.parse('2026-10-08T15:45:00.000Z'),alertMinutes:15,recurrence:{rule:'weekdays',zone:'America/Los_Angeles',date:'2026-10-08',time:'09:00',leadMinutes:15}}}},'UTC');
 assert.match(repeated.description,/Due October 8, 2026 at 9:00 AM PDT/);assert.match(repeated.description,/Alert October 8, 2026 at 8:45 AM PDT/);assert.match(repeated.description,/Repeats on weekdays at 09:00 \(America\/Los_Angeles\)\./);
});
test('Notes preserve exact review text and keep receipt text concise',()=>{
 const fields={title:'  Blue folder  ',body:'\n  First line.\n\n'+'Keep this exact text. '.repeat(100)+'\nLast line.  \n'},target={sourceId:'private-source',sourceRevision:'private-source-revision',noteId:'private-note',revision:'private-note-revision'},before=structuredClone({fields,target});
 for(const operation of [{type:'create_note',...fields},{type:'notes_update',fields,target}]){
  const value=presentDeviceRecordOperation(operation),creating=operation.type==='create_note';
  assert.equal(value.description,`${creating?'Create':'Update'} note\n“${fields.title}”\n${fields.body}`);
  assert.equal(value.appliedSummary,`${creating?'Saved':'Updated'} note “${fields.title}”.`);
  assert.ok(!value.appliedSummary.includes(fields.body));
 }
 const share=presentDeviceRecordOperation({type:'notes_read_selected',target}),remove=presentDeviceRecordOperation({type:'notes_delete',target});
 assert.equal(share.description,'Share selected note\nSend this note’s exact title and text to the connected agent.');assert.match(remove.description,/Attached audio files are retained\./);assert.doesNotMatch(share.description+remove.description,/private-source|private-note|\{|\}/);assert.deepEqual({fields,target},before);
});
