import {openScanReview} from './scan-review';
import {browserCamera,browserLibrary,browserPhotoLibrary,mountBrowserCamera} from './browser-camera';
import { registerPlugin } from '../platform-plugins';
import { Capacitor } from '@capacitor/core';

type Bag = Record<string, any>;
type VideoReceipt = { path: string; duration: number; width: number; height: number; fileSize: number };
type Photo = { base64: string; format: string; width: number; height: number; path?: string };
/** Android wire subset. Upstream's HTMLElement is a web-only argument: the
 * pinned Android implementation ignores it and mounts a full-parent PreviewView.
 * Do not serialize a DOM node or invent rectangle arguments. */
const nativeCamera = registerPlugin<{
  startPreview(options: { direction: 'front' | 'back'; resolution: { width: number; height: number }; mirror: boolean }): Promise<{ width: number; height: number; deviceId: string }>;
  stopPreview(): Promise<void>;
  capturePhoto(options: { format: 'jpeg'; quality: number; saveToGallery: boolean }): Promise<Photo>;
  startRecording(options: { audio: boolean; saveToGallery: boolean; quality: string; maxDuration: number; maxFileSize: number }): Promise<void>;
  stopRecording(): Promise<VideoReceipt>;
  getRecordingState(): Promise<{ isRecording: boolean; duration: number; fileSize: number }>;
  switchCamera(options: { direction: 'front' | 'back' }): Promise<unknown>;
  setZoom(options: { zoom: number }): Promise<void>;
  setSettings(options: { settings: { flash: 'off' | 'on' } }): Promise<void>;
  setFocusPoint(options: { x: number; y: number }): Promise<void>;
}>('ElizaCamera');
type SavedPhoto = { kind?: 'image' | 'video'; duration?: number; path?: string; id: string; image: string; width: number; height: number; date: number; revision: string; mutationRevision?: string; trashed?: boolean; expiresAt?: number; favorite?: boolean };
const nativeLibrary = registerPlugin<{
  beginEdit(options:{id:string;revision:string}):Promise<EditPreview>;
  previewEdit(options:{sessionId:string;rotation:number;crop:boolean;filter:string}):Promise<EditPreview>;
  saveEdit(options:{sessionId:string;rotation:number;crop:boolean;filter:string}):Promise<EditReceipt>;
  editResult(options:{operationId:string}):Promise<EditReceipt>;
  cancelEdit(options:{sessionId:string}):Promise<void>;
  list(options: { before?: string; trashed?: boolean; album?: string }): Promise<{ items: SavedPhoto[]; next: string }>;
  read(options: { id: string }): Promise<SavedPhoto>;
  setTrashed(options: { id: string; revision: string; trashed: boolean }): Promise<SavedPhoto & {status:string}>;
  share(options: { id: string }): Promise<{ status: string; message?: string }>;
  setFavorite(options: {id:string;revision:string;favorite:boolean}): Promise<SavedPhoto>;
  changeMany(options:{operation:'favorite'|'trash'|'restore';items:{id:string;revision:string}[]}):Promise<{status:string;outcomes:{id:string;status:string;item?:SavedPhoto}[]}>;
  shareMany(options:{items:{id:string;revision:string}[]}): Promise<{status:string;count:number}>;
  albums(): Promise<{items:OwnedAlbum[]}>;
  changeAlbum(options:Record<string,unknown>): Promise<{status:string;id:string;revision:string}>;
  summary(): Promise<{favorites:number;videos:number;trash:number;canFavorite:boolean}>;
  prepareDeleteTrash(): Promise<{confirmation:string;count:number}>;
  cancelDeleteTrash(options:{confirmation:string}): Promise<void>;
  deletePreparedTrash(options:{confirmation:string}): Promise<{status:string;deletedIds:string[];skippedIds:string[];failedIds:string[]}>;
}>('AlphaPhotos');
const browserMode=!Capacitor.isNativePlatform();
const camera:typeof nativeCamera=browserMode?browserCamera:nativeCamera;
// Check every implemented browser method against the native port contract.
browserPhotoLibrary satisfies Pick<typeof nativeLibrary,keyof typeof browserPhotoLibrary>;
const library=browserMode?browserLibrary as unknown as typeof nativeLibrary:nativeLibrary;
const libraryAvailable=()=>browserMode||Capacitor.isPluginAvailable('AlphaPhotos');
type EditPreview={sessionId:string;operationId:string;image:string;width:number;height:number;reduced:boolean;maxEdge:number;filter:string};
type EditReceipt={status:string;operationId:string;id?:string};
type OwnedAlbum = {id:string;name:string;revision:string;count:number;memberIds:string[]};
const finder = '[aria-label="Viewfinder. Tap to focus, hold to ask Alpha, swipe to change mode"]';

/** Install after native/selection adapters. Reload app-owned captures from
 * MediaStore; other personal images remain behind the Android photo picker. */
export function installPrototypeCameraAdapter(_Component: unknown, views: Record<string, Bag>): () => void {
  const module = views.camera;
  if (!module) return () => {};
  const render = module.render, leave = module.onLeave, cameraBack = module.back;
  const photosRender = views.photos?.render, photosBack = views.photos?.back, photosLeave = views.photos?.onLeave;
  const prototype=(_Component as any)?.prototype, originalApi=prototype?.api;
  const scanApi=typeof originalApi==='function'?function(this:Bag,key:string){
    const value=originalApi.call(this,key);
    if(key==='camera')value.saveScannedNote=async(text:string,id:string)=>{
      if(this.notesStorageFailed||this.notesPending||!this.notesStore)return false;
      const list=this.vget('notes').list||[];
      if(list.some((note:Bag)=>note.id===id))return false;
      return await this.vset('notes',{list:[{id,kind:'text',title:text.split('\n')[0].slice(0,100)||'Scanned text',body:text,when:'Now',pinned:false},...list]})===true;
    };
    return value;
  }:undefined;
  if(scanApi)prototype.api=scanApi;
  let closeScan:(()=>void)|undefined;
  const cancelScan=()=>{closeScan?.();closeScan=undefined;};
  let api: Bag | undefined;
  let phase: 'off' | 'starting' | 'ready' | 'error' = 'off';
  let epoch = 0, controlBusy = false, capturing = false, direction: 'front' | 'back' = 'back';
  let flash = false, disposed = false;
  let recording = false, recordingStarting = false, duration = 0;
  let finalizing: Promise<void> | undefined;
  let video: HTMLVideoElement | undefined, videoId = '';
  function closeVideo() { if (video) { video.pause(); video.removeAttribute('src'); video.load(); video.remove(); } video = undefined; videoId = ''; }
  let stopping: Promise<void> = Promise.resolve();
  let captures: SavedPhoto[] = [];
  let photosApi: Bag | undefined, loaded = false, loading = false, next = '', libraryEpoch = 0;
  let preview: SavedPhoto | undefined, reading = '', sharing = false;
  let edit: (EditPreview & {source:string;rotation:number;crop:boolean;busy:boolean;uncertain?:boolean})|undefined,editEpoch=0;
  const editPendingKey='alpha.photos.pending-copy.v1';
  function cancelEdit(){++editEpoch;const old=edit;edit=undefined;if(old)void library.cancelEdit({sessionId:old.sessionId}).catch(()=>{});}
  async function beginEdit(row:SavedPhoto,owner:Bag){
    if(row.kind==='video'){owner.toast('Video editing is not available. Your video is unchanged.');return;}
    if(!row.mutationRevision||edit||mutating)return;
    if(localStorage.getItem(editPendingKey)){owner.toast('Checking a previous saved-copy outcome…');void recoverEdit(owner);return;}
    const generation=++editEpoch;closeVideo();
    try{const value=await library.beginEdit({id:nativeId(row.id),revision:row.mutationRevision});if(disposed||generation!==editEpoch||!owner.isActive()||owner.get('photos').open!==row.id){void library.cancelEdit({sessionId:value.sessionId});return;}
      edit={...value,source:row.id,rotation:0,crop:false,busy:false};owner.set({nativeEditRevision:Date.now()});
    }catch(error){if(owner.isActive())owner.toast(error instanceof Error?error.message:'Photo editor unavailable.');}
  }
  async function transformEdit(owner:Bag,rotate:boolean,chosenFilter?:string){const current=edit;if(!current||current.busy||current.uncertain)return;current.busy=true;const rotation=rotate?(current.rotation+90)%360:current.rotation,crop=chosenFilter!==undefined?current.crop:rotate?current.crop:!current.crop,filter=chosenFilter??current.filter;owner.set({nativeEditRevision:Date.now()});
    try{const value=await library.previewEdit({sessionId:current.sessionId,rotation,crop,filter});if(edit===current)edit={...current,...value,rotation,crop,busy:false};}
    catch(error){if(edit===current){current.busy=false;owner.toast(error instanceof Error?error.message:'Preview unavailable. Original unchanged.');}}
    finally{if(owner.isActive())owner.set({nativeEditRevision:Date.now()});}
  }
  type EditCompletion={token:string;epoch:number;source:string|undefined};
  const completionCurrent=(ticket:EditCompletion,owner:Bag)=>!disposed&&!document.hidden&&owner.isActive()&&editEpoch===ticket.epoch&&owner.get('photos').open===ticket.source&&(!edit||edit.operationId===ticket.token);
  async function finishEdit(value:EditReceipt,owner:Bag,ticket:EditCompletion){
    // A late/duplicate outcome may only retire its own persisted operation.
    // It cannot consume a new save or cancel/navigate a newer editor/selection.
    if(value.operationId!==ticket.token||localStorage.getItem(editPendingKey)!==ticket.token)return true;
    const terminal=(value.status==='saved'&&!!value.id)||['failed','unchanged','not-started'].includes(value.status);if(!terminal)return false;
    const updateView=completionCurrent(ticket,owner);localStorage.removeItem(editPendingKey);
    if(edit?.operationId===ticket.token)cancelEdit();
    if(!updateView)return true;
    if(value.status==='saved'&&value.id){owner.toast('Saved a copy. Original unchanged.');void refresh();await openSaved('native-camera-'+value.id,owner);}
    else{owner.toast(value.status==='failed'?'Copy was not saved. Original unchanged.':'No copy was created. Original unchanged.');owner.set({nativeEditRevision:Date.now()});}return true;
  }
  let recoveringEdit=false,automaticEditRecovery='';
  async function recoverEdit(owner:Bag,original?:EditCompletion){
    const token=localStorage.getItem(editPendingKey);if(!token||recoveringEdit||(original&&original.token!==token))return;
    const ticket=original||{token,epoch:editEpoch,source:owner.get('photos').open};recoveringEdit=true;
    try{const value=await library.editResult({operationId:token});if(!await finishEdit(value,owner,ticket)&&completionCurrent(ticket,owner))owner.toast('Copy outcome is unresolved. No automatic retry; inspect Photos before trying another edit.');}
    catch{if(completionCurrent(ticket,owner))owner.toast('Copy outcome could not be checked. No additional copy was created.');}
    finally{recoveringEdit=false;}
  }
  async function saveEdit(owner:Bag){const current=edit;if(!current||current.busy)return;
    const ticket={token:current.operationId,epoch:editEpoch,source:current.source};if(current.uncertain){void recoverEdit(owner,ticket);return;}current.busy=true;owner.set({nativeEditRevision:Date.now()});
    try{const pending=localStorage.getItem(editPendingKey);if(pending&&pending!==ticket.token)throw Error('Another save is unresolved');localStorage.setItem(editPendingKey,ticket.token);const value=await library.saveEdit({sessionId:current.sessionId,rotation:current.rotation,crop:current.crop,filter:current.filter});if(!await finishEdit(value,owner,ticket)){if(edit===current)current.uncertain=true;await recoverEdit(owner,ticket);}}
    catch{if(edit===current)current.uncertain=true;await recoverEdit(owner,ticket);}
    finally{if(edit===current){current.busy=false;if(completionCurrent(ticket,owner))owner.set({nativeEditRevision:Date.now()});}}
  }
  let counts: {favorites:number;videos:number;trash:number;canFavorite:boolean} | undefined, countsBusy = false, countsError = false, countsEpoch = 0;
  let albumRows: SavedPhoto[] = [], albumKey = '', albumNext = '', albumBusy = false, albumEpoch = 0;
  let customAlbums: OwnedAlbum[] = [], albumsLoaded=false, albumsBusy=false, albumsEpoch=0;
  let manager: {media?:SavedPhoto;album?:OwnedAlbum;name:string;creating?:boolean;choosing?:boolean;confirmDelete?:boolean}|undefined;
  let selection: SavedPhoto[]|undefined;let holdTimer:number|undefined;let swallowedTap='';
  const endHold=()=>{if(holdTimer!==undefined)clearTimeout(holdTimer);holdTimer=undefined;};
  let prepared: {confirmation:string;count:number} | undefined;
  let trash: SavedPhoto[] = [], trashNext = '', trashLoaded = false, trashLoading = false, mutating = false, refreshAgain = false, trashRefreshAgain = false, trashEpoch = 0;
  const nativeId = (id: string) => id.replace(/^native-camera-/, '');
  const normalize = (photo: SavedPhoto): SavedPhoto => ({ ...photo, id: 'native-camera-' + photo.id });
  async function refresh(more = false) {
    if (disposed) return;
    if (loading) { refreshAgain = true; return; }
    if (!libraryAvailable()) {
      loaded = true;
      photosApi?.set({ nativeLibraryError: 'Saved photos are available in the Android app.' });
      return;
    }
    loading = true; const token = ++libraryEpoch;
    try {
      const result = await library.list(more ? { before: next } : {});
      if (disposed || token !== libraryEpoch) return;
      const rows = result.items.map(normalize);
      captures = more ? [...captures, ...rows.filter(row => !captures.some(old => old.id === row.id))] : rows;
      next = result.next; loaded = true; loading = false;
      photosApi?.set({ nativeLibraryError: '', nativeCaptureRevision: token });
      if (!more && photosApi) { void loadCounts(photosApi); void loadCustomAlbums(photosApi); }
      if (api?.isActive()) api.set({ nativeCaptureRevision: token });
    } catch { loaded = true; loading = false; if (!disposed) photosApi?.set({ nativeLibraryError: 'Saved photos could not be loaded. Tap to retry.' }); }
    finally { loading = false; if (refreshAgain && !disposed) { refreshAgain = false; queueMicrotask(() => { void refresh(); }); } }
  }
  function toggleSelection(row:SavedPhoto,owner:Bag){
    if(!selection||mutating||sharing)return;
    if(selection.some(item=>item.id===row.id))selection=selection.filter(item=>item.id!==row.id);
    else if(selection.length<20)selection=[...selection,row];else owner.toast('Select up to 20 items.');
    owner.set({nativePhotoSelection:null,nativeMultiSelection:Date.now()});
  }
  function thumbnailEvents(row:SavedPhoto,owner:Bag){return {
    selecting:!!selection,on:!!selection?.some(item=>item.id===row.id),selCss:selection?.some(item=>item.id===row.id)?'background:var(--acc);box-shadow:0 0 0 2px #ffffff':'background:rgba(0,0,0,.18);box-shadow:inset 0 0 0 2px #ffffff',
    tap:()=>{endHold();if(swallowedTap===row.id){swallowedTap='';return;}if(selection)toggleSelection(row,owner);else void openSaved(row.id,owner);},
    pd:()=>{endHold();if(selection||sharing||mutating)return;holdTimer=window.setTimeout(()=>{holdTimer=undefined;if(!owner.isActive()||disposed)return;selection=[row];swallowedTap=row.id;owner.set({open:null,nativePhotoSelection:null,nativeMultiSelection:Date.now()});},450);},pu:()=>{endHold();window.setTimeout(()=>{swallowedTap='';},0);},
  };}
  async function shareSelection(owner:Bag){
    if(!selection?.length||sharing||mutating)return;const chosen=selection;sharing=true;owner.set({nativeMultiSelection:Date.now()});
    try{await library.shareMany({items:chosen.map(row=>({id:nativeId(row.id),revision:row.mutationRevision||''}))});}
    catch(error){if(owner.isActive())owner.toast(error instanceof Error?error.message:'Selection could not be shared. Reselect the items.');}
    finally{sharing=false;if(!disposed)owner.set({nativeMultiSelection:Date.now()});}
  }
  async function changeSelection(owner:Bag,operation:'favorite'|'trash'|'restore',undoItems?:SavedPhoto[]){
    if(mutating||sharing||disposed)return;
    const chosen=undoItems||selection;if(!chosen?.length)return;
    const selectionAtStart=selection;
    mutating=true;closeVideo();preview=undefined;reading='';
    owner.set({open:null,nativePhotoSelection:null,nativeMultiSelection:Date.now()});
    try{
      const receipt=await library.changeMany({operation,items:chosen.map(row=>({id:nativeId(row.id),revision:row.mutationRevision||''}))});
      if(disposed)return;
      const verified=receipt.outcomes.filter(row=>row.item),changed=verified.filter(row=>row.status!=='unchanged');
      const successful=new Set(verified.map(row=>'native-camera-'+row.id));
      ++libraryEpoch;++trashEpoch;albumKey='';++albumEpoch;
      captures=captures.filter(row=>!successful.has(row.id));trash=trash.filter(row=>!successful.has(row.id));
      for(const row of verified){const before=chosen.find(item=>nativeId(item.id)===row.id);const item={...before,...normalize(row.item!)};if(item.trashed)trash.unshift(item);else captures.unshift(item);}
      if(owner.isActive()&&selection===selectionAtStart){
        selection=undoItems?undefined:chosen.filter(row=>!successful.has(row.id));if(!selection?.length)selection=undefined;
        owner.set({nativeMultiSelection:Date.now(),nativeCaptureRevision:Date.now()});
        const failed=receipt.outcomes.length-verified.length;
        const message=operation==='favorite'?`${verified.length} favorited`:operation==='trash'?`${verified.length} moved to Recently deleted`:`${verified.length} restored`;
        const undo=operation==='trash'?changed.map(row=>normalize(row.item!)):[];
        owner.toast(message+(failed?`; ${failed} not verified. Cancel selection and reselect to refresh.`:''),undo.length?{undo:()=>{void changeSelection(owner,'restore',undo);}}:undefined);
      }
    }catch{if(owner.isActive())owner.toast('Batch outcome could not be verified. Reopen Photos before retrying.');}
    finally{mutating=false;if(!disposed){void refresh();void loadTrash(owner);void loadCounts(owner);void loadCustomAlbums(owner);owner.set({nativeMultiSelection:Date.now()});}}
  }
  async function loadCustomAlbums(owner: Bag) {
    if(disposed)return;const token=++albumsEpoch;albumsBusy=true;
    try{const result=await library.albums();if(!disposed&&token===albumsEpoch){customAlbums=result.items;albumsLoaded=true;owner.set({nativeAlbumsError:'',nativeAlbumsRevision:token});}}
    catch{if(!disposed&&token===albumsEpoch){albumsLoaded=true;owner.set({nativeAlbumsError:'Custom albums could not be loaded. Reopen album management to retry.'});}}
    finally{if(token===albumsEpoch)albumsBusy=false;}
  }
  function openAlbumManager(owner:Bag,media?:SavedPhoto,album?:OwnedAlbum){
    manager={media,album,name:album?.name||''};owner.set({sheet:'owned-album'});void loadCustomAlbums(owner);
  }
  async function mutateAlbum(owner:Bag,operation:string,target?:OwnedAlbum){
    const current=manager;if(!current||mutating||disposed)return;
    const album=target||current.album,media=current.media;
    mutating=true;owner.set({nativePhotoMutation:Date.now()});
    try{
      await library.changeAlbum({operation,...(album?{id:album.id,revision:album.revision}:{}),...(media?{mediaId:nativeId(media.id),mediaRevision:media.mutationRevision}:{}),name:current.name});
      if(disposed)return;
      albumKey='';++albumEpoch;
      if(manager===current&&owner.isActive()&&owner.get('photos').sheet==='owned-album'){
        manager=undefined;
        owner.set({sheet:null,...(operation==='delete'?{album:null,open:null,nativePhotoSelection:null}:{}),nativeAlbumsError:''});
        owner.toast(operation==='delete'?'Album deleted. Its media was kept.':operation==='remove'?'Removed from album. Its media was kept.':'Album saved');
      }
      await loadCustomAlbums(owner);
    }catch(error){if(!disposed){if(manager===current&&owner.isActive())owner.toast(error instanceof Error?error.message:'Album could not be saved.');void loadCustomAlbums(owner);}}
    finally{mutating=false;if(!disposed)owner.set({nativePhotoMutation:Date.now()});}
  }
  async function loadCounts(owner: Bag) {
    const token = ++countsEpoch; countsBusy = true;
    try { const result = await library.summary(); if (!disposed && token === countsEpoch) { counts = result; countsError = false; owner.set({ nativeAlbumCounts: token }); } }
    catch { countsError = true; }
    finally { if (token === countsEpoch) countsBusy = false; }
  }
  async function loadAlbum(key: string, owner: Bag, more = false) {
    if (disposed || (albumBusy && albumKey === key && more)) return;
    const token = ++albumEpoch; albumKey = key; albumBusy = true;
    if (!more) { albumRows = []; albumNext = ''; }
    try {
      const result = await library.list({ album: key.startsWith('custom:') ? key : key === 'fav' ? 'favorites' : 'videos', ...(more ? {before:albumNext} : {}) });
      if (disposed || token !== albumEpoch) return;
      const rows = result.items.map(normalize); albumRows = more ? [...albumRows,...rows.filter(row => !albumRows.some(old => old.id === row.id))] : rows;
      albumNext = result.next; owner.set({nativeAlbumError:'',nativeAlbumRevision:token});
      if (!more) void loadCounts(owner);
    } catch { if (!disposed && token === albumEpoch) owner.set({nativeAlbumError:'Album could not be loaded. Tap to retry.'}); }
    finally { if (token === albumEpoch) albumBusy = false; }
  }
  async function favorite(row: SavedPhoto, owner: Bag) {
    if (mutating || sharing || disposed || !row.mutationRevision) return;
    mutating = true; owner.set({nativePhotoMutation:Date.now()});
    try {
      const result = normalize(await library.setFavorite({id:nativeId(row.id),revision:row.mutationRevision,favorite:!row.favorite}));
      if (disposed) return;
      const updated = {...row,...result}; captures = captures.map(item=>item.id===row.id?updated:item);
      const stillSelected = owner.isActive() && owner.get('photos').open === row.id;
      if (stillSelected) preview = updated;
      owner.set({...(stillSelected ? {nativePhotoSelection:{kind:updated.kind==='video'?'video':'photo',id:updated.id,revision:updated.revision}} : {}),nativeCaptureRevision:Date.now()});
      owner.toast(updated.favorite?'Added to favorites':'Removed from favorites');
      albumKey='';++albumEpoch;void loadCounts(owner);
    } catch (error) { if (!disposed) owner.toast(error instanceof Error?error.message:'Favorite could not be changed.'); }
    finally { mutating = false; if(!disposed)owner.set({nativePhotoMutation:Date.now()}); }
  }
  function cancelPermanent(owner: Bag) {
    if(mutating)return;
    const old=prepared;prepared=undefined;owner.set({sheet:null});if(old)void library.cancelDeleteTrash({confirmation:old.confirmation}).catch(()=>{});
  }
  async function preparePermanent(owner: Bag) {
    if(mutating||sharing||disposed)return;
    mutating=true;owner.set({nativePhotoMutation:Date.now()});
    try {
      const result=await library.prepareDeleteTrash();
      if(disposed||!owner.isActive()||owner.get('photos').album!=='trash'){void library.cancelDeleteTrash({confirmation:result.confirmation}).catch(()=>{});return;}
      if(result.count===0){void library.cancelDeleteTrash({confirmation:result.confirmation}).catch(()=>{});owner.toast('Recently deleted is empty.');return;}
      if(prepared)void library.cancelDeleteTrash({confirmation:prepared.confirmation}).catch(()=>{});
      prepared=result;owner.set({sheet:'empty',nativeTrashMutationStatus:''});
    } catch(error){if(!disposed)owner.toast(error instanceof Error?error.message:'Trash could not be prepared.');}
    finally{mutating=false;if(!disposed)owner.set({nativePhotoMutation:Date.now()});}
  }
  async function deletePermanent(owner: Bag) {
    if(mutating||disposed||!prepared)return;
    const snapshot=prepared;mutating=true;closeVideo();owner.set({nativePhotoMutation:Date.now()});
    try {
      const result=await library.deletePreparedTrash({confirmation:snapshot.confirmation});
      if(disposed)return;
      ++libraryEpoch;++trashEpoch;const deleted=new Set(result.deletedIds.map(id=>'native-camera-'+id));trash=trash.filter(row=>!deleted.has(row.id));captures=captures.filter(row=>!deleted.has(row.id));preview=undefined;
      const remaining=result.skippedIds.length+result.failedIds.length;
      owner.set({sheet:null,open:null,nativePhotoSelection:null,nativeTrashMutationStatus:remaining?`${result.deletedIds.length} deleted. ${remaining} changed or could not be deleted; review the remaining items.`:''});
      owner.toast(remaining?'Some items were not deleted.':`${result.deletedIds.length} ${result.deletedIds.length===1?'item':'items'} deleted forever`);
      void refresh();void loadTrash(owner);void loadCounts(owner);void loadCustomAlbums(owner);
    }catch(error){if(!disposed){owner.set({sheet:null,nativeTrashMutationStatus:'Deletion could not be completed. Review the remaining items.'});owner.toast(error instanceof Error?error.message:'Deletion failed.');void loadTrash(owner);}}
    finally{if(prepared===snapshot)prepared=undefined;mutating=false;if(!disposed)owner.set({nativePhotoMutation:Date.now()});}
  }
  async function loadTrash(owner: Bag, more = false) {
    if (disposed) return;
    if (trashLoading) { trashRefreshAgain = true; return; }
    trashLoading = true; const token = ++trashEpoch;
    try {
      const result = await library.list({ trashed: true, ...(more ? { before: trashNext } : {}) });
      if (disposed || token !== trashEpoch) return;
      const rows = result.items.map(normalize);
      trash = more ? [...trash, ...rows.filter(row => !trash.some(old => old.id === row.id))] : rows;
      trashNext = result.next; trashLoaded = true;
      owner.set({ nativeTrashError: '', nativeTrashRevision: Date.now() });
    } catch { if (!disposed) owner.set({ nativeTrashError: browserMode?'Browser trash could not be loaded. Tap to retry.':'Android trash could not be loaded. Android 11 or later is required.' }); }
    finally { trashLoading = false; if (trashRefreshAgain && !disposed) { trashRefreshAgain = false; queueMicrotask(() => { void loadTrash(owner); }); } }
  }
  async function changeTrash(row: SavedPhoto, desired: boolean, owner: Bag) {
    if (mutating || sharing || disposed) return;
    if (!row.mutationRevision) { owner.toast('Refresh Photos before changing this media.'); return; }
    mutating = true; closeVideo();
    try {
      const result = normalize(await library.setTrashed({ id: nativeId(row.id), revision: row.mutationRevision, trashed: desired }));
      if (disposed) return;
      ++libraryEpoch; ++trashEpoch; captures = captures.filter(item => item.id !== row.id); trash = trash.filter(item => item.id !== row.id);
      if (desired) trash.unshift({ ...row, ...result });
      else captures.unshift({ ...row, ...result });
      preview = undefined; reading = '';
      owner.set({ open: null, nativePhotoSelection: null, sheet: null, sel: null, nativeCaptureRevision: Date.now() });
      owner.toast(desired ? 'Moved to Recently deleted' : 'Restored', desired ? { undo: () => { void changeTrash({ ...row, ...result }, false, owner); } } : undefined);
      void refresh(); void loadTrash(owner); void loadCounts(owner); void loadCustomAlbums(owner); albumKey=''; ++albumEpoch;
    } catch (error) {
      if (!disposed) { owner.toast(error instanceof Error ? error.message : 'This media could not be changed.'); void refresh(); void loadTrash(owner); void loadCounts(owner); void loadCustomAlbums(owner); albumKey=''; ++albumEpoch; }
    } finally { mutating = false; }
  }
  async function openSaved(id: string, currentApi: Bag) {
    if (reading === id) return;
    closeVideo();
    reading = id;
    currentApi.set({ open: id, chrome: true, nativePhotoSelection: null });
    preview = undefined;
    try {
      const row = normalize(await library.read({ id: nativeId(id) }));
      if (disposed || currentApi.get('photos').open !== id) return;
      preview = row;
      currentApi.set({ nativePhotoSelection: { kind: row.kind === 'video' ? 'video' : 'photo', id: row.id, revision: row.revision } });
    } catch {
      if (!disposed && currentApi.get('photos').open === id) {
        currentApi.set({ open: null, nativePhotoSelection: null });
        currentApi.toast('This saved photo is no longer available.');
        void refresh();
      }
    } finally { if (reading === id) reading = ''; }
  }
  const marked = new Set<HTMLElement>();
  const style = document.createElement('style');
  style.textContent = `
    [data-alpha-camera-clear]{background:transparent!important;background-color:transparent!important}
    [data-alpha-camera-screen]{background:linear-gradient(to bottom,#000 0px,#000 var(--alpha-camera-top),transparent var(--alpha-camera-top),transparent var(--alpha-camera-bottom),#000 var(--alpha-camera-bottom))!important}
    [data-alpha-camera-frame]{visibility:hidden!important}
    [data-alpha-camera-underlay]{display:none!important}
  `;
  document.head.append(style);
  function mask(enable: boolean) {
    if(browserMode){if(enable)mountBrowserCamera();return;}
    for (const el of marked) {
      el.removeAttribute('data-alpha-camera-clear'); el.removeAttribute('data-alpha-camera-screen'); el.removeAttribute('data-alpha-camera-frame'); el.removeAttribute('data-alpha-camera-underlay');
      el.style.removeProperty('--alpha-camera-top'); el.style.removeProperty('--alpha-camera-bottom');
    }
    marked.clear();
    if (!enable) return;
    const vf = document.querySelector<HTMLElement>(finder);
    const screen = vf?.closest<HTMLElement>('[data-screen]');
    if (!vf || !screen) return;
    for (let el: HTMLElement | null = vf; el; el = el.parentElement) { el.setAttribute('data-alpha-camera-clear', ''); marked.add(el); }
    // Home remains mounted as a lower-z sibling of the active app surface.
    // Transparency must reveal CameraX, not that still-painted DOM. Hide only
    // positioned screen siblings below the active camera branch; keep status,
    // chat/confirmation overlays and all camera controls above it untouched.
    let branch: HTMLElement = vf;
    while (branch.parentElement && branch.parentElement !== screen) branch = branch.parentElement;
    const cameraZ = Number(getComputedStyle(branch).zIndex);
    if (branch.parentElement === screen && Number.isFinite(cameraZ)) {
      for (const sibling of Array.from(screen.children)) {
        if (!(sibling instanceof HTMLElement) || sibling === branch) continue;
        const computed = getComputedStyle(sibling), z = Number(computed.zIndex);
        if (['absolute', 'fixed'].includes(computed.position) && computed.zIndex !== 'auto' && Number.isFinite(z) && z < cameraZ) {
          sibling.setAttribute('data-alpha-camera-underlay', ''); marked.add(sibling);
        }
      }
    }
    const rect = vf.getBoundingClientRect(), sr = screen.getBoundingClientRect();
    const scale = sr.width / (screen.offsetWidth || 412);
    screen.setAttribute('data-alpha-camera-screen', '');
    screen.style.setProperty('--alpha-camera-top', `${(rect.top - sr.top) / scale}px`);
    screen.style.setProperty('--alpha-camera-bottom', `${(rect.bottom - sr.top) / scale}px`);
    // The prototype's separate decorative device frame sits behind data-screen.
    // It must not cover the actual native preview through the transparent hole.
    const frame = screen.parentElement?.firstElementChild;
    if (frame instanceof HTMLElement && frame !== screen && !frame.contains(screen)) { frame.setAttribute('data-alpha-camera-frame', ''); marked.add(frame); }
  }
  const active = () => !disposed && !document.hidden && !!api?.isActive() && !['sheet', 'full'].includes(api?.S.chat) && !!document.querySelector(finder);
  const message = (value: string) => { api?.set({ said: value }); };
  async function stop() {
    cancelScan(); ++epoch; phase = 'off'; controlBusy = false; mask(false);
    if (recording || finalizing) await finishVideo();
    stopping = stopping.then(async () => { try { if (browserMode || Capacitor.isPluginAvailable('ElizaCamera')) await camera.stopPreview(); } catch { /* startPreview resets native state before retrying. */ } });
    await stopping;
  }
  async function start(retry = false) {
    if (recordingStarting || finalizing || !active() || phase === 'starting' || phase === 'ready' || (phase === 'error' && !retry)) return;
    if (!browserMode && !Capacitor.isPluginAvailable('ElizaCamera')) { phase = 'error'; message('In-app camera is unavailable in this build.'); return; }
    const token = ++epoch; phase = 'starting'; message('Starting camera…');
    try {
      await stopping;
      if (token !== epoch || !active()) return;
      await camera.startPreview({ direction, resolution: { width: 1280, height: 720 }, mirror: direction === 'front' });
      if (token !== epoch || !active()) return;
      phase = 'ready';if(browserMode){flash=false;api?.set({zoom:1,flash:false});}mask(true); message('');
    } catch {
      if (token !== epoch) return;
      phase = 'error'; mask(false); message('Camera unavailable or permission denied. Tap the shutter to retry.');
    }
  }
  async function control(task: () => Promise<unknown>, completed: () => void) {
    if (phase !== 'ready' || controlBusy || capturing || recording || recordingStarting || finalizing) return;
    controlBusy = true; const token = epoch;
    try { await task(); if (token === epoch && active()) completed(); }
    catch { if (token === epoch) message('This camera does not support that control, or the operation was cancelled.'); }
    finally { if (token === epoch) controlBusy = false; }
  }
  async function finishVideo() {
    if (finalizing) return finalizing;
    recording = false; api?.set({ rec: false });
    finalizing = (async () => {
      message('Saving video…');
      try {
        const receipt = await camera.stopRecording();
        if (!/^(content:\/\/media\/|browser-video:\/\/\/)/.test(receipt.path) || receipt.duration <= 0 || receipt.fileSize <= 0) throw new Error('Incomplete recording');
        const id = receipt.path.split('/').pop();
        if (!id || !/^\d+$/.test(id)) throw new Error('Missing video identity');
        const item = normalize(await library.read({ id: 'v:' + id }));
        if (disposed) return;
        captures = [item, ...captures.filter(row => row.id !== item.id)]; loaded = false;
        api?.setView('photos', { nativeCaptureRevision: item.id });
        message(browserMode?'Video saved.':'Video saved to Android Photos.');
      } catch { if (!disposed) message('Video could not be finalized. No successful recording was confirmed.'); }
      finally { finalizing = undefined; }
    })();
    return finalizing;
  }
  async function record() {
    if (recording || finalizing) { await finishVideo(); return; }
    if (recordingStarting || capturing || controlBusy || phase !== 'ready') return;
    recordingStarting = true; const token = epoch; message('Starting video with microphone…');
    try {
      await camera.startRecording({ audio: true, saveToGallery: true, quality: 'medium', maxDuration: 300, maxFileSize: 104857600 });
      recording = true; duration = 0;
      if (token !== epoch || !active()) { await finishVideo(); return; }
      api?.set({ rec: true }); message('Recording · stops and saves when you leave · limit 5 minutes or 100 MB');
    } catch { if (token === epoch && active()) message('Video could not start. Allow microphone access and tap the shutter to retry.'); }
    finally { recordingStarting = false; schedule(); }
  }
  async function capture() {
    if (phase !== 'ready') { await start(true); return; }
    if (!api || capturing || controlBusy) return;
    if (api.get('camera').mode === 'video') { await record(); return; }
    const scanning=api.get('camera').mode==='scan';
    cancelScan();
    capturing = true; const token = epoch; const owner = api;
    message('Saving photo…');
    try {
      // The pinned plugin scales width/height independently. Supplying only a
      // width distorts the saved image; retain sensor dimensions and let the
      // owned-media reader create bounded, aspect-preserving display previews.
      const photo = await camera.capturePhoto({ format: 'jpeg', quality: 85, saveToGallery: true });
      if (!photo.path || photo.format !== 'jpeg' || !photo.base64 || photo.width <= 0 || photo.height <= 0) throw new Error('Incomplete photo receipt');
      // A capture may finish after navigation: the native gallery write already
      // happened. Retain its real receipt, but never move the user back to Camera.
      const mediaId = photo.path.split('/').pop();
      if (!mediaId || !/^\d+$/.test(mediaId)) throw new Error('Missing MediaStore identity');
      const item: SavedPhoto = { id: 'native-camera-' + mediaId, image: 'data:image/jpeg;base64,' + photo.base64, width: photo.width, height: photo.height, date: Date.now(), revision: 'captured' };
      if (disposed) return;
      captures = [item, ...captures.filter(row => row.id !== item.id)];
      loaded = false;
      owner.setView('photos', { nativeCaptureRevision: item.id });
      if (token === epoch && active()) {
        if(scanning){const bytes=Uint8Array.from(atob(photo.base64),char=>char.charCodeAt(0));closeScan=openScanReview(new Blob([bytes],{type:'image/jpeg'}),(text,id)=>owner.saveScannedNote?.(text,id)??Promise.resolve(false),draft=>{if(token!==epoch||!active())return false;owner.open('calendar',{form:draft,open:null,month:null,day:draft.off},'hidden');return true;});}
        message(browserMode?'Photo saved in this browser. Clearing site data removes saved photos.':'Photo saved to Android Photos.');
      }
    } catch { if (token === epoch && active()) message('Photo could not be saved. No successful capture was confirmed.'); }
    finally { capturing = false; }
  }
  module.render = (st: Bag, currentApi: Bag) => {
    api = currentApi;
    queueMicrotask(schedule);
    if (!loaded && !loading) queueMicrotask(() => { void refresh(); });
    const data = render(st, currentApi);
    data.bg = 'transparent'; data.vfBg = phase === 'ready' ? 'transparent' : '#000000';
    data.drift = ''; data.zoomCss = ''; data.scanFound = false; data.scanning = false; data.rec = recording; data.recTime = `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}`; data.flOp = 0;
    if(st.mode==='scan')data.shutterLabel='Scan text';
    data.shutter = () => { void capture(); };
    data.flip = () => { const next = direction === 'back' ? 'front' : 'back'; void control(() => camera.switchCamera({ direction: next }), () => { direction = next; flash = false; currentApi.set({ front: next === 'front', flash: false, ...(browserMode?{zoom:1}:{}) }); }); };
    data.toggleFlash = () => { const next = !flash; void control(() => camera.setSettings({ settings: { flash: next ? 'on' : 'off' } }), () => { flash = next; currentApi.set({ flash: next }); }); };
    data.zooms = (data.zooms || []).map((z: Bag, i: number) => ({ ...z, pick: () => { const ratio = parseFloat(z.label); void control(() => camera.setZoom({ zoom: ratio }), () => currentApi.set({ zoom: i })); } }));
    data.vfDown = () => {};
    data.vfUp = (event: PointerEvent) => { void control(() => camera.setFocusPoint({ x: Math.max(0, Math.min(1, event.clientX / window.innerWidth)), y: Math.max(0, Math.min(1, event.clientY / window.innerHeight)) }), () => message('')); };
    data.vfLeave = () => {};
    data.modes = (data.modes || []).map((m: Bag) => ({ ...m, pick: () => { if (recording || recordingStarting || finalizing || capturing) return; const mode = m.label.toLowerCase(); if (['photo','video','scan'].includes(mode)){cancelScan();currentApi.set({ mode, rec: false, found: false });if(mode==='scan')message('Hold text steady, then tap Scan text. English recognition runs locally.');} } }));
    data.ask = () => currentApi.assist('You can ask Alpha here. Camera image analysis is not connected, and the live camera feed is not shared.');
    if (captures[0]) {
      data.hasLast = true; data.noLast = false; data.lastBg = `url("${captures[0].image}") center / cover no-repeat`; data.lastTf = ''; data.lastFlt = '';
      data.openLast = () => { currentApi.open('photos', { open: captures[0].id, chrome: true }); };
    } else { data.hasLast = false; data.noLast = true; data.openLast = () => message('Take a photo first.'); }
    return data;
  };
  module.back = () => { if (recording || recordingStarting || finalizing) { void stop(); return true; } return false; };
  module.onLeave = () => { void stop(); };
  if (photosRender) views.photos.render = (st: Bag, currentApi: Bag) => {
    photosApi = currentApi;
    // Once per Photos entry, reconcile the persisted operation without reissuing a save.
    if(currentApi.isActive()&&!edit){
      let pending:string|null=null;try{pending=localStorage.getItem(editPendingKey);}catch{}
      if(pending&&automaticEditRecovery!==pending){automaticEditRecovery=pending;queueMicrotask(()=>{if(!disposed&&currentApi.isActive())void recoverEdit(currentApi);});}
    }
    if (!loaded && !loading) queueMicrotask(() => { void refresh(); });
    const data = photosRender(st, currentApi);
    if (!trashLoaded && !trashLoading && !st.nativeTrashError && libraryAvailable()) queueMicrotask(() => { void loadTrash(currentApi); });
    if (!counts && !countsBusy && !countsError && libraryAvailable()) queueMicrotask(() => { void loadCounts(currentApi); });
    data.trashN = counts ? String(counts.trash) : trashLoaded ? String(trash.length) + (trashNext ? '+' : '') : '…';
    data.tiles = [['fav','Favorites',counts?.favorites],['video','Videos',counts?.videos]].map(([key,name,count])=>({name,count:count??'…',bg:(captures.find(row=>key==='fav'?row.favorite:row.kind==='video')?.image ? `url("${captures.find(row=>key==='fav'?row.favorite:row.kind==='video')?.image}") center / cover no-repeat` : 'var(--s2)'),tf:'',flt:'',open:()=>{currentApi.set({album:key,open:null,nativePhotoSelection:null});closeVideo();void loadAlbum(String(key),currentApi);}}));
    if(!albumsLoaded&&!albumsBusy)queueMicrotask(()=>{void loadCustomAlbums(currentApi);});
    data.tiles.push(...customAlbums.map(album=>({name:album.name,count:album.count,bg:'var(--s2)',tf:'',flt:'',open:()=>{currentApi.set({album:'custom:'+album.id,open:null,nativePhotoSelection:null});closeVideo();void loadAlbum('custom:'+album.id,currentApi);void loadCustomAlbums(currentApi);}})));
    data.albumManager=st.sheet==='owned-album'&&!!manager;
    if(manager){const selectedManager=manager;data.am={title:manager.confirmDelete?'Delete album?':manager.creating?'New album':manager.album?'Manage album':manager.choosing?'Add to album':'Photo info',name:manager.name,onName:(event:Event)=>{if(manager){manager.name=(event.target as HTMLInputElement).value;currentApi.set({nativeAlbumDraft:Date.now()});}},
      managing:!!manager.album,naming:!!manager.creating||!!manager.album&&!manager.confirmDelete,info:!!manager.media&&!manager.creating&&!manager.choosing,description:manager.media?`${manager.media.width} × ${manager.media.height} · ${manager.media.kind==='video'?'Video':'Photo'} · ${browserMode?'saved in this browser':'saved to Android Photos'}`:'',choose:()=>{if(manager){manager.choosing=true;currentApi.set({nativeAlbumDraft:Date.now()});}},choosing:!!manager.media&&!!manager.choosing&&!manager.creating,confirming:!!manager.confirmDelete,error:st.nativeAlbumsError||'',busy:mutating,
      items:customAlbums.map(album=>({name:album.name,label:(album.memberIds.includes(nativeId(manager?.media?.id||''))?'Remove from ':'Add to ')+album.name,go:()=>{void mutateAlbum(currentApi,album.memberIds.includes(nativeId(selectedManager.media?.id||''))?'remove':'add',album);}})),
      create:()=>{if(manager){manager.creating=true;manager.name='';currentApi.set({nativeAlbumDraft:Date.now()});}},save:()=>{void mutateAlbum(currentApi,selectedManager.creating?'create':'rename');},askDelete:()=>{if(manager){manager.confirmDelete=true;currentApi.set({nativeAlbumDraft:Date.now()});}},delete:()=>{void mutateAlbum(currentApi,'delete');},close:()=>{manager=undefined;currentApi.set({sheet:null});}};}
    if(selection){data.hdr=false;data.selecting=true;data.selN=selection.length?String(selection.length):'Select';data.selNone=!selection.length;data.selDim=!selection.length||sharing||mutating?'opacity:.35;pointer-events:none':'';data.selCancel=()=>{selection=undefined;swallowedTap='';endHold();currentApi.set({nativeMultiSelection:Date.now()});};data.selShare=()=>{void shareSelection(currentApi);};data.selFav=()=>{void changeSelection(currentApi,'favorite');};data.selDel=()=>{void changeSelection(currentApi,'trash');};}
    data.mutationBusy = mutating;
    data.emptyOpen = st.sheet==='empty' && !!prepared;
    data.trashCount = prepared ? `${prepared.count} app-owned ${prepared.count===1?'item':'items'} · This cannot be undone.` : '';
    const priorCloseSheet = data.closeSheet; data.closeSheet=()=>{if(st.sheet==='empty')cancelPermanent(currentApi);else if(st.sheet==='owned-album'){manager=undefined;currentApi.set({sheet:null});}else priorCloseSheet?.();};
    data.openTrash = () => { currentApi.set({ album: 'trash', open: null, nativePhotoSelection: null }); closeVideo(); void loadTrash(currentApi); };
    data.emptyNow = () => { void deletePermanent(currentApi); };
    data.trashAsk = () => { void preparePermanent(currentApi); };
    if (st.album === 'trash') {
      data.album = true; data.viewing = false; data.viewEmpty = false;
      data.alb = { title: 'Recently deleted', isTrash: true, notTrash: false, count: data.trashN, empty: !trash.length,
        close: () => currentApi.set({ album: null }), emptyTrash: () => { void preparePermanent(currentApi); },
        status: st.nativeTrashError || st.nativeTrashMutationStatus || (trashLoading ? 'Loading…' : ''), more: !!trashNext || !!st.nativeTrashError,
        moreLabel: st.nativeTrashError ? 'Retry' : trashLoading ? 'Loading…' : 'Load more', loadMore: () => { void loadTrash(currentApi, !st.nativeTrashError); },
        items: trash.map(row => ({ nativeMediaId: row.id, bg: row.image ? `url("${row.image}") center / cover no-repeat` : 'var(--s2)', tf: '', flt: '', vid: row.kind === 'video', dur: '', selecting: false, on: false, dim: mutating ? 'opacity:.35;pointer-events:none' : 'opacity:.6',
          alt: `Restore captured ${row.kind === 'video' ? 'video' : 'photo'} ${new Date(row.date).toLocaleTimeString()}${row.expiresAt ? '; Android expiration ' + new Date(row.expiresAt).toLocaleDateString() : ''}`,
          tap: () => { void changeTrash(row, false, currentApi); }, pd: () => {}, pu: () => {} })) };
    }
    if (st.album === 'fav' || st.album === 'video' || st.album?.startsWith('custom:')) {
      if(albumKey !== st.album){albumRows=[];albumNext='';queueMicrotask(()=>{void loadAlbum(st.album,currentApi);});}
      data.album=true;data.alb={title:st.album.startsWith('custom:')?(customAlbums.find(row=>'custom:'+row.id===st.album)?.name||'Album'):st.album==='fav'?'Favorites':'Videos',isCustom:st.album.startsWith('custom:'),manage:()=>{const album=customAlbums.find(row=>'custom:'+row.id===st.album);if(album)openAlbumManager(currentApi,undefined,album);},isTrash:false,notTrash:true,count:st.album.startsWith('custom:')?(customAlbums.find(row=>'custom:'+row.id===st.album)?.count??'…'):counts?(st.album==='fav'?counts.favorites:counts.videos):'…',empty:!albumRows.length,
        close:()=>currentApi.set({album:null}),status:st.nativeAlbumError||(albumBusy?'Loading…':''),more:!!albumNext||!!st.nativeAlbumError,moreLabel:st.nativeAlbumError?'Retry':albumBusy?'Loading…':'Load more',loadMore:()=>{void loadAlbum(st.album,currentApi,!st.nativeAlbumError);},
        items:albumRows.map(row=>({nativeMediaId:row.id,bg:row.image?`url("${row.image}") center / cover no-repeat`:'var(--s2)',tf:'',flt:'',vid:row.kind==='video',dur:'',dim:'',alt:`${row.kind==='video'?'Captured video':'Captured photo'} ${new Date(row.date).toLocaleTimeString()}`,...thumbnailEvents(row,currentApi)}))};
    }
    data.libraryLoading = !loaded || loading;
    data.libraryMore = !!next && !st.searching && !st.filter;
    data.libraryMoreLabel = loading ? 'Loading…' : 'Load more photos';
    data.libraryLoadMore = () => { if (next) void refresh(true); };
    data.libraryError = st.nativeLibraryError || '';
    data.libraryRetry = () => { void refresh(); };
    const bg = (c: typeof captures[number]) => `url("${c.image}") center / cover no-repeat`;
    if (captures.length && !st.searching && !st.filter) data.groups = [{ label: 'Captured on this device', place: '', items: captures.map(c => ({ nativeMediaId: c.id, bg: bg(c), tf: '', flt: '', vid: c.kind === 'video', dur: c.duration ? `${Math.floor(c.duration / 60)}:${String(Math.floor(c.duration % 60)).padStart(2, '0')}` : '', fav: !!c.favorite, dim: '', alt: (c.kind === 'video' ? 'Captured video ' : 'Captured photo ') + new Date(c.date).toLocaleTimeString(), ...thumbnailEvents(c,currentApi) })) }, ...(data.groups || [])];
    const selected = preview?.id === st.open ? preview : captures.find(c => c.id === st.open);
    if (selected) {
      if (!st.nativePhotoSelection && preview?.id !== st.open) queueMicrotask(() => { if (currentApi.get('photos').open === selected.id) void openSaved(selected.id, currentApi); });
      data.viewing = true; data.viewEmpty = false; data.editing = !!edit&&edit.source===selected.id;
      data.v = { bg: bg(selected), tf: '', flt: '', slide: '', day: selected.kind === 'video' ? 'Captured video' : 'Captured photo', sub: `${selected.width} × ${selected.height} · ${browserMode?'saved in this browser':'saved to Android Photos'}`, chromeOp: 1, chromePE: 'auto', favIcon: selected.favorite ? 'fill:currentColor' : 'fill:none', favLabel: selected.favorite ? 'Remove from favorites' : 'Favorite', vid: selected.kind === 'video', playing: !!video && !video.paused, playBtn: selected.kind === 'video' && (!video || video.paused), prog: `width:${video?.duration ? Math.min(100, video.currentTime / video.duration * 100) : 0}%`, play: () => { void playVideo(selected, currentApi); }, pause: () => { video?.pause(); currentApi.set({ nativePlaybackRevision: Date.now() }); }, notSecure: true, tap: () => {}, down: () => {}, up: () => {}, share: async () => {
        if(sharing || mutating)return;
        sharing=true;
        try { const result=await library.share({id:nativeId(selected.id)}); if(result.status!=='opened')currentApi.toast(result.message||'Sharing could not open.'); }
        catch { currentApi.toast('This photo is no longer available for sharing.'); }
        finally { sharing=false; }
      }, fav: () => { void favorite(selected,currentApi); }, edit: () => {void beginEdit(selected,currentApi);}, del: () => { void changeTrash(selected, true, currentApi); }, info: () => openAlbumManager(currentApi,selected), ask: () => currentApi.assist('You can ask Alpha here. This photo stays selected, but image analysis is not connected and its pixels are not shared.') };
      if(edit?.source===selected.id){const current=edit;data.v.ed={bg:`url("${current.image}") center / contain no-repeat`,tf:'',flt:'none',cropOn:current.crop,cropCss:current.crop?'background:#ffffff;color:#000000':'background:rgba(255,255,255,.12);color:#ffffff',status:current.uncertain?'Save outcome unresolved. Save checks the existing operation; it never creates another copy.':`Saves a new copy · original unchanged${current.reduced?' · reduced to '+current.maxEdge+' px maximum':''}. Crop trims the center at 1.3×.`,saveDisabled:current.busy,rotate:()=>void transformEdit(currentApi,true),crop:()=>void transformEdit(currentApi,false),cancel:()=>{cancelEdit();currentApi.set({nativeEditRevision:Date.now()});},save:()=>void saveEdit(currentApi),filters:[['none','Original'],['vivid','Vivid'],['warm','Warm'],['cool','Cool'],['mono','Mono'],['fade','Fade'],['noir','Noir']].map(([id,label])=>({label,bg:`url("${selected.image}") center / cover no-repeat`,flt:({none:'none',vivid:'saturate(1.55) contrast(1.08)',warm:'sepia(.3) saturate(1.35) hue-rotate(-8deg)',cool:'saturate(1.1) hue-rotate(14deg) brightness(1.03)',mono:'grayscale(1) contrast(1.05)',fade:'contrast(.78) brightness(1.12) saturate(.75)',noir:'grayscale(1) contrast(1.55) brightness(.88)'} as Record<string,string>)[id],on:current.filter===id,ring:current.filter===id?'box-shadow:0 0 0 2px #000,0 0 0 4px #fff':'',lc:current.filter===id?'#fff':'rgba(255,255,255,.6)',pick:()=>void transformEdit(currentApi,false,id)}))};}
    }
    return data;
  };
  if (views.photos) views.photos.back = (st: Bag, currentApi: Bag) => { if(edit){cancelEdit();currentApi.set({nativeEditRevision:Date.now()});return true;}if(selection){selection=undefined;endHold();currentApi.set({nativeMultiSelection:Date.now()});return true;}if(st.sheet==='owned-album'){manager=undefined;currentApi.set({sheet:null});return true;}if(st.sheet==='empty'){cancelPermanent(currentApi);return true;}if(st.sheet)return photosBack?.(st,currentApi); if (preview?.id === st.open || captures.some(c => c.id === st.open) || albumRows.some(c => c.id === st.open)) { currentApi.set({ open: null, nativePhotoSelection: null }); preview = undefined; closeVideo(); return true; } return photosBack?.(st, currentApi); };
  if(views.photos)views.photos.onLeave=(owner:Bag)=>{automaticEditRecovery='';selection=undefined;swallowedTap='';endHold();manager=undefined;const old=prepared;prepared=undefined;if(old)void library.cancelDeleteTrash({confirmation:old.confirmation}).catch(()=>{});owner.set({sheet:null});photosLeave?.(owner);};
  async function playVideo(selected: SavedPhoto, owner: Bag) {
    if (selected.kind !== 'video') return;
    try {
      // Read verifies published MediaStore ownership before returning its local URI.
      const row = preview?.id === selected.id ? preview : normalize(await library.read({ id: nativeId(selected.id) }));
      if (!row.path || owner.get('photos').open !== selected.id || !owner.isActive()) return;
      if (videoId !== selected.id) {
        closeVideo(); video = document.createElement('video'); videoId = selected.id;
        video.dataset.alphaCapturedVideo = selected.id; video.playsInline = true; video.preload = 'metadata';
        video.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none;background:#000';
        video.src = row.path;
        video.setAttribute('type', 'video/mp4');
        const update = () => { if (owner.isActive() && owner.get('photos').open === selected.id) owner.set({ nativePlaybackRevision: Date.now() }); };
        video.onplay = update; video.onpause = update; video.ontimeupdate = update; video.onended = update;
        video.onerror = () => { closeVideo(); owner.toast('This saved video could not be played.'); update(); };
      }
      mountVideo(); await video?.play();
    } catch { owner.toast('Video playback could not start. Tap Play to retry.'); }
  }
  function mountVideo() {
    if (!video) return;
    const owner = photosApi;
    if (document.hidden || !owner?.isActive() || owner.get('photos').open !== videoId || ['sheet', 'full'].includes(owner.S.chat)) { closeVideo(); return; }
    const frame = document.querySelector('[aria-label="Photo. Tap to show or hide controls, swipe to browse"] > span');
    if (frame && video.parentElement !== frame) frame.insertBefore(video, frame.firstElementChild?.nextSibling ?? null);
  }
  let polling = false;
  const timer = window.setInterval(async () => {
    if (!recording || polling || finalizing) return;
    polling = true;
    try { const state = await camera.getRecordingState(); if (recording) { duration = state.duration; if (!state.isRecording) void finishVideo(); else api?.set({ nativeRecordingTick: duration }); } }
    catch { if (recording) void finishVideo(); }
    finally { polling = false; }
  }, 500);
  let queued = false;
  const sync = () => { queued = false;if(edit&&(!photosApi?.isActive()||photosApi.get('photos').open!==edit.source))cancelEdit(); mountVideo(); if (active()) { if (phase === 'off') void start(); else if (phase === 'ready') mask(true); } else if (phase !== 'off') void stop(); };
  const schedule = () => { if (!queued && !disposed) { queued = true; requestAnimationFrame(sync); } };
  const observer = new MutationObserver(schedule); observer.observe(document.body, { childList: true, subtree: true });
  const resize = () => { if (phase === 'ready') mask(true); schedule(); };
  const visibility = () => { if (document.hidden) { cancelEdit();closeVideo(); void stop(); } else { loaded = false; if (photosApi?.isActive()) void refresh(); schedule(); } };
  document.addEventListener('visibilitychange', visibility); window.addEventListener('pagehide', stop); window.addEventListener('resize', resize); schedule();
  return () => { if(scanApi&&prototype.api===scanApi)prototype.api=originalApi;disposed = true;cancelEdit();endHold();selection=undefined; clearInterval(timer); closeVideo(); observer.disconnect(); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', stop); window.removeEventListener('resize', resize); void stop(); style.remove(); captures = []; module.render = render; module.onLeave = leave; module.back = cameraBack; if (views.photos) { views.photos.render = photosRender; views.photos.back = photosBack; views.photos.onLeave = photosLeave; } };
}
