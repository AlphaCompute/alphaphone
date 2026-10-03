import { Capacitor } from '@capacitor/core';
import { registerPlugin } from '../platform-plugins';
import { DailyApps, type NativeResult } from '../daily';
type Bag=Record<string,any>;
type Entry={id:string;parentId?:string;name:string;mimeType:string;directory:boolean;size:number;revision:string;canCreate:boolean;canRename:boolean;canDelete:boolean;canMove:boolean};
type Listing={status:string;message:string;folder?:Entry;entries?:Entry[];rootId?:string;entry?:Entry};
const tree=registerPlugin<{
 importFolder():Promise<Listing>;choose():Promise<Listing>;list(input:{id?:string}):Promise<Listing>;
 createFolder(input:{id:string;name:string}):Promise<Listing>;
 rename(input:{id:string;name:string;expectedRevision:string}):Promise<Listing>;
 delete(input:{id:string;expectedRevision:string;confirmPermanent:true}):Promise<Listing>;
 move(input:{id:string;destinationId:string;expectedRevision:string}):Promise<Listing>;
 changeMany(input:{items:{id:string;expectedRevision:string}[];action:'move'|'delete';destinationId?:string;confirmPermanent?:boolean}):Promise<Listing>;
 shareMany(input:{items:{id:string;expectedRevision:string}[]}):Promise<Listing>;
 select(input:{id:string}):Promise<NativeResult>;forget():Promise<Listing>;
}>('AlphaFiles');
const FOLDER='M3 7h7l2 2h9v11H3zM3 7V4h7l2 3';
const FILE='M6 3h8l4 4v14H6zM14 3v5h4';
/** Exact existing Files rows/menu/preview; tree mutations require explicit UI. */
export function installFilesTreeAdapter(views:Bag,accept:(module:string,result:NativeResult,api:Bag)=>Promise<void>,clearSelected:()=>void){
 const module=views.files,render=module.render,back=module.back,leave=module.onLeave;
 let listing:Listing|undefined,api:Bag|undefined,busy=false,status='',generation=0,selected:Entry|undefined,selectedCapability:string|undefined;
 let selecting=false,picked=new Set<string>();
 const resetSelection=()=>{selecting=false;picked.clear();};
 let dialog:{entries?:Entry[];kind:'create'|'rename'|'delete'|'move';entry?:Entry;name:string;folder?:Entry;rows?:Entry[];error?:string}|undefined;
 const repaint=()=>api?.set({nativeTreeRevision:++generation});
 const visible=()=>api?.get('files').folder==='__native_tree';
 const apply=(value:Listing)=>{if(value.status==='ready'){listing=value;resetSelection();status=value.message.includes('250')?value.message:'';}else{status=value.message;if(value.status==='revoked'||value.status==='unavailable'){listing=undefined;selected=undefined;selectedCapability=undefined;clearSelected();api?.set({open:null});}}repaint();};
 async function load(id?:string){if(busy)return;busy=true;status='Loading folder…';repaint();try{apply(await tree.list({id}));}catch{status='Folder provider unavailable. Choose the folder again.';}finally{busy=false;repaint();}}
 async function choose(importFolder=false){if(busy)return;busy=true;try{const value=await (importFolder ? tree.importFolder() : tree.choose());if(value.status==='ready'){clearSelected();selected=undefined;selectedCapability=undefined;apply(value);api?.set({folder:'__native_tree',open:null,menu:false});}else if(value.status!=='cancelled')api?.toast(value.message);}catch{api?.toast('Folder selection unavailable.');}finally{busy=false;repaint();}}
 async function openEntry(entry:Entry){if(busy)return;if(entry.directory){void load(entry.id);return;}busy=true;try{const value=await tree.select({id:entry.id});if(value.status==='selected'){if(!api?.isActive()){if(value.selectionId)await DailyApps.forgetSelected({selectionId:value.selectionId});return;}selected=entry;selectedCapability=value.selectionId;await accept('files',value,api!);}else api?.toast(value.message||'File unavailable. Refresh this folder.');}catch{api?.toast('This file could not open. Refresh the folder.');}finally{busy=false;repaint();}}
 const beginDialog=(kind:'create'|'rename'|'delete'|'move',entry?:Entry)=>{
  if(busy)return;dialog={kind,entry,name:kind==='rename'?entry?.name||'':'',folder:listing?.folder,rows:listing?.entries?.filter(e=>e.directory)};api?.set({menu:false});repaint();
 };
 async function mutation(){
  const request=dialog,folder=listing?.folder;if(!request||!folder||busy)return;
  if(request.kind==='move'&&(!request.folder?.canCreate||request.folder.id===request.entry?.parentId))return;
  if(['create','rename'].includes(request.kind)&&!request.name.trim()){api?.toast('Enter a name.');return;}
  busy=true;repaint();
  try{
   const entry=request.entry;
   const value=request.entries&&['move','delete'].includes(request.kind)?await tree.changeMany({items:request.entries.map(e=>({id:e.id,expectedRevision:e.revision})),action:request.kind as 'move'|'delete',destinationId:request.folder?.id,confirmPermanent:request.kind==='delete'}):request.kind==='create'?await tree.createFolder({id:folder.id,name:request.name}):request.kind==='rename'&&entry?await tree.rename({id:entry.id,name:request.name,expectedRevision:entry.revision}):request.kind==='delete'&&entry?await tree.delete({id:entry.id,expectedRevision:entry.revision,confirmPermanent:true}):request.kind==='move'&&entry&&request.folder?await tree.move({id:entry.id,destinationId:request.folder.id,expectedRevision:entry.revision}):{status:'unsupported',message:'Choose a supported action.'};
   if(!['created','renamed','deleted','moved'].includes(value.status)){request.error=value.message;api?.toast(value.message);return;}
   dialog=undefined;api?.toast(value.message);
   const wasPreview=selected?.id===entry?.id;
   if(wasPreview){clearSelected();selected=undefined;api?.set({open:null});}
   let target=folder.id;
   if(request.kind==='delete'&&entry?.id===folder.id)target=folder.parentId!;
   apply(await tree.list({id:target}));
  }catch(error){request.error=error instanceof Error?error.message:'Refresh the folder and try again.';api?.toast(request.error);}
  finally{busy=false;repaint();}
 }
 async function moveFolder(id?:string){if(!dialog||dialog.kind!=='move'||busy)return;busy=true;dialog={...dialog,folder:undefined,rows:[],error:undefined};repaint();try{const value=await tree.list({id});if(value.status==='ready'&&dialog?.kind==='move'){dialog={...dialog,folder:value.folder,rows:value.entries?.filter(e=>e.directory)};}else api?.toast(value.message);}catch{api?.toast('Destination folder unavailable.');}finally{busy=false;repaint();}}
 module.render=(state:Bag,currentApi:Bag)=>{
  api=currentApi;const out=render(state,currentApi);
  out.locs=[...(out.locs||[]),{nativeTree:true,name:Capacitor.isNativePlatform()?'Choose folder':'Browser files',d:FOLDER,sub:Capacitor.isNativePlatform()?'Android folder access':'Browser files',go:()=>choose()}];
  if(!Capacitor.isNativePlatform())out.locs.push({nativeTree:true,name:'Import folder',d:FOLDER,sub:'Copy files into browser storage',go:()=>choose(true)});
  if(!listing)out.locs.push({nativeTree:true,name:'Saved folder',d:FOLDER,sub:'Restore selected access',go:()=>{currentApi.set({folder:'__native_tree'});void load();}});
  else out.locs.push({nativeTree:true,name:listing.folder?.name||'Selected folder',d:FOLDER,sub:'Browse selected folder',go:()=>{currentApi.set({folder:'__native_tree'});void load(listing?.folder?.id);}});
  if(state.folder==='__native_tree'){
   const folder=listing?.folder,rows=listing?.entries||[];
   out.top=false;out.inFolder=true;out.notSel=!selecting;out.isSel=selecting;out.isList=!state.grid;out.isGrid=!!state.grid;out.nativeTreeStatus=status;
   const pickedRows=()=>rows.filter(e=>picked.has(e.id));
   const batchDialog=(kind:'move'|'delete')=>{const entries=pickedRows();if(!entries.length||busy)return;beginDialog(kind);if(dialog)dialog.entries=entries;repaint();};
   out.selCount=String(picked.size);out.selOp=picked.size?'1':'.4';out.exitSel=()=>{resetSelection();repaint();};out.selAll=()=>{picked=new Set(picked.size===rows.length?[]:rows.map(e=>e.id));repaint();};out.selMove=()=>batchDialog('move');out.selDel=()=>batchDialog('delete');out.selShare=async()=>{if(busy||!picked.size)return;busy=true;repaint();try{const value=await tree.shareMany({items:pickedRows().map(e=>({id:e.id,expectedRevision:e.revision}))});currentApi.toast(value.message);}catch(error){currentApi.toast(error instanceof Error?error.message:'Selection could not be downloaded.');}finally{busy=false;repaint();}};
   const close=()=>{if(busy)return;if(folder?.parentId)void load(folder.parentId);else{dialog=undefined;currentApi.set({folder:null,open:null,menu:false});}};
   const menu=[{label:'Refresh folder',go:()=>{currentApi.set({menu:false});void load(folder?.id);}},...(folder?.canCreate?[{label:'New folder',go:()=>beginDialog('create')}]:[]),...(folder?.canRename?[{label:'Rename folder',go:()=>beginDialog('rename',folder)}]:[]),...(folder?.canDelete?[{label:'Delete empty folder',go:()=>beginDialog('delete',folder)}]:[]),{label:'Choose another folder',go:()=>choose()},{label:'Forget folder access',go:async()=>{if(busy)return;busy=true;try{const value=await tree.forget();if(value.status==='forgotten'){clearSelected();selected=undefined;listing=undefined;dialog=undefined;currentApi.set({folder:null,open:null,menu:false});}currentApi.toast(value.message);}catch{currentApi.toast('Folder access could not be released. Try again.');}finally{busy=false;repaint();}}}];
   out.fd={name:folder?.name||'Selected folder',empty:rows.length===0,close,viewIcon:FILE,openMenu:()=>currentApi.set({menu:true}),toggleView:()=>currentApi.set({grid:!state.grid}),viewLabel:state.grid?'Show as list':'Show as grid',sortLabel:'Sort by name',sortCss:'',toggleSort:()=>currentApi.set({sort:state.sort==='name'?'recent':'name'}),select:()=>{if(busy)return;if(Capacitor.isNativePlatform()){currentApi.toast('Open a file to move or delete it.');return;}selecting=true;picked.clear();repaint();},
    items:[...rows].sort((a,b)=>state.sort==='name'?a.name.localeCompare(b.name):0).map(e=>({id:e.id,name:e.name,sub:e.directory?'Folder':e.mimeType+(e.size>=0?` · ${e.size} bytes`:''),d:e.directory?FOLDER:FILE,isFile:!e.directory,isFolder:e.directory,selOn:selecting&&picked.has(e.id),selOff:selecting&&!picked.has(e.id),rowCss:'',label:(selecting?(picked.has(e.id)?'Deselect ':'Select '):'Open ')+e.name,tap:()=>{if(busy)return;if(selecting){picked.has(e.id)?picked.delete(e.id):picked.add(e.id);repaint();}else void openEntry(e);}})),menuRows:menu.map(m=>({...m,d:FOLDER,on:false}))};
   out.menuOpen=!!state.menu;out.closeMenu=()=>currentApi.set({menu:false});
  }
  if(selected&&selectedCapability===out.pv?.nativeSelectionId&&out.isPreview&&state.open==='__native_selected_document'){
   out.pv.move=()=>selected?.canMove?beginDialog('move',selected):currentApi.toast('This provider does not support moving this file.');
   out.pv.del=()=>selected?.canDelete?beginDialog('delete',selected):currentApi.toast('This provider does not support deleting this file.');
   out.pv.startRename=()=>selected?.canRename?beginDialog('rename',selected):currentApi.toast('This provider does not support renaming this file.');
  }
  if(dialog){const d=dialog;out.nativeTreeDialog={busy,confirmDisabled:busy||(d.kind==='move'&&(!d.folder?.canCreate||d.folder.id===d.entry?.parentId)),title:d.kind==='delete'?'Permanently delete?':d.kind==='move'?'Move file':d.kind==='rename'?'Rename':'New folder',message:d.error||(d.kind==='delete'?`${d.entries?d.entries.length+' selected items':d.entry?.name}. This cannot be undone. There is no integrated trash. Only empty folders can be deleted here.`:d.kind==='move'?`Destination: ${d.folder?.name||'Choose folder'}`:''),hasName:d.kind==='create'||d.kind==='rename',name:d.name,onName:(e:Event)=>{if(dialog)dialog.name=(e.target as HTMLInputElement).value;repaint();},moving:d.kind==='move',destinations:d.rows?.map(e=>({name:e.name,go:()=>moveFolder(e.id)}))||[],canUp:!!d.folder?.parentId,up:()=>moveFolder(d.folder?.parentId),canRoot:d.kind==='move',root:()=>moveFolder(),confirmLabel:busy?'Working…':d.kind==='delete'?'Delete permanently':d.kind==='move'?'Move here':d.kind==='rename'?'Rename':'Create folder',confirm:mutation,cancel:()=>{if(!busy){dialog=undefined;repaint();}}};}
  else out.nativeTreeDialog=null;
  return out;
 };
 module.back=(state:Bag,currentApi:Bag)=>{if(dialog){if(!busy){dialog=undefined;repaint();}return true;}if(selecting){resetSelection();repaint();return true;}if(state.open)return back?.(state,currentApi);if(visible()){if(busy)return true;if(state.menu){currentApi.set({menu:false});return true;}if(listing?.folder?.parentId)void load(listing.folder.parentId);else currentApi.set({folder:null});return true;}return back?.(state,currentApi);};
 module.onLeave=(...args:any[])=>{dialog=undefined;resetSelection();return leave?.(...args);};
}
