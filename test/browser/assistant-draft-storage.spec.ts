import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));await page.goto('/');});
test('draft text survives restart and remains isolated by full binding',async({page})=>{
 await page.evaluate(async()=>{const {assistantDraftStore}=await import('/src/runtime/assistant-draft-store.ts');await(await assistantDraftStore('owner-agent-conversation')).save(null,'First line\nSecond line');});await page.reload();
 expect(await page.evaluate(async()=>{const {assistantDraftStore}=await import('/src/runtime/assistant-draft-store.ts');return {same:(await(await assistantDraftStore('owner-agent-conversation')).read())?.text,other:await(await assistantDraftStore('owner-agent-other')).read()};})).toEqual({same:'First line\nSecond line',other:null});
});
test('competing windows cannot overwrite a draft admitted with the same receipt',async({page,context})=>{
 const other=await context.newPage();await other.goto(page.url());const write=(p:any,text:string)=>p.evaluate(async(text:string)=>{const {assistantDraftStore}=await import('/src/runtime/assistant-draft-store.ts');try{await(await assistantDraftStore('shared-binding')).save(null,text);return true;}catch{return false;}},text);
 const result=await Promise.all([write(page,'Window A'),write(other,'Window B')]);expect(result.filter(Boolean)).toHaveLength(1);const text=await page.evaluate(async()=>(await(await(await import('/src/runtime/assistant-draft-store.ts')).assistantDraftStore('shared-binding')).read())?.text);expect(['Window A','Window B']).toContain(text);
});
test('clearing does not make an old empty receipt valid again',async({page})=>{
 expect(await page.evaluate(async()=>{const store=await(await import('/src/runtime/assistant-draft-store.ts')).assistantDraftStore('clear-binding'),first=await store.save(null,'Draft');await store.save(first,'');let refused=false;try{await store.save(null,'Stale');}catch{refused=true;}return {refused,text:(await store.read())?.text};})).toEqual({refused:true,text:''});
});
test('an aborted save leaves the retained draft unchanged',async({page})=>{
 expect(await page.evaluate(async()=>{const store=await(await import('/src/runtime/assistant-draft-store.ts')).assistantDraftStore('cancel-binding'),first=await store.save(null,'Keep');const cancel=new AbortController();cancel.abort();let refused=false;try{await store.save(first,'Lost',cancel.signal);}catch{refused=true;}return {refused,text:(await store.read())?.text};})).toEqual({refused:true,text:'Keep'});
});
test('connection draft binding follows verified conversation selection and separates offline text',async({page})=>{
 await page.goto('/?mode=dev');
 expect(await page.evaluate(async()=>{const {connectionController:c}=await import('/src/runtime/connection-ui.tsx');await c.initialize();const offline=await c.assistantDraftBinding(new AbortController().signal);await c.startDevelopment('local');if(!c.getSnapshot().session)throw Error('Development fixture did not connect: '+c.getSnapshot().error);const before=await c.assistantDraftBinding(new AbortController().signal);const {LocalAgentProtocol}=await import('/src/runtime/local-agent.ts');LocalAgentProtocol.prototype.listConversations=async()=>[{id:'selected',title:'Selected'}];LocalAgentProtocol.prototype.messages=async()=>({messages:[]});await c.restoreHistory('selected');const after=await c.assistantDraftBinding(new AbortController().signal);await c.offline();return {different:before!==after,selected:JSON.parse(after).at(-1),offline:offline===await c.assistantDraftBinding(new AbortController().signal),separate:offline!==after};})).toEqual({different:true,selected:'selected',offline:true,separate:true});
});
