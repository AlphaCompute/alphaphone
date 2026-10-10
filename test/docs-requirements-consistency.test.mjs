// docs/requirements.json, the PRD table and the status index must agree.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const requirements = JSON.parse(read('docs/requirements.json'));
const status = read('docs/mvp-current-status.md');
const prd = read('docs/prd.md');
const STATUSES = ['implemented', 'partial', 'deferred', 'blocked'];

const cells = line => line.trim().replace(/^\|/, '').replace(/\|$/, '').split(' | ').map(cell => cell.trim());
function section(text, heading) {
  const start = text.indexOf(`\n## ${heading}\n`);
  assert.notEqual(start, -1, `missing section "## ${heading}"`);
  const end = text.indexOf('\n## ', start + heading.length + 4);
  return text.slice(start, end === -1 ? undefined : end);
}
function table(text, heading) {
  const rows = section(text, heading).split('\n').filter(line => line.startsWith('|'));
  assert.ok(rows.length > 2, `no table under "## ${heading}"`);
  const header = cells(rows[0]);
  return rows.slice(2).map(line => {
    const values = cells(line);
    assert.equal(values.length, header.length, `malformed row under "## ${heading}": ${line.slice(0, 80)}`);
    return Object.fromEntries(header.map((name, index) => [name, values[index]]));
  });
}

const capabilities = table(status, 'Capabilities and remaining acceptance');
const areas = new Set(capabilities.map(row => row.Area));
const index = new Map(table(status, 'PRD requirement status').map(row => [row.Requirement, row]));
const prdRows = new Map(table(prd, 'Scope and requirements').map(row => [row.ID, row]));

test('requirements.json defines exactly the four statuses and lists AP-01 to AP-15 in order', () => {
  assert.equal(requirements.schema, 2);
  assert.equal(requirements.source, 'docs/prd.md');
  assert.deepEqual(Object.keys(requirements.statuses), STATUSES);
  const ids = requirements.requirements.map(requirement => requirement.id);
  assert.deepEqual(ids, Array.from({ length: 15 }, (_, index) => `AP-${String(index + 1).padStart(2, '0')}`));
  assert.deepEqual(ids, [...prdRows.keys()], 'requirements.json and the PRD table list different requirements');
});

test('every requirement has a valid status, existing evidence paths, a gate and known status rows', () => {
  for (const requirement of requirements.requirements) {
    assert.ok(STATUSES.includes(requirement.status), `${requirement.id}: status "${requirement.status}"`);
    assert.ok(typeof requirement.gate === 'string' && requirement.gate.length > 10, `${requirement.id}: gate`);
    assert.ok(typeof requirement.remaining === 'string' && requirement.remaining.length > 0, `${requirement.id}: remaining`);
    assert.ok(Array.isArray(requirement.evidence) && requirement.evidence.length > 0, `${requirement.id}: evidence`);
    for (const evidence of requirement.evidence) {
      assert.ok(!path.isAbsolute(evidence) && !evidence.includes('..'), `${requirement.id}: ${evidence} must be repository-relative`);
      assert.ok(fs.existsSync(path.join(root, evidence)), `${requirement.id}: evidence path ${evidence} does not exist`);
    }
    assert.ok(requirement.statusRows.length > 0, `${requirement.id}: statusRows`);
    for (const area of requirement.statusRows) assert.ok(areas.has(area), `${requirement.id}: "${area}" is not a row in docs/mvp-current-status.md`);
  }
});

test('the status index table matches requirements.json exactly', () => {
  assert.deepEqual([...index.keys()], requirements.requirements.map(requirement => requirement.id));
  for (const requirement of requirements.requirements) {
    const row = index.get(requirement.id);
    assert.equal(row.Status, requirement.status, `${requirement.id}: status differs between docs/mvp-current-status.md and docs/requirements.json`);
    assert.deepEqual(row['Status rows'].split('; '), requirement.statusRows, `${requirement.id}: status rows differ`);
    assert.equal(row['Next gate'], requirement.gate, `${requirement.id}: gate differs`);
  }
});

test('deferred requirements are exactly the PRD rows marked deferred', () => {
  for (const requirement of requirements.requirements) {
    const deferredInPrd = /^Deferred\b/i.test(prdRows.get(requirement.id)['Priority / acceptance']);
    assert.equal(requirement.status === 'deferred', deferredInPrd, `${requirement.id}: PRD priority and status disagree on deferral`);
  }
});

test('every capability row labels its evidence class', () => {
  const known = /^(?:not applicable|(?:[SBEIRD](?: and [SBEIRD])?(?: [^;]+)?)(?:; [SBEIRD](?: [^;]+)?)*)$/;
  for (const row of capabilities) {
    assert.ok(row['Evidence class'], `${row.Area}: evidence class missing`);
    assert.match(row['Evidence class'], known, `${row.Area}: "${row['Evidence class']}" does not start each entry with an S, B, E, I, R or D class`);
  }
  for (const code of ['(S)', '(B)', '(E)', '(I)', '(R)', '(D)']) assert.ok(status.includes(code), `class ${code} is not defined`);
});


test('decisions.md lists the pending owner decisions with options and records none of them as decided', () => {
  const decisions = read('docs/decisions.md');
  const pending = section(decisions, 'Pending owner decisions');
  assert.match(pending, /Nothing in this section is decided\./);
  const rows = pending.split('\n').filter(line => /^\| A-\d\d \|/.test(line)).map(cells);
  const ids = rows.map(row => row[0]);
  for (const id of ['A-09', 'A-10', 'A-02', 'A-04', 'A-05', 'A-01', 'A-06', ...Array.from({ length: 16 }, (_, index) => `A-${index + 11}`)]) assert.ok(ids.includes(id), `${id} missing from pending owner decisions`);
  assert.equal(new Set(ids).size, ids.length, 'duplicate pending decision');
  for (const row of rows) {
    assert.equal(row.length, 4, `${row[0]}: expected ID, decision, options and evidence`);
    assert.match(row[2], /\(a\)[\s\S]*\(b\)/, `${row[0]}: needs at least two options`);
    assert.ok(row[3].length > 40, `${row[0]}: evidence missing`);
    assert.doesNotMatch(row.join(' '), /\b(?:decided|chosen|approved) by the (?:product )?owner\b|\bowner (?:decided|chose|approved)\b/i, `${row[0]}: records an owner choice`);
  }
  // A pending item must not also appear as an October 7 owner decision.
  const owner = section(decisions, 'October 7 owner product decisions');
  for (const id of ids.filter(id => Number(id.slice(2)) > 10)) assert.ok(!owner.includes(id), `${id} appears among owner decisions`);
});

// The contradictions the October 10 refresh found had three shapes: a ledger naming a retired
// upstream pin, a gate whose first step was a source check the same entry already listed as
// met, and a reference to a decision that has no row. Each is checked here.
test('the status index names the pinned upstream commit and no gate starts with a source check', () => {
  const pin = JSON.parse(read('upstream.lock.json')).commit;
  assert.ok(section(status, 'Product boundaries').includes(`\`${pin.slice(0, 10)}\``), `Product boundaries must name the pin ${pin.slice(0, 10)} from upstream.lock.json`);
  assert.ok(requirements.note.includes(pin.slice(0, 10)), 'requirements.json note must name the pin it was refreshed against');
  for (const requirement of requirements.requirements) {
    if (requirement.status !== 'partial') continue;
    // A gate that opens with "S:" says software is the next step; then "remaining" must name where that software is.
    if (/^S:/.test(requirement.gate)) assert.match(requirement.remaining, /not on main|not implemented|MVP-\d\d/, `${requirement.id}: an S gate needs the missing software named in "remaining"`);
  }
});

test('every decision ID named in the requirement ledgers is a row in decisions.md', () => {
  const decisions = read('docs/decisions.md');
  const named = new Set([...status.matchAll(/\bA-\d\d\b/g), ...JSON.stringify(requirements).matchAll(/\bA-\d\d\b/g)].map(match => match[0]));
  for (const id of named) assert.ok(decisions.includes(`| ${id} |`), `${id} is named in the ledgers but has no row in docs/decisions.md`);
  for (const [policy] of status.matchAll(/\bP-\d\d\b/g)) assert.ok(decisions.includes(`**${policy}**`), `${policy} is named in docs/mvp-current-status.md but is not an owner decision`);
});
