/// <reference lib="webworker" />
import * as ort from 'onnxruntime-web/wasm';
import {installSpeechWorker,type SpeechOnnxRuntime,type SpeechWorkerScope} from '../../../../.eliza/client-features/packages/voice/src/browser-speech/speech-worker.ts';

// Alpha's speech worker: the shared @elizaos/voice handler with this build's ONNX
// Runtime Web external-WebAssembly module. Model files come only from the verified manifest.
installSpeechWorker(self as unknown as SpeechWorkerScope,ort as unknown as SpeechOnnxRuntime);
