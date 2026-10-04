import {test,expect} from '@playwright/test';

test('workflow retirement does not render against revoked document storage and resumes cleanly',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?mode=dev&workflows=agent');
 await expect(page.getByRole('button',{name:'Device controls',exact:true})).toBeVisible();
 await page.evaluate(async()=>{
  const get=Storage.prototype.getItem;
  Object.defineProperty(document,'hidden',{configurable:true,value:true});
  Storage.prototype.getItem=function(key){if(key==='alpha.browser.device.v1')throw new DOMException('Departing document storage revoked','InvalidStateError');return get.call(this,key);};
  try{document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('pagehide'));await new Promise(resolve=>setTimeout(resolve,100));}
  finally{Storage.prototype.getItem=get;delete (document as unknown as {hidden?:boolean}).hidden;}
  window.dispatchEvent(new Event('pageshow'));document.dispatchEvent(new Event('visibilitychange'));
 });
 await expect(page.getByRole('button',{name:'Device controls',exact:true})).toBeVisible();
 expect(errors).toEqual([]);
});
