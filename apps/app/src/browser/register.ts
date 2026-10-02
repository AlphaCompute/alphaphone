import { BrowserLocation } from './location';
import { BrowserVoice } from './voice';
import { BrowserFiles } from './files';
import { BrowserDevice } from './device';
import { BrowserDaily, BrowserNotifications } from './daily';
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
  const daily = new BrowserDaily(files);
  registerPlugin('DailyApps', { web: () => daily });
  registerPlugin('AlphaNotifications', { web: () => new BrowserNotifications(daily) });
  registerPlugin('AlphaCalendar', { web: () => new BrowserCalendar() });
  registerPlugin('AlphaBrowser', { web: () => new BrowserSurface() });
}
