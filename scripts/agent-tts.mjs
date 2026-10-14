import {nativeSpeechEnvironment} from './agent-asr.mjs';
/** Paradee on libelizainference; the host worker authenticates all model bytes. */
export function agentTtsEnvironment(env=process.env){return nativeSpeechEnvironment(env,'tts');}
