import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));await page.goto('/');});
async function setup(page:any){await page.evaluate(async()=>{
 const {registerPlugin}=await import('/src/platform-plugins.ts');const b=registerPlugin<any>('AlphaBrowser');(window as any).navEvents=[];
 await b.addListener('stateChanged',(e:any)=>{if(e.session==='navigation-test')(window as any).navEvents.push(e);});
 await b.create({session:'navigation-test',id:'nav'});await b.present({session:'navigation-test',id:'nav',x:0,y:100,width:350,height:450});
});}
test('stopped loads and retired frame callbacks cannot commit or share an old address',async({page})=>{
 let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});
 await page.route('https://navigation.example/slow',async route=>{await held;await route.fulfill({contentType:'text/html',body:'<h1>Retired response</h1>'}).catch(()=>{});});
 await page.route('https://navigation.example/ready',route=>route.fulfill({contentType:'text/html',body:'<h1>Current response</h1>'}));
 await setup(page);
 await page.evaluate(async()=>{const {registerPlugin}=await import('/src/platform-plugins.ts');const b=registerPlugin<any>('AlphaBrowser');await b.navigate({session:'navigation-test',id:'nav',url:'https://navigation.example/slow'});(window as any).retiredFrame=document.querySelector('[data-browser-surface=nav] iframe');await b.command({session:'navigation-test',id:'nav',command:'stop'});});
 await expect(page.getByText('Loading stopped. Reload to open this page.',{exact:true})).toBeVisible();
 release();
 const stopped=await page.evaluate(async()=>{
  (window as any).retiredFrame.dispatchEvent(new Event('load'));const events=(window as any).navEvents,last=events.at(-1);
  const {registerPlugin}=await import('/src/platform-plugins.ts');let rejected=false;try{await registerPlugin<any>('AlphaBrowser').share({...last,url:'https://navigation.example/slow'});}catch{rejected=true;}
  return {last,rejected};
 });expect(stopped.last).toMatchObject({loading:false,committed:false,error:'Loading stopped. Reload to open this page.'});expect(stopped.rejected).toBe(true);
 await page.evaluate(async()=>{const {registerPlugin}=await import('/src/platform-plugins.ts');await registerPlugin<any>('AlphaBrowser').navigate({session:'navigation-test',id:'nav',url:'https://navigation.example/ready'});(window as any).retiredFrame.dispatchEvent(new Event('load'));});
 await expect(page.frameLocator('[data-browser-surface=nav] iframe').getByRole('heading',{name:'Current response'})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>(window as any).navEvents.at(-1).committed)).toBe(true);
 expect(await page.evaluate(()=>(window as any).navEvents.at(-1).url)).toBe('https://navigation.example/ready');
 await expect(page.getByText('Loading stopped. Reload to open this page.',{exact:true})).toHaveCount(0);
});
test('navigation within a sandboxed frame invalidates the host address and share authority',async({page})=>{
 await page.route('https://navigation.example/**',route=>route.fulfill({contentType:'text/html',body:route.request().url().endsWith('/first')?'<a href="https://navigation.example/second">Next page</a>':'<h1>Inner navigation</h1>'}));await setup(page);
 await page.evaluate(async()=>{const {registerPlugin}=await import('/src/platform-plugins.ts');await registerPlugin<any>('AlphaBrowser').navigate({session:'navigation-test',id:'nav',url:'https://navigation.example/first'});});
 const frame=page.frameLocator('[data-browser-surface=nav] iframe');await frame.getByRole('link',{name:'Next page'}).click();await expect(frame.getByRole('heading',{name:'Inner navigation'})).toBeVisible();
 await expect(page.getByRole('status').filter({hasText:'The website navigated inside'})).toBeVisible();
 const result=await page.evaluate(async()=>{const e=(window as any).navEvents.at(-1);const {registerPlugin}=await import('/src/platform-plugins.ts');let rejected=false;try{await registerPlugin<any>('AlphaBrowser').share(e);}catch{rejected=true;}return {e,rejected};});expect(result.e.committed).toBe(false);expect(result.rejected).toBe(true);
});
test('simultaneous bookmark edits from two tabs retain every change and survive reload',async({page,context})=>{
 const other=await context.newPage();await other.goto('/');
 const save=async(target:any,prefix:string)=>target.evaluate(async(prefix:string)=>{const {registerPlugin}=await import('/src/platform-plugins.ts');const b=registerPlugin<any>('AlphaBrowser');await Promise.all(Array.from({length:8},(_,i)=>b.setBookmark({url:`https://bookmarks.example/${prefix}/${i}`,saved:true})));},prefix);
 await Promise.all([save(page,'first'),save(other,'second')]);await page.reload();
 const rows=await page.evaluate(async()=>{const {registerPlugin}=await import('/src/platform-plugins.ts');return (await registerPlugin<any>('AlphaBrowser').bookmarks()).urls;});expect(rows).toHaveLength(16);expect(new Set(rows).size).toBe(16);
 await page.evaluate(async()=>{const {registerPlugin}=await import('/src/platform-plugins.ts');const b=registerPlugin<any>('AlphaBrowser');await Promise.all([b.setBookmark({url:'https://bookmarks.example/first/0',saved:false}),b.setBookmark({url:'https://bookmarks.example/third/0',saved:true})]);});await other.reload();
 const after=await other.evaluate(async()=>{const {registerPlugin}=await import('/src/platform-plugins.ts');return (await registerPlugin<any>('AlphaBrowser').bookmarks()).urls;});expect(after).toHaveLength(16);expect(after).not.toContain('https://bookmarks.example/first/0');expect(after).toContain('https://bookmarks.example/third/0');
});

test('rendered browser supports address navigation, Back, Forward, Reload and Stop recovery',async({page})=>{
 let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});let slow=0,second=0;
 await page.route('https://navigation.example/**',async route=>{const path=new URL(route.request().url()).pathname;if(path==='/slow'&&++slow===1)await held;if(path==='/second')second++;await route.fulfill({contentType:'text/html',body:`<h1>${path.slice(1)}</h1>`}).catch(()=>{});});
 await page.getByRole('button',{name:'Browser',exact:true}).click();
 const navigate=async(path:string)=>{await page.getByRole('button',{name:'Edit address',exact:true}).click();await page.getByRole('textbox',{name:'Address',exact:true}).fill('https://navigation.example/'+path);await page.getByRole('textbox',{name:'Address',exact:true}).press('Enter');};
 const menu=async(name:string)=>{await page.getByRole('button',{name:'Menu',exact:true}).click();await page.getByRole('button',{name,exact:true}).click();};
 const heading=(name:string)=>page.frameLocator('iframe[title=Website]').getByRole('heading',{name,exact:true});
 await navigate('first');await expect(heading('first')).toBeVisible();await expect(page.getByRole('img',{name:'Secure connection',exact:true})).toHaveCount(0);await navigate('second');await expect(heading('second')).toBeVisible();
 await page.getByRole('button',{name:'Previous page',exact:true}).click();await expect(heading('first')).toBeVisible();await page.getByRole('button',{name:'Next page',exact:true}).click();await expect(heading('second')).toBeVisible();
 const before=second;await menu('Reload page');await expect.poll(()=>second).toBe(before+1);await expect(heading('second')).toBeVisible();
 await navigate('slow');await expect.poll(()=>slow).toBe(1);await menu('Stop loading');await expect(page.getByText('Loading stopped. Reload to open this page.',{exact:true})).toBeVisible();await expect(page.getByRole('img',{name:'Secure connection',exact:true})).toHaveCount(0);
 release();await menu('Reload page');await expect(heading('slow')).toBeVisible();await expect(page.getByText('Loading stopped. Reload to open this page.',{exact:true})).toHaveCount(0);
});
test('a file chosen in a framed page reaches that page only, never the host document, the network or the agent',async({page})=>{
 // Test-owned fixture page and a synthetic file; nothing is uploaded anywhere.
 const requests:string[]=[];page.on('request',request=>{if(!request.url().startsWith('http://127.0.0.1'))requests.push(request.method()+' '+request.url());});
 await page.route('https://upload.example/form',route=>route.fulfill({contentType:'text/html',body:'<label>Choose file<input type="file" id="f"></label><output id="o"></output><script>f.onchange=async()=>{const file=f.files[0];o.textContent=file.name+" | "+file.size+" | "+await file.text();};</script>'}));
 await setup(page);
 await page.evaluate(async()=>{const {registerPlugin}=await import('/src/platform-plugins.ts');await registerPlugin<any>('AlphaBrowser').navigate({session:'navigation-test',id:'nav',url:'https://upload.example/form'});});
 const frame=page.frameLocator('[data-browser-surface=nav] iframe');
 await frame.getByLabel('Choose file').setInputFiles({name:'synthetic-upload.txt',mimeType:'text/plain',buffer:Buffer.from('Synthetic upload body')});
 await expect(frame.locator('#o')).toHaveText('synthetic-upload.txt | 21 | Synthetic upload body');
 // Choosing a file is not a navigation: the tab keeps its committed address.
 expect(await page.evaluate(()=>(window as any).navEvents.at(-1))).toMatchObject({url:'https://upload.example/form',committed:true,error:''});
 // The opaque-origin frame keeps the file: the host document, its storage and the agent context never see it.
 expect(await page.evaluate(()=>document.body.innerText)).not.toContain('Synthetic upload body');
 expect(await page.evaluate(()=>JSON.stringify({...localStorage})+JSON.stringify({...sessionStorage}))).not.toMatch(/synthetic-upload|Synthetic upload body/);
 expect(JSON.stringify(await page.evaluate(async()=>(await import('/src/runtime/alpha-client.ts')).alphaClient.getState().context))).not.toMatch(/synthetic-upload|Synthetic upload body/);
 expect(requests).toEqual(['GET https://upload.example/form']);
});
