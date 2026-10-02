/** Serialize a shared workflow destination without holding up unrelated workflows. */
export async function withWorkflowResource<T>(resource:'notes'|'agent'|'speech',signal:AbortSignal,operation:()=>Promise<T>):Promise<T>{
 signal.throwIfAborted();
 return navigator.locks.request('alpha.dev.workflow-resource.'+resource,{mode:'exclusive',signal},async()=>{signal.throwIfAborted();return operation();});
}
