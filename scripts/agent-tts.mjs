import {admitSpeech} from './host-speech-admission.mjs';
/** Explicit installed, reviewed host assets; readiness belongs to the native worker. */
export function agentTtsEnvironment(env=process.env) {
 const mode=env.ALPHA_LOCAL_TTS || 'auto';
 if(!['auto','off','required'].includes(mode))throw Error('ALPHA_LOCAL_TTS must be auto, off or required');
 if(mode==='off')return {};
 if(env.ALPHA_TTS_LIBRARY)throw Error('Retired speech configuration: use ELIZA_INFERENCE_LIBRARY, its reviewed SHA-256 and ALPHA_TTS_MODEL_DIR');
 const root=env.ALPHA_TTS_MODEL_DIR || env.ELIZA_PARADEE_MODEL_DIR;
 if(!root && mode==='auto')return {};
 return admitSpeech('tts',{...env,ELIZA_PARADEE_MODEL_DIR:root});
}
