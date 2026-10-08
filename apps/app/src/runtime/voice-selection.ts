import { Capacitor } from '@capacitor/core';
import { testMocksEnabled } from '../build-flags';
import { browserDevProfile } from '../browser/dev-profile';
import { connectionController } from './connection-ui';

/** Explicit local/manual choices win; billed resident speech uses the signed-in Cloud account. */
export function selectVoiceRoute(preference: 'default' | 'device' | 'agent' | 'manual' = 'default'): 'device' | 'cloud' | 'agent' | 'manual' {
  if (preference === 'device' || preference === 'manual') return preference;
  const cloud = !browserDevProfile && connectionController.getCloudEnvironment() !== null && connectionController.getCloudClient() !== null;
  if (preference === 'agent') return cloud ? 'cloud' : 'agent';
  return !testMocksEnabled && Capacitor.getPlatform() === 'android' && connectionController.getSnapshot().kind === 'resident' && cloud ? 'cloud' : 'device';
}
