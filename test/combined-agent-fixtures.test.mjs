import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {approvalSource} from '../scripts/combined-agent-fixtures.mjs';

test('generated synthetic effect passes its exact file path and one newline to the writer',()=>{
  const file='/tmp/owned "fixture"\\path\n.txt',source=approvalSource(file);
  const start=source.indexOf('appendFileSync('),end=source.indexOf(';return {message:',start);
  assert.ok(start>=0&&end>start);
  assert.equal(source.indexOf('appendFileSync(',start+1),-1);
  const writes=[];
  vm.runInNewContext(source.slice(start,end),{appendFileSync:(...args)=>writes.push(args)},{timeout:1000});
  assert.deepEqual(writes,[[file,'combined-effect\n']]);
});
