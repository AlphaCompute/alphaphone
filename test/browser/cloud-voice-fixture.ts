import type {Page} from '@playwright/test';

/** Closed Cloud account fixture. Recording still uses the browser's real recorder;
 * tests supply synthetic input and no provider or speaker is contacted. */
export async function installCloudVoiceFixture(page:Page,transcript='Synthetic Cloud transcript',queuedSpeech=false){
 await page.evaluate(async({transcript,queuedSpeech})=>{
  const w=window as any;
  const {connectionController:c}=await import('/src/runtime/connection-ui.tsx');
  const {BrowserVoice}=await import('/src/browser/voice.ts');
  c.getCloudEnvironment=()=> 'production';
  c.getCloudClient=()=>({sessionId:'synthetic-cloud-session',credentialId:'synthetic-cloud-credential',client:{}} as any);
  w.cloudVoiceFixture={transcriptions:[],speech:[]};
  BrowserVoice.prototype.transcribeRecording=async(input)=>{
   if(input.environment!=='production'||input.credentialId!=='synthetic-cloud-credential')throw Error('Wrong synthetic Cloud account');
   w.cloudVoiceFixture.transcriptions.push(input);
   return {text:transcript,local:false};
  };
  if(!queuedSpeech)return;
  BrowserVoice.prototype.synthesize=async(input)=>{
   if(input.environment!=='production'||input.credentialId!=='synthetic-cloud-credential')throw Error('Wrong synthetic Cloud account');
   w.cloudVoiceFixture.speech.push(input);
   const playbackId=crypto.randomUUID();
   w.speechFixture?.spoken.push({text:input.text});
   return {playbackId};
  };
  BrowserVoice.prototype.play=async function(input){
   if(!input.playbackId)throw Error('Closed speech fixture requires a playback id');
   const emit=(event:string)=>void (this as any).notifyListeners(event,{playbackId:input.playbackId});
   w.speechFixture.current={onend:()=>emit('playbackEnded')};
  };
  BrowserVoice.prototype.stopPlayback=async()=>{};
 },{transcript,queuedSpeech});
}
