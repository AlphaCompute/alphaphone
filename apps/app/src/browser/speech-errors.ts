/**
 * Error codes the browser recorder surfaces; each has its own user-facing state in
 * runtime/voice-states.ts. The web build has no in-browser recognizer: local speech runs on
 * the local agent (libelizainference), so 'local-agent-required' replaces model-load failures.
 */
export type SpeechErrorCode='no-speech'|'recognition-failed'|'local-agent-required';
export function speechError(code:SpeechErrorCode,message:string){
 return Object.assign(new Error(message),{code});
}
