import {admitSpeech} from './host-speech-admission.mjs';
/** Explicit installed, reviewed host assets; readiness belongs to the native worker. */
export function agentAsrEnvironment(env=process.env) {
 const mode=env.ALPHA_LOCAL_ASR || 'auto';
 if(!['auto','off','required'].includes(mode))throw Error('ALPHA_LOCAL_ASR must be auto, off or required');
 if(mode==='off')return {};
 if(env.ALPHA_WHISPER_BIN || env.ALPHA_WHISPER_BACKEND || env.ALPHA_ASR_MODEL)throw Error('Retired speech configuration: use ELIZA_INFERENCE_LIBRARY, its reviewed SHA-256 and ALPHA_ASR_MODEL_DIR');
 const root=env.ALPHA_ASR_MODEL_DIR || env.ELIZA_ASR_MODEL_DIR;
 if(!root && mode==='auto')return {};
 return admitSpeech('asr',{...env,ELIZA_ASR_MODEL_DIR:root});
}
