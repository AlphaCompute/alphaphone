/** Serialize deletion, restoration and reviewed recovery across same-origin views. */
export async function withAudioDeletionLock<T>(work:()=>Promise<T>,signal?:AbortSignal):Promise<T>{
 if(!navigator.locks?.request)throw Error('Safe audio recovery requires Web Locks');
 return navigator.locks.request('alpha.notes-audio-effects.v1',{mode:'exclusive',...(signal?{signal}:{})},work);
}
