import { createRegionalMaps, type RegionalOptions } from '../../../../.eliza/client-features/plugins/plugin-maps/src/client/regional-provider.ts';
import { registerPlugin } from '../platform-plugins';
import { Capacitor } from '@capacitor/core';
import { DailyApps } from '../daily';
import { configureMapsProvider } from './runtime';
import { testMocksEnabled, devSurfacesEnabled } from '../build-flags';
export type { RegionalMap } from '../../../../.eliza/client-features/plugins/plugin-maps/src/client/regional-provider.ts';

/** The regional dataset this build accepts. The gateway's /capabilities must report
 * the same provider id; its coverage descriptor documents the licensed extract. */
export interface RegionalDataset {
 providerId: string;
 coverage: { region: string; bounds: readonly [number, number, number, number] };
}
/** Data descriptor for the dataset built by scripts/maps/dataset_manifest.py. */
export const regionalDataset: RegionalDataset = {
 providerId: 'alpha-osm-monaco',
 coverage: { region: 'Monaco', bounds: [7.409, 43.724, 7.449, 43.752] },
};

// Endpoint policy. Plain-HTTP loopback hosts and the emulator gateway exist only in
// test-mocks builds (ELIZA_DEV_ALLOW_TEST_MOCKS=1) and fold out of every other build,
// which accepts HTTPS only. An unset VITE_MAPS_BASE_URL stays honestly unconfigured.
export const { regionalDiagnostics, nativeRegion, nativeRegionRequest, regionalMap, initializeRegionalMaps } = createRegionalMaps({
 baseUrl: import.meta.env.VITE_MAPS_BASE_URL || undefined,
 providerId: regionalDataset.providerId,
 nativeGateway: testMocksEnabled ? 'http://10.0.2.2:47850' : '',
 developmentHosts: testMocksEnabled ? ['127.0.0.1', '10.0.2.2'] : [],
 development: devSurfacesEnabled,
 isNative: () => Capacitor.isNativePlatform(),
 developmentBuild: async () => testMocksEnabled && (await DailyApps.surfaceInfo()).developmentBuild === true,
 transport: registerPlugin<RegionalOptions['transport']>('AlphaMapsTransport'),
 configure: configureMapsProvider,
});
