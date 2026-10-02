import { installBrowserDeviceAdapter } from './browser/device-adapter';
import { BrowserDeviceControls } from './browser/device-controls';
import './browser/register';
import { browserDevProfile } from './browser/dev-profile';
import { captureSimulatedApps, installSimulatedApps } from './browser/simulated-apps';
import {HostedDigestPanel} from './runtime/hosted-digest-ui';
import { installClockAdapter } from './prototype/clock-adapter';
import { installNotesDocumentAdapter } from './prototype/notes-document-adapter';
import { installPrototypeMapsAdapter } from './prototype/maps-adapter';
import { installNotificationsAdapter } from './prototype/notifications-adapter';
import { installWorkflowAdapter } from './prototype/workflow-adapter';
import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Component, VIEWS } from './prototype/model.js';
import { installReminderAdapter } from './prototype/reminder-adapter';
import { installAgentAdapter } from './prototype/agent-adapter';
import { installPrototypeNativeAdapters } from './prototype/native-adapter';
import { installSelectedDocumentAdapter } from './prototype/selection-adapter';
import { installPrototypeCameraAdapter } from './prototype/camera-adapter';
import { installPrototypeHomeBindings, installPrototypeDataAdapter } from './prototype/data-adapter';
import { isMvpView } from './prototype/mvp-features';
import { installPrototypeContactsAdapter } from './prototype/contacts-adapter';
import { isAndroid } from './native';
import { DailyApps } from './daily';
import { installPrototypeVoiceAdapter } from './prototype/voice-adapter';
import { installPrototypeBrowserAdapter } from './prototype/browser-adapter';
import { installCalendarAdapter } from './prototype/calendar-adapter';
import { installSettingsAdapter } from './prototype/settings-adapter';
import { ConnectionChooser, connectionController } from './runtime/connection-ui';
import { installInboxCloudAdapter } from './prototype/inbox-cloud-adapter';
import './prototype/prototype.css';
import './prototype/phone.css';
const query = new URLSearchParams(location.search);
document.documentElement.classList.toggle('native-phone', isAndroid);
const savedMock = (() => {
  try { return isAndroid && JSON.parse(localStorage.getItem('alpha.connection.selection.v1') || 'null')?.kind === 'mock'; }
  catch { return false; }
})();
// Resolve mock before mounting any native adapter, including after a cold start.
const mock = query.get('mode') === 'mock' || savedMock;
const fixture = mock || (import.meta.env.DEV && !isAndroid && query.get('fixture') === '1');
const initialTheme = (() => {
  if (query.has('theme') || fixture) return query.get('theme') === 'dark' ? 'dark' : 'light';
  try { return localStorage.getItem('alpha.appearance.v1') === 'dark' ? 'dark' : 'light'; }
  catch { return 'light'; }
})();
document.documentElement.dataset.connectionMode = mock ? 'mock' : 'live';
const simulatedApps=captureSimulatedApps(VIEWS);
installPrototypeHomeBindings(Component);
if (!fixture) {
  let selected: ReturnType<typeof installSelectedDocumentAdapter> | undefined;
  installPrototypeNativeAdapters(Component, VIEWS, { onSelection: (module, result, api) => { void selected?.(module, result, api); } });
  installPrototypeMapsAdapter(Component, VIEWS);
  selected = installSelectedDocumentAdapter(Component, VIEWS);
  installPrototypeCameraAdapter(Component, VIEWS);
  // Deferred by September 15 MVP notes; retain adapter source and user data.
  if (isMvpView("contacts")) installPrototypeContactsAdapter(Component, VIEWS);
  installAgentAdapter(Component, VIEWS);
  installReminderAdapter(Component, VIEWS);
  installCalendarAdapter(Component, VIEWS);
  installPrototypeDataAdapter(Component, VIEWS);
  installNotificationsAdapter(Component);
  installPrototypeVoiceAdapter(Component, VIEWS);
  installNotesDocumentAdapter(Component, VIEWS);
  installPrototypeBrowserAdapter(Component, VIEWS);
  installSettingsAdapter(Component, VIEWS);
  if(!isAndroid)installBrowserDeviceAdapter(Component);
  if(!browserDevProfile) installInboxCloudAdapter(Component, VIEWS);
  if(!browserDevProfile) installWorkflowAdapter(Component, VIEWS);
}
installSimulatedApps(Component,VIEWS,simulatedApps);
installClockAdapter(Component, VIEWS, { simulated: fixture, browser: !isAndroid });
let shell: any;
function Phone() {
  useEffect(() => {
    if (isAndroid) void DailyApps.surfaceInfo().then(info => {
      if (Number.isFinite(info.topInset)) document.documentElement.style.setProperty('--native-top-inset', `${info.topInset}px`);
    }).catch(() => {});
    const size = () => {
      const height = window.visualViewport?.height || window.innerHeight;
      const desktop = !isAndroid && window.innerWidth > 600;
      const banner = !isAndroid && mock ? document.querySelector('.mock-mode-banner')?.getBoundingClientRect().height || 36 : 0;
      const available = Math.max(1, height - banner - (desktop ? 48 : 0));
      const scale = desktop ? Math.min(1, available / 915) : window.innerWidth / 412;
      document.documentElement.style.setProperty('--phone-scale', String(scale));
      document.documentElement.style.setProperty('--phone-height', `${desktop ? 915 : available / scale}px`);
      document.documentElement.style.setProperty('--phone-left', `${desktop ? (window.innerWidth - 412 * scale) / 2 : 0}px`);
      document.documentElement.style.setProperty('--phone-top', `${banner + (desktop ? 24 : 0)}px`);
      document.documentElement.classList.toggle('browser-desktop', desktop);
    };
    size(); window.addEventListener('resize', size); window.visualViewport?.addEventListener('resize', size);
    return () => { window.removeEventListener('resize', size); window.visualViewport?.removeEventListener('resize', size); };
  }, []);
  return <>{import.meta.env.DEV&&!isAndroid&&!mock&&<BrowserDeviceControls command={action=>{
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
  }}/>}{import.meta.env.DEV&&!isAndroid&&!mock&&<button style={{position:'fixed',right:8,bottom:8,zIndex:90,fontSize:12}} onClick={()=>{const url=new URL(location.href);if(browserDevProfile)url.searchParams.delete('mode');else url.searchParams.set('mode','dev');location.assign(url.href);}}>{browserDevProfile?'Dev device · local data':'Dev device'}</button>}{mock && <div className="mock-mode-banner" role="status"><span>Mock mode · simulated data and actions</span><button onClick={() => { void connectionController.offline().then(() => { const url = new URL(location.href); url.searchParams.delete('mode'); url.searchParams.delete('start'); location.assign(url.href); }); }}>Exit mock mode</button></div>}<Component phoneSurface initial={fixture ? query.get('start') || 'home' : 'home'} theme={initialTheme} ref={(value: any) => { shell = value; }} />
{!fixture && <><ConnectionChooser /><HostedDigestPanel /></>}</>;
}
async function mountPhone() {
  if (mock && isAndroid) {
    try { await (await import('./platform-plugins')).registerPlugin<{pauseNotificationCollection():Promise<void>}>('AlphaConnection').pauseNotificationCollection(); }
    catch { document.getElementById('root')!.textContent='Mock mode could not pause notification collection. Reopen Alpha Phone to try again.'; return; }
  }
  createRoot(document.getElementById('root')!).render(<Phone />);
}
void mountPhone();
