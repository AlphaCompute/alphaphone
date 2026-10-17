import {test,expect} from '@playwright/test';
for(const theme of ['light','dark'])test(`Files location labels align with multiline descriptions in ${theme}`,async({page},info)=>{
 await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));
 await page.goto(`/?mode=dev&theme=${theme}`);
 await page.getByRole('button',{name:'Files',exact:true}).click();
 const grid=page.locator('[data-alpha-app-scroll="files"] .alpha-fit-grid').first();
 await expect(grid).toBeVisible();
 await page.evaluate(()=>Promise.all(document.getAnimations().filter(animation=>animation.effect?.getComputedTiming().iterations!==Infinity).map(animation=>animation.finished.catch(()=>{}))));
 const labels=await grid.locator(':scope > button').evaluateAll(buttons=>buttons.map(button=>({row:Math.round(button.getBoundingClientRect().top),label:button.querySelector('div')!.getBoundingClientRect().top})));
 expect(labels.length).toBeGreaterThan(1);
 for(const row of new Set(labels.map(label=>label.row))){const peers=labels.filter(label=>label.row===row);expect(Math.max(...peers.map(p=>p.label))-Math.min(...peers.map(p=>p.label))).toBeLessThan(1);}
 await page.screenshot({path:info.outputPath('files-aligned.png')});
});
