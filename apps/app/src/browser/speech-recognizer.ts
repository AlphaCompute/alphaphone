import {BrowserSpeechRecognizer as SharedSpeechRecognizer} from '../../../../.eliza/client-features/packages/voice/src/browser-speech/speech-recognizer.ts';

/**
 * Alpha's host inputs for the shared @elizaos/voice in-browser recognizer: the model
 * manifest this build serves under browser-speech/, and Alpha's speech worker.
 */
export class BrowserSpeechRecognizer extends SharedSpeechRecognizer {
 constructor(manifestUrl=()=>new URL('browser-speech/manifest.json',document.baseURI).href,create=()=>new Worker(new URL('./speech-worker.ts',import.meta.url),{type:'module',name:'alpha-speech'}),idleMs=5*60_000){
  super({manifestUrl,createWorker:create,idleMs});
 }
}
