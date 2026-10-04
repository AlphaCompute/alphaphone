import { createRegionalMaps, type RegionalOptions } from '../../../../.eliza/client-features/plugins/plugin-maps/src/client/regional-provider.ts';
import { registerPlugin } from '../platform-plugins';
import { Capacitor } from '@capacitor/core';
import { DailyApps } from '../daily';
import { configureMapsProvider } from './runtime';
export type { RegionalMap } from '../../../../.eliza/client-features/plugins/plugin-maps/src/client/regional-provider.ts';
/** Alpha's explicitly configured regional dataset and Android debug gateway. */
export const { regionalDiagnostics, nativeRegion, nativeRegionRequest, regionalMap, initializeRegionalMaps } = createRegionalMaps({
 baseUrl: import.meta.env.VITE_MAPS_BASE_URL,
 providerId: 'alpha-osm-monaco',
 nativeGateway: 'http://10.0.2.2:47850',
 developmentHosts: ['127.0.0.1','10.0.2.2'],
 development: import.meta.env.DEV,
 isNative: () => Capacitor.isNativePlatform(),
 developmentBuild: async () => (await DailyApps.surfaceInfo()).developmentBuild,
 transport: registerPlugin<RegionalOptions['transport']>('AlphaMapsTransport'),
 configure: configureMapsProvider,
});
