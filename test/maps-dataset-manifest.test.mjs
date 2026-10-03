import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
test('Maps gateway binds served data and graph to an explicitly reviewed revision',()=>{
 const result=execFileSync('python3',['-B','scripts/maps/test-dataset-manifest.py'],{encoding:'utf8',timeout:20000});
 assert.match(result,/PASS: actual gateway revision\/search/);
});
