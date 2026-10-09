import test from 'node:test';
import assert from 'node:assert/strict';
import {clockDays, describeClockDays, validateClockOperation, describeClockHandoff} from '../apps/app/src/runtime/clock-contract.ts';
const set = extra => ({type:'clock_handoff',action:'set',hour:6,minute:45,label:'Gym',timeZone:'UTC',...extra});
test('repeat days are 1-7 unique ascending Calendar values for EXTRA_DAYS', () => {
 assert.deepEqual(clockDays([2,3,4,5,6]), [2,3,4,5,6]);
 for (const days of [[], [0], [8], [3,2], [2,2], [1.5], ['2'], [1,2,3,4,5,6,7,1]]) assert.throws(() => clockDays(days), /repeat days/);
 assert.throws(() => clockDays('2,3'), /repeat days/);
});
test('set operations accept an optional days field and keep exact keys otherwise', () => {
 assert.equal('days' in validateClockOperation(set({})), false);
 assert.deepEqual(validateClockOperation(set({days:[1,7]})).days, [1,7]);
 assert.throws(() => validateClockOperation(set({days:[]})), /repeat days/);
 assert.throws(() => validateClockOperation({type:'clock_handoff',action:'show',days:[2]}), /Unexpected Clock fields/);
 assert.match(describeClockHandoff(validateClockOperation(set({days:[2,3,4,5,6]}))), /repeating weekdays/);
 assert.equal(describeClockDays([1,2,3,4,5,6,7]), 'every day');
 assert.equal(describeClockDays([2,4]), 'Mon, Wed');
});
