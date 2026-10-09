import { testMocksEnabled } from '../build-flags';

/** Product speech uses the selected Cloud account. Local routes are explicit test surfaces. */
export function selectVoiceRoute(preference: 'default' | 'device' | 'agent' | 'manual' = 'default'): 'device' | 'cloud' | 'agent' | 'manual' {
  if (testMocksEnabled && (preference === 'device' || preference === 'manual')) return preference;
  return 'cloud';
}
