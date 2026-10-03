import { registerPlugin as capacitorRegister } from '@capacitor/core';
const registered = new Map<string, object>();
/** Share modern Capacitor proxies, never the synchronous legacy objects injected by Android. */
export function registerPlugin<T extends object>(name:string,implementations?:Parameters<typeof capacitorRegister>[1]):T {
  let plugin=registered.get(name);
  if(!plugin){plugin=capacitorRegister<object>(name,implementations);registered.set(name,plugin);}
  return plugin as T;
}
