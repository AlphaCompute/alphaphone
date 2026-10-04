import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const source=stripTypeScriptTypes(fs.readFileSync('apps/app/src/prototype/recording-summary.ts','utf8'));
const {proposedRecordingSummary:parse}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('recording summary accepts a bounded structured proposal without changing its meaning',()=>{
 const value={summary:'First paragraph.\nSecond paragraph.',actions:['Water the plants.','Review the schedule.']};
 assert.deepEqual(parse(JSON.stringify(value)),value);assert.deepEqual(parse('```json\n'+JSON.stringify(value)+'\n```'),value);assert.deepEqual(parse(JSON.stringify({...value,actions:[]})),{...value,actions:[]});
});
test('recording summary refuses partial, ambiguous or oversized action output',()=>{
 const value={summary:'Review this.',actions:['Water the plants.']};
 for(const bad of ['Not JSON',JSON.stringify(null),JSON.stringify({...value,save:true}),JSON.stringify({...value,actions:['Two\nitems']}),JSON.stringify({...value,actions:[{}]}),JSON.stringify({...value,actions:Array(21).fill('Action')}),JSON.stringify({...value,actions:['x'.repeat(501)]}),JSON.stringify({...value,actions:Array(20).fill('x'.repeat(300))}),JSON.stringify({...value,summary:'x'.repeat(32001)}),JSON.stringify({...value,summary:'\0'}),'Prose '+JSON.stringify(value)])assert.equal(parse(bad),undefined);
});
