import {test,expect} from '@playwright/test';
for(const theme of ['light','dark'])for(const state of ['maps','maps:route','maps:nav'])test(`illustrated map labels remain readable ${theme} ${state}`,async({page},info)=>{
 await page.goto(`/?mode=mock&theme=${theme}&start=${state}`);
 const labels=page.locator('[data-alpha-map-label]');await expect(labels.first()).toBeAttached();
 const ratios=await labels.evaluateAll(elements=>elements.map(element=>{
  const css=getComputedStyle(element),numbers=(s:string)=>s.match(/[\d.]+/g)!.map(Number);
  const bg=numbers(css.backgroundColor),fg=numbers(css.color);
  if((bg[3]??1)!==1)return 0;
  const lum=(c:number[])=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
  const x=lum(fg),y=lum(bg);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
 }));
 expect(ratios.length).toBeGreaterThan(0);for(const ratio of ratios)expect(ratio).toBeGreaterThanOrEqual(4.5);
 await page.screenshot({path:info.outputPath('map-labels.png'),animations:'disabled'});
});
