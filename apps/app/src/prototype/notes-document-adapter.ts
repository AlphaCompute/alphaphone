import {registerPlugin} from '@capacitor/core';
type Bag=Record<string,any>;
const documents=registerPlugin<{importText():Promise<{status:string;message:string;text?:string;name?:string}>;exportText(input:{title:string;text:string}):Promise<{status:string;message:string}>}>('AlphaNoteDocuments');
/** Explicit user-selected text only; existing Notes persistence owns conflict/readback checks. */
export function installNotesDocumentAdapter(Component:any,views:Record<string,Bag>){
 const notes=views.notes,render=notes.render,leave=notes.onLeave;let busy=false,epoch=0;
 const originalApi=Component.prototype.api;
 Component.prototype.api=function(key:string){const api=originalApi.call(this,key);if(key==='notes')api.saveImportedNote=async(patch:Bag)=>await this.vset('notes',patch)===true;return api;};
 notes.onLeave=(api:Bag)=>{epoch++;leave?.(api);};
 notes.render=(state:Bag,api:Bag)=>{
  const view=render(state,api);
  const perform=async(task:()=>Promise<any>,apply:(value:any)=>void|Promise<void>)=>{if(busy){api.toast('Finish the current document selection first.');return;}const token=epoch;busy=true;api.set({noteDocumentBusy:true});try{const value=await task();if(token!==epoch||!api.isActive())return;await apply(value);}catch{if(token===epoch)api.toast('Document operation failed. No completed export or import is confirmed.');}finally{busy=false;api.set({noteDocumentBusy:false});}};
  view.importText=()=>void perform(()=>documents.importText(),async value=>{
   if(value.status!=='read'||typeof value.text!=='string'){api.toast(value.message);return;}
   const current=api.get('notes'),id=crypto.randomUUID();if(current.list.length>=10000){api.toast('Notes is full. Nothing imported.');return;}
   const note={id,kind:'text',title:String(value.name||'Imported note').replace(/\.(txt|md|markdown)$/i,'').slice(0,200),body:value.text,pinned:false,when:'Imported on this device'};
   if(await api.saveImportedNote({list:[note,...current.list],open:id,sheet:null}))api.toast('Imported as a new note. Nothing uploaded.');
  });
  view.canImportText=true;view.documentBusy=busy;
  const selected=state.list?.find((n:Bag)=>n.id===state.open);
  view.canExportText=!!selected&&selected.kind==='text';
  view.exportText=()=>{const current=api.get('notes'),note=current.list.find((n:Bag)=>n.id===current.open);if(!note||note.kind!=='text'){api.toast('Only plain text notes can be exported here.');return;}const snapshot={title:String(note.title||'Note'),text:String(note.body||'')};void perform(()=>documents.exportText(snapshot),value=>api.toast(value.message));};
  return view;
 };
}
