import {test,expect,type Page} from '@playwright/test';
const key='alpha.dev.location.v1',broken=' \n { broken location bytes 🌍 ';
async function open(page:Page,raw=broken){
 await page.addInitScript(({key,raw})=>{localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'}));localStorage.setItem(key,raw);},{key,raw});
 await page.goto('/?mode=dev&tools=1');await page.getByRole('button',{name:'Device controls',exact:true}).click();await page.getByRole('dialog',{name:'Development device controls'}).getByRole('button',{name:'Location',exact:true}).click();
 return page.getByRole('dialog',{name:'Development location'});
}
for(const raw of [broken,'',JSON.stringify({mode:'coordinates',latitude:200})])test(`unreadable location retains exact backup and requires confirmed replacement: ${JSON.stringify(raw)}`,async({page},info)=>{
 const dialog=await open(page,raw);await expect(dialog.getByRole('status')).toContainText('unreadable');
 const download=page.waitForEvent('download');await dialog.getByRole('button',{name:'Download location settings backup',exact:true}).click();
 const stream=await(await download).createReadStream(),chunks:Buffer[]=[];for await(const chunk of stream!)chunks.push(Buffer.from(chunk));expect(Buffer.concat(chunks)).toEqual(Buffer.from(raw));
 await dialog.getByLabel('Location source',{exact:true}).selectOption('coordinates');await dialog.getByLabel('Latitude',{exact:true}).fill('12.5');
 await dialog.getByRole('button',{name:'Replace saved location settings',exact:true}).click();expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe(raw);
 if(raw===broken)await page.screenshot({path:info.outputPath('location-replacement-review.png')});
 await dialog.getByRole('button',{name:'Confirm location replacement',exact:true}).click();await expect(dialog).toHaveCount(0);
 expect(await page.evaluate(async()=>(await import('/src/browser/location-simulation.ts')).readLocationSimulation())).toMatchObject({mode:'coordinates',latitude:12.5,longitude:0});
});
test('stale recovery cannot replace another tab location choice',async({page,context})=>{
 const dialog=await open(page);await dialog.getByRole('button',{name:'Replace saved location settings',exact:true}).click();
 const other=await context.newPage();await other.goto('/?mode=dev');const saved=await other.evaluate(async()=>{const m=await import('/src/browser/location-simulation.ts');m.saveLocationSimulation({mode:'coordinates',latitude:23,longitude:45,accuracy:5,homeId:'',radius:200});return localStorage.getItem(m.locationSimulationKey);});
 await dialog.getByRole('button',{name:'Confirm location replacement',exact:true}).click();await expect(dialog.getByRole('status')).toContainText('changed');expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe(saved);
});
test('replacement failure retains the original bytes and editor',async({page})=>{
 const dialog=await open(page);await dialog.getByRole('button',{name:'Replace saved location settings',exact:true}).click();
 await page.evaluate(key=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(name,value){if(name===key)throw new DOMException('Location storage full','QuotaExceededError');return set.call(this,name,value);};},key);
 await dialog.getByRole('button',{name:'Confirm location replacement',exact:true}).click();await expect(dialog.getByRole('status')).toContainText('Location storage full');expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe(broken);
});
test('leaving recovery cancels confirmation without changing settings',async({page})=>{
 const dialog=await open(page);await dialog.getByRole('button',{name:'Replace saved location settings',exact:true}).click();await page.evaluate(()=>window.dispatchEvent(new Event('launcher-home')));await expect(dialog).toHaveCount(0);expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe(broken);
});
test('invalid coordinates are refused and edits require a new confirmation',async({page})=>{
 const dialog=await open(page);await dialog.getByLabel('Latitude',{exact:true}).fill('200');await dialog.getByRole('button',{name:'Replace saved location settings',exact:true}).click();await expect(dialog.getByRole('button',{name:'Confirm location replacement',exact:true})).toHaveCount(0);expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe(broken);
 await dialog.getByLabel('Latitude',{exact:true}).fill('12');await dialog.getByRole('button',{name:'Replace saved location settings',exact:true}).click();await dialog.getByLabel('Latitude',{exact:true}).fill('13');await expect(dialog.getByRole('button',{name:'Replace saved location settings',exact:true})).toBeVisible();expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe(broken);
});
test('unavailable saved places do not erase existing Home and Work bindings',async({page})=>{
 const value={mode:'coordinates',latitude:1,longitude:2,accuracy:5,homeId:'retained-home',radius:200,workId:'retained-work',workRadius:300};
 await page.addInitScript(({key,value})=>{localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'}));localStorage.setItem(key,JSON.stringify(value));},{key,value});await page.goto('/?mode=dev&tools=1');
 await page.evaluate(async()=>{const {SavedPlaces}=await import('/src/maps/saved-places.ts');SavedPlaces.prototype.read=()=>{throw Error('Unavailable places');};});
 await page.getByRole('button',{name:'Device controls',exact:true}).click();await page.getByRole('dialog',{name:'Development device controls'}).getByRole('button',{name:'Location',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Development location'});
 await expect(dialog.getByLabel('Home place',{exact:true})).toBeDisabled();await expect(dialog.getByLabel('Work place',{exact:true})).toBeDisabled();await dialog.getByLabel('Latitude',{exact:true}).fill('3');await dialog.getByRole('button',{name:'Save location',exact:true}).click();await expect(dialog).toHaveCount(0);
 expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),key)).toEqual({...value,latitude:3});
});
