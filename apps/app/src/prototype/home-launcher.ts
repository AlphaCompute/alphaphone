import type {DefaultApp, InstalledApp} from '../native';
type Bag = Record<string, any>;

/** The installed-app bridge the drawer needs; DeviceApps on Android, BrowserDevice on the web. */
export interface LauncherBridge {
  list(options?: {icons?: boolean}): Promise<{apps: InstalledApp[]}>;
  launch(options: {packageName: string}): Promise<void>;
  resolveDefault?(options: {role: 'dial'}): Promise<DefaultApp>;
  openDefault?(options: {role: 'dial'}): Promise<void>;
}
export type LauncherStatus = 'idle' | 'loading' | 'ready' | 'failed';
export interface LauncherSnapshot {
  status: LauncherStatus;
  apps: InstalledApp[];
  dial: DefaultApp | null;
  /** Package currently being opened; repeated taps are ignored until it settles. */
  launching: string | null;
  /** Last open failure, shown inline until the next search, load or launch. */
  launchError: string | null;
}

const fold = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();
/** Label (then package) match, ignoring case and accents; prefix matches sort first. */
export function filterLauncherApps(apps: InstalledApp[], query: string): InstalledApp[] {
  const needle = fold(query.trim());
  const collator = new Intl.Collator(undefined, {sensitivity: 'base', numeric: true});
  const sorted = [...apps].sort((a, b) => collator.compare(a.label, b.label) || a.packageName.localeCompare(b.packageName));
  if (!needle) return sorted;
  const score = (app: InstalledApp) => { const label = fold(app.label); return label.startsWith(needle) ? 0 : label.includes(needle) ? 1 : fold(app.packageName).includes(needle) ? 2 : -1; };
  return sorted.map(app => [app, score(app)] as const).filter(([, rank]) => rank >= 0).sort((a, b) => a[1] - b[1]).map(([app]) => app);
}

const valid = (value: unknown): value is InstalledApp => !!value && typeof value === 'object'
  && typeof (value as Bag).packageName === 'string' && !!(value as Bag).packageName
  && typeof (value as Bag).label === 'string'
  && ((value as Bag).icon === undefined || (typeof (value as Bag).icon === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test((value as Bag).icon)));

/** Reads installed apps on each open (installs and removals happen outside Alpha) and launches
 * only from an explicit tap. Failures stay visible; nothing is retried automatically. */
export function createLauncher(bridge: LauncherBridge, changed: () => void, options: {icons?: boolean} = {}) {
  let state: LauncherSnapshot = {status: 'idle', apps: [], dial: null, launching: null, launchError: null};
  let generation = 0;
  const update = (patch: Partial<LauncherSnapshot>) => { state = {...state, ...patch}; changed(); };
  const message = (error: unknown) => error instanceof Error && error.message ? error.message : String(error || 'Unavailable');
  return {
    snapshot: () => state,
    async load() {
      const current = ++generation;
      update({status: 'loading', launchError: null});
      const [listed, dial] = await Promise.allSettled([
        bridge.list(options.icons ? {icons: true} : undefined),
        bridge.resolveDefault ? bridge.resolveDefault({role: 'dial'}) : Promise.reject(Error('Unsupported')),
      ]);
      if (current !== generation) return;
      const dialApp = dial.status === 'fulfilled' && dial.value && dial.value.available === true ? dial.value : null;
      if (listed.status === 'rejected' || !Array.isArray(listed.value?.apps)) { update({status: 'failed', apps: [], dial: dialApp}); return; }
      const seen = new Set<string>();
      const apps = listed.value.apps.filter(valid).filter(app => !seen.has(app.packageName) && !!seen.add(app.packageName));
      update({status: 'ready', apps, dial: dialApp});
    },
    async launch(app: InstalledApp) {
      if (state.launching) return;
      update({launching: app.packageName, launchError: null});
      try { await bridge.launch({packageName: app.packageName}); update({launching: null}); }
      catch (error) { update({launching: null, launchError: `${app.label} could not be opened. ${message(error)}`}); }
    },
    async openDial() {
      if (state.launching || !state.dial || !bridge.openDefault) return;
      const label = state.dial.label || 'Phone';
      update({launching: 'dial', launchError: null});
      try { await bridge.openDefault({role: 'dial'}); update({launching: null}); }
      catch (error) { update({launching: null, launchError: `${label} could not be opened. ${message(error)}`}); }
    },
    /** Drops a stale launch error (new search or reopened drawer). An in-flight read keeps its
     * generation, so typing while apps load never strands the drawer in its loading state. */
    clearError() { if (state.launchError) state = {...state, launchError: null}; },
  };
}
export type Launcher = ReturnType<typeof createLauncher>;

/** Home's All-apps drawer. Shell state (open, query) lives in the model so Back and Home close
 * it; the installed list lives here. */
export function installHomeLauncher(Component: any, bridge: LauncherBridge, options: {icons?: boolean} = {}) {
  const p = Component.prototype, mount = p.componentDidMount, render = p.renderVals;
  let owner: any = null;
  const launcher = createLauncher(bridge, () => owner?.setState({launcherRevision: Date.now()}), options);
  p.componentDidMount = function (...args: any[]) { owner = this; return mount?.apply(this, args); };
  p.openAllApps = function () { this.setState({drawer: true, drawerQ: ''}); void launcher.load(); };
  p.renderVals = function () {
    const out = render.call(this), S = this.S(), self = this;
    const snap = launcher.snapshot(), query = String(S.drawerQ || '');
    const rows = filterLauncherApps(snap.apps, query).map(app => ({
      label: app.label, aria: `Open ${app.label}`, hasIcon: !!app.icon, noIcon: !app.icon, icon: app.icon || '',
      busy: snap.launching === app.packageName, disabled: !!snap.launching,
      open: () => void launcher.launch(app),
    }));
    const dial = snap.dial && !query.trim() ? {
      label: 'Phone', aria: snap.dial.label ? `Open Phone (${snap.dial.label})` : 'Open Phone', sub: snap.dial.label || 'Choose a phone app',
      hasIcon: !!snap.dial.icon, noIcon: !snap.dial.icon, icon: snap.dial.icon || '', disabled: !!snap.launching,
      open: () => void launcher.openDial(),
    } : null;
    const status = snap.status === 'loading' || snap.status === 'idle' ? 'Reading installed apps…'
      : snap.status === 'failed' ? 'Installed apps could not be read.'
      : !snap.apps.length ? 'No other apps are installed.'
      : !rows.length ? `No apps match “${query.trim()}”.` : '';
    return {...out, drawerOpen: !!S.drawer && !!out.isOn && !out.isView, launcher: {
      open: () => self.openAllApps(), close: () => self.setState({drawer: false, drawerQ: ''}),
      query, onQuery: (event: any) => { launcher.clearError(); self.setState({drawerQ: event.target.value}); },
      rows, hasRows: rows.length > 0, dial, hasDial: !!dial, status, hasStatus: !!status, failed: snap.status === 'failed',
      retry: () => void launcher.load(), launchError: snap.launchError || '', hasLaunchError: !!snap.launchError,
      count: snap.status === 'ready' ? `${rows.length} ${rows.length === 1 ? 'app' : 'apps'}` : '',
    }};
  };
  return launcher;
}
