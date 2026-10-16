import 'maplibre-gl/dist/maplibre-gl.css';
import { MapPlane as SharedMapPlane, type MapBasemap } from '../../../../.eliza/client-features/plugins/plugin-maps/src/client/map-plane.ts';
export type { MapOverlay, MapPin, MapPosition } from '../../../../.eliza/client-features/plugins/plugin-maps/src/client/map-plane.ts';
import fontUrl from '@fontsource/public-sans/files/public-sans-latin-400-normal.woff2?url';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { nativeRegion, nativeRegionRequest } from './regional-provider';
/** Product palette, typography and space reserved for the Alpha route sheets. */
export class MapPlane extends SharedMapPlane {
 constructor(container:HTMLElement,region:MapBasemap,onError:()=>void,colors:Record<string,string>,onPin?:(id:string)=>void) {
  super(container,region,onError,colors,{fontUrl,workerUrl,accent:'#1616d8',protocol:'alpha-region',routePadding:{top:220,bottom:280,left:30,right:30},nativeRegion,nativeRequest:nativeRegionRequest,selectionPadding:region.kind==='global'?()=>({top:80,bottom:Math.min(430,container.clientHeight*.52+30),left:30,right:30}):undefined,onPin});
 }
}
