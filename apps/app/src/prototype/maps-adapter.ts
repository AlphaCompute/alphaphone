import {distanceToRoute} from '../maps/route-distance';
import {NavigationVoice} from '../maps/navigation-voice';
import {placeShare,routeShare,shareMap,type MapShare} from '../maps/share';
import { MapPlane } from '../maps/map-plane';
import { initializeRegionalMaps, regionalMap, regionalDiagnostics } from '../maps/regional-provider';
import { NativeMapsLocation } from '../maps/native-location';
import { publishMapsSelection, clearMapsSelection } from '../maps/agent-context';
import { MapsController, type MapsState } from '../maps/state';
import { mapsConnection, onMapsConnectionChange } from '../maps/runtime';
import { coordinate, failure, type Coordinate, type Place } from '../maps/contracts';
import type { SavedPlace } from '../maps/saved-places';

type Bag = Record<string, any>;
type Selection = { editingName?: boolean; label: string; coordinate: Coordinate; savedId?: string; providerId?: string; providerPlaceId?: string; origin: 'manual' | 'location' | 'saved' | 'provider' };
const PIN = 'M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0zM15 10a3 3 0 1 1-6 0a3 3 0 1 1 6 0z';
const coordLabel = (point: Coordinate) => `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`;

/** Exact prototype chrome with honest no-provider state and real local/native flows. */
export function installPrototypeMapsAdapter(_Component: unknown, views: Record<string, Bag>): () => void {
  const module = views.maps; if (!module) return () => {};
  const original = { render: module.render, back: module.back, onLeave: module.onLeave, reply: module.reply, suggestions: module.suggestions, ongoing: module.ongoing };
  let api: Bag | undefined, controller: MapsController | undefined, state: MapsState | undefined;
  let unsubscribe: (() => void) | undefined, selected: Selection | undefined;
  let plane: MapPlane | undefined, planeElement: HTMLElement | undefined, initialized=false, directions=false, originText='', navigating=false, navStep=0, navDistance=0, arrived=false;
  const navigationLocation=new NativeMapsLocation();
  let query = '', searching = false, message = '', disposed = false, revision = 0, locating = false;
  const lifecycle={releases:0,hidden:0,permissionHeld:0,providerActivations:0,lastRelease:''};
  let initialization: Promise<void> | undefined, searchIntent = 0;
  const navigationVoice=new NavigationVoice(()=>{message='Voice guidance paused. Tap Enable voice guidance to retry.';invalidate();});
  const searchIdentity = {};
  let sharing: {abort:AbortController;current:()=>boolean}|undefined;
  function share(data:MapShare,current:()=>boolean){
    if(!current()||document.hidden)return;sharing?.abort.abort();const owner={abort:new AbortController(),current};sharing=owner;
    void shareMap(data,owner.abort.signal).then(result=>{if(sharing===owner&&current()&&result==='copied')api?.toast('Copied');}).catch(()=>{}).finally(()=>{if(sharing===owner)sharing=undefined;});
  }
  const identities = new WeakMap<Selection, object>();
  const invalidate = () => {
    if(sharing&&!sharing.current()){sharing.abort.abort();sharing=undefined;}
    const token = ++revision;
    if (selected) {
      let identity = identities.get(selected);
      if (!identity) { identity = {}; identities.set(selected, identity); }
      const route = (directions || navigating) && state?.route.phase === 'ready' ? state.route.value : null;
      const selection = selected, provider = state?.provider;
      const read = provider?.status === 'configured' ? () => {
        if (route && route.mode !== 'transit') return { kind: 'map-route' as const, providerId: provider.providerId, providerRevision: provider.revision, attribution: route.attribution, from: route.from, to: route.to, mode: route.mode, distanceMeters: route.distanceMeters, durationSeconds: route.durationSeconds, traffic: route.traffic };
        return { kind: 'map-place' as const, providerId: provider.providerId, providerRevision: provider.revision, attribution: regionalMap()?.attribution || state?.selection.value?.attribution || '', label: selection.label, coordinate: selection.coordinate };
      } : undefined;
      // Route identity changes with origin/mode/provider updates; failed/loading
      // routes expose no stale route read capability.
      publishMapsSelection(route ? 'map-route' : 'map-place', identity, token, read);
    }
    else if (searching && query.trim()) publishMapsSelection('map-search', searchIdentity, token);
    else clearMapsSelection();
    queueMicrotask(() => { if (!disposed && token === revision && api?.isActive()) api.set({ nativeMapsRevision: token }); });
  };
  function ensure() {
    if (!initialized) { initialized=true; initialization=initializeRegionalMaps().finally(()=>{initialization=undefined;invalidate();}); }
    if (controller) return controller;
    const connection = mapsConnection(); controller = new MapsController(connection.config, connection.provider);
    unsubscribe = controller.subscribe(next => {
      if(navigating&&(next.route.phase!=='ready'||next.route.value?.id!==state?.route.value?.id)){navigationVoice.pause();navigating=false;void navigationLocation.stop().catch(()=>{});}
      state = next;
      if (locating && next.position.phase === 'ready' && next.position.value) {
        const position = next.position.value; locating = false;
        if (!directions) selected = { label: 'Current location', coordinate: position.coordinate, origin: 'location' };
        else { originText=coordLabel(position.coordinate); void controller?.planRoute(); }
        searching = false;
        message = `${position.precision === 'approximate' ? 'Approximate location' : 'Location fix'} · accuracy ±${Math.ceil(position.accuracyMeters)} m`;
      } else if (locating && next.position.phase === 'error') { locating = false; message = next.position.error?.message || 'Location unavailable.'; }
      invalidate();
    });
    return controller;
  }
  function release(cancelIntent=true) {
    sharing?.abort.abort();sharing=undefined;navigationVoice.pause();
    lifecycle.releases++;lifecycle.lastRelease=cancelIntent?'leave-or-background':'provider-switch';message='';
    if(cancelIntent)++searchIntent;
    plane?.destroy(); plane=undefined; planeElement=undefined; directions=false; navigating=false; void navigationLocation.stop().catch(()=>{});
    clearMapsSelection(); ++revision; locating = false; unsubscribe?.(); unsubscribe = undefined;
    const old = controller; controller = undefined; state = undefined;
    void old?.leave().catch(error => { message = failure(error).message; });
    selected = undefined;
  }
  function showSaved(saved: SavedPlace) { selected = { label: saved.label, coordinate: saved.coordinate, savedId: saved.id, providerId: saved.providerId, providerPlaceId: saved.providerPlaceId, origin: 'saved' }; searching = false; message = ''; invalidate(); }
  function showPlace(place: Place) {
    selected = { label: place.name, coordinate: place.coordinate, providerId: place.providerId, providerPlaceId: place.id, origin: 'provider' };
    searching = false; message = ''; void ensure().select(place); invalidate();
  }
  function submit() {
    const intent=++searchIntent;
    selected = undefined; searching = true; message = '';
    const match = query.trim().match(/^([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)$/);
    if (match) {
      try { const point = coordinate({ latitude: Number(match[1]), longitude: Number(match[2]) }); selected = { label: 'Dropped pin', coordinate: point, origin: 'manual' }; searching = false; }
      catch (error) { message = failure(error).message; }
      invalidate(); return;
    }
    // A new explicit search also retries a failed configured connection. Never
    // poll in the background or replay the search after the user leaves/edits.
    const requestedQuery=query;
    void (async()=>{
      ensure();
      if(!initialization&&regionalDiagnostics().configured&&regionalDiagnostics().error){
        message='Connecting regional Maps…';invalidate();
        initialization=initializeRegionalMaps().finally(()=>{initialization=undefined;invalidate();});
      }
      await initialization;
      if(disposed||intent!==searchIntent||!api?.isActive()||query!==requestedQuery)return;
      message='';void ensure().search(requestedQuery);
    })();
  }
  function locate() { message = ''; locating = true; if(!directions)selected = undefined; searching = false; void ensure().locate(); invalidate(); }
  function save() {
    if (!selected) return;
    try {
      const existing = state?.saved.value.find(item => item.id === selected?.savedId || (!!selected?.providerId && item.providerId === selected.providerId && item.providerPlaceId === selected.providerPlaceId));
      if (existing) { ensure().removeSaved(existing.id); selected.savedId = undefined; message = 'Place removed from saved.'; }
      else { const saved = ensure().save({ label: selected.label, coordinate: selected.coordinate, providerId: selected.providerId, providerPlaceId: selected.providerPlaceId }); selected.savedId = saved.id; message = 'Place saved on this device.'; }
    } catch (error) { message = failure(error).message; }
    invalidate();
  }
  const back = () => { ++searchIntent;if(directions||navigating){navigationVoice.pause();directions=false;navigating=false;void navigationLocation.stop().catch(()=>{});message='';invalidate();return true;} if (selected) { selected = undefined; message = ''; invalidate(); return true; } if (searching || query) { searching = false; query = ''; message = ''; void ensure().search(''); invalidate(); return true; } return false; };
  module.back = back; module.onLeave = () => release(); module.ongoing = () => null;
  module.reply = () => null;
  module.suggestions = () => regionalMap() ? ['Help me with this place', 'Explain regional map coverage'] : ['Help me choose a Maps provider', 'Explain location permissions'];
  module.render = (st: Bag, currentApi: Bag) => {
    api = currentApi; ensure();
    // Calling the original with neutral state retains visual tokens without
    // generating sample place cards, address guesses, routes or timers.
    const data = original.render({ ...st, query: null, place: null, directions: null, nav: false, saved: [], pan: null }, currentApi);
    const snapshot = state!, saved = snapshot.saved.value;
    const error = snapshot.saved.error || snapshot.position.error || snapshot.search.error || snapshot.route.error;
    const pending = locating || snapshot.search.phase === 'loading';
    const unconfigured = snapshot.provider.status === 'unconfigured';
    const status = snapshot.route.error?.message || message || error?.message || (pending ? 'Finding location…' : unconfigured && regionalDiagnostics().configured && regionalDiagnostics().error ? 'Regional Maps is unavailable. Submit a search to retry the configured connection.' : unconfigured ? 'Maps provider not connected. Search and route planning need a connection. Enter latitude, longitude or use Recenter to save a place.' : (regionalMap()?.region || 'Regional Maps'));
    const isPlace = !!selected && !directions && !navigating;
    Object.assign(data, {
      rootRef:(element:HTMLElement)=>{if(element)element.dataset.mapDiagnostics=JSON.stringify({...regionalDiagnostics(),lifecycle:{...lifecycle,locating,permissionPending:controller?.awaitingLocationPermission()||navigationLocation.awaitingPermission(),position:state?.position.phase}});},
      notNative:false, hasNativeMap:!!regionalMap(),mapAttribution:regionalMap()?.attribution||'',attributionBottom:directions?310:isPlace?410:130,
      mapRef:(element:HTMLElement)=>{const region=regionalMap();if(element&&region){if(element!==planeElement){plane?.destroy();planeElement=element;plane=new MapPlane(element,region,()=>{message='Map tiles unavailable. Search and saved places remain usable.';invalidate();},data.C);}plane?.update(selected?.coordinate,snapshot.route.value);}},
      native: true, nativeStatus: status, nativeStatusTop: directions?232:isPlace ? 128 : searching ? 130 : 174,
      nativeSavedEmpty: !saved.length, nativeLocationBusy: locating, nativeLocation: locate,
      mode:navigating?'nav':directions?'dir':isPlace?'place':searching?'results':'base', isBase:!isPlace&&!searching&&!directions&&!navigating,isResults:searching&&!isPlace&&!directions&&!navigating,isPlace,isDir:directions&&!navigating,isNav:navigating,
      showSearch:!directions&&!navigating, showRec:!navigating, grid: '', major: '', fwy: '', water: '', parks: '', rwy: '', routeD: '', doneD: '', hasRoute: false, pins: [], labels: [], meCss: 'display:none;',
      mapDown: () => {}, mapUp: () => {}, q: query, hasQ: !!query, searchLabel: isPlace || searching ? 'Back' : 'Search',
      searchLead: () => { if (!back()) { searching = true; invalidate(); } },
      onQ: (event: Event) => { ++searchIntent;query = (event.target as HTMLInputElement).value; selected = undefined; searching = true; message = ''; void ensure().search(''); invalidate(); },
      focusQ: () => { if (!searching) { selected = undefined; searching = true; invalidate(); } },
      qKey: (event: KeyboardEvent) => { if (event.key === 'Enter') { event.preventDefault(); submit(); (event.target as HTMLInputElement).blur(); } },
      clearQ: () => { ++searchIntent;query = ''; selected = undefined; searching = true; message = ''; void ensure().search(''); invalidate(); },
      chips: saved.map(item => ({ label: item.label, d: PIN, go: () => showSaved(item) })),
      cats: data.cats.map((category: Bag) => ({ ...category, go: () => { query = category.label; submit(); } })),
      savedRows: saved.map(item => ({ name: item.label, sub: coordLabel(item.coordinate), d: PIN, go: () => showSaved(item) })),
      results: snapshot.search.value.map(item => ({ name: item.name, sub: item.address || coordLabel(item.coordinate), d: PIN, go: () => showPlace(item) })),
      hasResults: snapshot.search.value.length > 0, noResults: snapshot.search.phase === 'empty', emptyQ: !query.trim(),
      recenter: locate, recBottom: isPlace ? 414 : searching ? 534 : 124, recCss: '',
      sheetH: directions ? 300 : isPlace ? 400 : 520, sheetSw: { down: () => {}, up: () => {} }, sheetTap: () => {},
      askAlpha: () => currentApi.send(query || 'Help me with Maps.'), noResTxt: `Ask ${currentApi.name} about this search`,
    });
    if (selected) {
      const item = selected;
      const existing = saved.find(value => value.id === item.savedId || (!!item.providerId && value.providerId === item.providerId && value.providerPlaceId === item.providerPlaceId));
      data.pc = {
        name: item.label, meta: item.origin === 'saved' ? 'Saved on this device' : item.origin === 'location' ? 'Device location' : 'Coordinates', addr: coordLabel(item.coordinate),
        hasHours: false, hasPhone: false, hasWeb: false, canDir: true, min: 'Directions', saved: !!existing,
        saveLabel: existing ? 'Remove from saved' : 'Save', starCss: existing ? 'color:var(--acct)' : '', starFill: existing ? 'fill:currentColor' : '',
        close: () => { selected = undefined; message = ''; invalidate(); }, save,
        dirs: () => { if(unconfigured){message='Connect a Maps provider to plan a route. No route has been calculated.';}else{directions=true; message='Enter an origin latitude, longitude and press Enter, or explicitly use current location.'; if(item.origin!=='provider')void ensure().select({providerId:'alpha-osm-monaco',id:item.providerPlaceId||'manual',name:item.label,coordinate:item.coordinate,attribution:regionalMap()!.attribution,fetchedAt:Date.now()},false);} invalidate(); },
        share: () => share(placeShare(item.label,item.coordinate),()=>!disposed&&!!api?.isActive()&&selected===item),
        nativeName: item.label, nativeEditing: !!item.editingName,
        nativeTitleRole: 'button', nativeTitleTabIndex: 0, nativeTitleLabel: 'Rename place',
        nativeEdit: () => { item.editingName = true; invalidate(); },
        nativeEditKey: (event: KeyboardEvent) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); item.editingName = true; invalidate(); } },
        nativeRename: (event: Event) => { item.label = (event.target as HTMLInputElement).value.slice(0, 300); invalidate(); },
        nativeApplyName: () => { try { if (existing) ensure().renameSaved(existing.id, item.label); else if (!item.label.trim()) throw new Error(); item.editingName = false; message = existing ? 'Saved place renamed.' : 'Name updated. Tap Save to keep this place.'; } catch { message = 'The place name could not be saved.'; } invalidate(); },
      };
    }
    if(directions&&selected){
      const route=snapshot.route.value;
      const plan=()=>{try{const values=originText.split(',').map(Number);if(values.length!==2||!originText.trim())throw new Error();ensure().setOrigin(coordinate({latitude:values[0],longitude:values[1]}));message='';void ensure().planRoute();}catch{message='Enter origin latitude, longitude.';invalidate();}};
      data.originText=originText;data.onOrigin=(event:Event)=>{originText=(event.target as HTMLInputElement).value;ensure().clearOrigin();message='Press Enter to calculate a route from this origin.';invalidate();};data.originKey=(event:KeyboardEvent)=>{if(event.key==='Enter'){event.preventDefault();plan();}};data.originLocation=locate;
      const distance=(a:Coordinate,b:Coordinate)=>{const r=Math.PI/180,dlat=(a.latitude-b.latitude)*r,dlon=(a.longitude-b.longitude)*r;return 6371000*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(dlat/2)**2+Math.cos(a.latitude*r)*Math.cos(b.latitude*r)*Math.sin(dlon/2)**2)));};
      const end=()=>{navigationVoice.pause();navigating=false;void navigationLocation.stop().catch(error=>{message=failure(error).message;invalidate();});invalidate();};
      data.dr={name:selected.label,close:()=>back(),min:route?Math.max(1,Math.round(route.durationSeconds/60))+' min':snapshot.route.phase==='loading'?'Planning…':'No route',meta:route?(route.distanceMeters/1000).toFixed(1)+' km · no live traffic':'Regional route',via:route?.steps[0]?.instruction||'Choose a real origin to calculate a route.',shareLabel:'Share route',shareEta:()=>{if(route&&snapshot.route.phase==='ready'){const target=selected;share(routeShare(target!.label,route),()=>!disposed&&!!api?.isActive()&&selected===target&&!!directions&&state?.route.phase==='ready'&&state.route.value===route);}},
       modes:data.nativeModeMetadata.map((reference:{mode:'drive'|'walk'|'bike'|'transit';label:string;d:string})=>{const mode=reference.mode==='bike'?'bicycle':reference.mode;const {label,d}=reference;return {label,t:label,d,css:snapshot.mode===mode?'background:var(--acc);color:#fff':'background:var(--s2);color:var(--fg)',go:()=>{if(!ensure().capabilities().modes.includes(mode)){message='Transit schedules are not available for this region.';invalidate();return;}ensure().setMode(mode);message='';if(snapshot.origin)void ensure().planRoute();}};}),
       start:()=>{if(!route){message='Calculate a route before starting navigation.';invalidate();return;}navigationVoice.pause();navStep=0;arrived=false;navigating=true;message='Waiting for a fresh location fix. Foreground guidance only.';void navigationLocation.start(false,fix=>{if(!navigating)return;if(state?.route.phase!=='ready'||state.route.value?.id!==route.id){navigationVoice.pause();navigating=false;void navigationLocation.stop();invalidate();return;}if(fix.accuracyMeters>50){navigationVoice.pause();message='Location is too approximate for turn guidance.';invalidate();return;}navDistance=distance(fix.coordinate,route.to);arrived=navDistance<25&&fix.accuracyMeters<=30;if(arrived){navigationVoice.pause();message='Destination reached.';void navigationLocation.stop();}else{const nearest=distanceToRoute(fix.coordinate,route.geometry);message=nearest>Math.max(75,fix.accuracyMeters*2)?'Off route. Stop and calculate a new route.':'Foreground guidance · location accuracy ±'+Math.ceil(fix.accuracyMeters)+' m';while(navStep<route.steps.length-1&&distance(fix.coordinate,route.steps[navStep].coordinate)<40)navStep++;if(nearest>Math.max(75,fix.accuracyMeters*2))navigationVoice.pause();else if(route.steps[navStep])navigationVoice.update(route.id+':'+navStep,route.steps[navStep].instruction);}invalidate();},error=>{navigationVoice.pause();message=failure(error).message;navigating=false;invalidate();});invalidate();},
       nav:{going:!arrived,arrived,dist:arrived?'Arrived':navDistance?Math.round(navDistance)+' m':'Locating…',street:route?.steps[navStep]?.instruction||'Waiting for location',icon:PIN,hasThen:false,left:arrived?'Arrived':'Foreground guidance',meta:'Distance shown is direct to destination',end,ask:()=>currentApi.send('Help me with this route.'),voiceLabel:navigationVoice.enabled?'Mute voice guidance':'Enable voice guidance',voice:()=>{navigationVoice.toggle();invalidate();},voiceD:PIN}};
    }
    return data;
  };
  const changed = onMapsConnectionChange(() => {
    const connection=mapsConnection();
    if(controller&&state?.provider.status==='unconfigured'&&connection.config.status==='configured'&&regionalMap()){lifecycle.providerActivations++;controller.activateProvider(connection.config,connection.provider);}
    else release(false);
    invalidate();
  });
  const retireShare=()=>{sharing?.abort.abort();sharing=undefined;navigationVoice.pause();};
  const shareEvents=['launcher-home','alpha:device-state','alpha:dev-incoming-call'];for(const event of shareEvents)window.addEventListener(event,retireShare);
  const visibility = () => { if(document.hidden){retireShare();lifecycle.hidden++;if(controller?.awaitingLocationPermission()||navigationLocation.awaitingPermission()){lifecycle.permissionHeld++;invalidate();return;}release();}else invalidate(); };
  const pagehide=()=>release();window.addEventListener('pagehide', pagehide); document.addEventListener('visibilitychange', visibility);
  return () => { disposed = true; for(const event of shareEvents)window.removeEventListener(event,retireShare); changed(); release(); window.removeEventListener('pagehide', pagehide); document.removeEventListener('visibilitychange', visibility); Object.assign(module, original); };
}
