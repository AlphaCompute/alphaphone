import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const source=readFileSync(new URL('../apps/app/src/browser/reminder-recurrence.ts',import.meta.url),'utf8');
const {initialReminderDue,nextReminderOccurrence}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64'));
const rule=(date,time,zone='America/New_York',kind='daily',leadMinutes=0)=>({date,time,zone,rule:kind,leadMinutes});
const iso=value=>new Date(value).toISOString();
test('saved zone survives host-zone changes, overlaps choose earlier instant, and lead is elapsed time',()=>{
 const previous=process.env.TZ;
 try {
  for(const tz of ['Pacific/Honolulu','Asia/Tokyo','UTC']) {
   process.env.TZ=tz;
   const result=nextReminderOccurrence(rule('2026-10-31','01:30','America/New_York','daily',60),Date.parse('2026-10-31T12:00Z'));
   assert.equal(iso(result.dueAt),'2026-11-01T05:30:00.000Z');
   assert.equal(iso(result.at),'2026-11-01T04:30:00.000Z');
   assert.equal(result.date,'2026-11-01');
  }
 } finally {if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});
test('future gaps choose first valid instant, then return to requested wall clock',()=>{
 const r=rule('2027-03-13','02:30');
 const first=nextReminderOccurrence(r,Date.parse('2027-03-13T12:00Z'));
 assert.equal(iso(first.dueAt),'2027-03-14T07:00:00.000Z');
 const second=nextReminderOccurrence({...r,date:first.date},first.at);
 assert.equal(iso(second.dueAt),'2027-03-15T06:30:00.000Z');
 const half=nextReminderOccurrence(rule('2026-10-03','02:15','Australia/Lord_Howe'),Date.parse('2026-10-03T00:00Z'));
 assert.equal(iso(half.dueAt),'2026-10-03T15:30:00.000Z');
 const skippedDay=nextReminderOccurrence(rule('2011-12-29','12:00','Pacific/Apia'),Date.parse('2011-12-29T23:00Z'));
 assert.equal(iso(skippedDay.dueAt),'2011-12-30T10:00:00.000Z');
});
test('weekdays skip weekends, weekly retains weekday, overdue occurrences count accurately',()=>{
 const weekdays=nextReminderOccurrence(rule('2026-10-02','09:00','America/New_York','weekdays'),Date.parse('2026-10-02T14:00Z'));
 assert.equal(iso(weekdays.at),'2026-10-05T13:00:00.000Z');
 const weekly=nextReminderOccurrence(rule('2026-10-30','09:00','America/New_York','weekly'),Date.parse('2026-10-30T14:00Z'));
 assert.equal(iso(weekly.at),'2026-11-06T14:00:00.000Z');
 const overdue=nextReminderOccurrence(rule('2026-10-01','09:00'),Date.parse('2026-10-04T13:00Z'));
 assert.equal(overdue.skippedDates,3);assert.equal(overdue.date,'2026-10-05');
});
test('first occurrence validates civil date, zone, weekday, lead and exact instant',()=>{
 const at=Date.parse('2026-11-01T05:30Z');
 assert.equal(initialReminderDue(rule('2026-11-01','01:30'),at),at);
 for(const [r,value] of [
  [rule('2027-03-14','02:30'),Date.parse('2027-03-14T07:30Z')],
  [rule('2026-02-30','09:00'),at],[rule('2026-11-01','25:00'),at],
  [rule('2026-11-01','01:30','Invalid/Zone'),at],
  [rule('2026-11-01','01:30','America/New_York','weekdays'),at],
  [rule('2026-11-01','01:30','America/New_York','daily',-1),at],
  [rule('2026-11-01','01:30'),at+3600000],
 ])assert.throws(()=>initialReminderDue(r,value));
});
