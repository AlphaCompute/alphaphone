// docs/core-loop-audit.md states each loop's step classes three times: in the per-loop step
// table (the last cell of each row), in that loop's "Count:" line and in the summary table.
// After round 8 the B and J01 Count lines still read 22 of 23 and 7 of 9 while their tables
// and the summary said 23 of 23 and 9 of 9. This test recomputes the counts from the step
// tables and requires the Count lines and the summary table to agree with them.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const audit = fs.readFileSync(path.join(root, 'docs/core-loop-audit.md'), 'utf8');
const LOOPS = ['A', 'B', 'C', 'D', 'E', 'F', 'J01', 'J03', 'J04', 'J05'];
const CLASSES = ['EVIDENCED', 'SOFTWARE', 'EMULATOR', 'CI', 'HUMAN', 'DEVICE', 'UPSTREAM'];
const CLOSABLE = ['EVIDENCED', 'SOFTWARE', 'EMULATOR', 'CI'];
const cells = line => line.trim().replace(/^\|/, '').replace(/\|$/, '').split(' | ').map(cell => cell.trim());

/** The text of "### <loop>. ..." up to the next heading of level 2 or 3. */
function loopSection(loop) {
  const start = audit.indexOf(`\n### ${loop}. `);
  assert.notEqual(start, -1, `missing section "### ${loop}."`);
  const ends = [audit.indexOf('\n### ', start + 5), audit.indexOf('\n## ', start + 5)].filter(index => index !== -1);
  return audit.slice(start, Math.min(...ends));
}

function stepCounts(loop) {
  const rows = loopSection(loop).split('\n').filter(line => new RegExp(`^\\| ${loop}-\\d+ \\|`).test(line));
  assert.ok(rows.length > 0, `${loop}: no step rows`);
  const counts = Object.fromEntries(CLASSES.map(name => [name, 0]));
  const ids = new Set();
  for (const row of rows) {
    const values = cells(row);
    assert.equal(values.length, 4, `${loop}: malformed step row ${row.slice(0, 60)}`);
    assert.ok(!ids.has(values[0]), `${values[0]} is listed twice`);
    ids.add(values[0]);
    assert.ok(CLASSES.includes(values[3]), `${values[0]}: "${values[3]}" is not one of ${CLASSES.join(', ')}`);
    counts[values[3]] += 1;
  }
  const numbers = [...ids].map(id => Number(id.split('-')[1]));
  assert.deepEqual(numbers, numbers.map((_, index) => index + 1), `${loop}: step numbers must run 1..n in order`);
  return { steps: rows.length, ...counts };
}

const closable = counts => CLOSABLE.reduce((sum, name) => sum + counts[name], 0);
const percent = counts => Math.round((100 * counts.EVIDENCED) / closable(counts));

function summaryRows() {
  const start = audit.indexOf('| Loop | Steps | Evidenced |');
  assert.notEqual(start, -1, 'summary table missing');
  const lines = audit.slice(start).split('\n');
  const header = cells(lines[0]);
  const rows = [];
  for (const line of lines.slice(2)) {
    if (!line.startsWith('|')) break;
    rows.push(Object.fromEntries(header.map((name, index) => [name, cells(line)[index]])));
  }
  return new Map(rows.map(row => [row.Loop, row]));
}

const computed = Object.fromEntries(LOOPS.map(loop => [loop, stepCounts(loop)]));

test('each loop Count line equals the classes of its own step rows', () => {
  for (const loop of LOOPS) {
    const counts = computed[loop];
    const line = loopSection(loop).split('\n').find(text => text.startsWith('Count: '));
    assert.ok(line, `${loop}: no Count line`);
    const expected = `Count: ${counts.EVIDENCED} evidenced, ${counts.SOFTWARE} SOFTWARE, ${counts.EMULATOR} EMULATOR, ${counts.CI} CI; separately ${counts.HUMAN} HUMAN, ${counts.DEVICE} DEVICE, ${counts.UPSTREAM} UPSTREAM. **${counts.EVIDENCED} of ${closable(counts)} = ${percent(counts)}%.**`;
    assert.ok(line.startsWith(expected), `${loop}: expected the Count line to start with\n${expected}\nfound\n${line.slice(0, expected.length + 20)}`);
  }
});

test('the summary table equals the step rows, loop by loop and in total', () => {
  const summary = summaryRows();
  assert.deepEqual([...summary.keys()], [...LOOPS, 'All']);
  const total = Object.fromEntries(['steps', ...CLASSES].map(name => [name, 0]));
  for (const loop of [...LOOPS, 'All']) {
    const counts = loop === 'All' ? total : computed[loop];
    if (loop !== 'All') for (const name of Object.keys(total)) total[name] += counts[name];
    const row = summary.get(loop);
    const expected = {
      Steps: counts.steps, Evidenced: counts.EVIDENCED, SOFTWARE: counts.SOFTWARE, EMULATOR: counts.EMULATOR, CI: counts.CI,
      'Closable total': closable(counts), Percentage: `${percent(counts)}%`, HUMAN: counts.HUMAN, DEVICE: counts.DEVICE, UPSTREAM: counts.UPSTREAM,
    };
    for (const [column, value] of Object.entries(expected)) assert.equal(row[column], String(value), `${loop}: summary column ${column}`);
  }
});

test('a class-E row names the source of its run', () => {
  for (const loop of LOOPS) {
    for (const line of loopSection(loop).split('\n').filter(text => new RegExp(`^\\| ${loop}-\\d+ \\|`).test(text))) {
      if (!/class E/.test(line)) continue;
      assert.match(line, /6dcdde34|2961bd9e|9a1ca161|73b973a5|Build\d+/, `${cells(line)[0]}: a class E claim must name the run's source`);
    }
  }
});
