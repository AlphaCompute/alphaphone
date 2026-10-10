import {test,expect} from '@playwright/test';

test('encrypted credential CAS fences concurrent renderer instances even without Web Locks',async({page})=>{
 await page.goto('/?mode=offline');
 const result=await page.evaluate(async()=>{
  Object.defineProperty(navigator,'locks',{configurable:true,value:undefined});
  const {indexedDbSecretBackend}=await import('/src/runtime/native-connection.ts');
  const slot='remote:https://cas.example.invalid';
  let arrivals=0,release!:()=>void;
  const gate=new Promise<void>(resolve=>release=resolve);
  const subtle={generateKey:crypto.subtle.generateKey.bind(crypto.subtle),decrypt:crypto.subtle.decrypt.bind(crypto.subtle),encrypt:async(...args:any[])=>{if(++arrivals===2)release();await gate;return (crypto.subtle.encrypt as any)(...args);}} as SubtleCrypto;
  const first=indexedDbSecretBackend(indexedDB,subtle),second=indexedDbSecretBackend(indexedDB,subtle);
  const outcomes=await Promise.all([first.compareExchange(slot,null,'first'),second.compareExchange(slot,null,'second')]);
  return {outcomes,value:await first.read(slot)};
 });
 expect(result.outcomes.filter(Boolean)).toHaveLength(1);
 expect(result.value).toBe(result.outcomes[0]?'first':'second');
});

test('browser transport admits only canonical automation writes and rejects host-only credentials',async({page})=>{
 await page.goto('/?mode=offline');
 const result=await page.evaluate(async()=>{
  const {createBrowserConnection}=await import('/src/runtime/native-connection.ts');
  const calls:string[]=[];
  const port=createBrowserConnection({fetch:async(url,init)=>{calls.push(init!.method+' '+url);return new Response('{}',{status:200});}});
  const request=(path:string,method:string,extra={})=>port.request({requestId:crypto.randomUUID(),url:'https://agent.example.invalid'+path,method,headers:{},...extra});
  await request('/api/triggers/owned-id','PUT');await request('/api/triggers/owned-id','DELETE');
  const rejected=[];
  for(const [path,method,extra] of [['/api/admin','DELETE',{}],['/api/triggers/owned-id','PATCH',{}],['/api/automations','GET',{credentialReference:'host-secret'}]] as const){try{await request(path,method,extra);rejected.push(false);}catch{rejected.push(true);}}
  return {calls,rejected};
 });
 expect(result.calls).toHaveLength(2);expect(result.rejected).toEqual([true,true,true]);
});
