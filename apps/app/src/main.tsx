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
document.documentElement.dataset.connectionMode = mock ? 'mock' : 'live';
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
  installInboxCloudAdapter(Component, VIEWS);
  installWorkflowAdapter(Component, VIEWS);
}
installClockAdapter(Component, VIEWS, { simulated: fixture });
let shell: any;
function Phone() {
  useEffect(() => {
    if (isAndroid) void DailyApps.surfaceInfo().then(info => {
      if (Number.isFinite(info.topInset)) document.documentElement.style.setProperty('--native-top-inset', `${info.topInset}px`);
    }).catch(() => {});
    const size = () => {
      const scale = window.innerWidth / 412;
      document.documentElement.style.setProperty('--phone-scale', String(scale));
      document.documentElement.style.setProperty('--phone-height', `${(window.visualViewport?.height || window.innerHeight) / scale}px`);
    };
    size(); window.addEventListener('resize', size); window.visualViewport?.addEventListener('resize', size);
    return () => { window.removeEventListener('resize', size); window.visualViewport?.removeEventListener('resize', size); };
  }, []);
  return <>{mock && <div className="mock-mode-banner" role="status"><span>Mock mode · simulated data and actions</span><button onClick={() => { void connectionController.offline().then(() => { const url = new URL(location.href); url.searchParams.delete('mode'); url.searchParams.delete('start'); location.assign(url.href); }); }}>Exit mock mode</button></div>}<Component phoneSurface initial={fixture ? query.get('start') || 'home' : 'home'} theme={query.get('theme') === 'dark' ? 'dark' : 'light'} ref={(value: any) => { shell = value; }} />
{!fixture && <><ConnectionChooser /><HostedDigestPanel /></>}</>;
}
async function mountPhone() {
  if (mock && isAndroid) {
    try { await (await import('@capacitor/core')).registerPlugin<{pauseNotificationCollection():Promise<void>}>('AlphaConnection').pauseNotificationCollection(); }
    catch { document.getElementById('root')!.textContent='Mock mode could not pause notification collection. Reopen Alpha Phone to try again.'; return; }
  }
  createRoot(document.getElementById('root')!).render(<Phone />);
}
void mountPhone();
