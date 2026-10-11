// Takes the rows the Android free/busy reader returned on the JVM (test/fixtures/
// CalendarAvailabilityReaderTest.java) through the renderer's provider-row parser and the
// shared contract computation, and checks the answer the owner would review and share.
// It joins the two halves that are otherwise tested apart; it is not a device run.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseAvailabilityEvents} from '../apps/app/src/runtime/calendar-availability.ts';
import {calendarAvailability} from '../.eliza/client-features/packages/contracts/src/device-reviews.ts';

type Case={name:string;timeZone:string;start:string;end:string;calendarCount:number;rows:unknown;expected:{status:string;transparentIgnored:number;busy:unknown[]}};
const cases=JSON.parse(readFileSync(process.argv[2],'utf8')) as Case[];
assert.ok(Array.isArray(cases)&&cases.length>=30,'the reader test supplies every zone and case');
for(const item of cases){
 const operation={type:'calendar_availability' as const,start:item.start,end:item.end,timeZone:item.timeZone};
 const result=calendarAvailability(operation,item.calendarCount,parseAvailabilityEvents(item.rows));
 assert.deepEqual(result,{version:1,kind:'calendar_availability',window:{start:item.start,end:item.end,timeZone:item.timeZone},calendarCount:item.calendarCount,status:item.expected.status,busy:item.expected.busy,transparentIgnored:item.expected.transparentIgnored},item.name);
 const shared=JSON.stringify(result);
 for(const secret of ['SECRET','CALENDAR_NAME','example','title','description','location'])assert.ok(!shared.includes(secret),`${item.name}: shared result must not contain ${secret}`);
}
console.log(`PASS: ${cases.length} Android reader results produce the expected shared free/busy answers.`);
