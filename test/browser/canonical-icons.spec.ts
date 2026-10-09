import {test,expect} from '@playwright/test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const root=new URL('../../apps/app/public/icons/lucide/',import.meta.url);
test('published assets retain their recorded provenance',()=>{
 const source=JSON.parse(readFileSync(new URL('source.json',root),'utf8'));
 expect(source.package).toBe('lucide-react');expect(source.version).toBe('1.18.0');expect(source.license).toBe('ISC');
 for(const [name,entry] of Object.entries(source.assets) as [string,{source:string;sha256:string}][]){expect(createHash('sha256').update(readFileSync(new URL(name,root))).digest('hex')).toBe(entry.sha256);expect(source.sourceFiles[entry.source]).toMatch(/^[a-f0-9]{64}$/);}
 expect(createHash('sha256').update(readFileSync(new URL('LICENSE.txt',root))).digest('hex')).toBe(source.licenseSha256);
});
for(const theme of ['light','dark'])test(`canonical launcher, dock and Files assets: ${theme}`,async({page},info)=>{
 await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));
 await page.goto('/?mode=dev&theme='+theme);
 const camera=page.getByRole('button',{name:'Camera',exact:true});
 // Camera stays an ordinary named button; inspecting it never starts a device capture.
 await expect(camera.first().locator('[data-alpha-icon]')).toHaveAttribute('data-alpha-icon','/icons/lucide/camera.svg');
 await expect(page.getByRole('button',{name:'Workflows',exact:true}).locator('[data-alpha-icon]')).toHaveAttribute('data-alpha-icon','/icons/lucide/workflow.svg');
 await page.screenshot({animations:'disabled',path:info.outputPath('launcher-'+theme+'.png')});
 await page.getByRole('button',{name:'Files',exact:true}).click();
 const type=page.getByRole('button',{name:'Type',exact:true});await expect(type.locator('[data-alpha-icon]')).toHaveAttribute('data-alpha-icon','/icons/lucide/keyboard.svg');

 await expect(page.getByRole('region',{name:'Home',exact:true})).toHaveCount(0);
 await page.screenshot({animations:'disabled',path:info.outputPath('dock-folders-'+theme+'.png')});
 const folder=page.getByText('Browser files',{exact:true}).first().locator('xpath=ancestor::button[1]').locator('[data-alpha-icon]');await expect(folder).toHaveAttribute('data-alpha-icon','/icons/lucide/folder.svg');
 await page.getByText('Browser files',{exact:true}).first().click();
 await page.getByRole('button',{name:'View and sort',exact:true}).click();await page.getByText('New folder',{exact:true}).click();await page.getByRole('textbox',{name:'Folder or file name'}).fill('Synthetic folder');await page.getByRole('button',{name:'Create folder',exact:true}).click();
 const row=page.getByRole('button',{name:'Open Synthetic folder',exact:true});await expect(row.locator('[data-alpha-icon]')).toHaveAttribute('data-alpha-icon','/icons/lucide/folder.svg');
 await page.screenshot({animations:'disabled',path:info.outputPath('folders-'+theme+'.png')});
 const icon=row.locator('[data-alpha-icon]');expect(await icon.evaluate(el=>({tag:el.tagName,mask:getComputedStyle(el).maskImage,color:getComputedStyle(el).backgroundColor,width:el.getBoundingClientRect().width,hidden:el.getAttribute('aria-hidden'),viewbox:el.hasAttribute('viewBox')}))).toMatchObject({tag:'SPAN',hidden:'true',viewbox:false});expect(await icon.evaluate(el=>getComputedStyle(el).maskImage)).toContain('folder.svg');
 // The generic unmapped Back icon remains the original SVG path.
 await expect(page.getByRole('button',{name:'Back to apps',exact:true}).first().locator('svg path')).toHaveCount(1);
 await page.screenshot({animations:'disabled',path:info.outputPath('folders-'+theme+'.png')});
});
