// Eliza Cloud Maps device provider against a stubbed account-bound Cloud request.
// No request leaves the process; this is not evidence of a deployed Cloud Maps
// service, real coverage, a live route or physical navigation.
import assert from 'node:assert/strict';
import { createCloudMaps, cloudMapsFailure, insideCloudCoverage } from '../apps/app/src/maps/cloud-provider.ts';
import { MapsController } from '../.eliza/client-features/plugins/plugin-maps/src/client/state.ts';
import { SavedPlaces } from '../.eliza/client-features/plugins/plugin-maps/src/client/saved-places.ts';
import { MapsFailure } from '../.eliza/client-features/plugins/plugin-maps/src/client/contracts.ts';

const ATTRIBUTION = '© OpenStreetMap contributors (ODbL). Search: Nominatim. Routing: GraphHopper.';
const CASINO = { latitude: 43.7397, longitude: 7.4276 }, PORT = { latitude: 43.7347, longitude: 7.4206 };
const coverage = {
  providerId: 'eliza-cloud-osm', connectionId: 'conn_eliza_cloud_maps_osm', revision: 'osm-monaco-2026-09-29', attribution: ATTRIBUTION,
  regions: [{ id: 'monaco', name: 'Monaco', bounds: [7.409, 43.724, 7.449, 43.752] }],
  capabilities: { map: false, search: true, placeDetails: true, geocode: true, reverseGeocode: true, modes: ['drive', 'walk', 'bicycle'], alternatives: true, traffic: 'none', transit: 'none', offline: { map: false, search: false, routing: false } },
};
const place = { providerId: 'eliza-cloud-osm', id: 'N1234', name: 'Port Hercule', coordinate: PORT, address: 'Port Hercule, Monaco', attribution: ATTRIBUTION, fetchedAt: Date.now() };
const route = { providerId: 'eliza-cloud-osm', id: 'route_0123456789abcdef01234567', from: CASINO, to: PORT, mode: 'walk', geometry: [CASINO, PORT],
  distanceMeters: 640, durationSeconds: 480, steps: [{ instruction: 'Walk south', coordinate: CASINO, distanceMeters: 640, maneuver: 'depart' }, { instruction: 'Arrive', coordinate: PORT, distanceMeters: 0, maneuver: 'arrive' }],
  attribution: ATTRIBUTION, fetchedAt: Date.now(), traffic: 'none' };
const cloudError = (status, code) => Object.assign(new Error(`Eliza Cloud http (${status})`), { name: 'CloudProtocolError', code: 'http', status, data: { code } });
const location = { awaitingPermission: () => false, start: async () => {}, stop: async () => {} };
const memory = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }; };

// Signed out: Maps stays unconfigured and says why; nothing is invented.
{
  let configured = 0;
  const maps = createCloudMaps(async () => { throw new MapsFailure('unauthorized', 'Sign in to Eliza Cloud to use Maps.'); }, () => configured++);
  await maps.initializeCloudMaps();
  assert.equal(configured, 0);
  assert.equal(maps.cloudMapsCoverage(), undefined);
  assert.deepEqual(maps.cloudMapsDiagnostics(), { configured: true, error: 'unauthorized' });
}

// Signed in: coverage configures the provider and the shared controller plans a validated route.
{
  const calls = [];
  let config, provider;
  const maps = createCloudMaps(async (path, _signal, body) => {
    calls.push([path, body]);
    if (path === 'capabilities') return structuredClone(coverage);
    if (path === 'places/search') return { providerId: coverage.providerId, attribution: ATTRIBUTION, places: [place] };
    if (path === 'places/details') return { providerId: coverage.providerId, attribution: ATTRIBUTION, place };
    if (path === 'routes') return { providerId: coverage.providerId, attribution: ATTRIBUTION, routes: [route] };
    throw new Error(`unexpected ${path}`);
  }, (nextConfig, nextProvider) => { config = nextConfig; provider = nextProvider; });
  await maps.initializeCloudMaps();
  assert.equal(config.status, 'configured');
  assert.equal(config.capabilities.map, false, 'Cloud serves no tiles');
  assert.deepEqual(config.capabilities.modes, ['drive', 'walk', 'bicycle']);
  assert.equal(maps.cloudMapsCoverage().attribution, ATTRIBUTION);
  assert.ok(insideCloudCoverage(maps.cloudMapsCoverage(), CASINO));
  assert.ok(!insideCloudCoverage(maps.cloudMapsCoverage(), { latitude: 48.85, longitude: 2.35 }));

  const controller = new MapsController(config, provider, new SavedPlaces('test.maps.saved', memory()), location);
  await controller.search('Port');
  assert.equal(controller.snapshot().search.phase, 'ready');
  await controller.select(controller.snapshot().search.value[0]);
  assert.equal(controller.snapshot().selection.value.name, 'Port Hercule');
  controller.setOrigin(CASINO);
  controller.setMode('walk');
  await controller.planRoute();
  const planned = controller.snapshot().route;
  assert.equal(planned.phase, 'ready', planned.error?.message);
  assert.equal(planned.value.distanceMeters, 640);
  assert.deepEqual(calls.map(([path]) => path), ['capabilities', 'places/search', 'places/details', 'routes']);
  assert.deepEqual(calls[1][1], { query: 'Port' });
  assert.deepEqual(calls[3][1], { from: CASINO, to: PORT, mode: 'walk' }, 'location travels only in the body; no alternatives are requested');
}

// Typed Cloud refusals become device failures; none becomes data.
for (const [status, code, expected] of [[403, 'subscription_required', 'unauthorized'], [422, 'no_route', 'unsupported'], [422, 'unsupported_region', 'unsupported'], [429, 'rate_limited', 'rate-limited'], [503, 'maps_not_configured', 'unconfigured'], [503, 'provider_unavailable', 'unavailable'], [502, 'provider_invalid_response', 'invalid-response']])
  assert.equal(cloudMapsFailure(cloudError(status, code)).code, expected, `${status} ${code}`);
assert.equal(cloudMapsFailure(Object.assign(new Error('x'), { name: 'CloudProtocolError', code: 'credentials-missing' })).code, 'unauthorized');
assert.equal(cloudMapsFailure(cloudError(503, 'provider_unavailable'), AbortSignal.abort()).code, 'cancelled');

// Invalid coverage leaves Maps unconfigured.
{
  let configured = 0;
  const maps = createCloudMaps(async () => ({ ...coverage, regions: [] }), () => configured++);
  await maps.initializeCloudMaps();
  assert.equal(configured, 0);
  assert.equal(maps.cloudMapsDiagnostics().error, 'invalid-response');
}
console.log('PASS Cloud Maps device provider: coverage, search, details, route, failures');
