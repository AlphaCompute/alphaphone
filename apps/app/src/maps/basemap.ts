import type {GlobalBasemap} from '../../../../.eliza/client-features/plugins/plugin-maps/src/client/map-plane.ts';

/** Public map imagery only. This does not configure place search, routes or location access. */
export const globalBasemap:GlobalBasemap = {
 kind:'global',
 styleUrl:'https://tiles.openfreemap.org/styles/bright',
 attribution:'OpenFreeMap · © OpenMapTiles · Data from OpenStreetMap',
};
