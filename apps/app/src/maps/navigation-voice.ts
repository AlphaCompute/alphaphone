import { NavigationVoice as SharedNavigationVoice } from '../../../../.eliza/client-features/plugins/plugin-maps/src/client/navigation-voice.ts';
import { speakLocalText } from '../local-speech-playback';
export class NavigationVoice extends SharedNavigationVoice {
 constructor(failed:()=>void) { super(failed, speakLocalText); }
}
