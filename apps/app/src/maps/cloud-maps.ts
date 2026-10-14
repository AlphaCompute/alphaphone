import { MapsFailure } from './contracts';
import { createCloudMaps } from './cloud-provider';
import { configureMapsProvider } from './runtime';
import { connectionController } from '../runtime/connection-ui';

/** Product Maps provider: Eliza Cloud Maps through the signed-in account's exact reviewed
 * routes. The phone keeps GPS, the active route and guidance; Cloud supplies data only. */
export const { initializeCloudMaps, cloudMapsCoverage, cloudMapsDiagnostics } = createCloudMaps((route, signal, body) => {
 const cloud = connectionController.getCloudClient();
 if (!cloud) throw new MapsFailure('unauthorized', 'Sign in to Eliza Cloud to use Maps.');
 return cloud.client.mapsRequest(route, signal, body);
}, configureMapsProvider);
