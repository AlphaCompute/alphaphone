export type PermissionAccess = { granted: boolean; enabled: boolean };
export type StartupPermissionState = 'checking' | 'request' | 'settings' | 'ready' | 'unavailable';
export interface StartupPermissionBridge {
  status(): Promise<PermissionAccess>;
  request(): Promise<unknown>;
  openSettings(): Promise<unknown>;
}
/** Requests occur only from an explicit tap; a denial never schedules another prompt. */
export function createStartupPermissionFlow(bridge: StartupPermissionBridge) {
  let attempted = false;
  let pending = false;
  let state: StartupPermissionState = 'checking';
  async function refresh(): Promise<StartupPermissionState> {
    try {
      const access = await bridge.status();
      if (typeof access.granted !== 'boolean' || typeof access.enabled !== 'boolean') throw Error('Unavailable');
      state = access.granted && access.enabled ? 'ready'
        : attempted || access.granted ? 'settings' : 'request';
    } catch { state = 'unavailable'; }
    return state;
  }
  return {
    refresh,
    async enable(): Promise<StartupPermissionState> {
      if (pending) return state;
      pending = true;
      try {
        // Recheck before acting: access may have changed while this panel was open.
        await refresh();
        if (state === 'request') { attempted = true; await bridge.request(); }
        else if (state === 'settings') await bridge.openSettings();
        return await refresh();
      } catch { return state = 'unavailable'; }
      finally { pending = false; }
    },
  };
}
