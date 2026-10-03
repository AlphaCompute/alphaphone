import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
// Exercise the exact harmless query dispatched by the native startup probe.
const source=readFileSync(new URL('../../android/app/src/androidTest/java/ai/elizaresearch/alphaphone/StartupDocumentProbe.java',import.meta.url),'utf8');
const match=source.match(/evaluateJavascript\(("(?:[^"\\]|\\.)*"),value/);
if(!match)throw Error('Native startup readiness query was not found');
const query=JSON.parse(match[1]);
test('native readiness accepts rendered mock mode and requires the live navigation marker after exit',async({page})=>{
 await page.goto('/?mode=mock');
 await expect(page.getByRole('button',{name:'Exit mock mode',exact:true})).toBeVisible();
 expect(await page.locator('html').getAttribute('data-active-view')).toBeNull();
 await expect.poll(()=>page.evaluate(query)).toBe('mock');
 await page.getByRole('button',{name:'Exit mock mode',exact:true}).click();
 await expect.poll(()=>page.evaluate(query)).toBe('live');
 await page.evaluate(()=>{delete document.documentElement.dataset.activeView;});
 expect(await page.evaluate(query)).toBeNull();
});
