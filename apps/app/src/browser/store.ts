/** One atomic persisted document per domain, serialized across browser tabs. */
export async function editStore<T,R>(key:string,initial:()=>T,edit:(data:T)=>R|Promise<R>):Promise<R> {
  // A process-local queue cannot protect this origin from another tab. Never
  // start an edit (which may prepare a receipt) without the cross-tab lock.
  const locks=navigator.locks;
  if(!locks || typeof locks.request!=='function')throw new Error('Safe browser storage is unavailable. Open Alpha in a browser with Web Locks on localhost or HTTPS.');
  const run=async()=>{const raw=localStorage.getItem(key),data:T=raw?JSON.parse(raw):initial();const result=await edit(data);localStorage.setItem(key,JSON.stringify(data));return result;};
  return locks.request(key,{mode:'exclusive'},run);
}
export function readStore<T>(key:string,initial:()=>T):T {const raw=localStorage.getItem(key);return raw?JSON.parse(raw):initial();}
export const revision=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
