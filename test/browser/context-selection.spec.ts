import {test,expect,type Page} from '@playwright/test';
// MVP-13: folder, notification and capture questions keep the exact selected identity and
// revision. A switch, delete or revoke during review adds nothing and never sends a neighbor.
const offline=(page:Page)=>page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));
const selectedObject=(page:Page)=>page.evaluate(async()=>(await import('/src/runtime/alpha-client.ts')).alphaClient.getState().context.selectedObject??null);
const composer=(page:Page)=>page.getByRole('textbox',{name:'Message Alpha',exact:true});
const review=(page:Page)=>page.getByRole('dialog',{name:'Ask about selected content'});
async function seedFolder(page:Page){
 return page.evaluate(async()=>{
  const {registerPlugin}=await import('/src/platform-plugins.ts');const files=registerPlugin<any>('AlphaFiles');
  await files.importDirectory([{path:'alpha.txt',file:new File(['PRIVATE_FILE_BODY_CANARY'],'alpha.txt',{type:'text/plain'})},{path:'beta.txt',file:new File(['two'],'beta.txt',{type:'text/plain'})},{path:'inner/deep.txt',file:new File(['PRIVATE_NESTED_CANARY'],'deep.txt',{type:'text/plain'})}],'Review scope');
  await files.importDirectory([{path:'neighbor.txt',file:new File(['n'],'neighbor.txt',{type:'text/plain'})}],'Neighbor folder');
  const root=await files.list({});return {root:root.folder.id,scope:root.entries.find((row:any)=>row.name==='Review scope').id,neighbor:root.entries.find((row:any)=>row.name==='Neighbor folder').id};
 });
}
async function openFolder(page:Page,name:string){
 await page.getByRole('button',{name:'Files',exact:true}).click();await page.getByText('App files',{exact:true}).first().click();
 await page.getByRole('button',{name:'Open '+name,exact:true}).click();await expect(page.getByRole('button',{name:'Open alpha.txt',exact:true})).toBeVisible();
}
const askFolder=async(page:Page)=>{await page.getByRole('button',{name:'View and sort',exact:true}).click();await page.getByText('Ask Alpha about this folder',{exact:true}).click();};

test.describe('folder',()=>{
 test.beforeEach(async({page})=>{await offline(page);await page.goto('/');});
 test('the browsed folder is an opaque identity that follows the listing and ends with the folder view',async({page})=>{
  const ids=await seedFolder(page);await openFolder(page,'Review scope');
  await expect.poll(()=>selectedObject(page)).toMatchObject({kind:'folder',id:ids.scope});
  const first=await selectedObject(page);
  expect(Object.keys(first!).sort()).toEqual(['id','kind','revision']);expect(first!.revision).toMatch(/^listing-\d+$/);expect(JSON.stringify(first)).not.toMatch(/Review scope|alpha\.txt/);
  // The same listing keeps its revision; a changed listing gets a new one.
  await page.getByRole('button',{name:'View and sort',exact:true}).click();await page.getByText('Refresh folder',{exact:true}).click();await expect(page.getByRole('button',{name:'Open alpha.txt',exact:true})).toBeVisible();
  expect(await selectedObject(page)).toEqual(first);
  await page.evaluate(async id=>{const {registerPlugin}=await import('/src/platform-plugins.ts');await registerPlugin<any>('AlphaFiles').createFolder({id,name:'added'});},ids.scope);
  await page.getByRole('button',{name:'View and sort',exact:true}).click();await page.getByText('Refresh folder',{exact:true}).click();await expect(page.getByRole('button',{name:'Open added',exact:true})).toBeVisible();
  await expect.poll(async()=>(await selectedObject(page))?.revision).not.toBe(first!.revision);expect((await selectedObject(page))!.id).toBe(ids.scope);
  // A subfolder is its own identity; an opened file replaces the folder; leaving ends it.
  await page.getByRole('button',{name:'Open inner',exact:true}).click();await expect(page.getByRole('button',{name:'Open deep.txt',exact:true})).toBeVisible();
  await expect.poll(async()=>(await selectedObject(page))?.id).not.toBe(ids.scope);expect((await selectedObject(page))!.kind).toBe('folder');
  await page.getByRole('button',{name:'Open deep.txt',exact:true}).click();await expect.poll(async()=>(await selectedObject(page))?.kind).toBe('document');
  // Closing the file returns to its folder's identity; leaving the folder tree ends it.
  await page.evaluate(()=>window.dispatchEvent(new Event('alpha-back',{cancelable:true})));await expect.poll(async()=>(await selectedObject(page))?.kind).toBe('folder');
  await expect.poll(async()=>{await page.evaluate(()=>window.dispatchEvent(new Event('alpha-back',{cancelable:true})));return selectedObject(page);}).toBeNull();
 });
 test('a folder question reviews only that folder\'s entry names and places the reviewed draft',async({page})=>{
  await seedFolder(page);await openFolder(page,'Review scope');await askFolder(page);
  const dialog=review(page);await expect(dialog.getByRole('heading')).toHaveText('Ask about folder Review scope');
  const excerpt=dialog.getByRole('textbox',{name:'Content excerpt'});
  await expect(excerpt).toHaveValue(/^Folder: Review scope\n3 entries listed by name and type\. File contents and subfolder contents are not included\./);
  const value=await excerpt.inputValue();expect(value).toContain('- alpha.txt (Text)');expect(value).toContain('- inner (Folder)');expect(value).not.toMatch(/deep\.txt|CANARY|neighbor/);
  await excerpt.fill('Folder: Review scope\n- alpha.txt (Text)');await dialog.getByRole('button',{name:'Use in conversation',exact:true}).click();
  await expect(composer(page)).toHaveValue('What is in this folder?\n\nSource: folder Review scope\n\nFolder: Review scope\n- alpha.txt (Text)');
 });
 for(const change of ['delete','add','revoke'] as const)test(`a folder ${change} during review adds nothing to the conversation`,async({page})=>{
  const ids=await seedFolder(page);await openFolder(page,'Review scope');await askFolder(page);
  const dialog=review(page);await expect(dialog.getByRole('textbox',{name:'Content excerpt'})).toHaveValue(/alpha\.txt/);
  await page.evaluate(async({ids,change})=>{
   const {registerPlugin}=await import('/src/platform-plugins.ts');const files=registerPlugin<any>('AlphaFiles');
   if(change==='revoke'){
    // The browser's app files cannot lose a grant. Stand in for Android's answer at the plugin
    // boundary: a listing that reports the folder grant ended.
    let owner=Object.getPrototypeOf(files);const {BrowserFiles}=await import('/src/browser/files.ts');owner=BrowserFiles.prototype;
    while(owner&&!Object.prototype.hasOwnProperty.call(owner,'list'))owner=Object.getPrototypeOf(owner);
    owner.list=async()=>({status:'revoked',message:'Folder access ended. Choose the folder again.'});return;
   }
   if(change==='add'){await files.createFolder({id:ids.scope,name:'arrived later'});return;}
   const row=(await files.list({id:ids.scope})).entries.find((entry:any)=>entry.name==='alpha.txt');await files.delete({id:row.id,expectedRevision:row.revision,confirmPermanent:true});
  },{ids,change});
  await dialog.getByRole('button',{name:'Use in conversation',exact:true}).click();
  await expect(page.getByText(/Nothing was added to your conversation\./)).toBeVisible();
  await expect(dialog).toHaveCount(0);await expect(composer(page)).toHaveCount(0);
  if(change==='delete')await expect(page.getByRole('button',{name:'Open alpha.txt',exact:true})).toHaveCount(0);
  if(change==='add')await expect(page.getByRole('button',{name:'Open arrived later',exact:true})).toBeVisible();
  if(change==='revoke'){await expect(page.getByText('Folder access ended. Choose the folder again. Nothing was added to your conversation.',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Open alpha.txt',exact:true})).toHaveCount(0);await expect.poll(()=>selectedObject(page)).toBeNull();}
 });
});

test.describe('notification',()=>{
 test.beforeEach(async({page})=>{await offline(page);await page.goto('/?mode=dev&tools=1');});
 async function post(page:Page,rows:Array<{id:string;title:string;body:string}>){
  await page.evaluate(async rows=>{
   const {registerPlugin}=await import('/src/platform-plugins.ts');const daily=registerPlugin<any>('DailyApps'),notices=registerPlugin<any>('AlphaNotifications');
   for(const row of rows)await daily.scheduleReminder({id:row.id,title:row.title,body:row.body,at:Date.now()+60000});
   await (await import('/src/browser/reminder-store.ts')).reminderDocument.edit(()=>({reminders:[] as any[]}),data=>{data.reminders.forEach((row:any,index:number)=>{row.at=Date.now()-1000-index;});});
   await notices.setNotificationPolicy({expectedRevision:(await notices.crossAppStatus()).revision,enabled:true,apps:[{packageName:'browser.mail',preview:true}]});
   await notices.inject({packageName:'browser.mail',title:'Other app title',text:'Other app text'});
  },rows);
  await page.getByRole('button',{name:'Device controls',exact:true}).click();await page.getByRole('dialog',{name:'Development device controls'}).getByRole('button',{name:'Notifications',exact:true}).click();
 }
 const rows=[{id:'context-first',title:'Call the clinic',body:'Ask about Tuesday'},{id:'context-second',title:'Water the plants',body:'Neighbor reminder'}];
 const ask=(page:Page)=>page.getByRole('button',{name:'Ask Alpha about this Alpha Phone notification',exact:true});
 test('only own notifications offer a question, and the reviewed text is what reaches the draft',async({page})=>{
  await post(page,rows);await expect(page.getByText('Ask about Tuesday',{exact:true})).toBeVisible();await expect(page.getByText('Other app title · Other app text',{exact:true})).toBeVisible();
  await expect(ask(page)).toHaveCount(2);await expect(page.getByRole('button',{name:/^Ask Alpha about this Mail/})).toHaveCount(0);
  await page.locator('.alpha-shade-list > div',{hasText:'Call the clinic'}).getByRole('button',{name:/^Ask Alpha/}).click();
  // Pressing the row selects exactly that notification as opaque context while the shade is open.
  expect(await selectedObject(page)).toMatchObject({kind:'notification',id:'context-first',accountId:'own'});
  const dialog=review(page);await expect(dialog.getByRole('heading')).toHaveText('Ask about Alpha Phone notification');
  await expect(dialog.getByRole('textbox',{name:'Content excerpt'})).toHaveValue('Call the clinic\nAsk about Tuesday');
  // Verification codes are not placed in a draft.
  await dialog.getByRole('textbox',{name:'Content excerpt'}).fill('Your verification code is 481516');await dialog.getByRole('button',{name:'Use in conversation',exact:true}).click();
  await expect(dialog.getByRole('status')).toHaveText('This excerpt may contain credentials or verification codes. Remove them before continuing.');
  await dialog.getByRole('textbox',{name:'Content excerpt'}).fill('Call the clinic');await dialog.getByRole('button',{name:'Use in conversation',exact:true}).click();
  await expect(composer(page)).toHaveValue('Help me with this notification.\n\nSource: Alpha Phone notification\n\nCall the clinic');
  // The selection does not outlive the shade.
  expect((await selectedObject(page))?.kind).not.toBe('notification');
 });
 test('dismissing the reviewed notification never sends its neighbor',async({page})=>{
  await post(page,rows);await page.locator('.alpha-shade-list > div',{hasText:'Call the clinic'}).getByRole('button',{name:/^Ask Alpha/}).click();
  const dialog=review(page);await expect(dialog.getByRole('textbox',{name:'Content excerpt'})).toHaveValue(/Call the clinic/);
  await page.evaluate(async()=>{const {registerPlugin}=await import('/src/platform-plugins.ts');const notices=registerPlugin<any>('AlphaNotifications');const row=(await notices.list()).items.find((item:any)=>item.id==='context-first');await notices.dismiss({id:row.id,revision:row.revision,source:'own'});});
  await dialog.getByRole('button',{name:'Use in conversation',exact:true}).click();
  // Either the open review reports the change or the final re-read refuses it; nothing is composed.
  await expect(page.getByText(/Selection changed\. Close this review|Nothing was added to your conversation\./)).toBeVisible();
  await expect(composer(page)).toHaveCount(0);
  if(await dialog.count())await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page.getByText('Neighbor reminder',{exact:true})).toBeVisible();await expect(page.getByText('Ask about Tuesday',{exact:true})).toHaveCount(0);
 });
});

test('Settings pages publish only their section slug; the root and other views publish none',async({page})=>{
 await offline(page);await page.goto('/');
 await page.getByRole('button',{name:'Settings',exact:true}).click();expect(await selectedObject(page)).toBeNull();
 await page.getByRole('button',{name:'Display',exact:true}).click();await expect.poll(()=>selectedObject(page)).toEqual({kind:'settings',id:'display'});
});

test.describe('capture',()=>{
 const photo=(page:Page,label:string)=>page.evaluate(async label=>{const {importBrowserPhoto}=await import('/src/prototype/browser-camera.ts');const canvas=document.createElement('canvas');canvas.width=400;canvas.height=200;const context=canvas.getContext('2d')!;context.fillStyle='white';context.fillRect(0,0,400,200);context.fillStyle='black';context.font='bold 48px sans-serif';context.fillText(label,30,110);return (await importBrowserPhoto({image:canvas.toDataURL('image/jpeg'),width:400,height:200},new AbortController().signal)).id;},label);
 test.beforeEach(async({page})=>{await offline(page);await page.goto('/');});
 test('a photo question is bound to the open item and its revision',async({page})=>{
  await photo(page,'FIRST');await photo(page,'SECOND');
  await page.getByRole('button',{name:'Photos',exact:true}).click();await page.getByRole('button',{name:/Captured photo/}).first().click();
  await expect.poll(async()=>(await selectedObject(page))?.kind).toBe('photo');const selected=await selectedObject(page);
  await page.getByRole('button',{name:'Ask Alpha about this photo',exact:true}).click();
  const dialog=review(page);await expect(dialog.getByRole('heading')).toHaveText('Ask about Selected photo');await expect(dialog.getByRole('img')).toBeVisible();
  await dialog.getByRole('textbox',{name:'Content excerpt'}).fill('A reviewed description');await dialog.getByRole('button',{name:'Use in conversation',exact:true}).click();
  await expect(composer(page)).toHaveValue('Help me understand this image text or description.\n\nSource: Selected photo\n\nA reviewed description');
  // The envelope still names the same item at the same revision; no content is in it.
  expect(await selectedObject(page)).toEqual(selected);expect(Object.keys(selected!).sort()).toEqual(['id','kind','revision']);
 });
 test('a typed library search is not treated as a capture and stays visibly unavailable',async({page})=>{
  await photo(page,'ONLY');await page.getByRole('button',{name:'Photos',exact:true}).click();await expect(page.getByRole('button',{name:/Captured photo/}).first()).toBeVisible();
  await page.getByRole('button',{name:'Search photos',exact:true}).click();await page.keyboard.type('beach');
  await page.getByRole('button',{name:/^Ask .*beach/}).click();
  await expect(page.getByText('Content analysis is not connected. No photo or document content has been sent.',{exact:true})).toBeVisible();
  await expect(review(page)).toHaveCount(0);await expect(composer(page)).toHaveCount(0);
 });
});
