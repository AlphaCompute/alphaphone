import test from 'node:test';
import assert from 'node:assert/strict';
import {initialReminderDue,nextReminderOccurrence} from '../apps/app/src/browser/reminder-recurrence.ts';
test('production browser recurrence handles half-hour transitions and quarter-hour offsets',()=>{
 const halfHour=nextReminderOccurrence({rule:'daily',zone:'Australia/Lord_Howe',date:'2026-10-03',time:'02:15',leadMinutes:0},Date.parse('2026-10-02T16:00:00Z'));
 assert.equal(new Date(halfHour.dueAt).toISOString(),'2026-10-03T15:30:00.000Z');
 const at=Date.parse('2026-10-02T04:15:00.000Z');
 assert.equal(initialReminderDue({rule:'daily',zone:'Asia/Kathmandu',date:'2026-10-02',time:'10:00',leadMinutes:0},at),at);
});
