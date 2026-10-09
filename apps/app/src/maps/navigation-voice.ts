import { NavigationVoice as SharedNavigationVoice } from '../../../../.eliza/client-features/plugins/plugin-maps/src/client/navigation-voice.ts';
import { speakCloudText } from '../runtime/cloud-voice';
export class NavigationVoice extends SharedNavigationVoice {
 constructor(failed:(error?:unknown)=>void) { let failure:unknown;super(()=>failed(failure),async(text,signal)=>{try{await speakCloudText(text,signal);}catch(error){failure=error;throw error;}}); }
}
