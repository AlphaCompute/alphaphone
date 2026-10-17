import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {photosBridge} from './helpers/photos-bridge';
// Real renderer/native-bridge contract with an explicitly held native Save.
// This fixture does not qualify Android MediaStore or provider publication.
async function openPendingVideoCopy(page:Page){
 const clip=await readFile(new URL('../../android/video-fixture/src/main/assets/qa-source.mp4',import.meta.url));
 await page.route('**/qa-video-source.mp4',route=>route.fulfill({status:200,contentType:'video/mp4',body:clip}));
 await photosBridge(page,'full',false);
 await page.evaluate(()=>{
  const w=window as any,f=w.mediaFixture,cap=w.Capacitor,original=cap.nativePromise;
  Object.assign(f.row,{id:'m:external_primary:v:91',name:'Synthetic video.mp4',kind:'video',duration:4,width:320,height:240,path:location.origin+'/qa-video-source.mp4',favorite:false});
  f.operation='video-11111111-1111-4111-8111-111111111111';f.copyCount=0;f.cancelCount=0;f.saveCount=0;f.deleted=false;
  cap.nativePromise=async(plugin:string,method:string,input:any)=>{
   if(plugin==='AlphaPhotos'&&['beginVideoEdit','saveVideoEdit','cancelVideoEdit','editResult','read'].includes(method)){
    f.calls.push({plugin,method,input});
    if(method==='read'){if(f.scope==='denied'||f.deleted)throw Error('Source unavailable');return input.id==='v:92'?f.copy:f.row;}
    if(method==='beginVideoEdit')return {sessionId:f.operation,operationId:f.operation,duration:4,width:320,height:240};
    if(method==='cancelVideoEdit'){f.cancelCount++;return {};}
    if(method==='editResult')return {operationId:f.operation,status:'not-started'};
    if(method==='saveVideoEdit'){
     f.saveCount++;return new Promise(resolve=>{f.complete=(saved:boolean)=>{if(saved){f.copy={...f.row,id:'v:92',name:'Synthetic edited copy.mp4',revision:'copy:1',mutationRevision:'copy:1',owned:true};f.copyCount++;}resolve({operationId:f.operation,status:saved?'saved':'not-started',...(saved?{id:'v:92'}:{})});};});
    }
   }
   return original(plugin,method,input);
  };
 });
 await page.getByRole('button',{name:'Photos',exact:true}).click();
 await page.getByRole('button',{name:/^Captured video /}).click();
 await page.getByRole('button',{name:'Edit video',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Edit video',exact:true});
 await expect(dialog.getByRole('button',{name:'Save video copy',exact:true})).toBeEnabled();
 await dialog.getByRole('slider',{name:'Start seconds'}).press('ArrowRight');
 await dialog.getByRole('button',{name:'Save video copy',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).mediaFixture.saveCount)).toBe(1);
 return dialog;
}
test('own library notifications during native Save do not cancel the operation',async({page})=>{
 const dialog=await openPendingVideoCopy(page);
 await page.evaluate(()=>{const f=(window as any).mediaFixture;f.callsBeforeNotification=f.calls.length;f.emit();f.emit();});
 await expect.poll(()=>page.evaluate(()=>{const f=(window as any).mediaFixture;return f.calls.slice(f.callsBeforeNotification).filter((c:any)=>c.method==='libraryAccess').length;})).toBeGreaterThan(0);
 expect(await page.evaluate(()=>(window as any).mediaFixture.cancelCount)).toBe(0);
 await expect(dialog).toBeVisible();
 await page.evaluate(()=>(window as any).mediaFixture.complete(true));
 await expect(dialog).toHaveCount(0);
 expect(await page.evaluate(()=>{const f=(window as any).mediaFixture;return {saves:f.saveCount,copies:f.copyCount,revision:f.row.mutationRevision};})).toEqual({saves:1,copies:1,revision:'provider:1:100:2:1:2'});
});
for(const change of ['permission revoked','source changed','source removed'])test(`native Save still invalidates when ${change}`,async({page})=>{
 const dialog=await openPendingVideoCopy(page);
 await page.evaluate(change=>{const f=(window as any).mediaFixture;if(change==='permission revoked')f.scope='denied';else if(change==='source changed')f.row.mutationRevision='provider:changed';else f.deleted=true;f.emit();},change);
 await expect.poll(()=>page.evaluate(()=>(window as any).mediaFixture.cancelCount)).toBeGreaterThan(0);
 await expect(dialog).toHaveCount(0);
 await page.evaluate(()=>(window as any).mediaFixture.complete(false));
 expect(await page.evaluate(()=>{const f=(window as any).mediaFixture;return {saves:f.saveCount,copies:f.copyCount};})).toEqual({saves:1,copies:0});
});
