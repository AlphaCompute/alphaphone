import {BrowserClock} from './clock';
import { browserHostedResults } from './hosted-results';
import { BrowserLocation } from './location';
import { BrowserVoice } from './voice';
import { BrowserMailAttachments } from './mail-attachments';
import { BrowserFiles } from './files';
import { BrowserDevice } from './device';
import { BrowserDaily } from './daily';
import { BrowserNotifications } from './notifications';
import { registerPlugin } from '../platform-plugins';
import { Capacitor } from '@capacitor/core';
import { BrowserCalendar } from './calendar';
import { BrowserSurface } from './browser-surface';
// This module must be the first import in main: Capacitor keeps the first registration.
if (!Capacitor.isNativePlatform()) {
  registerPlugin('ElizaLocation', { web: () => new BrowserLocation() });
  const voice = new BrowserVoice();
  registerPlugin('AlphaVoiceCloud', { web: () => voice });
  registerPlugin('DevelopmentAgent', { web: () => voice });
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
  registerPlugin('AlphaHostedResults', { web: () => browserHostedResults });
  const calendar=new BrowserCalendar();
  const notifications=new BrowserNotifications(daily,calendar);
  registerPlugin('AlphaNotifications', { web: () => notifications });
  new BrowserClock(daily,notifications);
  registerPlugin('AlphaCalendar', { web: () => calendar });
  registerPlugin('AlphaBrowser', { web: () => new BrowserSurface() });
}
