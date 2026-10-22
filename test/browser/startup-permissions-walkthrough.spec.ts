import {test,expect,type Page} from '@playwright/test';
async function walkthrough(page:Page,deny=false,theme='light'){
 await page.route(/^https?:\/\/(?!127\.0\.0\.1:|localhost:)/,route=>route.abort());
 await page.addInitScript(({deny})=>{
  localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'none'}));localStorage.setItem('alpha.startup-permissions.v1',JSON.stringify({dismissed:true,attempted:{}}));
  const state=(window as any).walkthroughProof={permission:'prompt',captureCalls:0,stops:0};
  Object.defineProperty(window,'Notification',{configurable:true,value:{permission:'default',requestPermission:async()=>{throw Error('Visual test must not request notifications');}}});
  Object.defineProperty(navigator,'permissions',{configurable:true,value:{query:async()=>({state:state.permission})}});
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{state.captureCalls++;if(deny){state.permission='denied';throw new DOMException('Denied','NotAllowedError');}state.permission='granted';return {getAudioTracks:()=>[{readyState:'live'}],getTracks:()=>[{stop(){state.stops++;}}]};}}});
 },{deny});
 await page.goto('/?theme='+theme);
 await page.evaluate(async()=>{const c=(await import('/src/runtime/connection-ui.tsx')).connectionController;c.close();(await import('/src/startup-permission-flow.ts')).reopenStartupPermissions();});
 await expect(page.getByRole('dialog',{name:'Set up Alpha access',exact:true})).toBeVisible();
}
for(const viewport of [{width:412,height:915,theme:'light'},{width:1280,height:800,theme:'light'},{width:842,height:390,theme:'dark'}])test(`sequential access walkthrough and Ready fit ${viewport.width}`,async({page},info)=>{
 await page.setViewportSize({width:viewport.width,height:viewport.height});await walkthrough(page,false,viewport.theme);const setup=page.getByRole('dialog',{name:'Set up Alpha access',exact:true});
 await expect(setup.getByRole('heading',{name:'Talk to Alpha',exact:true})).toBeVisible();await expect(setup.getByRole('button',{name:'Enable microphone'})).toBeVisible();await page.evaluate(()=>document.fonts.ready);
 const bounds=await setup.boundingBox();expect(bounds!.width).toBeGreaterThanOrEqual(viewport.width*.95);expect(bounds!.height).toBeGreaterThanOrEqual(viewport.height*.95);
 await expect(setup.locator('h2')).toHaveCount(1);expect(await setup.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);if(!process.env.ALPHA_WIZARD_NO_SCREENSHOTS)await page.screenshot({path:info.outputPath(`microphone-${viewport.width}.png`),animations:'disabled'});
 await setup.getByRole('button',{name:'Not now',exact:true}).click();await expect(setup.getByRole('heading',{name:'Stay in the loop',exact:true})).toBeVisible();
 await setup.getByRole('button',{name:'Previous setup step'}).click();await expect(setup.getByRole('heading',{name:'Talk to Alpha',exact:true})).toBeVisible();
 await setup.getByRole('button',{name:'Not now',exact:true}).click();await setup.getByRole('button',{name:'Not now',exact:true}).click();await expect(setup.getByRole('heading',{name:'Bring your day together',exact:true})).toBeVisible();
 await setup.getByRole('button',{name:'Not now',exact:true}).click();await expect(setup.getByRole('heading',{name:'Keep your files handy',exact:true})).toBeVisible();await setup.getByRole('button',{name:'Continue',exact:true}).click();
 const ready=page.getByRole('dialog',{name:'You’re all set',exact:true});await expect(ready).toBeVisible();await expect(ready.getByRole('button',{name:'Go to Alpha'})).toBeVisible();if(!process.env.ALPHA_WIZARD_NO_SCREENSHOTS)await page.screenshot({path:info.outputPath(`ready-${viewport.width}.png`),animations:'disabled'});
 expect(await page.evaluate(()=>(window as any).walkthroughProof.captureCalls)).toBe(0);await ready.getByRole('button',{name:'Go to Alpha'}).click();await expect(page.locator('dialog.alpha-startup-permissions')).toHaveCount(0);
 await page.reload();await expect(page.locator('dialog.alpha-startup-permissions')).toHaveCount(0);
});
test('an explicit microphone denial stays on the step and Back cannot repeat the prompt',async({page})=>{
 await walkthrough(page,true);const setup=page.getByRole('dialog',{name:'Set up Alpha access',exact:true});await setup.getByRole('button',{name:'Enable microphone'}).click();await expect(setup.getByRole('heading',{name:'Talk to Alpha',exact:true})).toBeVisible();await expect(setup.getByRole('button',{name:'Check microphone again'})).toBeVisible();
 await setup.getByRole('button',{name:'Not now',exact:true}).click();await setup.getByRole('button',{name:'Previous setup step'}).click();await setup.getByRole('button',{name:'Check microphone again'}).click();expect(await page.evaluate(()=>(window as any).walkthroughProof.captureCalls)).toBe(1);
});
