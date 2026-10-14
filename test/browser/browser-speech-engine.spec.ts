import {test,expect} from '@playwright/test';

test('offline browser reports native speech unavailable without fetching browser models',async({page})=>{
 const models:string[]=[];
 page.on('request',request=>{if(/browser-speech|\.onnx(?:$|\?)/.test(request.url()))models.push(request.url());});
 await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));
 await page.goto('/?mode=dev');
 const status=await page.evaluate(async()=>{
  const {registerPlugin}=await import('/src/platform-plugins.ts');
  return registerPlugin<any>('AlphaVoiceCloud').localSpeechStatus();
 });
 expect(status).toMatchObject({ready:false,execution:'host',route:'local-agent'});
 expect(models).toEqual([]);
});
