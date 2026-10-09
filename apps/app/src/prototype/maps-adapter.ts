import {distanceToRoute,routeProgress} from '../maps/route-distance';
import {atStep,guidanceView} from '../maps/guidance';
import {BackgroundNavigation,type NavigationBridge} from '../maps/background-navigation';
import {registerPlugin} from '../platform-plugins';
import {DailyApps} from '../daily';
import {Capacitor} from '@capacitor/core';
import {NavigationVoice} from '../maps/navigation-voice';
import {placeShare,routeShare,shareMap,type MapShare} from '../maps/share';
import { MapPlane } from '../maps/map-plane';
import { initializeRegionalMaps, regionalMap, regionalDiagnostics } from '../maps/regional-provider';
import { NativeMapsLocation, type Position } from '../maps/native-location';
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
  let plane: MapPlane | undefined, planeElement: HTMLElement | undefined, initialized=false, directions=false, originText='', navigating=false, navDistance=0, arrived=false;
  // Origin picking reuses the results sheet; navigation state is per explicit Start.
  let originMode=false, navStep=0, navFix: Position | undefined, navRouteId='', follow=true, offRoute=false, rerouting=false, navSession=0, backgroundRunning=false, rerouteCleared=false;
  const navigationLocation=new NativeMapsLocation();
  const background=new BackgroundNavigation(registerPlugin<NavigationBridge>('AlphaMapsTransport'),()=>Capacitor.isNativePlatform());
  let query = '', searching = false, message = '', disposed = false, revision = 0, locating = false;
  const lifecycle={releases:0,hidden:0,permissionHeld:0,providerActivations:0,lastRelease:'',backgroundNavigation:0,backgroundStops:0};
  let initialization: Promise<void> | undefined, searchIntent = 0;
  const navigationVoice=new NavigationVoice(()=>{message='Voice guidance paused. Tap Enable voice guidance to retry.';invalidate();});
  const searchIdentity = {};
  /** Ends guidance, its location watch and any screen-off session, once per Start. */
  function stopGuidance(){
    navigationVoice.pause();navigating=false;rerouting=false;offRoute=false;navFix=undefined;navRouteId='';backgroundRunning=false;++navSession;
    void background.stop();
    return navigationLocation.stop();
  }
  let pendingHandoff: {query:string;intent:number}|undefined;
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
      if(navigating&&rerouting){
        // An explicit reroute keeps the session; the new route replaces the old one.
        // Only a route planned after the reroute request replaced the old one is accepted.
        if(next.route.phase!=='ready'&&next.route.phase!=='error')rerouteCleared=true;
        else if(next.route.phase==='ready'&&next.route.value&&rerouteCleared){rerouting=false;navStep=0;navRouteId=next.route.value.id;navigationVoice.pause();message='New route ready.';}
        else if(next.route.phase==='error'){void stopGuidance().catch(()=>{});}
      }
      else if(navigating&&(next.route.phase!=='ready'||next.route.value?.id!==navRouteId)){void stopGuidance().catch(()=>{});}
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
  function discardHandoff(){
    pendingHandoff=undefined;
    if(api?.get('maps').query!=null)api.set({query:null});
  }
  function release(cancelIntent=true) {
    sharing?.abort.abort();sharing=undefined;navigationVoice.pause();
    lifecycle.releases++;lifecycle.lastRelease=cancelIntent?'leave-or-background':'provider-switch';message='';
    if(cancelIntent){++searchIntent;discardHandoff();}
    plane?.destroy(); plane=undefined; planeElement=undefined; directions=false; originMode=false; void stopGuidance().catch(()=>{});
    clearMapsSelection(); ++revision; locating = false; unsubscribe?.(); unsubscribe = undefined;
    const old = controller; controller = undefined; state = undefined;
    void old?.leave().catch(error => { message = failure(error).message; });
    selected = undefined;
  }
  function showSaved(saved: SavedPlace) { discardHandoff();selected = { label: saved.label, coordinate: saved.coordinate, savedId: saved.id, providerId: saved.providerId, providerPlaceId: saved.providerPlaceId, origin: 'saved' }; searching = false; message = ''; invalidate(); }
  function showPlace(place: Place) {
    selected = { label: place.name, coordinate: place.coordinate, providerId: place.providerId, providerPlaceId: place.id, origin: 'provider' };
    searching = false; message = ''; void ensure().select(place); invalidate();
  }
  let pinTap: (id: string) => void = () => {};
  /** A chosen origin (saved or regional place) replaces the typed text and replans. */
  function chooseOrigin(candidate: Place | SavedPlace) {
    originMode=false;originText='label' in candidate?candidate.label:candidate.name;message='';
    void ensure().chooseOrigin(candidate);invalidate();
  }
  /** Opens a provider website only on an explicit tap, in the system browser surface. */
  function openWebsite(raw: string) {
    let url: URL;
    try { url = new URL(raw); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error(); }
    catch { api?.toast('This website address is not valid.'); return; }
    if (Capacitor.isNativePlatform()) void DailyApps.perform({ action: 'browser', url: url.href }).then(result => { if (result.status !== 'opened') api?.toast(result.message || 'The browser could not open.'); }, () => api?.toast('The browser could not open.'));
    else window.open(url.href, '_blank', 'noopener,noreferrer');
  }
  function submit() {
    discardHandoff();
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
  function locate() { discardHandoff();message = ''; locating = true; if(!directions)selected = undefined; searching = false; void ensure().locate(); invalidate(); }
  function save() {
    if (!selected) return;
    try {
      const existing = state?.saved.value.find(item => item.id === selected?.savedId || (!!selected?.providerId && item.providerId === selected.providerId && item.providerPlaceId === selected.providerPlaceId));
      if (existing) { ensure().removeSaved(existing.id); selected.savedId = undefined; message = 'Place removed from saved.'; }
      else { const saved = ensure().save({ label: selected.label, coordinate: selected.coordinate, providerId: selected.providerId, providerPlaceId: selected.providerPlaceId }); selected.savedId = saved.id; message = 'Place saved on this device.'; }
    } catch (error) { message = failure(error).message; }
    invalidate();
  }
  const back = () => { discardHandoff();++searchIntent;if(originMode){originMode=false;ensure().cancelOriginSearch();message='';invalidate();return true;} if(directions||navigating){directions=false;void stopGuidance().catch(()=>{});message='';invalidate();return true;} if (selected) { selected = undefined; message = ''; invalidate(); return true; } if (searching || query) { searching = false; query = ''; message = ''; void ensure().search(''); invalidate(); return true; } return false; };
  module.back = back; module.onLeave = () => release(); module.ongoing = () => null;
  module.reply = () => null;
  module.suggestions = () => regionalMap() ? ['Help me with this place', 'Explain regional map coverage'] : ['Help me choose a Maps provider', 'Explain location permissions'];
  module.render = (st: Bag, currentApi: Bag) => {
    api = currentApi; ensure();
    // Cross-app navigation carries a one-use search, not a selected destination.
    // Consume it outside render and fence it against leaving or a newer action.
    if(typeof st.query==='string'&&st.query.trim()&&!pendingHandoff){
      const handoff=pendingHandoff={query:st.query,intent:searchIntent};
      queueMicrotask(()=>{
        if(pendingHandoff!==handoff)return;pendingHandoff=undefined;
        if(disposed||!currentApi.isActive()||currentApi.get('maps').query!==handoff.query||handoff.intent!==searchIntent)return;
        currentApi.set({query:null});release();query=handoff.query.trim();submit();invalidate();
      });
    }
    // Calling the original with neutral state retains visual tokens without
    // generating sample place cards, address guesses, routes or timers.
    const data = original.render({ ...st, query: null, place: null, directions: null, nav: false, saved: [], pan: null }, currentApi);
    const snapshot = state!, saved = snapshot.saved.value;
    const choosingOrigin = originMode && directions && !navigating && !!selected;
    const error = snapshot.saved.error || snapshot.position.error || (choosingOrigin ? snapshot.originSearch.error : snapshot.search.error) || snapshot.route.error;
    const pending = locating || (choosingOrigin ? snapshot.originSearch.phase === 'loading' : snapshot.search.phase === 'loading');
    const unconfigured = snapshot.provider.status === 'unconfigured';
    const status = (choosingOrigin && !snapshot.originSearch.error && snapshot.originSearch.phase !== 'loading' ? message : '') || snapshot.route.error?.message || message || error?.message || (pending ? 'Finding location…' : unconfigured && regionalDiagnostics().configured && regionalDiagnostics().error ? 'Regional Maps is unavailable. Submit a search to retry the configured connection.' : unconfigured ? 'Maps provider not connected. Search and route planning need a connection. Enter latitude, longitude or use Recenter to save a place.' : (regionalMap()?.region || 'Regional Maps'));
    const isPlace = !!selected && !directions && !navigating;
    const isResults = (searching && !isPlace && !directions && !navigating) || choosingOrigin;
    const isDir = directions && !navigating && !choosingOrigin;
    // Result pins come from the list being shown; the position marker from an explicit
    // Recenter or the active navigation watch. Nothing is drawn from prototype data.
    const pinned: readonly Place[] = choosingOrigin ? snapshot.originSearch.value : isResults ? snapshot.search.value : [];
    const fix = navigating ? navFix : snapshot.position.phase === 'ready' ? snapshot.position.value || undefined : undefined;
    const overlay = { pins: pinned.map(item => ({ id: item.id, label: item.name, coordinate: item.coordinate })), position: fix ? { coordinate: fix.coordinate, accuracyMeters: fix.accuracyMeters, headingDegrees: fix.headingDegrees } : null, follow: navigating && follow && !!navFix };
    const onPin = (id: string) => { const item = pinned.find(value => value.id === id); if (!item) return; if (choosingOrigin) chooseOrigin(item); else showPlace(item); };
    const savedOrigins = choosingOrigin ? controller!.savedMatches(originText) : [];
    Object.assign(data, {
      rootRef:(element:HTMLElement)=>{if(element)element.dataset.mapDiagnostics=JSON.stringify({...regionalDiagnostics(),lifecycle:{...lifecycle,locating,permissionPending:controller?.awaitingLocationPermission()||navigationLocation.awaitingPermission(),position:state?.position.phase}});},
      notNative:false, hasNativeMap:!!regionalMap(),mapAttribution:regionalMap()?.attribution||'',attributionBottom:directions?310:isPlace?410:130,
      mapRef:(element:HTMLElement)=>{const region=regionalMap();if(element&&region){if(element!==planeElement){plane?.destroy();planeElement=element;plane=new MapPlane(element,region,()=>{message='Map tiles unavailable. Search and saved places remain usable.';invalidate();},data.C,id=>pinTap(id));}pinTap=onPin;plane?.update(selected?.coordinate,snapshot.route.value,overlay);}},
      native: true, nativeStatus: status, nativeStatusTop: directions?232:isPlace ? 128 : searching ? 130 : 174,
      nativeSavedEmpty: !saved.length, nativeLocationBusy: locating, nativeLocation: locate,
      mode:navigating?'nav':choosingOrigin?'origin':directions?'dir':isPlace?'place':searching?'results':'base', isBase:!isPlace&&!searching&&!directions&&!navigating,isResults,isPlace,isDir,isNav:navigating,
      showSearch:!directions&&!navigating, showRec:!navigating, grid: '', major: '', fwy: '', water: '', parks: '', rwy: '', routeD: '', doneD: '', hasRoute: false, pins: [], labels: [], meCss: 'display:none;',
      mapDown: () => {}, mapUp: () => {}, q: query, hasQ: !!query, searchLabel: isPlace || searching ? 'Back' : 'Search',
      searchLead: () => { if (!back()) { searching = true; invalidate(); } },
      onQ: (event: Event) => { discardHandoff();++searchIntent;query = (event.target as HTMLInputElement).value; selected = undefined; searching = true; message = ''; void ensure().search(''); invalidate(); },
      focusQ: () => { if (!searching) { selected = undefined; searching = true; invalidate(); } },
      qKey: (event: KeyboardEvent) => { if (event.key === 'Enter') { event.preventDefault(); submit(); (event.target as HTMLInputElement).blur(); } },
      clearQ: () => { ++searchIntent;query = ''; selected = undefined; searching = true; message = ''; void ensure().search(''); invalidate(); },
      chips: saved.map(item => ({ label: item.label, d: PIN, go: () => showSaved(item) })),
      cats: data.cats.map((category: Bag) => ({ ...category, go: () => { query = category.label; submit(); } })),
      savedRows: saved.map(item => ({ name: item.label, sub: coordLabel(item.coordinate), d: PIN, go: () => showSaved(item) })),
      results: choosingOrigin
        ? [...savedOrigins.map(item => ({ name: item.label, sub: 'Saved place · ' + coordLabel(item.coordinate), d: PIN, go: () => chooseOrigin(item) })),
           ...snapshot.originSearch.value.map(item => ({ name: item.name, sub: item.address || coordLabel(item.coordinate), d: PIN, go: () => chooseOrigin(item) }))]
        : snapshot.search.value.map(item => ({ name: item.name, sub: item.address || coordLabel(item.coordinate), d: PIN, go: () => showPlace(item) })),
      hasResults: choosingOrigin ? savedOrigins.length + snapshot.originSearch.value.length > 0 : snapshot.search.value.length > 0,
      noResults: choosingOrigin ? snapshot.originSearch.phase === 'empty' && !savedOrigins.length : snapshot.search.phase === 'empty', emptyQ: !choosingOrigin && !query.trim(),
      recenter: () => { if (navigating) { follow = true; invalidate(); } else locate(); }, recBottom: isPlace ? 414 : searching ? 534 : 124, recCss: '',
      sheetH: directions ? 300 : isPlace ? 400 : 520, sheetSw: { down: () => {}, up: () => {} }, sheetTap: () => {},
      askAlpha: () => currentApi.send(query || 'Help me with Maps.'), noResTxt: `Ask ${currentApi.name} about this search`,
    });
    if (selected) {
      const item = selected;
      const existing = saved.find(value => value.id === item.savedId || (!!item.providerId && value.providerId === item.providerId && value.providerPlaceId === item.providerPlaceId));
      // Provider detail for this exact place: opening hours, phone and website when the
      // source has them. Phone is shown as text; calling stays deferred with Phone.
      const detail = snapshot.selection.phase === 'ready' && item.providerPlaceId && snapshot.selection.value?.id === item.providerPlaceId && snapshot.selection.value.providerId === item.providerId ? snapshot.selection.value : undefined;
      const website = detail?.website;
      data.pc = {
        name: item.label, meta: (item.origin === 'saved' ? 'Saved on this device' : item.origin === 'location' ? 'Device location' : 'Coordinates') + (detail?.phone ? ' · Phone ' + detail.phone : ''), addr: detail?.address || coordLabel(item.coordinate),
        hasHours: !!detail?.openingHours, openTxt: 'Hours', openCss: '', hoursTxt: detail?.openingHours || '',
        hasPhone: false, hasWeb: !!website, web: () => { if (website) openWebsite(website); },
        canDir: true, min: 'Directions', saved: !!existing,
        saveLabel: existing ? 'Remove from saved' : 'Save', starCss: existing ? 'color:var(--acct)' : '', starFill: existing ? 'fill:currentColor' : '',
        close: () => { selected = undefined; message = ''; invalidate(); }, save,
        dirs: () => { if(unconfigured){message='Connect a Maps provider to plan a route. No route has been calculated.';}else{directions=true; message='Enter an origin latitude, longitude and press Enter, or explicitly use current location.'; if(item.origin!=='provider'&&snapshot.provider.status==='configured')void ensure().select({providerId:snapshot.provider.providerId,id:item.providerPlaceId||'manual',name:item.label,coordinate:item.coordinate,attribution:regionalMap()!.attribution,fetchedAt:Date.now()},false);} invalidate(); },
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
      // Coordinates plan directly; any other text searches regional places and saved places.
      const plan=()=>{
        const text=originText.trim(),match=text.match(/^([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)$/);
        if(match){try{ensure().setOrigin(coordinate({latitude:Number(match[1]),longitude:Number(match[2])}));message='';originMode=false;void ensure().planRoute();}catch{message='Enter origin latitude, longitude.';}invalidate();return;}
        if(!text){message='Enter a starting place, a saved place or latitude, longitude.';invalidate();return;}
        if(snapshot.provider.status!=='configured'&&!ensure().savedMatches(text).length){message='Enter origin latitude, longitude.';invalidate();return;}
        originMode=true;message=`Choose a starting point for the route to ${selected!.label}.`;
        if(snapshot.provider.status==='configured')void ensure().searchOrigin(text);
        invalidate();
      };
      const editOrigin=(value:string)=>{originText=value;ensure().clearOrigin();message=choosingOrigin?`Press Enter to search again for a starting point to ${selected!.label}.`:'Press Enter to search for this origin or calculate a route from coordinates.';invalidate();};
      data.originText=originText;data.onOrigin=(event:Event)=>{originMode=false;editOrigin((event.target as HTMLInputElement).value);};data.originKey=(event:KeyboardEvent)=>{if(event.key==='Enter'){event.preventDefault();plan();}};data.originLocation=locate;
      if(choosingOrigin){
        // While choosing an origin the search bar edits the origin text; editing cancels
        // the pending origin search and Back returns to the route sheet.
        Object.assign(data,{showSearch:true,q:originText,hasQ:!!originText,searchLabel:'Back',searchLead:()=>{back();},
          onQ:(event:Event)=>editOrigin((event.target as HTMLInputElement).value),focusQ:()=>{},
          qKey:(event:KeyboardEvent)=>{if(event.key==='Enter'){event.preventDefault();plan();(event.target as HTMLInputElement).blur();}},
          clearQ:()=>editOrigin('')});
      }
      const distance=(a:Coordinate,b:Coordinate)=>{const r=Math.PI/180,dlat=(a.latitude-b.latitude)*r,dlon=(a.longitude-b.longitude)*r;return 6371000*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(dlat/2)**2+Math.cos(a.latitude*r)*Math.cos(b.latitude*r)*Math.sin(dlon/2)**2)));};
      const end=()=>{void stopGuidance().catch(error=>{message=failure(error).message;invalidate();});invalidate();};
      const progress=navigating&&navFix&&route&&!arrived&&!rerouting?atStep(routeProgress(navFix.coordinate,route),route.steps,navStep):undefined;
      const view=progress?guidanceView(progress):undefined;
      const onFix=(fix:Position)=>{
        if(!navigating)return;
        const current=state?.route.phase==='ready'?state.route.value:null;
        if(rerouting||!current){navFix=fix;invalidate();return;}
        if(current.id!==navRouteId){void stopGuidance().catch(()=>{});invalidate();return;}
        if(fix.accuracyMeters>50){navigationVoice.pause();message='Location is too approximate for turn guidance.';invalidate();return;}
        navFix=fix;navDistance=distance(fix.coordinate,current.to);arrived=navDistance<25&&fix.accuracyMeters<=30;
        if(arrived){navigationVoice.pause();message='Destination reached.';offRoute=false;void navigationLocation.stop();void background.stop();backgroundRunning=false;}
        else{
          const nearest=distanceToRoute(fix.coordinate,current.geometry);offRoute=nearest>Math.max(75,fix.accuracyMeters*2);
          // As before, a maneuver is passed once a fix comes within 40 m of it.
          while(navStep<current.steps.length-1&&distance(fix.coordinate,current.steps[navStep].coordinate)<40)navStep++;
          const reading=atStep(routeProgress(fix.coordinate,current),current.steps,navStep),view=guidanceView(reading),next=reading.next;
          message=offRoute?'Off route. Stop and calculate a new route.':'Foreground guidance · location accuracy ±'+Math.ceil(fix.accuracyMeters)+' m'+(backgroundRunning?' · continues with the screen off':'');
          if(offRoute){navigationVoice.pause();background.update('Off route','Open Maps to reroute from here or stop.');}
          else{if(next)navigationVoice.update(current.id+':'+next.index,view.spoken);background.update(view.notificationTitle,view.notificationText);}
        }
        invalidate();
      };
      const reroute=()=>{
        const from=navFix?.coordinate;if(!navigating||!from||rerouting)return;
        rerouting=true;rerouteCleared=false;offRoute=false;navigationVoice.pause();originText=coordLabel(from);message='Planning a new route from here…';
        void ensure().reroute(from);invalidate();
      };
      data.dr={name:selected.label,close:()=>back(),min:route?Math.max(1,Math.round(route.durationSeconds/60))+' min':snapshot.route.phase==='loading'?'Planning…':'No route',meta:route?(route.distanceMeters/1000).toFixed(1)+' km · no live traffic':'Regional route',via:route?(snapshot.originLabel?'From '+snapshot.originLabel+' · ':'')+(route.steps[0]?.instruction||''):'Choose a real origin to calculate a route.',shareLabel:'Share route',shareEta:()=>{if(route&&snapshot.route.phase==='ready'){const target=selected;share(routeShare(target!.label,route),()=>!disposed&&!!api?.isActive()&&selected===target&&!!directions&&state?.route.phase==='ready'&&state.route.value===route);}},
       modes:data.nativeModeMetadata.map((reference:{mode:'drive'|'walk'|'bike'|'transit';label:string;d:string})=>{const mode=reference.mode==='bike'?'bicycle':reference.mode;const {label,d}=reference;return {label,t:label,d,css:snapshot.mode===mode?'background:var(--acc);color:#fff':'background:var(--s2);color:var(--fg)',go:()=>{if(!ensure().capabilities().modes.includes(mode)){message='Transit schedules are not available for this region.';invalidate();return;}ensure().setMode(mode);message='';if(snapshot.origin)void ensure().planRoute();}};}),
       start:()=>{
        if(!route){message='Calculate a route before starting navigation.';invalidate();return;}
        navigationVoice.pause();arrived=false;navigating=true;follow=true;navStep=0;offRoute=false;rerouting=false;navFix=undefined;navRouteId=route.id;backgroundRunning=false;
        const session=++navSession;message='Waiting for a fresh location fix. Foreground guidance only.';
        // Screen-off continuation only where the native session is available; the
        // notification's Stop ends this exact session once.
        void background.start(`Route to ${selected!.label}`,'Waiting for location',reason=>{if(session!==navSession||!navigating)return;lifecycle.backgroundStops++;
          // Only the notification's Stop is the user ending navigation. A refused or system-ended
          // service drops back to foreground-only guidance, which a hidden page then releases.
          if(reason==='notification'){message='Navigation stopped from the notification.';end();return;}
          backgroundRunning=false;message='Screen-off guidance is unavailable. Foreground guidance only.';if(document.hidden)release();else invalidate();}).then(running=>{if(session!==navSession||!navigating){if(running)void background.stop();return;}backgroundRunning=running;if(running&&!navFix)message='Waiting for a fresh location fix. Guidance continues with the screen off.';invalidate();});
        void navigationLocation.start(false,onFix,error=>{if(session!==navSession)return;message=failure(error).message;void stopGuidance().catch(()=>{});invalidate();});invalidate();
       },
       nav:{going:!arrived,arrived,dist:arrived?'Arrived':view?view.distance:rerouting?'Rerouting…':'Locating…',street:arrived?selected.label:view?view.instruction:rerouting?'Planning a new route from here':'Waiting for location',icon:view?.icon||PIN,hasThen:!!view?.hasThen,thenD:view?.thenIcon||'',thenText:view?.thenText||'',
        left:arrived?'Arrived':view?view.remainingTime:'Guidance',meta:arrived?'Destination reached':view?view.remaining:backgroundRunning?'Continues with the screen off':'Foreground guidance',remaining:view?.remaining||'',
        offRoute,canReroute:offRoute&&!!navFix&&!rerouting,reroute,rerouteLabel:'Reroute from here',background:backgroundRunning,
        end,ask:()=>currentApi.send('Help me with this route.'),voiceLabel:navigationVoice.enabled?'Mute voice guidance':'Enable voice guidance',voice:()=>{navigationVoice.toggle();invalidate();},voiceD:PIN}};
    }
    return data;
  };
  const changed = onMapsConnectionChange(() => {
    const connection=mapsConnection();
    if(controller&&state?.provider.status==='unconfigured'&&connection.config.status==='configured'&&regionalMap()){lifecycle.providerActivations++;controller.activateProvider(connection.config,connection.provider);}
    else release(false);
    invalidate();
  });
  // Screen-off navigation keeps its voice; everything else retires shared and spoken output.
  const continuing=()=>navigating&&background.active();
  const retireShare=()=>{sharing?.abort.abort();sharing=undefined;if(!continuing())navigationVoice.pause();};
  const shareEvents=['launcher-home','alpha:device-state','alpha:dev-incoming-call'];for(const event of shareEvents)window.addEventListener(event,retireShare);
  const visibility = () => { if(document.hidden){retireShare();lifecycle.hidden++;if(continuing()){lifecycle.backgroundNavigation++;invalidate();return;}if(controller?.awaitingLocationPermission()||navigationLocation.awaitingPermission()){lifecycle.permissionHeld++;invalidate();return;}release();}else invalidate(); };
  const pagehide=()=>release();window.addEventListener('pagehide', pagehide); document.addEventListener('visibilitychange', visibility);
  return () => { disposed = true; for(const event of shareEvents)window.removeEventListener(event,retireShare); changed(); release(); window.removeEventListener('pagehide', pagehide); document.removeEventListener('visibilitychange', visibility); Object.assign(module, original); };
}
