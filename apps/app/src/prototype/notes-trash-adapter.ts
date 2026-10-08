import {
 addNotesTrashEntry,editNotesTrash,notesTrashDaysLabel,planNotesTrash,readNotesTrash,removeNotesTrashEntries,
 restoreNotesTrashEntry,savedNoteIds,sortedNotesTrash,withNotesDeletionLock,type NotesTrashEntry,
} from '../runtime/notes-trash';
type Bag=Record<string,any>;
type Shell=any;
const kindLabel:Record<string,string>={text:'Note',list:'Checklist',voice:'Voice note',link:'Link'};

/**
 * Deleted notes go to a durable Trash and are erased three days after deletion.
 * Maintenance (drop rows whose note is live again, purge expired rows) runs at startup
 * and whenever Notes opens. It is idempotent and reads authoritative storage only.
 */
export function installNotesTrashAdapter(Component:Shell,views:Record<string,Bag>){
 const notes=views.notes,render=notes.render,back=notes.back;
 const p=Component.prototype,originalApi=p.api,originalMount=p.componentDidMount,originalUnmount=p.componentWillUnmount;
 let busy=false,maintaining:Promise<unknown>|null=null;

 const ready=(shell:Shell)=>shell.live&&shell.notesStore&&!shell.notesStorageFailed&&!shell.notesPending;
 const voice=(shell:Shell)=>shell.api('notes') as Bag;
 async function purge(shell:Shell,entry:NotesTrashEntry){
  // Caller holds the deletion-effects lock. A recording is erased before its row disappears.
  if(!entry.audio)return true;
  const hook=voice(shell).purgeTrashedVoice;
  return typeof hook==='function'?!!await hook(entry):false;
 }
 async function load(shell:Shell){
  try{const doc=await readNotesTrash();if(shell.live)shell.vset('notes',{trash:sortedNotesTrash(doc),trashError:''});}
  catch{if(shell.live)shell.vset('notes',{trash:[],trashError:'Trash could not be read. Nothing in it was deleted.'});}
 }
 /** Idempotent: a second run with the same clock finds nothing to do. */
 async function maintain(shell:Shell,now=Date.now()){
  const doc=await readNotesTrash();
  if(doc.entries.length){
   const plan=planNotesTrash(doc,await savedNoteIds(),now);
   // Only take the shared deletion lock when there is work, so idle opens never queue behind a deletion.
   if(plan.stale.length||plan.expired.length)await withNotesDeletionLock(async()=>{
    const current=planNotesTrash(await readNotesTrash(),await savedNoteIds(),now),drop=current.stale.map(entry=>entry.id);
    for(const entry of current.expired){try{if(await purge(shell,entry))drop.push(entry.id);}catch{/* Retained; retried next time. */}}
    if(drop.length)await editNotesTrash(value=>removeNotesTrashEntries(value,drop));
   });
  }
  await load(shell);
 }
 function runMaintenance(shell:Shell){
  if(maintaining)return maintaining;
  maintaining=maintain(shell).catch(()=>load(shell)).finally(()=>{maintaining=null;});
  return maintaining;
 }

 async function moveToTrash(shell:Shell,note:Bag,index:number){
  if(!ready(shell)){shell.toast(shell.notesPending&&!shell.notesStorageFailed?'Still saving. Try again in a moment. Nothing was deleted.':'Notes storage needs recovery. Nothing was deleted.');return false;}
  let entry:NotesTrashEntry|undefined;
  try{
   const saved=await withNotesDeletionLock(async()=>{
    if(!ready(shell))throw Error('Notes changed');
    const stored=shell.notesStore.list.find((n:Bag)=>n.id===note.id);
    if(JSON.stringify(stored)!==JSON.stringify(note))throw Error('Note changed');
    entry={id:crypto.randomUUID(),note:stored,target:await shell.notesStore.target(note.id),index,deletedAt:Date.now()};
    // Write-ahead: the restorable copy is durable before the note leaves the saved list.
    await editNotesTrash(doc=>addNotesTrashEntry(doc,entry!));
    const list=shell.vget('notes').list.filter((n:Bag)=>n.id!==note.id);
    return await shell.vset('notes',{list,open:null,sheet:null,playing:false,dict:false})===true;
   });
   if(!saved)return false;
  }catch{shell.toast('Could not move this note to Trash. Nothing was deleted.');return false;}
  void load(shell);
  shell.toast(`${note.title||kindLabel[note.kind]||'Note'} moved to Trash`,{undo:()=>void restore(shell,entry!.id)});
  return true;
 }

 async function restore(shell:Shell,id:string){
  if(busy)return;busy=true;shell.vset('notes',{trashBusy:true});
  try{
   const entry=(await readNotesTrash()).entries.find(x=>x.id===id);
   if(!entry){shell.toast('This note is no longer in Trash.');return;}
   if(entry.audio){
    // The recording follows its note through the reviewed voice restore path.
    const hook=voice(shell).restoreTrashedVoice;
    if(typeof hook==='function')await hook(entry);else shell.toast('Voice restore is unavailable. The note stays in Trash.');
    return;
   }
   const restored=await withNotesDeletionLock(async()=>{
    if(!ready(shell))throw Error('Notes storage needs recovery');
    const current=(await readNotesTrash()).entries.find(x=>x.id===id);
    if(!current)return 'gone';
    if((await savedNoteIds()).has(current.note.id)){await editNotesTrash(doc=>removeNotesTrashEntries(doc,[id]));return 'live';}
    const list=restoreNotesTrashEntry(shell.notesStore.list,current);
    if(await shell.vset('notes',{list},{exact:true})!==true)throw Error('Restore unconfirmed');
    await editNotesTrash(doc=>removeNotesTrashEntries(doc,[id]));
    return 'restored';
   });
   shell.toast(restored==='restored'?`${entry.note.title||kindLabel[entry.note.kind]||'Note'} restored`:restored==='live'?'This note is already in Notes.':'This note is no longer in Trash.');
  }catch{shell.toast('Restore is unconfirmed. Reopen Notes to check Trash. No newer note was replaced.');}
  finally{busy=false;if(shell.live)shell.vset('notes',{trashBusy:false});await load(shell);}
 }

 async function erase(shell:Shell,ids:'all'|string){
  if(busy)return;busy=true;shell.vset('notes',{trashBusy:true,trashConfirm:null});
  let failed=0,count=0;
  try{
   await withNotesDeletionLock(async()=>{
    const entries=(await readNotesTrash()).entries.filter(entry=>ids==='all'||entry.id===ids),drop:string[]=[];
    for(const entry of entries){try{if(await purge(shell,entry))drop.push(entry.id);else failed++;}catch{failed++;}}
    if(drop.length)await editNotesTrash(doc=>removeNotesTrashEntries(doc,drop));
    count=drop.length;
   });
   shell.toast(failed?`${failed} item(s) could not be deleted yet. They stay in Trash.`:ids==='all'?'Trash emptied':count?'Deleted forever':'This note is no longer in Trash.');
  }catch{shell.toast('Permanent deletion is unconfirmed. Reopen Trash to check.');}
  finally{busy=false;if(shell.live)shell.vset('notes',{trashBusy:false});await load(shell);}
 }

 p.api=function(key:string){
  const api=originalApi.call(this,key);
  // Installed only for live Notes (never fixtures), so deletion never falls back to an in-memory remove.
  if(key==='notes'){
   const shell=this;
   api.moveNoteToTrash=(note:Bag,index:number)=>moveToTrash(shell,note,index);
   api.notesTrash={restore:(id:string)=>restore(shell,id),erase:(ids:'all'|string)=>erase(shell,ids),maintain:()=>runMaintenance(shell)};
  }
  return api;
 };
 p.componentDidMount=function(...args:unknown[]){
  const result=originalMount?.apply(this,args);
  // Startup purge, once saved Notes are open. Restarts simply repeat it.
  void Promise.resolve(this.notesReady).then(()=>{if(this.live&&!this.notesStorageFailed)return runMaintenance(this);}).catch(()=>{});
  this.notesTrashChanged=()=>{if(this.live)void load(this);};
  window.addEventListener('alpha:notes-trash-changed',this.notesTrashChanged);
  return result;
 };
 p.componentWillUnmount=function(...args:unknown[]){
  window.removeEventListener('alpha:notes-trash-changed',this.notesTrashChanged);
  return originalUnmount?.apply(this,args);
 };

 notes.back=(state:Bag,api:Bag)=>{
  if(state.trashConfirm){api.set({trashConfirm:null});return true;}
  if(state.trashOpen){api.set({trashOpen:false});return true;}
  return back(state,api);
 };
 notes.render=(state:Bag,api:Bag)=>{
  const view=render(state,api),trash=api.notesTrash as Bag|undefined;
  view.trashAvailable=!!trash;
  if(!trash)return view;
  // Notes opened: purge due entries. Navigation resets this flag, so every open checks again.
  if(!state.trashChecked){queueMicrotask(()=>{api.set({trashChecked:true});void trash.maintain();});}
  const rows:NotesTrashEntry[]=state.trash||[],now=Date.now(),disabled=!!state.trashBusy;
  view.openTrash=()=>{api.set({trashOpen:true,open:null,sheet:null,q:null,trashConfirm:null});void trash.maintain();};
  view.closeTrash=()=>api.set({trashOpen:false,trashConfirm:null});
  view.trashOpen=!!state.trashOpen;
  view.trashLabel=rows.length?`Trash, ${rows.length} item${rows.length===1?'':'s'}`:'Trash';
  view.trashRows=rows.map(entry=>{
   const title=entry.note.title||'Untitled';
   return {id:entry.id,title,kind:kindLabel[entry.note.kind]||'Note',left:notesTrashDaysLabel(entry,now),
    restoreLabel:`Restore ${title}`,deleteLabel:`Delete ${title} forever`,disabled,
    restore:()=>void trash.restore(entry.id),
    erase:()=>api.set({trashConfirm:{id:entry.id,title}})};
  });
  view.trashNone=!rows.length;
  view.trashError=state.trashError||'';
  view.trashEmptyDisabled=disabled||!rows.length;
  view.trashBusy=disabled;
  view.emptyTrash=()=>api.set({trashConfirm:{id:'all'}});
  const confirm=state.trashConfirm as Bag|null;
  view.trashConfirmOpen=!!confirm&&!!state.trashOpen;
  view.trashConfirmTitle=confirm?.id==='all'?'Empty Trash?':'Delete forever?';
  view.trashConfirmText=confirm?.id==='all'?`${rows.length} item${rows.length===1?'':'s'} will be deleted permanently. This cannot be undone.`:`“${confirm?.title||'This note'}” will be deleted permanently. This cannot be undone.`;
  view.trashConfirmLabel=confirm?.id==='all'?'Confirm empty Trash':'Confirm delete forever';
  view.trashConfirmText2=confirm?.id==='all'?'Empty Trash':'Delete forever';
  view.trashCancel=()=>api.set({trashConfirm:null});
  view.trashConfirmGo=()=>{if(confirm)void trash.erase(confirm.id);};
  return view;
 };
}
