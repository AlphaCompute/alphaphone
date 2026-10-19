import {test} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
declare global { interface Window { calls: {email:number;external:number;copy:number}; current:boolean; openSharePanel: (options: import('../../apps/app/src/runtime/share-panel').SharePanelOptions) => Promise<void>; } }
const script=stripTypeScriptTypes(fs.readFileSync('apps/app/src/runtime/share-panel.ts','utf8').replace(/^export /gm,''),{mode:'transform'})+'\nwindow.openSharePanel=openSharePanel;';
test('common Share panel keeps email/external explicit and retires without fallback',async({page})=>{
 await page.setContent('<button id="origin">Share selected</button>');await page.addScriptTag({content:script});
 const open=()=>page.evaluate(()=>{window.calls={email:0,external:0,copy:0};window.current=true;void window.openSharePanel({title:'Selected note',current:()=>window.current,email:()=>window.calls.email++,external:()=>{window.calls.external++;throw new DOMException('Cancel','AbortError');},copy:()=>window.calls.copy++});});
 await open();await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.deepEqual(await page.evaluate(()=>window.calls),{email:0,external:0,copy:0});
 await open();await page.getByRole('button',{name:'Share to email',exact:true}).click();assert.deepEqual(await page.evaluate(()=>window.calls),{email:1,external:0,copy:0});
 await open();await page.getByRole('button',{name:'Share externally',exact:true}).click();assert.deepEqual(await page.evaluate(()=>window.calls),{email:0,external:1,copy:0});await page.waitForTimeout(30);assert.equal(await page.getByRole('alert').count(),0);
 await open();await page.evaluate(()=>{window.current=false;});await page.getByRole('dialog',{name:'Share',exact:true}).waitFor({state:'detached'});assert.deepEqual(await page.evaluate(()=>window.calls),{email:0,external:0,copy:0});
 await open();await page.evaluate(()=>window.dispatchEvent(new Event('launcher-home')));assert.equal(await page.getByRole('dialog',{name:'Share',exact:true}).count(),0);assert.deepEqual(await page.evaluate(()=>window.calls),{email:0,external:0,copy:0});
});
