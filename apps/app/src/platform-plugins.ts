import { Capacitor, registerPlugin as capacitorRegister, type Plugin } from '@capacitor/core';
/** Shared plugin identity: consumers can declare narrower interfaces without re-registering. */
export function registerPlugin<T extends object>(name:string,implementations?:Parameters<typeof capacitorRegister>[1]):T {
  const existing=(Capacitor as unknown as {Plugins:Record<string,Plugin>}).Plugins?.[name];
  return (existing || capacitorRegister(name,implementations)) as T;
}
