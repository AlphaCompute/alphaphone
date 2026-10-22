import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { registerPlugin } from './platform-plugins';
import { connectionController } from './runtime/connection-ui';
import { googleConnectionController } from './runtime/google-connection-ui';
import { createGoogleAccounts, GOOGLE_ACCOUNTS_CHANGED } from './runtime/google-accounts';
import { GMAIL_ACCOUNTS_CHANGED } from './runtime/gmail-mailbox';
import { createStartupPermissionFlow, readStartupPermissionMemory, writeStartupPermissionMemory, startupPhotoAccess, startupGoogleAccess, startupLocationAccess, STARTUP_PERMISSIONS_REOPEN, type StartupPermissionState } from './startup-permission-flow';
import { browserStartupPermissions } from './browser-startup-permissions';
import './startup-permissions.css';

const notifications = registerPlugin<{status(): Promise<{permissionGranted: boolean; appEnabled: boolean}>}>('AlphaNotifications');
const permissions = registerPlugin<{
  requestPermissions(options: {permissions: ['notifications' | 'camera']}): Promise<unknown>;
  addListener(event: 'appResumed', callback: () => void): Promise<PluginListenerHandle>;
}>('DailyApps');
const microphone = registerPlugin<{
  checkPermissions(): Promise<{microphone: string}>;
  requestPermissions(options: {permissions: ['microphone']}): Promise<unknown>;
}>('AlphaVoiceCloud');
const camera = registerPlugin<{checkPermissions(): Promise<{camera: string}>}>('ElizaCamera');
const photos = registerPlugin<{scope(): Promise<unknown>; requestAccess(): Promise<unknown>}>('AlphaPhotoLibrary');
const device = registerPlugin<{openSettings(options: {page: 'notifications' | 'privacy'}): Promise<unknown>}>('AlphaDevice');
const location = registerPlugin<{checkPermissions(): Promise<unknown>; requestPermissions(): Promise<unknown>}>('ElizaLocation');
const calendar = registerPlugin<{checkPermissions(): Promise<{calendar: string}>; requestPermissions(options: {permissions: ['calendar']}): Promise<unknown>}>('AlphaCalendar');
const keys = ['microphone', 'notifications', 'camera', 'photos', 'location', 'calendar'] as const;
type PermissionKey = typeof keys[number];
const details = {
  microphone: {title: 'Talk to Alpha', description: 'Ask questions and get replies with your voice.', icon: 'mic'},
  notifications: {title: 'Stay in the loop', description: 'Get reminders and updates, even when Alpha is in the background.', icon: 'bell'},
  camera: {title: 'Capture a moment', description: 'Take photos and scan documents with Alpha.', icon: 'camera'},
  photos: {title: 'Your photos, here', description: 'Choose the photos and videos you want to use in Alpha.', icon: 'images'},
  location: {title: 'Find your way', description: 'Use your location for nearby places and directions.', icon: 'map-pin'},
  calendar: {title: 'Make time for it', description: 'View and save events in this phone’s calendars.', icon: 'calendar-days'},
  google: {title: 'Bring your day together', description: 'Connect Gmail and Google Calendar with your Google account.', icon: 'mail'},
  files: {title: 'Keep your files handy', description: 'Choose a file or folder whenever you need it. You stay in control.', icon: 'folder'},
};
type SetupStep = PermissionKey | 'google' | 'files';
function runtimeAccess(value: string) {
  if (!['granted', 'denied', 'prompt', 'prompt-with-rationale'].includes(value)) throw Error('Access unavailable');
  return {granted: value === 'granted', enabled: value === 'granted'};
}
type GoogleStatus = {state: 'checking' | 'checked' | 'unavailable' | 'signed-out'; gmail: boolean; calendar: boolean};

/** Optional setup after sign-in. Each tap opens one real platform or provider consent flow. */
export function StartupPermissions({active = true}: {active?: boolean} = {}) {
  const native = Capacitor.getPlatform() === 'android';
  const activeKeys: readonly PermissionKey[] = native ? keys : ['microphone', 'notifications'];
  const [browser] = useState(() => browserStartupPermissions());
  const [finishing, setFinishing] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const steps: readonly SetupStep[] = [...activeKeys, 'google', 'files'];
  const step = steps[stepIndex];
  const detail = details[step];
  const connection = useSyncExternalStore(connectionController.subscribe, connectionController.getSnapshot);
  const googleOpen = useSyncExternalStore(googleConnectionController.subscribe, googleConnectionController.getSnapshot);
  const photoDescription = useRef('');
  const [photoStatus, setPhotoStatus] = useState('');
  const locationDescription = useRef('');
  const [locationStatus, setLocationStatus] = useState('');
  const [flows] = useState(() => ({
    notifications: createStartupPermissionFlow(native ? {
      status: async () => { const status = await notifications.status(); return {granted: status.permissionGranted, enabled: status.appEnabled}; },
      request: () => permissions.requestPermissions({permissions: ['notifications']}),
      openSettings: () => device.openSettings({page: 'notifications'}),
    } : browser.notifications, {key: native ? 'notifications' : 'browsernotifications'}),
    microphone: createStartupPermissionFlow(native ? {
      status: async () => runtimeAccess((await microphone.checkPermissions()).microphone),
      request: () => microphone.requestPermissions({permissions: ['microphone']}),
      openSettings: () => device.openSettings({page: 'privacy'}),
    } : browser.microphone, {key: native ? 'microphone' : 'browsermicrophone'}),
    camera: createStartupPermissionFlow({
      status: async () => runtimeAccess((await camera.checkPermissions()).camera),
      // ElizaCamera.requestPermissions requests microphone too. The consumer alias requests only camera.
      request: () => permissions.requestPermissions({permissions: ['camera']}),
      openSettings: () => device.openSettings({page: 'privacy'}),
    }, {key: 'camera'}),
    location: createStartupPermissionFlow({
      status: async () => { const access = startupLocationAccess(await location.checkPermissions()); locationDescription.current = access.description; return access; },
      request: () => location.requestPermissions(),
      openSettings: () => device.openSettings({page: 'privacy'}),
    }, {key: 'location'}),
    calendar: createStartupPermissionFlow({
      status: async () => runtimeAccess((await calendar.checkPermissions()).calendar),
      request: () => calendar.requestPermissions({permissions: ['calendar']}),
      openSettings: () => device.openSettings({page: 'privacy'}),
    }, {key: 'calendar'}),
    photos: createStartupPermissionFlow({
      status: async () => { const access = startupPhotoAccess(await photos.scope()); photoDescription.current = access.description; return access; },
      request: () => photos.requestAccess(),
      openSettings: () => device.openSettings({page: 'privacy'}),
    }, {key: 'photos'}),
  }));
  const [states, setStates] = useState<Record<PermissionKey, StartupPermissionState>>({notifications: 'checking', microphone: 'checking', camera: 'checking', photos: 'checking', location: 'checking', calendar: 'checking'});
  const [dismissed, setDismissedState] = useState(() => readStartupPermissionMemory().dismissed);
  const [reopened, setReopened] = useState(false);
  const [busy, setBusy] = useState<PermissionKey | null>(null);
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus>({state: 'checking', gmail: false, calendar: false});
  const heading = useRef<HTMLHeadingElement>(null);
  const dialog = useRef<HTMLDialogElement>(null), alive = useRef(false), actionPending = useRef(false);
  const cloud = connectionController.getCloudClient();
  const cloudIdentity = JSON.stringify([cloud?.sessionId, cloud?.credentialId]);
  const allReady = activeKeys.every(key => states[key] === 'ready') && googleStatus.state === 'checked' && googleStatus.gmail && googleStatus.calendar;
  const complete = finishing || (!reopened && allReady);
  const visible = (active || reopened) && !dismissed && !googleOpen && !connection.open && (reopened || !!connection.cloudAccount) && activeKeys.some(key => states[key] !== 'checking');
  const setDismissed = (value: boolean) => { writeStartupPermissionMemory({dismissed: value}); setDismissedState(value); if (value) setReopened(false); };
  useEffect(() => {
    if (!connection.setupRevision) return;
    // Review current access after an explicit sign-in while retaining completed/attempted memory.
    // This component stays mounted while account dialogs open, so a normal close never replays it.
    setDismissedState(false); setReopened(false); setFinishing(false); setStepIndex(0);
  }, [connection.setupRevision]);
  useEffect(() => {
    const reopen = () => { setDismissedState(readStartupPermissionMemory().dismissed); setFinishing(false); setStepIndex(0); setReopened(true); };
    window.addEventListener(STARTUP_PERMISSIONS_REOPEN, reopen);
    return () => window.removeEventListener(STARTUP_PERMISSIONS_REOPEN, reopen);
  }, []);
  useEffect(() => {
    alive.current = true;
    let disposed = false;
    const refresh = (key: PermissionKey) => {
      void flows[key].refresh().then(value => {
        if (!disposed && value !== null) { setStates(previous => ({...previous, [key]: value})); if (key === 'photos') setPhotoStatus(photoDescription.current); if (key === 'location') setLocationStatus(locationDescription.current); }
      });
    };
    const resume = () => { if (!document.hidden && !actionPending.current) activeKeys.forEach(refresh); };
    activeKeys.forEach(refresh);
    document.addEventListener('visibilitychange', resume);
    let listener: PluginListenerHandle | undefined;
    if (native) void permissions.addListener('appResumed', resume).then(handle => {
      if (disposed) void handle.remove(); else listener = handle;
    }).catch(() => { /* Visibility refresh remains available. */ });
    return () => { disposed = true; alive.current = false; document.removeEventListener('visibilitychange', resume); void listener?.remove(); };
  }, [flows, native]);
  useEffect(() => {
    if (!active || (dismissed && !reopened) || googleOpen) return;
    let request: AbortController | undefined;
    let disposed = false;
    const refresh = () => {
      request?.abort(); const abort = request = new AbortController();
      if (!cloud) { setGoogleStatus({state: 'signed-out', gmail: false, calendar: false}); return; }
      setGoogleStatus({state: 'checking', gmail: false, calendar: false});
      void createGoogleAccounts(cloud, () => connectionController.getCloudClient()).list(abort.signal).then(accounts => {
        if (!disposed && !abort.signal.aborted && connectionController.getCloudClient()?.client === cloud.client && connectionController.getCloudClient()?.sessionId === cloud.sessionId && connectionController.getCloudClient()?.credentialId === cloud.credentialId) setGoogleStatus({state: 'checked', ...startupGoogleAccess(accounts)});
      }).catch(() => { if (!disposed && !abort.signal.aborted) setGoogleStatus({state: 'unavailable', gmail: false, calendar: false}); });
    };
    const resume = () => { if (!document.hidden) refresh(); };
    refresh();
    window.addEventListener(GOOGLE_ACCOUNTS_CHANGED, refresh); window.addEventListener(GMAIL_ACCOUNTS_CHANGED, refresh);
    document.addEventListener('visibilitychange', resume);
    let listener: PluginListenerHandle | undefined;
    if (native) void permissions.addListener('appResumed', resume).then(handle => { if (disposed) void handle.remove(); else listener = handle; }).catch(() => {});
    return () => { disposed = true; request?.abort(); void listener?.remove(); window.removeEventListener(GOOGLE_ACCOUNTS_CHANGED, refresh); window.removeEventListener(GMAIL_ACCOUNTS_CHANGED, refresh); document.removeEventListener('visibilitychange', resume); };
  }, [cloudIdentity, cloud?.client, native, active, dismissed, reopened, googleOpen]);
  const advance = () => { if (actionPending.current) return; if (stepIndex === steps.length - 1) setFinishing(true); else setStepIndex(value => value + 1); };
  const previous = () => { if (actionPending.current) return; if (finishing) setFinishing(false); else setStepIndex(value => Math.max(0, value - 1)); };
  useEffect(() => {
    const panel = dialog.current;
    if (visible && panel && !panel.open) {
      const phone = document.querySelector('.os');
      if (phone) { const theme = getComputedStyle(phone); for (const token of ['bg', 'fg', 's2', 'line', 'mut', 'acc']) panel.style.setProperty(`--connection-${token}`, theme.getPropertyValue(token === 'acc' ? '--acct' : `--${token}`)); }
      panel.showModal();
      // Each step owns focus without scrolling to its footer or requesting access.
      heading.current?.focus({preventScroll: true});
      panel.scrollTop = 0;
    }
    const back = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); if (!actionPending.current) { if (stepIndex > 0 || finishing) previous(); else advance(); } };
    if (visible) window.addEventListener('alpha-back', back, true);
    return () => { if (panel?.open) panel.close(); window.removeEventListener('alpha-back', back, true); };
  }, [visible, complete, reopened, stepIndex]);
  async function enable(key: PermissionKey, manage = false) {
    if (actionPending.current) return;
    actionPending.current = true; setBusy(key);
    try {
      if (manage) await device.openSettings({page: 'privacy'});
      const value = manage || states[key] === 'unavailable' ? await flows[key].refresh() : await flows[key].enable();
      if (alive.current && value !== null) { setStates(previous => ({...previous, [key]: value})); if (key === 'photos') setPhotoStatus(photoDescription.current); if (key === 'location') setLocationStatus(locationDescription.current); if (value === 'ready' && !manage) setStepIndex(index => Math.min(index + 1, steps.length - 1)); }
    } catch { if (alive.current) setStates(previous => ({...previous, [key]: 'unavailable'})); }
    finally { actionPending.current = false; if (alive.current) setBusy(null); }
  }
  if (!visible) return null;
  const permission = activeKeys.includes(step as PermissionKey) ? step as PermissionKey : null;
  const status = permission ? states[permission] : null;
  const googleReady = googleStatus.state === 'checked' && googleStatus.gmail && googleStatus.calendar;
  const ready = status === 'ready' || step === 'files' || step === 'google' && googleReady;
  const icon = complete ? 'check' : detail.icon;
  const act = () => {
    if (actionPending.current) return;
    if (ready) { advance(); return; }
    if (step === 'google') { googleConnectionController.open(); return; }
    if (permission) void enable(permission);
  };
  const permissionName = permission === 'location' ? 'location' : permission === 'photos' ? 'photo access' : permission;
  const actionLabel = busy ? 'Checking…' : ready ? 'Continue' : step === 'google' ? 'Connect Google' : status === 'settings' ? (native ? 'Open settings' : 'Check again') : status === 'unavailable' ? 'Try again' : 'Allow';
  const statusText = status === 'ready' ? permission === 'photos' ? photoStatus : permission === 'location' ? locationStatus : 'Already allowed'
    : status === 'settings' ? (native ? 'Access is off. You can change it in Android settings or continue without it.' : 'Access is blocked. Allow it in this site’s browser settings, then check again.')
    : status === 'unavailable' ? 'Access couldn’t be checked. Try again, or choose Not now.'
    : status === 'checking' ? 'Checking access…' : '';
  return <dialog ref={dialog} className="alpha-startup-permissions" aria-label={complete ? 'You’re all set' : 'Set up Alpha access'} aria-describedby="alpha-permission-description" onCancel={event => { event.preventDefault(); if (!actionPending.current) { if (stepIndex > 0 || finishing) previous(); else advance(); } }}>
    <div className="alpha-startup-layout">
      <header className="alpha-startup-header">
        <div>{!complete && stepIndex > 0 && <button type="button" className="alpha-startup-back" aria-label="Previous setup step" disabled={busy !== null} onClick={previous}><span aria-hidden="true" style={{maskImage:"url('/icons/lucide/chevron-left.svg')",WebkitMaskImage:"url('/icons/lucide/chevron-left.svg')"}}/></button>}</div>
        <span className="alpha-compute-mark" role="img" aria-label="Alpha Phone"/>
        <span className="alpha-startup-count">{!complete && `${stepIndex + 1} of ${steps.length}`}</span>
      </header>
      <div className="alpha-startup-stage" key={complete ? 'ready' : step}>
        <div className="alpha-startup-symbol"><span className="alpha-startup-icon" aria-hidden="true" style={{maskImage:`url('/icons/lucide/${icon}.svg')`,WebkitMaskImage:`url('/icons/lucide/${icon}.svg')`}}/></div>
        <h2 className="serif" ref={heading} tabIndex={-1} id="alpha-permission-title">{complete ? 'You’re all set' : detail.title}</h2>
        <p id="alpha-permission-description">{complete ? 'Make yourself at home. You can change your choices anytime in Settings.' : detail.description}</p>
        {!complete && statusText && <p className="alpha-startup-status" role="status">{statusText}</p>}
        {!complete && step === 'google' && <p className="alpha-startup-status" role="status">{googleStatus.state === 'checking' ? 'Checking your connection…' : googleStatus.state === 'unavailable' ? 'Your Google connection couldn’t be checked.' : `Gmail: ${googleStatus.gmail ? 'Connected' : 'Not connected'} · Calendar: ${googleStatus.calendar ? 'Connected' : 'Not connected'}`}</p>}
        {complete && <div className="alpha-startup-notices">
          {connection.residentInference && connection.residentInference !== 'cloud' && <p role="status">{connection.residentPlanNotice === 'needs-plan' ? 'AI needs an active Cloud plan. Manage your plan in Settings.' : 'AI is not ready yet. Check your connection in Settings.'}</p>}
          {connection.error && <p role="alert">{connection.error}</p>}
          {connection.message?.includes('did not confirm revoking') && <p role="status">{connection.message}</p>}
          {connection.accountCreated && <p role="status">This sign-in created a new Eliza Cloud account{connection.cloudAccount?.email ? ` (${connection.cloudAccount.email})` : ''}.</p>}
        </div>}
      </div>
      <footer className="alpha-startup-footer">
        {!complete && <progress className="alpha-startup-progress" value={stepIndex + 1} max={steps.length} aria-label={`Setup step ${stepIndex + 1} of ${steps.length}`}/>}
        <div className="alpha-startup-permission-actions">
          {complete ? <button type="button" className="alpha-startup-primary" onClick={() => { setDismissed(true); if (!reopened) window.dispatchEvent(new Event('launcher-home')); }}>Go to Alpha</button>
            : <><button type="button" className="alpha-startup-primary" disabled={busy !== null || status === 'checking'} aria-label={permission && status !== 'ready' ? status === 'settings' ? (native ? `Manage ${permissionName} in Android` : `Check ${permission} again`) : status === 'unavailable' ? `Check ${permission} again` : `Enable ${permission}` : undefined} onClick={act}>{actionLabel}</button>
              {step !== 'files' && <button type="button" className="alpha-startup-skip" disabled={busy !== null} onClick={advance}>Not now</button>}</>}
        </div>
      </footer>
    </div>
  </dialog>;
}
