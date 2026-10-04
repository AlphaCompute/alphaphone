import {test,expect} from '@playwright/test';

// Exercise the production store in separate documents of the same origin.
test.beforeEach(async({page})=>{await page.goto('/');});

test('cross-tab edits read the last committed value after an asynchronous edit',async({page,context})=>{
  const other=await context.newPage();await other.goto('/');
  await page.evaluate(async()=>{
    const {editStore}=await import('/src/browser/store.ts');
    const state=window as any;
    state.edit=editStore('alpha.test.atomic',()=>({items:[] as string[]}),async data=>{
      state.entered=true;await new Promise<void>(resolve=>{state.release=resolve;});data.items.push('first');
    });
  });
  await expect.poll(()=>page.evaluate(()=>(window as any).entered)).toBe(true);
  await other.evaluate(async()=>{
    const {editStore}=await import('/src/browser/store.ts');
    const state=window as any;
    state.edit=editStore('alpha.test.atomic',()=>({items:[] as string[]}),data=>{state.entered=true;data.items.push('second');});
  });
  await expect.poll(()=>other.evaluate(async()=>(await navigator.locks.query()).pending?.some(lock=>lock.name==='alpha.test.atomic'))).toBe(true);
  expect(await other.evaluate(()=>(window as any).entered)).toBeUndefined();
  await page.evaluate(async()=>{(window as any).release();await (window as any).edit;});
  await other.evaluate(async()=>{await (window as any).edit;});
  await page.reload();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('alpha.test.atomic')!))).toEqual({items:['first','second']});
});

test('missing lock support rejects before initialization or edit and preserves existing data',async({page})=>{
  const result=await page.evaluate(async()=>{
    const {editStore,readStore}=await import('/src/browser/store.ts');
    localStorage.setItem('alpha.test.atomic',JSON.stringify({count:7}));
    Object.defineProperty(navigator,'locks',{value:undefined,configurable:true});
    let initialized=false,edited=false,error='';
    try{await editStore('alpha.test.atomic',()=>{initialized=true;return {count:0};},data=>{edited=true;data.count++;});}catch(e){error=(e as Error).message;}
    return {initialized,edited,error,data:readStore('alpha.test.atomic',()=>({count:0}))};
  });
  expect(result).toMatchObject({initialized:false,edited:false,data:{count:7}});
  expect(result.error).toContain('Web Locks');
});

test('failed edit and failed persistence release the lock without committing a partial result',async({page})=>{
  const result=await page.evaluate(async()=>{
    const {editStore}=await import('/src/browser/store.ts');
    const key='alpha.test.atomic';localStorage.setItem(key,JSON.stringify({count:7}));
    const failures:string[]=[];
    try{await editStore(key,()=>({count:0}),async data=>{data.count=99;throw Error('Edit failed');});}catch(e){failures.push((e as Error).message);}
    const afterEdit=localStorage.getItem(key),original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('Storage full','QuotaExceededError');original.call(this,k,v);};
    try{await editStore(key,()=>({count:0}),data=>{data.count=88;});}catch(e){failures.push((e as Error).name);}finally{Storage.prototype.setItem=original;}
    const afterWrite=localStorage.getItem(key);
    const receipt=await editStore(key,()=>({count:0}),data=>{data.count++;return data.count;});
    return {failures,afterEdit,afterWrite,receipt,saved:JSON.parse(localStorage.getItem(key)!)};
  });
  expect(result).toEqual({failures:['Edit failed','QuotaExceededError'],afterEdit:'{"count":7}',afterWrite:'{"count":7}',receipt:8,saved:{count:8}});
});

test('closing a tab during an edit releases ownership without publishing its uncommitted state',async({page,context})=>{
  const owner=await context.newPage();await owner.goto('/');
  await owner.evaluate(async()=>{
    const {editStore}=await import('/src/browser/store.ts');
    void editStore('alpha.test.atomic',()=>({count:0}),async data=>{data.count=99;(window as any).entered=true;await new Promise(()=>{});});
  });
  await expect.poll(()=>owner.evaluate(()=>(window as any).entered)).toBe(true);
  await owner.close();
  const result=await page.evaluate(async()=>{
    const {editStore}=await import('/src/browser/store.ts');
    return editStore('alpha.test.atomic',()=>({count:0}),data=>{data.count++;return data;});
  });
  expect(result).toEqual({count:1});
});

test('rapid cross-tab edits retain every committed item and unique receipt',async({page,context})=>{
 const other=await context.newPage();await other.goto('/');
 const write=(tab:typeof page,owner:string)=>tab.evaluate(async owner=>{
  const {editStore}=await import('/src/browser/store.ts');const receipts:number[]=[];
  for(let i=0;i<25;i++){
   // Prime a task-local snapshot before requesting the cross-tab lock.
   localStorage.getItem('alpha.test.rapid');
   receipts.push(await editStore('alpha.test.rapid',()=>({items:[] as string[]}),data=>{data.items.push(owner+':'+i);return data.items.length;}));
  }
  return receipts;
 },owner);
 const receipts=(await Promise.all([write(page,'first'),write(other,'second')])).flat().sort((a,b)=>a-b);
 expect(receipts).toEqual(Array.from({length:50},(_,i)=>i+1));await page.reload();
 const items=await page.evaluate(()=>JSON.parse(localStorage.getItem('alpha.test.rapid')!).items);
 expect(items.sort()).toEqual(['first','second'].flatMap(owner=>Array.from({length:25},(_,i)=>owner+':'+i)).sort());
});
