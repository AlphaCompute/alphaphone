import { NavigationVoice as SharedNavigationVoice } from '../../../../.eliza/client-features/plugins/plugin-maps/src/client/navigation-voice.ts';
import { createOnDeviceVoice } from '../runtime/local-voice';
export class NavigationVoice extends SharedNavigationVoice {
 constructor(failed:(error?:unknown)=>void) { let failure:unknown;super(()=>failed(failure),async(text,signal)=>{try{const voice=createOnDeviceVoice();if(!voice||!await voice.playbackReady(signal))throw Error('On-device navigation speech is unavailable.');await voice.speak(text,signal);}catch(error){failure=error;throw error;}}); }
}
