export type StartupPermissionState = 'checking' | 'request' | 'settings' | 'ready' | 'unavailable';

/** Nonsecret startup-access memory: the "Not now" dismissal and which OS prompts were already
 * shown, so a chooser close or a cold start neither reopens the panel nor re-prompts. */
export const STARTUP_PERMISSIONS_KEY = 'alpha.startup-permissions.v1';
export const STARTUP_PERMISSIONS_REOPEN = 'alpha:startup-permissions-reopen';
export interface StartupPermissionMemory { dismissed: boolean; attempted: Record<string, true> }
type Store = Pick<Storage, 'getItem' | 'setItem'>;
const defaultStore = (): Store | null => { try { return globalThis.localStorage ?? null; } catch { return null; } };
export function readStartupPermissionMemory(store: Store | null = defaultStore()): StartupPermissionMemory {
  try {
    const value = JSON.parse(store?.getItem(STARTUP_PERMISSIONS_KEY) || 'null');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {dismissed: false, attempted: {}};
    const attempted: Record<string, true> = {};
    if (value.attempted && typeof value.attempted === 'object') for (const [key, flag] of Object.entries(value.attempted)) if (flag === true && /^[a-z]{1,32}$/.test(key)) attempted[key] = true;
    return {dismissed: value.dismissed === true, attempted};
  } catch { return {dismissed: false, attempted: {}}; }
}
/** Best effort: unavailable storage keeps the in-memory behavior for this session. */
export function writeStartupPermissionMemory(patch: Partial<StartupPermissionMemory>, store: Store | null = defaultStore()) {
  const current = readStartupPermissionMemory(store);
  const next = {dismissed: patch.dismissed ?? current.dismissed, attempted: {...current.attempted, ...(patch.attempted || {})}};
  try { store?.setItem(STARTUP_PERMISSIONS_KEY, JSON.stringify(next)); return true; } catch { return false; }
}
/** Settings → "Set up Alpha access" calls this to show the panel again. Prompts already denied
 * stay on the Android-settings path; nothing is requested until the user taps. */
export function reopenStartupPermissions(store: Store | null = defaultStore()) {
  writeStartupPermissionMemory({dismissed: false}, store);
  try { globalThis.dispatchEvent?.(new Event(STARTUP_PERMISSIONS_REOPEN)); } catch { /* No window in tests. */ }
}

/** Requests occur only from an explicit tap; a denial never schedules another prompt, including
 * after a restart when `key` names the persisted attempt. */
export function createStartupPermissionFlow(bridge: {
  status(): Promise<{granted: boolean; enabled: boolean}>;
  request(): Promise<unknown>;
  openSettings(): Promise<unknown>;
}, options: {key?: string; store?: Store | null} = {}) {
  const store = options.store === undefined ? defaultStore() : options.store;
  let attempted = !!options.key && readStartupPermissionMemory(store).attempted[options.key] === true;
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
        if (state === 'request') {
          attempted = true;
          if (options.key) writeStartupPermissionMemory({attempted: {[options.key]: true}}, store);
          await bridge.request();
        }
        else if (state === 'settings') await bridge.openSettings();
        if (current !== generation) return null;
        return await check(current);
      } catch { return current === generation ? state = 'unavailable' : null; }
      finally { pending = false; }
    },
  };
}
