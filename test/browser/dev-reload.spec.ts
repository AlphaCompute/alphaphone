import {test,expect} from '@playwright/test';
import {mkdtemp,mkdir,writeFile,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createServer} from 'vite';
import {browserFullReload} from '../../scripts/browser-full-reload';
test('source edits reload bootstrap once and preserve browser-local state',async({page})=>{
 const root=await realpath(await mkdtemp(path.join(tmpdir(),'alpha-reload-')));await mkdir(path.join(root,'src'));
 await writeFile(path.join(root,'index.html'),'<script type="module" src="/src/main.js"></script>');
 await writeFile(path.join(root,'src/value.js'),'export const value="before";');
 await writeFile(path.join(root,'src/main.js'),'import {value} from "./value.js"; const count=Number(localStorage.getItem("boots")||0)+1;localStorage.setItem("boots",String(count));document.body.textContent=value+":"+count;');
 const server=await createServer({configFile:false,root,plugins:[browserFullReload()],server:{host:'127.0.0.1',port:0,watch:{usePolling:true,interval:50}}});await server.listen();
 try{
  const connected=page.waitForEvent('console',message=>message.text().includes('[vite] connected'));const address=server.httpServer!.address() as {port:number};await page.goto(`http://127.0.0.1:${address.port}`);await expect(page.locator('body')).toHaveText('before:1');await connected;
  await expect.poll(()=>server.watcher.getWatched()[path.join(root,'src')]||[]).toContain('value.js');
  await page.evaluate(()=>localStorage.setItem('saved-note','Retain me'));
  await writeFile(path.join(root,'src/value.js'),'export const value="after";');await expect(page.locator('body')).toHaveText('after:2');expect(await page.evaluate(()=>localStorage.getItem('saved-note'))).toBe('Retain me');
 }finally{await server.close();await rm(root,{recursive:true,force:true});}
});
