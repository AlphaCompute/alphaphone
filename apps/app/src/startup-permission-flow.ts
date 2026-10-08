export type StartupPermissionState = 'checking' | 'request' | 'settings' | 'ready' | 'unavailable';
/** Requests occur only from an explicit tap; a denial never schedules another prompt. */
export function createStartupPermissionFlow(bridge: {
  status(): Promise<{granted: boolean; enabled: boolean}>;
  request(): Promise<unknown>;
  openSettings(): Promise<unknown>;
}) {
  let attempted = false;
  let pending = false;
  let state: StartupPermissionState = 'checking';
  let generation = 0;
  async function check(current: number): Promise<StartupPermissionState | null> {
    try {
      const access = await bridge.status();
      if (current !== generation) return null;
      if (typeof access.granted !== 'boolean' || typeof access.enabled !== 'boolean') throw Error('Unavailable');
      state = access.granted && access.enabled ? 'ready'
        : attempted || access.granted ? 'settings' : 'request';
    } catch {
      if (current !== generation) return null;
      state = 'unavailable';
    }
    return state;
  }
  return {
    // The owned prompt/settings transaction reads back access when it settles.
    // A resume check during that transaction must not retire its final read.
    refresh: () => pending ? Promise.resolve(null) : check(++generation),
    async enable(): Promise<StartupPermissionState | null> {
      if (pending) return null;
      pending = true;
      const current = ++generation;
      try {
        // Recheck before acting: access may have changed while this panel was open.
        if (await check(current) === null || current !== generation) return null;
        if (state === 'request') { attempted = true; await bridge.request(); }
        else if (state === 'settings') await bridge.openSettings();
        if (current !== generation) return null;
        return await check(current);
      } catch { return current === generation ? state = 'unavailable' : null; }
      finally { pending = false; }
    },
  };
}
