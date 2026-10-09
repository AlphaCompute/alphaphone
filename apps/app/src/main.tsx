import {installSubviewAccessibility} from './prototype/subview-accessibility';
import {installCalendarMonthFocus} from './prototype/calendar-month-focus';
import {installCalendarEditDraftAdapter} from './prototype/calendar-edit-draft-adapter';
import {installCalendarFormDraftAdapter} from './prototype/calendar-form-draft-adapter';
// Register browser implementations before any runtime module claims plugin identity.
import './browser/register';
import {bindBrowserSpeechConnection} from './browser/agent-speech';
import { testMocksEnabled, devSurfacesEnabled } from './build-flags';
import { RootErrorBoundary, installGlobalErrorRecovery } from './runtime/error-boundary';
import { installBrowserDeviceAdapter } from './browser/device-adapter';
import { browserDevProfile as devProfileQuery,developmentAgentWorkflows as devAgentWorkflowsQuery } from './browser/dev-profile';
// Static imports keep development startup synchronous (no top-level await, which the page load
// event does not wait for). Flag-off builds resolve these two modules to inert stubs in vite.config.
import { BrowserDeviceControls as DevDeviceControls } from './browser/device-controls';
import { captureSimulatedApps, installSimulatedApps } from './browser/simulated-apps';
import {HostedDigestPanel} from './runtime/hosted-digest-ui';
import { installClockAdapter } from './prototype/clock-adapter';
import {installNoteWebSourceAdapter} from './prototype/note-web-source-adapter';
import {installNoteSourceAdapter} from './prototype/note-source-adapter';
import { installNotesDocumentAdapter } from './prototype/notes-document-adapter';
import { installPrototypeMapsAdapter } from './prototype/maps-adapter';
import { installNotificationsAdapter } from './prototype/notifications-adapter';
import { installWorkflowAdapter } from './prototype/workflow-adapter';
import { useEffect, useSyncExternalStore } from 'react';
import { StartupPermissions } from './startup-permissions';
import { createRoot } from 'react-dom/client';
import { Component, VIEWS } from './prototype/model.js';
import { installReminderAdapter } from './prototype/reminder-adapter';
import { installAgentAdapter } from './prototype/agent-adapter';
import { installPrototypeNativeAdapters } from './prototype/native-adapter';
import { installSelectedDocumentAdapter } from './prototype/selection-adapter';
import { installPrototypeCameraAdapter } from './prototype/camera-adapter';
import { installPrototypeHomeBindings, installPrototypeDataAdapter } from './prototype/data-adapter';
import { isAndroid, DeviceApps } from './native';
import { DailyApps } from './daily';
import { installPrototypeVoiceAdapter } from './prototype/voice-adapter';
import { installPrototypeBrowserAdapter } from './prototype/browser-adapter';
import { installCalendarAdapter } from './prototype/calendar-adapter';
import { installSettingsAdapter } from './prototype/settings-adapter';
import { ConnectionChooser, connectionController } from './runtime/connection-ui';
import { installNotesTrashAdapter } from './prototype/notes-trash-adapter';
import { installInboxCloudAdapter } from './prototype/inbox-cloud-adapter';
import { installHomeLauncher } from './prototype/home-launcher';
import { setLocalePreferences } from './prototype/locale-time';
import './prototype/prototype.css';
import './prototype/phone.css';
installGlobalErrorRecovery();
// Developer surfaces are only reachable in an explicitly flagged development server.
const browserDevProfile=devSurfacesEnabled&&devProfileQuery;
const developmentAgentWorkflows=devSurfacesEnabled&&devAgentWorkflowsQuery;
const BrowserDeviceControls=devSurfacesEnabled?DevDeviceControls:null;
const MOCK_BANNER_STYLE=".mock-mode-banner{position:fixed;top:0;left:0;right:0;z-index:2000;display:flex;justify-content:space-between;align-items:center;gap:8px;padding:5px 10px;background:#0000ff;color:white;font:11px 'Public Sans',sans-serif}.mock-mode-banner button{border:1px solid white;border-radius:14px;background:transparent;color:white;padding:4px 8px;font:inherit}.native-phone .mock-mode-banner{top:var(--native-top-inset,24px)}";
if(!isAndroid)bindBrowserSpeechConnection(connectionController);
const query = new URLSearchParams(location.search);
document.documentElement.classList.toggle('native-phone', isAndroid);
const savedMock = testMocksEnabled && (() => {
  try { return isAndroid && JSON.parse(localStorage.getItem('alpha.connection.selection.v1') || 'null')?.kind === 'mock'; }
  catch { return false; }
})();
// Resolve mock before mounting any native adapter, including after a cold start.
// Production builds never admit mock or fixture state, whatever the URL or storage says.
const mock = testMocksEnabled && (query.get('mode') === 'mock' || savedMock);
const fixture = testMocksEnabled && (mock || (devSurfacesEnabled && !isAndroid && query.get('fixture') === '1'));
const initialTheme = (() => {
  if (testMocksEnabled && (query.has('theme') || fixture)) return query.get('theme') === 'dark' ? 'dark' : 'light';
  try { return localStorage.getItem('alpha.appearance.v1') === 'dark' ? 'dark' : 'light'; }
  catch { return 'light'; }
})();
document.documentElement.dataset.connectionMode = mock ? 'mock' : 'live';
if (testMocksEnabled && mock) { const style = document.createElement('style'); style.textContent = MOCK_BANNER_STYLE; document.head.append(style); }
const simulatedApps=devSurfacesEnabled?captureSimulatedApps(VIEWS):undefined;
installPrototypeHomeBindings(Component);
if (!fixture) {
  let selected: ReturnType<typeof installSelectedDocumentAdapter> | undefined;
  installPrototypeNativeAdapters(Component, VIEWS, { onSelection: (module, result, api) => { void selected?.(module, result, api); } });
  installPrototypeMapsAdapter(Component, VIEWS);
  selected = installSelectedDocumentAdapter(Component, VIEWS);
  installPrototypeCameraAdapter(Component, VIEWS);
  installAgentAdapter(Component, VIEWS);
  installReminderAdapter(Component, VIEWS);
  installCalendarAdapter(Component, VIEWS);
  installCalendarFormDraftAdapter(Component, VIEWS);
  installCalendarEditDraftAdapter(Component, VIEWS);
  installPrototypeDataAdapter(Component, VIEWS);
  installNotificationsAdapter(Component);
  installPrototypeVoiceAdapter(Component, VIEWS);
  installNotesDocumentAdapter(Component, VIEWS);
  installNotesTrashAdapter(Component, VIEWS);
  installNoteSourceAdapter(VIEWS);
  installNoteWebSourceAdapter(VIEWS);
  installPrototypeBrowserAdapter(Component, VIEWS);
  installSettingsAdapter(Component, VIEWS);
  if(!isAndroid){if(devSurfacesEnabled)installBrowserDeviceAdapter(Component);else installBrowserCapabilityTiles(Component);}
  if(!browserDevProfile) installInboxCloudAdapter(Component, VIEWS);
  if(!browserDevProfile) installWorkflowAdapter(Component, VIEWS);
}
if(devSurfacesEnabled&&simulatedApps)installSimulatedApps(Component,VIEWS,simulatedApps);
if(developmentAgentWorkflows)installWorkflowAdapter(Component,VIEWS);
installSubviewAccessibility(VIEWS);
installCalendarMonthFocus(Component, VIEWS);
installClockAdapter(Component, VIEWS, { simulated: testMocksEnabled && fixture, browser: !isAndroid });
// Installed apps come from Android (or the browser device's app list); outermost so its drawer
// state composes with every Home binding above.
installHomeLauncher(Component, DeviceApps, { icons: isAndroid });
/** A browser cannot read or change radios and sensors; show that instead of fixture toggles. */
function installBrowserCapabilityTiles(Component:any){
  const p=Component.prototype,render=p.renderVals;
  const managed=new Set(['Wi-Fi','Bluetooth','Airplane mode','Agent can listen','Location','Do not disturb']);
  p.renderVals=function(){
    const out=render.call(this);
    const tiles=(out.tiles||[]).map((tile:any)=>managed.has(tile.label)?{...tile,on:false,disabled:true,css:'background:var(--s2);color:var(--fg);opacity:.55',toggle:()=>{}}:tile);
    return {...out,tiles,deviceSettingsPending:true,deviceSettingsMessage:'Network, radio and sensor settings are managed by your browser and operating system.',sbWifi:navigator.onLine,sbPlane:false};
  };
}
let shell: any;
let launcherPresentation = false;
/** Opened through ACTION_ASSIST (AlphaAssistActivity): chat and close only. */
let assistantSurface = false;
const closeAssistant = () => { void DailyApps.closeAssistant().catch(() => {}); };
function Phone() {
  const connection = useSyncExternalStore(connectionController.subscribe, connectionController.getSnapshot);
  useEffect(() => {
    if (isAndroid) void DailyApps.surfaceInfo().then(info => {
      if (Number.isFinite(info.topInset)) document.documentElement.style.setProperty('--native-top-inset', `${info.topInset}px`);
      if (Number.isFinite(info.bottomInset)) document.documentElement.style.setProperty('--native-bottom-inset', `${info.bottomInset}px`);
    }).catch(() => {});
    const size = () => {
      const height = window.visualViewport?.height || window.innerHeight;
      // A wide browser window shows the fitted phone preview; touch devices and Android fill the screen.
      const coarse = !isAndroid && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
      const desktop = !isAndroid && window.innerWidth > 600 && !coarse;
      const banner = testMocksEnabled && mock ? document.querySelector('.mock-mode-banner')?.getBoundingClientRect().height || 36 : 0;
      const tools = devSurfacesEnabled && !isAndroid && !mock ? document.querySelector<HTMLElement>('.alpha-dev-tools') : null;
      const toolsInset = tools ? Math.max(56, Math.ceil(tools.getBoundingClientRect().height + (parseFloat(getComputedStyle(tools).bottom) || 0) + 2)) : 0;
      const available = Math.max(1, height - banner - (desktop ? 48 : 0) - toolsInset);
      // Orientation comes from the screen, not the viewport, so a soft keyboard (adjustResize)
      // never flips the layout. Landscape scales by the screen's shorter side so rotating keeps the
      // same type size; the longer side becomes extra canvas (Home and the composer side by side).
      const landscape = !desktop && window.screen.width > window.screen.height;
      const scale = desktop ? Math.min(1, available / 915) : landscape ? Math.max(0.1, Math.min(window.innerWidth, window.screen.height) / 412) : window.innerWidth / 412;
      // Width follows the viewport in CSS, so a rotation never leaves the canvas wider than the
      // screen before this handler runs (a wider canvas would widen the mobile layout viewport).
      const width = desktop ? '412px' : `calc(100vw / ${scale})`;
      document.documentElement.style.setProperty('--phone-scale', String(scale));
      document.documentElement.style.setProperty('--phone-width', width);
      document.documentElement.style.setProperty('--phone-height', `${desktop ? 915 : available / scale}px`);
      document.documentElement.style.setProperty('--phone-left', `${desktop ? (window.innerWidth - 412 * scale) / 2 : 0}px`);
      document.documentElement.style.setProperty('--phone-top', `${banner + (desktop ? 24 : 0)}px`);
      document.documentElement.classList.toggle('browser-desktop', desktop);
      document.documentElement.classList.toggle('alpha-landscape', landscape);
    };
    const bannerObserver=new ResizeObserver(size);const bannerElement=testMocksEnabled&&mock?document.querySelector('.mock-mode-banner'):null;if(bannerElement)bannerObserver.observe(bannerElement);
    size(); window.addEventListener('resize', size); window.visualViewport?.addEventListener('resize', size);
    return () => { bannerObserver.disconnect(); window.removeEventListener('resize', size); window.visualViewport?.removeEventListener('resize', size); };
  }, []);
  return <>{BrowserDeviceControls&&!isAndroid&&!mock&&query.get('tools')==='1'&&<BrowserDeviceControls command={action=>{
    if(!shell)return;
    if(action==='home')window.dispatchEvent(new Event('launcher-home'));
    else if(action==='back')window.dispatchEvent(new Event('alpha-back',{cancelable:true}));
    else if(action==='power'){shell.leave();shell.power();}
    else if(action==='unlock'){shell.unlock();window.dispatchEvent(new Event('focus'));}
    else if(action==='boot'){shell.leave();shell.runBoot();}
    else if(action==='shade'){shell.unlock();shell.setState({shade:true});}
    else if(action==='assistant'){shell.unlock();shell.setState({chat:'full'});}
    else if(action==='background'){shell.leave();shell.setState({screen:'off',voice:'off',chat:'input',shade:false});document.documentElement.dataset.devBackground='true';window.dispatchEvent(new Event('blur'));}
    else if(action==='resume'){delete document.documentElement.dataset.devBackground;shell.unlock();window.dispatchEvent(new Event('focus'));}
    if(['power','unlock','boot','background','resume'].includes(action))window.dispatchEvent(new Event('alpha:device-state'));
  }}/>}{testMocksEnabled && mock && <div className="mock-mode-banner" role="status"><span>Mock mode · simulated data and actions</span><button onClick={() => { void connectionController.offline().then(() => { const url = new URL(location.href); url.searchParams.delete('mode'); url.searchParams.delete('start'); location.assign(url.href); }); }}>Exit mock mode</button></div>}<Component phoneSurface assistantSurface={assistantSurface} onCloseAssistant={closeAssistant} systemShell={launcherPresentation} nativeSystemChrome={isAndroid || !launcherPresentation} initial={testMocksEnabled && fixture ? query.get('start') || 'home' : 'home'} theme={initialTheme} ref={(value: any) => { shell = value; }} />
{!fixture && <><ConnectionChooser />{!assistantSurface && <><HostedDigestPanel />{!connection.open && <StartupPermissions />}</>}</>}</>;
}
/** Android's locale and 24-hour setting; WebView Intl alone does not follow the latter. */
async function applyDeviceLocale() {
  try { const info = await DeviceApps.localeInfo(); setLocalePreferences({ locale: info.locale, hourCycle: info.hour24 === true ? 'h23' : info.hour24 === false ? 'h12' : undefined }); }
  catch { /* Keep the WebView's default locale formatting. */ }
}
async function mountPhone() {
  // Android owns its system bars; browser defaults to the standalone app.
  launcherPresentation = isAndroid
    ? await DeviceApps.buildInfo().then(info => info.launcher === true).catch(() => false)
    : devSurfacesEnabled && query.get('shell') === 'launcher';
  if (isAndroid) {
    // AlphaAssistActivity (surfaceInfo) or an Activity opened with the 'alpha.assistant' extra.
    const [surface, launch] = await Promise.all([
      DailyApps.surfaceInfo().then(info => info.assistant === true).catch(() => false),
      DeviceApps.launchInfo().then(info => info.assistant === true).catch(() => false),
    ]);
    assistantSurface = surface || launch;
    await applyDeviceLocale();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) void applyDeviceLocale().then(() => shell?.setState({ localeRevision: Date.now() })); });
  } else if (devSurfacesEnabled && query.get('surface') === 'assistant') {
    // Development server only: preview the ACTION_ASSIST surface without an Android host.
    assistantSurface = true;
  }
  document.documentElement.classList.toggle('alpha-assistant-surface', assistantSurface);
  document.documentElement.classList.toggle('standalone-app', !launcherPresentation);
  if (testMocksEnabled && mock && isAndroid) {
    const { pauseLiveActivityForMock } = await import('./runtime/mock-admission');
    const root=document.getElementById('root')!;
    root.setAttribute('role','status');
    root.textContent='Pausing live background activity before opening mock mode…';
    try { await pauseLiveActivityForMock(); }
    catch {
      root.setAttribute('role','alert');
      root.textContent='Live background activity could not be paused. Retry before opening mock mode.';
      const retry=document.createElement('button');retry.textContent='Retry mock mode';
      retry.onclick=()=>{retry.disabled=true;void mountPhone();};root.append(retry);return;
    }
    root.removeAttribute('role');
  }
  createRoot(document.getElementById('root')!).render(<RootErrorBoundary><Phone /></RootErrorBoundary>);
}
void mountPhone();
