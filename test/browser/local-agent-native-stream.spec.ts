import {test,expect} from '@playwright/test';

// Real renderer/client with a held synthetic transport; never calls a model.
for(const outcome of ['complete','cancel','failure','done-then-failure'] as const){
 test(`native adapter streamed reply renders before completion and handles ${outcome}`,async({page},info)=>{
  await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));
  await page.goto('/');
  await page.getByRole('textbox',{name:'Ask Alpha',exact:true}).waitFor();
  await page.evaluate(async()=>{
   const {alphaClient}=await import('/src/runtime/alpha-client.ts');
   const w=window as any;w.streamFixture={posts:0};
   alphaClient.attachVerifiedTransport({session:{ownerId:'fixture-owner',agentId:'fixture-agent',sessionId:'fixture-session',origin:'https://fixture.example'},
    send:async({onText,signal}:any)=>{
      const {streamNativeAgent}=await import('/src/runtime/local-agent-native-stream.ts');
      let emit:any,id='';
      const frame=(value:any)=>emit({streamId:id,event:value});
      const data=(value:any)=>frame({type:'chunk',dataBase64:btoa('data: '+JSON.stringify(value)+'\n\n')});
      const port={async addListener(_:string,callback:any){emit=callback;return{async remove(){w.streamFixture.removed=true;}};},async cancelStream(){w.streamFixture.closed=true;},async requestStream(input:any){
        id=input.streamId;w.streamFixture.posts++;
        frame({type:'response',status:200,headers:{'content-type':'text/event-stream'}});
        data({type:'token',text:'First streamed text'});
        w.streamFixture.emit=(text:string)=>data({type:'token',fullText:text});
        w.streamFixture.done=()=>data({type:'done',fullText:'Authoritative final reply',agentName:'Alpha'});
        w.streamFixture.finish=()=>frame({type:'complete'});
        w.streamFixture.fail=()=>frame({type:'complete',error:'Fixture provider failed'});
        return{streamId:id};
      }};
      return streamNativeAgent(port,{path:'/api/conversations/fixture/messages/stream',ownerId:'fixture-owner',headers:{},body:'{}'},signal,onText);
    },
    execute:async()=>{throw Error('No action may execute');},
   });
  });
  await page.getByRole('textbox',{name:'Ask Alpha',exact:true}).fill('Synthetic streaming test');
  await page.getByRole('textbox',{name:'Ask Alpha',exact:true}).press('Enter');
  const conversation=page.locator('[data-alpha-layer="conversation"]');
  await expect(conversation.getByText('First streamed text',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Stop reply',exact:true})).toBeVisible();
  await expect(conversation.getByText('Authoritative final reply',{exact:true})).toHaveCount(0);
  await page.screenshot({path:info.outputPath('progress.png')});
  if(outcome==='complete'||outcome==='done-then-failure'){
   await page.evaluate(()=>(window as any).streamFixture.done());
   await expect(page.getByRole('button',{name:'Stop reply',exact:true})).toBeVisible();
   await expect(conversation.getByText('Authoritative final reply',{exact:true})).toHaveCount(0);
   await page.evaluate(outcome=>outcome==='complete'?(window as any).streamFixture.finish():(window as any).streamFixture.fail(),outcome);
  }
  else if(outcome==='failure')await page.evaluate(()=>(window as any).streamFixture.fail());
  else await page.getByRole('button',{name:'Stop reply',exact:true}).click();
  await expect(page.getByRole('button',{name:'Stop reply',exact:true})).toHaveCount(0);
  await page.evaluate(()=>(window as any).streamFixture.emit('Late untrusted text'));
  await expect(conversation.getByText('Late untrusted text',{exact:true})).toHaveCount(0);
  if(outcome==='complete'){
   await expect(conversation.getByText('Authoritative final reply',{exact:true})).toHaveCount(1);
   await expect(conversation.getByText('First streamed text',{exact:true})).toHaveCount(0);
  }else await expect(conversation.getByText(/First streamed text.*Response interrupted/s)).toBeVisible();
  expect(await page.evaluate(()=>(window as any).streamFixture.posts)).toBe(1);
  await expect.poll(()=>page.evaluate(()=>(window as any).streamFixture.closed===true&&(window as any).streamFixture.removed===true)).toBe(true);
  await page.screenshot({path:info.outputPath('terminal.png')});
 });
}
