// docs/mvp-remaining-work-2026-10-09.md and its .json must describe the same 53 items:
// the same ids in the same order, titles, priorities, kinds, requirements and "Blocked on" values.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const inventory = JSON.parse(read('docs/mvp-remaining-work-2026-10-09.json'));
const markdown = read('docs/mvp-remaining-work-2026-10-09.md');
const CLASSES = ['SOFTWARE', 'EMULATOR', 'CI', 'HUMAN', 'DEVICE', 'UPSTREAM'];
const NEEDS_DETAIL = new Set(['HUMAN', 'UPSTREAM']);

/** One entry per "### MVP-nn Title" block: its heading, the bold meta line and the "Blocked on" line. */
const blocks = [...markdown.matchAll(/^### (MVP-\d\d) (.+)\n\n\*\*(.+)\*\*\n(.*)\n/gm)].map(match => {
  const [priority, kind, requirements] = match[3].split(' · ');
  return { id: match[1], title: match[2], priority, kind, requirements: requirements?.split(', ') ?? [], blockedLine: match[4] };
});
const blockClass = entry => entry.split(':')[0];

test('the inventory lists MVP-01 to MVP-53 once each, in order, in both files', () => {
  const expected = Array.from({ length: 53 }, (_, index) => `MVP-${String(index + 1).padStart(2, '0')}`);
  assert.deepEqual(inventory.items.map(item => item.id), expected);
  assert.deepEqual(blocks.map(block => block.id), expected, 'the Markdown headings differ from the JSON ids');
  assert.equal(markdown.match(/^### MVP-\d\d /gm).length, 53, 'a Markdown item heading is not followed by its meta and "Blocked on" lines');
});

test('titles, priorities, kinds and requirements agree between the two files', () => {
  for (const [index, item] of inventory.items.entries()) {
    const block = blocks[index];
    assert.equal(block.title, item.title, `${item.id}: title`);
    assert.equal(block.priority, item.priority, `${item.id}: priority`);
    assert.ok(Object.hasOwn(inventory.priorities, item.priority), `${item.id}: unknown priority ${item.priority}`);
    assert.equal(block.kind, item.kind, `${item.id}: kind`);
    assert.deepEqual(block.requirements, item.requirements, `${item.id}: requirements`);
  }
});

test('every item is blocked on one or more known classes, and both files say the same', () => {
  assert.deepEqual(Object.keys(inventory.blocked_on_classes), CLASSES);
  for (const [index, item] of inventory.items.entries()) {
    assert.ok(Array.isArray(item.blocked_on) && item.blocked_on.length > 0, `${item.id}: blocked_on is missing or empty`);
    const classes = item.blocked_on.map(blockClass);
    assert.equal(new Set(classes).size, classes.length, `${item.id}: a class is listed twice`);
    for (const entry of item.blocked_on) {
      const name = blockClass(entry);
      assert.ok(CLASSES.includes(name), `${item.id}: "${name}" is not one of ${CLASSES.join(', ')}`);
      assert.ok(entry === name || entry.startsWith(`${name}: `), `${item.id}: "${entry}" must be CLASS or "CLASS: detail"`);
      assert.ok(!entry.includes('; '), `${item.id}: "${entry}" contains the entry separator`);
      // A person cannot act on "HUMAN" alone, and an upstream blocker must name its change.
      if (NEEDS_DETAIL.has(name)) assert.ok(entry.length > name.length + 12, `${item.id}: ${name} must name the decision ID, owner action or upstream change`);
    }
    assert.equal(blocks[index].blockedLine, `Blocked on: ${item.blocked_on.join('; ')}.`, `${item.id}: the Markdown "Blocked on" line differs from the JSON`);
  }
});

test('the per-class counts stated in the Markdown are the counts in the JSON', () => {
  const carrying = Object.fromEntries(CLASSES.map(name => [name, 0]));
  const first = Object.fromEntries(CLASSES.map(name => [name, 0]));
  for (const item of inventory.items) {
    for (const name of new Set(item.blocked_on.map(blockClass))) carrying[name] += 1;
    first[blockClass(item.blocked_on[0])] += 1;
  }
  const line = counts => CLASSES.map(name => `${name} ${counts[name]}`).join(' · ');
  assert.ok(markdown.includes(`Items carrying each class (an item can carry several): ${line(carrying)}.`), `expected carried counts: ${line(carrying)}`);
  assert.ok(markdown.includes(`Items by first blocker: ${line(first)}.`), `expected first-blocker counts: ${line(first)}`);
});

test('decision IDs and dependencies named by an item exist', () => {
  const decisions = read('docs/decisions.md');
  const ids = new Set(inventory.items.map(item => item.id));
  for (const item of inventory.items) {
    for (const dependency of item.depends_on) assert.ok(ids.has(dependency), `${item.id}: depends on unknown ${dependency}`);
    for (const [id] of [item.current, item.remaining, ...item.blocked_on].join(' ').matchAll(/\bA-\d\d\b/g)) assert.ok(decisions.includes(`| ${id} |`), `${item.id}: ${id} is not a row in docs/decisions.md`);
  }
});

test('the inventory names the pin in upstream.lock.json', () => {
  assert.equal(inventory.upstream_pin, JSON.parse(read('upstream.lock.json')).commit);
});

// docs/mvp-owner-actions.md is the list the owner works from. It must name every pending
// decision and every item that waits on a person, an emulator or CI run, or a device.
test('owner actions name every pending decision and every item that is not software-only', () => {
  const actions = read('docs/mvp-owner-actions.md');
  const named = new Set();
  for (const [, list] of actions.matchAll(/MVP-(\d\d(?:(?:, | and | to )\d\d)*)/g)) {
    for (const part of list.split(/, | and /)) {
      const [from, to = from] = part.split(' to ').map(Number);
      for (let number = from; number <= to; number += 1) named.add(`MVP-${String(number).padStart(2, '0')}`);
    }
  }
  for (const item of inventory.items) {
    if (item.blocked_on.every(entry => blockClass(entry) === 'SOFTWARE')) continue;
    assert.ok(named.has(item.id), `${item.id} is blocked on ${item.blocked_on.map(blockClass).join(', ')} but docs/mvp-owner-actions.md does not name it`);
  }
  const pending = read('docs/decisions.md').split('\n## Pending owner decisions\n')[1];
  for (const [, id] of pending.matchAll(/^\| (A-\d\d) \|/gm)) assert.ok(actions.includes(id), `pending decision ${id} is missing from docs/mvp-owner-actions.md`);
});
