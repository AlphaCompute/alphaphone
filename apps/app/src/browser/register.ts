import './register-hosted-results';
import {BrowserClock} from './clock';
import { BrowserLocation } from './location';
import { BrowserVoice } from './voice';
import { BrowserMailAttachments } from './mail-attachments';
import { BrowserFiles } from './files';
import { BrowserDevice } from './device';
import { BrowserDaily } from './daily';
import { BrowserNotifications } from './notifications';
import { registerPlugin } from '../platform-plugins';
import { Capacitor } from '@capacitor/core';
import { devSurfacesEnabled } from '../build-flags';
import { BrowserCalendar } from './calendar';
import { BrowserSurface } from './browser-surface';
// This module must be the first import in main: Capacitor keeps the first registration.
if (!Capacitor.isNativePlatform()) {
  registerPlugin('ElizaLocation', { web: () => new BrowserLocation() });
  const voice = new BrowserVoice();
  registerPlugin('AlphaVoiceCloud', { web: () => voice });
  // The development voice/agent bridge exists only on the development server with test mocks.
  if (devSurfacesEnabled) registerPlugin('DevelopmentAgent', { web: () => voice });
  registerPlugin('AlphaNoteAudio', { web: () => voice });
  const device = new BrowserDevice();
  registerPlugin('AlphaDevice', { web: () => device });
  registerPlugin('ElizaSystem', { web: () => device });
  registerPlugin('DeviceApps', { web: () => device });
  const files = new BrowserFiles();
  registerPlugin('AlphaFiles', { web: () => files });
  registerPlugin('AlphaMailAttachments', { web: () => new BrowserMailAttachments(files) });
  const daily = new BrowserDaily(files);
  registerPlugin('DailyApps', { web: () => daily });
  const calendar=new BrowserCalendar();
  const notifications=new BrowserNotifications(daily,calendar);
  registerPlugin('AlphaNotifications', { web: () => notifications });
  new BrowserClock(daily,notifications);
  registerPlugin('AlphaCalendar', { web: () => calendar });
  registerPlugin('AlphaBrowser', { web: () => new BrowserSurface() });
}
