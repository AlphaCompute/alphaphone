import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(process.env.ALPHA_BROWSER_MODULES?path.join(process.env.ALPHA_BROWSER_MODULES,'maps-test.cjs'):import.meta.url);
const {chromium}=require('playwright');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:412,height:915}});page.setDefaultTimeout(20000);
const errors=[];page.on('console',m=>{if(m.type()==='error')console.log('renderer',m.text());});page.on('pageerror',e=>errors.push(e.message));
const requests=[];page.on('request',r=>{if(r.url().includes(':47850/'))requests.push(new URL(r.url()).pathname);});
let releaseDetail;const detailGate=new Promise(resolve=>{releaseDetail=resolve;});
let detailFetched;const detailReady=new Promise(resolve=>{detailFetched=resolve;});
// Hold a real provider response until after the user submits Directions. This
// exercises native-style detail latency without replacing any provider data.
await page.route('http://127.0.0.1:47850/place?*',async route=>{const response=await route.fetch();detailFetched();await detailGate;await route.fulfill({response});});
try{
 await page.goto('http://127.0.0.1:5194',{waitUntil:'load'});
 await page.getByRole('button',{name:'Maps',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[data-alpha-map-plane]')?.dataset.mapReady==='true');
 await page.waitForFunction(()=>Number(document.querySelector('[data-alpha-map-plane]')?.dataset.mapFeatureCount)>0);
 assert.ok(requests.some(p=>p.startsWith('/tiles/')),'Actual vector tile requests');
 const query=page.getByRole('textbox',{name:'Search places',exact:true});await query.fill('Casino');await query.press('Enter');
 await page.getByRole('button',{name:/^Casino de Monte Carlo/}).first().click();
 await page.getByRole('button',{name:'Directions',exact:true}).click();
 const origin=page.getByRole('textbox',{name:'Route origin coordinates'});await origin.fill('43.7384, 7.4246');await origin.press('Enter');
 await detailReady;
 assert.equal(requests.filter(p=>p==='/route').length,0,'Route waits for the selected place detail');
 releaseDetail();
 await page.waitForFunction(()=>document.querySelector('[data-alpha-maps-root]')?.textContent.includes('no live traffic'));
 for(const mode of ['Walk','Bike','Drive']){await page.getByRole('button',{name:mode,exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-alpha-maps-root]')?.textContent.includes('no live traffic'));}
 await origin.fill('37, -122');await origin.press('Enter');await page.getByText('Both endpoints must be inside the Monaco region.',{exact:true}).waitFor();
 assert.ok(!await page.getByText('no live traffic',{exact:false}).count(),'Old route removed on changed origin');
 await origin.fill('43.7384, 7.4246');await origin.press('Enter');await page.waitForFunction(()=>document.querySelector('[data-alpha-maps-root]')?.textContent.includes('no live traffic'));
 const dir='test-results/maps-regional-development';fs.mkdirSync(dir,{recursive:true});await page.screenshot({path:path.join(dir,'route.png')});
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(dir,'renderer.json'),JSON.stringify({passed:true,delayedRealDetail:true,requests,scope:'Real Chromium renderer + local OSM provider; native GPS and Android untested'},null,2));console.log('PASS real map tiles/search/delayed-detail route/modes/out-of-region/stale-route clearing');
}catch(error){console.log(JSON.stringify({errors,requests,state:await page.locator('[data-alpha-maps-root]').innerText().catch(()=>''),planes:await page.locator('[data-alpha-map-plane]').count()}));throw error;}finally{await browser.close();}
