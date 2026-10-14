import {accessSync,constants,readFileSync,statSync,readdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {isAbsolute,join} from 'node:path';
import {fileDigest} from './native-speech-inputs.mjs';
const pins=JSON.parse(readFileSync(new URL('../config/native-speech.json',import.meta.url)));

/** Explicit native assets only; the fused worker verifies its pinned model hashes at startup. */
export function nativeSpeechEnvironment(env,kind){
 const asr=kind==='asr',mode=env[asr?'ALPHA_LOCAL_ASR':'ALPHA_LOCAL_TTS']||'auto';
 if(!['auto','off','required'].includes(mode))throw Error('Local speech mode must be auto, off or required');
 if(mode==='off')return {};
 const library=env.ALPHA_INFERENCE_LIBRARY||env.ALPHA_TTS_LIBRARY;
 const root=env[asr?'ALPHA_ASR_MODEL_DIR':'ALPHA_TTS_MODEL_DIR'];
 if(!library&&!root&&mode==='auto')return {};
 if(!library||!root||!isAbsolute(library)||!isAbsolute(root))throw Error('Native speech requires an absolute ALPHA_INFERENCE_LIBRARY and model directory');
 const stat=statSync(library);
 if(!stat.isFile()||!stat.size||stat.size>256*1024*1024||!statSync(root).isDirectory())throw Error('Invalid native speech assets');
 accessSync(library,constants.R_OK);
 const backend=asr&&(existsSync(join(root,'asr/phonon-2-fv5.gguf'))?'parakeet':'qwen3');
 const assets=asr?[pins.vad,...pins.asr[backend]]:pins.tts;
 if(asr){const names=readdirSync(join(root,'asr')).filter(name=>name.endsWith('.gguf')).sort(),expected=pins.asr[backend].map(row=>row.path.slice(4)).sort();if(JSON.stringify(names)!==JSON.stringify(expected))throw Error('Ambiguous native ASR models');}
 for(const item of assets){const file=join(root,item.path);if(!existsSync(file)||statSync(file).size!==item.bytes||fileDigest(file)!==item.sha256)throw Error('Native speech model checksum does not match: '+item.path);}

 const digest=createHash('sha256').update(readFileSync(library)).digest('hex');
 return {ELIZA_INFERENCE_LIBRARY:library,ELIZA_INFERENCE_LIBRARY_SHA256:digest,
  [asr?'ELIZA_ASR_ENABLED':'ELIZA_PARADEE_ENABLED']:'1',
  [asr?'ELIZA_ASR_MODEL_DIR':'ELIZA_PARADEE_MODEL_DIR']:root};
}
export function agentAsrEnvironment(env=process.env){
 if(env.ALPHA_LOCAL_ASR==='off')return {};
 if(env.ALPHA_WHISPER_BIN||env.ALPHA_WHISPER_BACKEND||env.ALPHA_ASR_MODEL)throw Error('Use ALPHA_INFERENCE_LIBRARY and ALPHA_ASR_MODEL_DIR for fused native ASR');
 return nativeSpeechEnvironment(env,'asr');
}
/** The native host owns cancellable warm-up; never launch a second speech engine. */
export async function warmAgentAsr(_config,{signal}={}){signal?.throwIfAborted();return {warmed:false};}
