import 'maplibre-gl/dist/maplibre-gl.css';
import { MapPlane as SharedMapPlane } from '../../../../.eliza/patched/plugins/plugin-maps/src/client/map-plane.ts';
export type { MapOverlay, MapPin, MapPosition } from '../../../../.eliza/patched/plugins/plugin-maps/src/client/map-plane.ts';
import fontUrl from '@fontsource/public-sans/files/public-sans-latin-400-normal.woff2?url';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { nativeRegion, nativeRegionRequest, type RegionalMap } from './regional-provider';
/** Product palette, typography and space reserved for the Alpha route sheets. */
export class MapPlane extends SharedMapPlane {
 constructor(container:HTMLElement,region:RegionalMap,onError:()=>void,colors:Record<string,string>,onPin?:(id:string)=>void) {
  super(container,region,onError,colors,{fontUrl,workerUrl,accent:'#1616d8',protocol:'alpha-region',routePadding:{top:220,bottom:280,left:30,right:30},nativeRegion,nativeRequest:nativeRegionRequest,onPin});
 }
}
