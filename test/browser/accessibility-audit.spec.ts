import { test, expect, type Page } from '@playwright/test';
import { auditPage, auditTabOrder, auditTree, format } from './accessibility-audit';

// The sweep is only as good as its checks. Each rule is shown here to fire on a seeded defect
// and to stay quiet on the corrected markup, so a silent sweep means a clean page.
const page_ = (body: string) => `<!doctype html><html lang="en"><body style="margin:0;font:16px sans-serif;background:#fff;color:#000">${body}</body></html>`;
const rules = (lines: string[]) => [...new Set(lines.map(line => line.split(':')[0]))].sort();
async function load(page: Page, body: string) { await page.setContent(page_(body)); }

test('names and focusability come from the accessibility tree', async ({ page }) => {
  await load(page, `<button><svg width="20" height="20" aria-hidden="true"></svg></button>
    <input type="text"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="40" height="40">
    <div role="dialog"><p>Untitled</p></div><div role="button">Not focusable</div>`);
  const found = format(await auditTree(page));
  expect(rules(found)).toEqual(['accessible-name', 'keyboard-focusable']);
  expect(found.filter(line => line.startsWith('accessible-name'))).toHaveLength(4);
  expect(found.filter(line => line.startsWith('keyboard-focusable')).join()).toContain('Not focusable');

  await load(page, `<button aria-label="Close"><svg width="20" height="20" aria-hidden="true"></svg></button>
    <label>Name <input type="text"></label><img alt="A lighthouse" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="40" height="40">
    <div role="dialog" aria-label="Details"><p>Titled</p></div><div role="button" tabindex="0">Focusable</div>`);
  expect(format(await auditTree(page))).toEqual([]);
});

test('hidden focus, broken references, small targets and low contrast are reported', async ({ page }) => {
  await load(page, `<div aria-hidden="true"><button>Behind</button></div>
    <button aria-labelledby="missing" style="width:16px;height:16px;padding:0">x</button>
    <p style="color:#999;background:#fff">Grey on white</p>
    <div style="background:#000"><p style="color:#fff;opacity:.4">Faded on black</p></div>`);
  const found = format(await auditPage(page, { contrast: true, targetSize: 24 }));
  expect(rules(found)).toEqual(['aria-hidden-focus', 'aria-reference', 'contrast', 'target-size']);
  expect(found.filter(line => line.startsWith('contrast'))).toHaveLength(2);

  await load(page, `<div aria-hidden="true" inert><button>Behind</button></div>
    <span id="present">Close</span><button aria-labelledby="present" style="width:24px;height:24px;padding:0">x</button>
    <p style="color:#595959;background:#fff">Grey on white</p>
    <p style="color:#8a8a8a;background:#fff;font-size:24px">Large grey on white</p>
    <button disabled style="color:#bbb;background:#fff">Unavailable</button>`);
  expect(format(await auditPage(page, { contrast: true, targetSize: 24 }))).toEqual([]);
});

test('clipped text, spilling labels and unreachable controls are reported; ellipsis is separate', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 300 });
  await load(page, `<div class="os" style="position:relative;width:400px;height:300px;overflow:hidden">
    <div id="cut" style="width:80px;height:14px;overflow:hidden;white-space:nowrap;font-size:20px">Cut through the middle</div>
    <div id="ellipsis" style="width:80px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">Deliberately shortened preview</div>
    <button id="spill" style="width:40px;height:24px;padding:0;white-space:nowrap">A label that spills over</button>
    <button id="below" style="position:absolute;top:400px;left:0">Below the fold</button>
    <button id="side" style="position:absolute;top:100px;left:380px;width:80px">Off the side</button>
  </div>`);
  const found = format(await auditPage(page, { clipping: true }));
  expect(rules(found)).toEqual(['control-off-screen', 'control-unreachable', 'label-overflows-control', 'text-clipped', 'text-truncated']);
  expect(found.find(line => line.startsWith('text-truncated'))).toContain('Deliberately shortened');
  expect(found.find(line => line.startsWith('text-clipped'))).toContain('Cut through');

  // Nothing clips this paragraph, so it simply runs off the side of the phone.
  await load(page, `<div class="os" style="position:relative;width:400px;height:300px"><p style="position:absolute;left:340px;top:20px;margin:0;white-space:nowrap">Runs off the side</p></div>`);
  expect(rules(format(await auditPage(page, { clipping: true })))).toEqual(['text-off-screen']);

  await load(page, `<div class="os" style="position:relative;width:400px;height:300px;overflow:hidden">
    <div style="height:300px;overflow-y:auto"><p style="font-size:20px">Wraps instead of being cut through the middle of a line</p>
    <button style="min-height:24px">A label that fits</button><div style="height:400px"></div><button>Below the fold, but scrollable</button></div>
    <div style="width:80px;height:20px;overflow:hidden"><span style="display:block;height:20px">Fits</span><span style="display:block">Hidden whole</span></div>
  </div>`);
  expect(format(await auditPage(page, { clipping: true }))).toEqual([]);
});

test('a focus trap and focus inside hidden content are reported; a bounded order is not', async ({ page }) => {
  await load(page, `<button>One</button><button id="trap">Trap</button><button>Never reached</button>
    <script>document.getElementById('trap').addEventListener('keydown',event=>{if(event.key==='Tab')event.preventDefault();});</script>`);
  expect(rules(format(await auditTabOrder(page)))).toEqual(['focus-trap']);

  await load(page, `<button>One</button><div aria-hidden="true"><button>Hidden but focusable</button></div><button>Three</button>`);
  expect(rules(format(await auditTabOrder(page)))).toEqual(['focus-in-hidden-content']);

  // A modal with one control holds focus by design.
  await load(page, `<div role="dialog" aria-label="Notice"><button id="only">OK</button></div>
    <script>document.getElementById('only').addEventListener('keydown',event=>{if(event.key==='Tab')event.preventDefault();});</script>`);
  expect(format(await auditTabOrder(page))).toEqual([]);

  await load(page, `<button>One</button><a href="#two">Two</a><input aria-label="Three">`);
  expect(format(await auditTabOrder(page))).toEqual([]);
});
