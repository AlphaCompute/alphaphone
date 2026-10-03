import {accessSync,constants,readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {homedir} from 'node:os';
import {isAbsolute,join} from 'node:path';
/** Explicit installed assets only. The worker independently checks them before readiness. */
export function agentTtsEnvironment(env=process.env,home=homedir()){
 const mode=env.ALPHA_LOCAL_TTS||'auto';
 if(!['auto','off','required'].includes(mode))throw Error('ALPHA_LOCAL_TTS must be auto, off or required');
 if(mode==='off')return {};
 const library=env.ALPHA_TTS_LIBRARY;
 if(!library){if(mode==='required'||env.ALPHA_TTS_MODEL_DIR)throw Error('Configure ALPHA_TTS_LIBRARY for local speech');return {};}
 const root=env.ALPHA_TTS_MODEL_DIR||join(home,'.cache/alphaphone-tts/kokoro');
 if(!isAbsolute(library)||!isAbsolute(root))throw Error('Local TTS requires absolute library and model paths');
 const digest=(file,maximum)=>{const stat=statSync(file);if(!stat.isFile()||stat.size===0||stat.size>maximum)throw Error('Invalid local speech asset');accessSync(file,constants.R_OK);return createHash('sha256').update(readFileSync(file)).digest('hex');};
 const librarySha=digest(library,64*1024*1024);
 if(digest(join(root,'kokoro-82m-v1_0.gguf'),256*1024*1024)!=='165acd9d2d9b6c2d71fa5bd52b92a2559be08567f58ed496bade076e3d9cb46c'||digest(join(root,'voices/af_bella.bin'),4*1024*1024)!=='f69d836209b78eb8c66e75e3cda491e26ea838a3674257e9d4e5703cbaf55c8b')throw Error('Local TTS model or voice checksum does not match');
 return {ELIZA_KOKORO_ENABLED:'1',ELIZA_INFERENCE_LIBRARY:library,ELIZA_KOKORO_MODEL_DIR:root,ELIZA_KOKORO_LIBRARY_SHA256:librarySha};
}
