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
  notifications: {title: 'Notifications', description: 'Get reminders, scheduled briefs and approval requests when Alpha is in the background.'},
  microphone: {title: 'Microphone', description: 'Talk to Alpha when you choose voice input. Allowing access does not start recording.'},
  camera: {title: 'Camera', description: 'Take photos and scan documents in Alpha. Allowing access does not open the camera.'},
  location: {title: 'Location for Maps', description: 'Choose approximate or precise access in Android. Allowing access does not fetch your location.'},
  calendar: {title: 'On-phone Calendar', description: 'Allow viewing and saving events in Android calendar accounts. This is separate from connecting Google Calendar through Cloud; granting access does not read or change events.'},
  photos: {title: 'Photos and videos', description: 'Choose selected items or your library in Android. Access stays on this phone; sharing is a separate action.'},
};
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
    const reopen = () => { setDismissedState(readStartupPermissionMemory().dismissed); setFinishing(false); setReopened(true); };
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
  useEffect(() => {
    const panel = dialog.current;
    if (visible && panel && !panel.open) {
      const phone = document.querySelector('.os');
      if (phone) { const theme = getComputedStyle(phone); for (const token of ['bg', 'fg', 's2', 'line', 'mut', 'acc']) panel.style.setProperty(`--connection-${token}`, theme.getPropertyValue(token === 'acc' ? '--acct' : `--${token}`)); }
      panel.showModal();
      // A granted checklist may start with its first button far below the introduction.
      // Focus the heading instead, so reopening starts at the top without changing access.
      heading.current?.focus({preventScroll: true});
      panel.scrollTop = 0;
    }
    const back = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); if (!actionPending.current) setFinishing(true); };
    if (visible) window.addEventListener('alpha-back', back, true);
    return () => { if (panel?.open) panel.close(); window.removeEventListener('alpha-back', back, true); };
  }, [visible, complete, reopened]);
  async function enable(key: PermissionKey, manage = false) {
    if (actionPending.current) return;
    actionPending.current = true; setBusy(key);
    try {
      if (manage) await device.openSettings({page: 'privacy'});
      const value = manage || states[key] === 'unavailable' ? await flows[key].refresh() : await flows[key].enable();
      if (alive.current && value !== null) { setStates(previous => ({...previous, [key]: value})); if (key === 'photos') setPhotoStatus(photoDescription.current); if (key === 'location') setLocationStatus(locationDescription.current); }
    } catch { if (alive.current) setStates(previous => ({...previous, [key]: 'unavailable'})); }
    finally { actionPending.current = false; if (alive.current) setBusy(null); }
  }
  if (!visible) return null;
  const googleText = (connected: boolean) => googleStatus.state === 'checking' ? 'Checking connection…' : googleStatus.state === 'unavailable' ? 'Connection could not be verified. Check Google accounts.' : connected ? 'Connected with read access' : 'Not connected';
  return <dialog ref={dialog} className="alpha-startup-permissions" aria-labelledby="alpha-permission-title" aria-describedby="alpha-permission-description" onCancel={event => { event.preventDefault(); if (!actionPending.current) setFinishing(true); }}>
    <div className="alpha-startup-content"><span className="alpha-compute-mark" role="img" aria-label="Alpha Phone"/>
    {complete ? <>
      <h2 className="serif" ref={heading} tabIndex={-1} id="alpha-permission-title">You’re all set</h2>
      <p id="alpha-permission-description">You can start using Alpha and manage skipped permissions and Google connections in Settings.</p>
      <div className="alpha-startup-permission-actions"><button type="button" onClick={() => { setDismissed(true); if (!reopened) window.dispatchEvent(new Event('launcher-home')); }}>Go to Alpha</button></div>
    </> : <>
    <h2 className="serif" ref={heading} tabIndex={-1} id="alpha-permission-title">Set up Alpha access</h2>
    <p id="alpha-permission-description">Choose access for the features you want. You can do this later in Settings.</p>
    {activeKeys.map(key => <section key={key} aria-labelledby={`alpha-access-${key}`}>
      <h3 id={`alpha-access-${key}`}>{details[key].title}</h3><p>{details[key].description}</p>
      {states[key] === 'ready' ? <p role="status">{key === 'photos' ? photoStatus : key === 'location' ? locationStatus : 'Allowed'}</p> : states[key] === 'checking' ? <p role="status">Checking access…</p> : <>
        {states[key] === 'settings' && <p role="status">{native ? 'Access is off. You can enable it in Android settings.' : 'Access is blocked. Open this site’s settings in your browser, allow access, then check again.'}</p>}
        {states[key] === 'unavailable' && <p role="status">Access could not be checked. Try again, or manage it later in Settings.</p>}
        <div className="alpha-startup-permission-actions"><button type="button" disabled={busy !== null} aria-label={busy === key ? 'Checking…' : states[key] === 'settings' ? (native ? `Manage ${details[key].title.toLowerCase()} in Android` : `Check ${key} again`) : states[key] === 'unavailable' ? `Check ${key} again` : `Enable ${key}`} onClick={() => void enable(key)}>{busy === key ? 'Checking…' : states[key] === 'settings' ? (native ? 'Manage' : 'Check again') : states[key] === 'unavailable' ? 'Check again' : 'Enable'}</button></div>
      </>}
      {(key === 'photos' || key === 'location') && states[key] === 'ready' && <div className="alpha-startup-permission-actions"><button type="button" disabled={busy !== null} onClick={() => void enable(key, true)}>{key === 'photos' ? 'Manage photo access' : 'Manage location access'}</button></div>}
    </section>)}
    <section aria-labelledby="alpha-access-google"><h3 id="alpha-access-google">Gmail and Google Calendar</h3>
      <p>Connect your Google account through Eliza Cloud. Google shows the permissions before you approve. Sending email and changing Calendar events use additional optional consent in Google accounts.</p>
      <p role="status">Gmail: {googleText(googleStatus.gmail)}<br/>Google Calendar: {googleText(googleStatus.calendar)}</p>
      <div className="alpha-startup-permission-actions"><button type="button" disabled={busy !== null} onClick={() => googleConnectionController.open()}>Review Google connections</button></div>
    </section>
    <section aria-labelledby="alpha-access-files"><h3 id="alpha-access-files">Files</h3><p>{native ? 'Choose files or folders when you open Files.' : 'Choose files with your browser’s file picker when you need them.'}</p></section>
    <div className="alpha-startup-permission-actions alpha-startup-permission-footer"><button type="button" disabled={busy !== null} onClick={() => setFinishing(true)}>{allReady ? 'Continue' : 'Not now'}</button></div>
    </>}</div>
  </dialog>;
}
