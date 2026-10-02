import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zonedTimeToEpoch, proposalActions, turns } from '../backend/proposal-action.ts';
// Reminder instants are resolved in code from model-supplied wall time and IANA zone.
test('resolves wall time in its zone across DST', () => {
  assert.equal(new Date(zonedTimeToEpoch('2026-10-20T09:00', 'America/Los_Angeles')).toISOString(), '2026-10-20T16:00:00.000Z');
  assert.equal(new Date(zonedTimeToEpoch('2026-12-20T09:00', 'America/Los_Angeles')).toISOString(), '2026-12-20T17:00:00.000Z');
  assert.equal(new Date(zonedTimeToEpoch('2026-10-20T09:00', 'Asia/Kolkata')).toISOString(), '2026-10-20T03:30:00.000Z');
});
test('rejects skipped, impossible, malformed and unknown inputs', () => {
  for (const [local, zone] of [['2027-03-14T02:30', 'America/New_York'], ['2026-02-30T09:00', 'UTC'], ['2026-10-20 09:00', 'UTC'], ['2026-10-20T09:00', 'Not/AZone'], ['2026-10-20T09:00', ''], [1792512000000, 'UTC']])
    assert.equal(zonedTimeToEpoch(local, zone), null, `${local} ${zone}`);
});

test('rejects repeated wall-clock times until the user disambiguates',()=>{
 assert.equal(zonedTimeToEpoch('2026-11-01T01:30','America/New_York'),null);
 assert.equal(zonedTimeToEpoch('2026-04-05T01:45','Australia/Lord_Howe'),null);
 assert.equal(zonedTimeToEpoch('2026-11-01T06:30','UTC'),Date.parse('2026-11-01T06:30:00Z'));
});

test('ambiguous reminder action requests clarification without creating a proposal',async()=>{
 const proposals=[];const action=proposalActions.find(action=>action.name==='CREATE_REMINDER');
 const result=await turns.run({revision:1,proposals,signal:new AbortController().signal},()=>action.handler(null,null,null,{parameters:{title:'Check timing',body:'Test',localDateTime:'2026-11-01T01:30',timeZone:'America/New_York'}}));
 assert.equal(result.success,false);assert.match(result.text,/ambiguous/);assert.deepEqual(proposals,[]);
});

test('unambiguous future reminder prepares an exact proposal without scheduling',async()=>{
 const proposals=[];const action=proposalActions.find(action=>action.name==='CREATE_REMINDER');
 const result=await turns.run({revision:7,proposals,signal:new AbortController().signal},()=>action.handler(null,null,null,{parameters:{title:'Future reminder',body:'Exact body',localDateTime:'2080-10-20T09:00',timeZone:'Asia/Kolkata'}}));
 assert.equal(result.success,true);assert.equal(proposals.length,1);assert.equal(proposals[0].contextRevision,7);assert.deepEqual(proposals[0].operation,{type:'create_reminder',title:'Future reminder',body:'Exact body',at:Date.parse('2080-10-20T03:30:00Z')});
});
