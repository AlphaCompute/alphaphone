import {test} from 'node:test';
import assert from 'node:assert/strict';
const {calendarAgentReviewText}=await import('../apps/app/src/browser/calendar-agent-review.ts');
const source={name:'App calendar',account:'Alpha Phone'};
const fields={title:'Venue booking call',description:'From the venue meeting note',location:'Main hall',start:'2026-10-12T05:00:00.000Z',end:'2026-10-12T06:00:00.000Z',timeZone:'Asia/Tokyo'};

test('a create review names the calendar, account, zone, all-day state and attendees, in the event zone', () => {
  assert.deepEqual(calendarAgentReviewText('calendar_create',fields,source,undefined,'America/New_York').split('\n'),[
    'Create event',
    '“Venue booking call”',
    'Calendar: App calendar · Account: Alpha Phone',
    'October 12, 2026 at 2:00 PM GMT+9 – October 12, 2026 at 3:00 PM GMT+9',
    'Time zone: Asia/Tokyo (this phone is set to America/New_York)',
    'All day: no. This is a timed event.',
    'Attendees: none. This change adds no attendees and sends no invitations.',
    'Location: Main hall',
    'From the venue meeting note',
  ]);
});
test('the device zone is not repeated when it is the event zone, and empty optional lines are omitted', () => {
  const lines=calendarAgentReviewText('calendar_create',{...fields,location:' ',description:''},source,undefined,'Asia/Tokyo').split('\n');
  assert.equal(lines[4],'Time zone: Asia/Tokyo');assert.equal(lines.length,7);
});
test('an update says existing attendees are kept and that an all-day event stays all day', () => {
  const timed=calendarAgentReviewText('calendar_update',fields,source,{who:['a','b']},'Asia/Tokyo');
  assert.match(timed,/^Update event\n/);
  assert.match(timed,/Attendees: 2 people on this event, kept as they are\. This change adds or removes no one and sends no invitations\./);
  const allDay=calendarAgentReviewText('calendar_update',{...fields,start:'2026-10-12T00:00:00.000Z',end:'2026-10-14T00:00:00.000Z'},source,{allDay:true,who:['a'],seriesId:'s'},'Asia/Tokyo').split('\n');
  assert.equal(allDay[0],'Update event · This occurrence only');
  assert.equal(allDay[3],'October 12, 2026 – October 13, 2026');
  assert.equal(allDay[4],'All day: yes. This event stays an all-day event; no time zone applies.');
  assert.match(allDay[5],/^Attendees: 1 person on this event, kept/);
  assert.equal(calendarAgentReviewText('calendar_update',{...fields,start:'2026-10-12T00:00:00.000Z',end:'2026-10-13T00:00:00.000Z'},source,{allDay:true}).split('\n')[3],'October 12, 2026');
});
test('delete and share reviews state what happens to attendees', () => {
  assert.match(calendarAgentReviewText('calendar_delete',fields,source,{who:['a']}),/^Delete event\n[\s\S]*Attendees: 1 person on this event\. Deleting it sends no cancellation\./);
  assert.match(calendarAgentReviewText('calendar_read_selected',fields,source,{who:['a','b','c']}),/^Share event with the connected agent\n[\s\S]*Attendees: 3 people on this event\. Their names are not shared\./);
  assert.match(calendarAgentReviewText('calendar_delete',fields,source,{}),/Attendees: none\.$/m);
});
