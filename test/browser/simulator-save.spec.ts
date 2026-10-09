import {test,expect} from '@playwright/test';
test('storage failure keeps Contacts navigable and retains the draft for a successful retry',async({page})=>{
 const failures:string[]=[];page.on('pageerror',e=>failures.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'}));const set=Storage.prototype.setItem;(window as any).allowSimulatorSave=false;(window as any).simulatorWrites=0;Storage.prototype.setItem=function(key,value){if(key==='alpha.dev.app.contacts'){(window as any).simulatorWrites++;if(!(window as any).allowSimulatorSave)throw Error('Storage full');}return set.call(this,key,value);};});
 await page.goto('/?mode=dev');await page.getByRole('button',{name:'Contacts',exact:true}).click();await page.getByRole('button',{name:'New contact',exact:true}).click();await page.getByPlaceholder('First name',{exact:true}).fill('Local Save Retry');
 expect(await page.evaluate(()=>(window as any).simulatorWrites)).toBe(0);expect(failures).toEqual([]);
 await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByText('Could not save Contacts. Your changes are still here. Try again after freeing app storage.',{exact:true})).toBeVisible();await expect(page.getByPlaceholder('First name',{exact:true})).toHaveValue('Local Save Retry');expect(await page.evaluate(()=>localStorage.getItem('alpha.dev.app.contacts'))).toBeNull();await expect(page.getByText('Saved',{exact:true})).toHaveCount(0);
 expect(failures).toContain('Development app save failed.');
 await page.evaluate(()=>(window as any).allowSimulatorSave=true);await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByPlaceholder('First name',{exact:true})).toHaveCount(0);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('alpha.dev.app.contacts')!).list.filter((r:any)=>r.first==='Local Save Retry').length)).toBe(1);
 await page.reload();await page.getByRole('button',{name:'Contacts',exact:true}).click();await expect(page.getByText('Local Save Retry',{exact:true})).toBeVisible();
});
test('transient simulator updates do not write unrelated saved data',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));await page.goto('/?mode=dev');
 const result=await page.evaluate(async()=>{const {Component}=await import('/src/prototype/model.js');const writes:string[]=[];const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('alpha.dev.app.'))writes.push(key);return set.call(this,key,value);};let state:any={};const owner={vget:()=>state,setState(fn:any){state={...state,...fn({vs:{}})};}};for(const name of ['phone','messages','contacts','inbox','workflows','wallet'])Component.prototype.vset.call(owner,name,{open:null});Storage.prototype.setItem=set;return writes;});expect(result).toEqual([]);
});
