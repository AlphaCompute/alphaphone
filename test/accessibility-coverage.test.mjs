// The accessibility sweep (MVP-48, renderer part) must keep visiting every retained view. A view
// added to the MVP without a state in the sweep, or a state dropped from it, fails here instead
// of quietly leaving a screen unchecked.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function enabledViews() {
  const source = read('apps/app/src/prototype/mvp-features.ts');
  const body = source.match(/export const ENABLED_MVP_VIEWS = new Set\(\[([\s\S]*?)\]\);/);
  assert.ok(body, 'ENABLED_MVP_VIEWS is declared as a literal set');
  // Deferred views are commented out in the literal; only uncommented entries are retained.
  const live = body[1].split('\n').map(line => line.replace(/\/\/.*$/, '')).join('\n');
  return [...live.matchAll(/"([a-z]+)"/g)].map(match => match[1]);
}

const states = read('test/browser/accessibility-states.ts');
const sweep = read('test/browser/accessibility-sweep.spec.ts');
const production = read('test/browser/accessibility-sweep.production.spec.ts');

test('every retained MVP view has a live state and a populated state in the sweep', () => {
  const views = enabledViews();
  assert.deepEqual([...views].sort(), ['browser', 'calendar', 'camera', 'files', 'inbox', 'maps', 'notes', 'photos', 'settings', 'workflows']);
  const liveBlock = states.slice(states.indexOf('export const LIVE_STATES'), states.indexOf('export const MOCK_STATES'));
  const mockBlock = states.slice(states.indexOf('export const MOCK_STATES'), states.indexOf('export const FAILURE_STATES'));
  for (const view of views) {
    const title = view[0].toUpperCase() + view.slice(1);
    assert.match(liveBlock, new RegExp(`live\\('[^']*', \\['${title}'`), `live state opens ${title}`);
    assert.match(mockBlock, new RegExp(`'${view}'`), `fixture state opens ${view}`);
    assert.match(mockBlock, new RegExp(`'${view}:[a-z]+'`), `fixture state opens a ${view} subview`);
  }
  for (const surface of ["live('Home')", "live('All apps'", "live('Conversation'", "'shade'", "'sheet'", "'full'"])
    assert.ok(states.includes(surface), `${surface} is swept`);
  assert.match(states, /name: 'render failure recovery'/);
  assert.match(states, /name: 'startup failure recovery'/);
});

test('the sweep applies every dimension and cannot be narrowed silently', () => {
  assert.match(sweep, /const STATES = \[\.\.\.LIVE_STATES, \.\.\.MOCK_STATES, \.\.\.FAILURE_STATES\];/);
  assert.match(sweep, /for \(const theme of \['light', 'dark'\] as const\)/);
  assert.match(sweep, /auditTree\(page\)/);
  assert.match(sweep, /auditPage\(page, \{ contrast: true, targetSize: 24, clipping: true \}\)/);
  assert.match(sweep, /auditTabOrder\(page\)/);
  assert.match(sweep, /setTextScale\(page, 2\)/);
  assert.match(sweep, /viewport: \{ width: 915, height: 412 \}/);
  // Only deliberate truncation is tolerated; nothing else is filtered out of the results.
  assert.equal([...sweep.matchAll(/\.filter\(/g)].length, 2);
  assert.match(sweep, /lines\.filter\(line => !line\.startsWith\('text-truncated:'\)\)/);
  assert.doesNotMatch(sweep, /test\.skip|\.only\(/);
  // One documented large-text gap, owned by another work package.
  assert.equal([...states.matchAll(/largeTextOpen:/g)].length, 1);
  assert.match(production, /for \(const state of LIVE_STATES\)/);
  assert.match(production, /auditPage\(page, \{ contrast: true, targetSize: 24, clipping: true \}\)/);
});

test('the layout fixes the sweep depends on stay in the stylesheet and template', () => {
  const css = read('apps/app/src/prototype/phone.css');
  const template = read('apps/app/src/prototype/template.html');
  for (const hook of ['data-alpha-camera-root', 'data-alpha-camera="viewfinder"', 'data-alpha-camera="capture"', 'data-alpha-camera="modes"', 'data-alpha-camera="zoom"', 'data-alpha-maps-sheet="results"', 'data-alpha-maps-sheet="place"', 'data-alpha-maps-sheet="directions"', 'data-alpha-maps-directions', 'data-alpha-map-canvas', 'class="calendar-block-text"'])
    assert.ok(template.includes(hook), `${hook} is in the template`);
  assert.match(css, /\.alpha-landscape \[data-alpha-camera="capture"\]\{[^}]*flex-direction:column-reverse/);
  assert.match(css, /\[data-alpha-maps-sheet="place"\],\[data-alpha-maps-sheet="directions"\]\{[^}]*max-height:calc\(100% - 104px\);overflow-y:auto/);
  assert.match(css, /\.calendar-block-text\{[^}]*flex-wrap:wrap/);
  // The find bar is bound to its open flag, not to the always-present binding object.
  assert.ok(template.includes('<sc-if value="{{browser.finding}}">'));
  assert.ok(!template.includes('<sc-if value="{{browser.find}}">'));
  assert.ok(template.includes('onChange="{{browser.find.onInput}}"'));
});
