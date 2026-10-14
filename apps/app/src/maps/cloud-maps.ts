import { createCloudMaps } from './cloud-provider';
import { captureMapsSession } from './cloud-session';
import { configureMapsProvider } from './runtime';
import { connectionController } from '../runtime/connection-ui';

/** Cloud supplies data only; retained routes belong to the session that requested them. */
const maps = createCloudMaps(() => captureMapsSession(() => connectionController.getCloudClient()), configureMapsProvider);
export const { initializeCloudMaps, cloudMapsCoverage, cloudMapsDiagnostics } = maps;
let previous = connectionController.getCloudClient();
connectionController.subscribe(() => {
 const next = connectionController.getCloudClient();
 if (previous?.sessionId !== next?.sessionId || previous?.credentialId !== next?.credentialId || previous?.client !== next?.client) {
  previous = next;
  // Retry requires an explicit search; a new account never inherits automatic rerouting.
  if (maps.cloudMapsDiagnostics().configured) maps.retireCloudMaps();
 }
});
