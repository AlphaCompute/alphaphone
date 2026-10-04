import { test } from 'node:test';
import assert from 'node:assert/strict';
import { smokeCaseCounts } from '../scripts/smoke-case-counts.mjs';
const status = (name, code) => `INSTRUMENTATION_STATUS: class=Fixture\nINSTRUMENTATION_STATUS: test=${name}\nINSTRUMENTATION_STATUS_CODE: ${code}\n`;
const pair = (name, code) => status(name, 1) + status(name, code);
const cases = pair('passed', 0) + pair('ignored', -3) + pair('optIn', -4);
test('JUnit count excludes ignored cases and includes assumption skips', () => {
  const result = smokeCaseCounts(cases + 'OK (2 tests)\n');
  assert.equal(result.countsVerified, true);
  assert.deepEqual(result.testCounts, {passed:1, failed:0, ignored:1, assumptionSkipped:1, unknown:0});
  assert.equal(smokeCaseCounts((cases + 'OK (2 tests)\n').replaceAll('\n','\r\n')).countsVerified,true);
});
test('failed cases remain counted and visible', () => {
  const result = smokeCaseCounts(cases + pair('failure', -2) + 'Tests run: 3,  Failures: 1\n');
  assert.equal(result.countsVerified, true);
  assert.equal(result.testCounts.failed, 1);
});
for (const [name, output] of Object.entries({
  inflated: cases + 'OK (3 tests)\n',
  missingStart: status('passed',0) + 'OK (1 test)\n',
  unfinished: pair('passed',0) + status('unfinished',1) + 'OK (1 test)\n',
  duplicate: pair('passed',0) + pair('passed',0) + 'OK (2 tests)\n',
  unknown: pair('passed',-5) + 'OK (1 test)\n',
  empty: 'OK (0 tests)\n',
})) test(`rejects ${name} evidence`,()=>assert.equal(smokeCaseCounts(output).countsVerified,false));

test('rejects status records missing a case identity even when other counts match', () => {
  for (const malformed of [
    'INSTRUMENTATION_STATUS: test=orphan\nINSTRUMENTATION_STATUS_CODE: 0\n',
    'INSTRUMENTATION_STATUS: class=Fixture\nINSTRUMENTATION_STATUS_CODE: 1\n',
  ]) assert.equal(smokeCaseCounts(pair('passed', 0) + malformed + 'OK (1 test)\n').countsVerified, false);
});
