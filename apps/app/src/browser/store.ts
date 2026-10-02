/** One atomic persisted document per domain, serialized across browser tabs. */
export async function editStore<T,R>(key:string,initial:()=>T,edit:(data:T)=>R|Promise<R>):Promise<R> {
  const run=async()=>{const raw=localStorage.getItem(key),data:T=raw?JSON.parse(raw):initial();const result=await edit(data);localStorage.setItem(key,JSON.stringify(data));return result;};
  return navigator.locks ? navigator.locks.request(key,run) : run();
}
export function readStore<T>(key:string,initial:()=>T):T {const raw=localStorage.getItem(key);return raw?JSON.parse(raw):initial();}
export const revision=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
