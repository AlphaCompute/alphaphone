import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { useEffect, useRef, useState } from 'react';
import { registerPlugin } from './platform-plugins';
import { createStartupPermissionFlow, readStartupPermissionMemory, writeStartupPermissionMemory, STARTUP_PERMISSIONS_REOPEN, type StartupPermissionState } from './startup-permission-flow';
import './startup-permissions.css';

const notifications = registerPlugin<{status(): Promise<{permissionGranted: boolean; appEnabled: boolean}>}>('AlphaNotifications');
const permissions = registerPlugin<{
  requestPermissions(options: {permissions: ['notifications']}): Promise<unknown>;
  addListener(event: 'appResumed', callback: () => void): Promise<PluginListenerHandle>;
}>('DailyApps');
const microphone = registerPlugin<{
  checkPermissions(): Promise<{microphone: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale'}>;
  requestPermissions(options: {permissions: ['microphone']}): Promise<unknown>;
}>('AlphaVoiceCloud');
const device = registerPlugin<{openSettings(options: {page: 'notifications' | 'privacy'}): Promise<unknown>}>('AlphaDevice');
const keys = ['notifications', 'microphone'] as const;
type PermissionKey = typeof keys[number];
const details = {
  notifications: {title: 'Notifications', description: 'Get reminders, scheduled briefs and approval requests when Alpha is in the background.'},
  microphone: {title: 'Microphone', description: 'Talk to Alpha when you choose voice input. Allowing access does not start recording.'},
};

/** Explicit access requests only; no recording, cross-app access or OS role changes. */
export function StartupPermissions() {
  const [flows] = useState(() => ({
    notifications: createStartupPermissionFlow({
      status: async () => { const status = await notifications.status(); return {granted: status.permissionGranted, enabled: status.appEnabled}; },
      request: () => permissions.requestPermissions({permissions: ['notifications']}),
      openSettings: () => device.openSettings({page: 'notifications'}),
    }, {key: 'notifications'}),
    microphone: createStartupPermissionFlow({
      status: async () => {
        const status = await microphone.checkPermissions();
        if (!['granted', 'denied', 'prompt', 'prompt-with-rationale'].includes(status.microphone)) throw Error('Microphone status unavailable');
        return {granted: status.microphone === 'granted', enabled: status.microphone === 'granted'};
      },
      request: () => microphone.requestPermissions({permissions: ['microphone']}),
      openSettings: () => device.openSettings({page: 'privacy'}),
    }, {key: 'microphone'}),
  }));
  const [states, setStates] = useState<Record<PermissionKey, StartupPermissionState>>({notifications: 'checking', microphone: 'checking'});
  // "Not now" survives the chooser unmounting this panel and a cold start, until Settings reopens it.
  const [dismissed, setDismissedState] = useState(() => readStartupPermissionMemory().dismissed);
  const setDismissed = (value: boolean) => { writeStartupPermissionMemory({dismissed: value}); setDismissedState(value); };
  useEffect(() => {
    const reopen = () => setDismissedState(readStartupPermissionMemory().dismissed);
    window.addEventListener(STARTUP_PERMISSIONS_REOPEN, reopen);
    return () => window.removeEventListener(STARTUP_PERMISSIONS_REOPEN, reopen);
  }, []);
  const [busy, setBusy] = useState<PermissionKey | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const alive = useRef(false);
  const actionPending = useRef(false);
  const native = Capacitor.getPlatform() === 'android';
  const visible = native && !dismissed && keys.some(key => states[key] !== 'checking' && states[key] !== 'ready');

  useEffect(() => {
    alive.current = true;
    if (!native) return () => { alive.current = false; };
    let disposed = false;
    const refresh = (key: PermissionKey) => {
      void flows[key].refresh().then(value => {
        if (!disposed && value !== null) setStates(previous => ({...previous, [key]: value}));
      });
    };
    const resume = () => { if (!document.hidden && !actionPending.current) keys.forEach(refresh); };
    keys.forEach(refresh);
    document.addEventListener('visibilitychange', resume);
    let listener: PluginListenerHandle | undefined;
    void permissions.addListener('appResumed', resume).then(handle => {
      if (disposed) void handle.remove(); else listener = handle;
    }).catch(() => { /* Visibility refresh remains available if the resume bridge is unavailable. */ });
    return () => {
      disposed = true; alive.current = false;
      document.removeEventListener('visibilitychange', resume);
      void listener?.remove();
    };
  }, [flows, native]);
  useEffect(() => {
    const panel = dialog.current;
    if (visible && panel && !panel.open) panel.showModal();
    return () => { if (panel?.open) panel.close(); };
  }, [visible]);

  async function enable(key: PermissionKey) {
    // Android presents one permission/settings flow at a time.
    if (actionPending.current) return;
    actionPending.current = true;
    setBusy(key);
    const value = states[key] === 'unavailable' ? await flows[key].refresh() : await flows[key].enable();
    actionPending.current = false;
    if (alive.current) {
      if (value !== null) setStates(previous => ({...previous, [key]: value}));
      setBusy(null);
    }
  }
  if (!visible) return null;
  return <dialog ref={dialog} className="alpha-startup-permissions" aria-labelledby="alpha-permission-title" aria-describedby="alpha-permission-description" onCancel={() => setDismissed(true)}>
    <h2 id="alpha-permission-title">Set up Alpha access</h2>
    <p id="alpha-permission-description">Choose what to allow. You can keep using text and manage access later in Settings.</p>
    {keys.map(key => <section key={key} aria-labelledby={`alpha-access-${key}`}>
      <h3 id={`alpha-access-${key}`}>{details[key].title}</h3>
      <p>{details[key].description}</p>
      {states[key] === 'ready' ? <p role="status">Allowed</p> : states[key] === 'checking' ? <p role="status">Checking access…</p> : <>
        {states[key] === 'settings' && <p role="status">Access is off. You can enable it in Android settings.</p>}
        {states[key] === 'unavailable' && <p role="status">Access could not be checked. Try again, or manage it later in Settings.</p>}
        <div className="alpha-startup-permission-actions"><button type="button" disabled={busy !== null} onClick={() => void enable(key)}>{busy === key ? 'Checking…' : states[key] === 'settings' ? `Manage ${key} in Android` : states[key] === 'unavailable' ? `Check ${key} again` : `Enable ${key}`}</button></div>
      </>}
    </section>)}
    <div className="alpha-startup-permission-actions"><button type="button" onClick={() => setDismissed(true)}>Not now</button></div>
  </dialog>;
}
