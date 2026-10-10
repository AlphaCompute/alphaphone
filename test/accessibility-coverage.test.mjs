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

test('every subview of a retained view is opened by a state that asserts it is the exposed one', () => {
  const template = read('apps/app/src/prototype/template.html');
  const retained = new Set(enabledViews());
  // Subview ids are "<view>-<name>"; the automation editor lives in the Workflows view.
  const owner = id => id.startsWith('automations-') ? 'workflows' : id.split('-')[0];
  const subviews = [...new Set([...template.matchAll(/data-alpha-subview="([^"]+)"/g)].map(match => match[1]))].filter(id => retained.has(owner(id)));
  assert.ok(subviews.length >= 25, 'the template still marks its subviews');
  // The base list of a view is what its plain state shows; only layered subviews need a named state.
  // photos-empty is the viewer left open after its photo disappears: not reachable by a tap path.
  const unreachable = new Set(['photos-empty']);
  const table = states.slice(states.indexOf('const SUBVIEW'), states.indexOf('export const MOCK_STATES'));
  assert.match(states, /\.map\(start => mock\(start, \[\], SUBVIEW\[start\]\)\)/, 'deep-link states assert their subview');
  assert.match(states, /const showing = async[\s\S]*?\[data-alpha-subview="\$\{subview\}"\]:not\(\[inert\]\)[\s\S]*?toBeVisible\(\)/, 'a declared subview is asserted when the state opens');
  const asserted = new Set([
    ...[...table.matchAll(/'[a-z]+:[a-z]+': '([a-zA-Z-]+)'/g)].map(match => match[1]),
    ...[...states.matchAll(/(?:live|mock)\([^\n]*, '([a-zA-Z-]+)'\),/g)].map(match => match[1]),
  ]);
  for (const id of subviews) {
    if (id.endsWith('-list') || unreachable.has(id)) continue;
    assert.ok(asserted.has(id), `a state opens and asserts the ${id} subview`);
  }
  // Menus, search fields, sheets and the Undo toast are states of their own.
  for (const step of ["['New automation', 'Edit When step']", "['Add Read step']", "['Connections', 'Slack']", "['Browser', 'Menu']", "['Photos', 'Search photos']", "['Notes', 'Search notes']", "['Files', 'Search files']", "['Search email']", "['Menu', 'Share']", "['Share photo']", "['View and sort']", "['Move file']", "['Delete file']"])
    assert.ok(states.includes(step), `${step} is swept`);
  for (const page of ['Character', 'Accounts', 'Connections', 'Notifications', 'Calendar', 'Password manager', 'Models', 'Display', 'Privacy & data', 'About', 'Scheduled digests', 'Agent connection'])
    assert.ok(states.includes(`['Settings', '${page}']`), `Settings > ${page} is swept`);
});

test('the sweep applies every dimension and cannot be narrowed silently', () => {
  assert.match(sweep, /const STATES = \[\.\.\.LIVE_STATES, \.\.\.DEVELOPMENT_STATES, \.\.\.MOCK_STATES, \.\.\.FAILURE_STATES\];/);
  assert.match(sweep, /for \(const theme of \['light', 'dark'\] as const\)/);
  assert.match(sweep, /auditTree\(page\)/);
  assert.match(sweep, /auditPage\(page, \{ contrast: true, targetSize: 24, clipping: true \}\)/);
  assert.match(sweep, /auditTabOrder\(page\)/);
  assert.match(sweep, /setTextScale\(page, 2\)/);
  assert.match(sweep, /viewport: \{ width: 915, height: 412 \}/);
  for (const spec of [sweep, production]) assert.match(spec, /toHaveClass\(\/alpha-landscape\/\)/, 'the landscape lane asserts the landscape layout is active');
  // Only deliberate truncation is tolerated; nothing else is filtered out of the results.
  assert.equal([...sweep.matchAll(/\.filter\(/g)].length, 2);
  assert.match(sweep, /lines\.filter\(line => !line\.startsWith\('text-truncated:'\)\)/);
  // No state is skipped, marked fixme or exempted from a dimension.
  assert.doesNotMatch(sweep, /test\.skip|test\.fixme|\.only\(/);
  assert.doesNotMatch(production, /test\.skip|test\.fixme|\.only\(/);
  assert.doesNotMatch(states, /fixme|largeTextOpen/);
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
  assert.match(css, /\[data-alpha-browser-menu\]>button\{[^}]*min-height:50px/);
  assert.match(css, /\[data-alpha-subview="photos-edit"\]\{[^}]*overflow-y:auto/);
  assert.match(css, /\[data-alpha-app-header\]\[data-alpha-header-grow\]\{height:auto!important\}/);
  assert.ok(template.includes('data-alpha-browser-menu') && template.includes('data-alpha-header-grow'));
  // Search fields may shrink below the input's intrinsic width, so Close search stays on screen.
  for (const label of ['Search mail', 'Search photos', 'Search notes', 'Search files']) {
    const at = template.indexOf(`aria-label="${label}" placeholder`);
    assert.ok(at > 0, `${label} field is in the template`);
    const wrapper = template.lastIndexOf('<div style="flex-grow: 1;', at);
    assert.match(template.slice(wrapper, at), /^<div style="flex-grow: 1; min-width: 0;/, `${label} wrapper can shrink`);
  }
  // Every menu or sheet over a scrim owns focus: the scrim is out of the tab order, the panel is
  // a named dialog, and both sit in a container bound to a focus-owning ref.
  const lines = template.split('\n');
  const retained = enabledViews();
  let scrims = 0;
  lines.forEach((line, index) => {
    const scrim = line.match(/^\s*<button[^>]*aria-label="Close[^"]*"[^>]*onClick="\{\{([a-z]+)\.[^"]*"[^>]*inset: ?0/);
    if (!scrim || !retained.includes(scrim[1])) return;
    scrims++;
    assert.match(line, /tabindex="-1"/, `scrim on line ${index + 1} is out of the tab order`);
    assert.match(lines[index - 1], /<div ref="\{\{[a-zA-Z.]+\}\}"/, `scrim on line ${index + 1} sits in a focus-owning container`);
    assert.match(lines[index + 1], /role="dialog"[^>]* aria-label="[^"]+"/, `panel on line ${index + 2} is a named dialog`);
  });
  assert.ok(scrims >= 13, `the template still marks its scrim popups (${scrims})`);
  const access = read('apps/app/src/prototype/subview-accessibility.ts');
  for (const ref of [...template.matchAll(/<div ref="\{\{([a-z]+)\.([a-zA-Z]+)\}\}" data-alpha-popup/g)])
    assert.match(access, new RegExp(`${ref[1]}:\\[[^\\n]*\\['${ref[2]}'`), `${ref[1]}.${ref[2]} is provided by subview-accessibility.ts`);
  // Settings re-releases its top page on every render; it must not release one a sheet holds.
  assert.match(read('apps/app/src/prototype/model.js'), /if \(!root\.querySelector\("\[data-alpha-popup\]"\)\) \{\s*current\.inert = false;/);
  // The find bar is bound to its open flag, not to the always-present binding object.
  assert.ok(template.includes('<sc-if value="{{browser.finding}}">'));
  assert.ok(!template.includes('<sc-if value="{{browser.find}}">'));
  assert.ok(template.includes('onChange="{{browser.find.onInput}}"'));
});
