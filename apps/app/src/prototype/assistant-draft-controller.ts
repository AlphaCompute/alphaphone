import type {BrowserDomainDocument} from '../browser/domain-document';
import type {AssistantDraft} from '../runtime/assistant-draft-record';
type Store={recovery?:Pick<BrowserDomainDocument,'capture'|'reset'>;read():Promise<AssistantDraft|null>;save(expected:AssistantDraft|null,text:string):Promise<AssistantDraft>};
type Binding={key:string;store?:Store;record:AssistantDraft|null;last:string;ready:boolean;failed:boolean;queue:Promise<void>};
/** Product composer lifecycle. Queued writes keep their original conversation binding. */
export class AssistantDraftController {
 private active?:Binding;
 state={message:'Opening local draft…',opening:true,conflict:false,savedText:'',consuming:false,error:false};
 constructor(private factory:(key:string)=>Promise<Store>,private text:()=>string,private restore:(text:string)=>void,private changed:()=>void){}
 private publish(patch:Partial<typeof this.state>){this.state={...this.state,...patch};this.changed();}
 recovery(){return this.active?.store?.recovery;}
 retire(notify=true){this.active=undefined;this.state={message:'Opening local draft…',opening:true,conflict:false,savedText:'',consuming:false,error:false};if(notify)this.changed();}
 unavailable(){this.retire();this.publish({opening:false,conflict:false,consuming:false,error:true,message:'Local draft could not be opened. Your current text is retained.'});}
 async open(key:string){
  if(this.active?.key===key)return;
  const initial=this.text(),b:Binding={key,record:null,last:initial,ready:false,failed:false,queue:Promise.resolve()};this.active=b;
  this.publish({opening:true,conflict:false,consuming:false,error:false,message:'Opening local draft…'});
  try{
   b.store=await this.factory(key);b.record=await b.store.read();if(this.active!==b)return;
   b.ready=true;
   if(this.text()!==initial||initial!==''){
    if(b.record&&b.record.text!==this.text()){b.failed=true;this.publish({opening:false,conflict:true,savedText:b.record.text,message:'A saved draft is available. Review both copies.'});return;}
    b.last=b.record?.text??'';this.publish({opening:false,message:''});this.edit(this.text());
   }else{b.last=b.record?.text??'';this.restore(b.last);this.publish({opening:false,message:b.last?'Draft restored locally. Review before sending.':''});}
  }catch{if(this.active===b){b.failed=true;this.publish({opening:false,conflict:false,error:true,message:'Local draft could not be read. Your current text is retained.'});}}
 }
 edit(text:string){
  const b=this.active;if(!b||text===b.last)return;b.last=text;
  if(!b.ready||b.failed||this.state.consuming)return;
  this.publish({message:''});
  b.queue=b.queue.then(async()=>{
   if(b.failed)return;
   try{b.record=await b.store!.save(b.record,text);if(this.active===b&&b.last===text)this.publish({message:''});}
   catch{b.failed=true;if(this.active===b)await this.reviewConflict(b);}
  });
 }
 private async reviewConflict(b:Binding){
  try{const latest=await b.store!.read();if(this.active!==b)return;b.record=latest;this.publish({opening:false,conflict:true,error:false,savedText:latest?.text??'',message:'Draft was not saved. Review the saved copy before replacing it.'});}
  catch{if(this.active===b)this.publish({opening:false,conflict:false,error:true,message:'Draft was not saved. Your current text is retained.'});}
 }
 restoreSaved(){const b=this.active;if(!b?.ready||!this.state.conflict)return;b.failed=false;b.last=b.record?.text??'';this.restore(b.last);this.publish({conflict:false,message:b.last?'Saved draft restored. Review before sending.':''});}
 keepCurrent(){const b=this.active;if(!b?.ready||!this.state.conflict)return;b.failed=false;const text=this.text();b.last=b.record?.text??'';this.publish({conflict:false,error:false,message:''});this.edit(text);}
 async retry(){const key=this.active?.key;if(!key)return;this.retire();await this.open(key);}
 async consume(expectedText:string,current:()=>boolean=()=>true){
  const b=this.active;if(!b?.ready||b.failed||this.state.consuming)throw Error('Review local draft storage before sending.');
  this.edit(this.text());await b.queue;
  if(this.active!==b||b.failed||!current()||this.text().trim()!==expectedText)throw Error('The draft changed. Review it before sending.');
  const original=b.record?.text??this.text();
  this.publish({consuming:true,message:'Preparing draft to send…'});
  try{
   b.record=await b.store!.save(b.record,'');
   if(this.active!==b||!current()||this.text().trim()!==expectedText){
    // Undo only our own known clear. A newer edit wins if this receipt is stale.
    try{b.record=await b.store!.save(b.record,this.active===b?this.text():original);}catch{}
    throw Error('The draft changed. Nothing was sent.');
   }
   b.last='';this.restore('');this.publish({consuming:false,message:''});
  }catch(error){if(this.active===b){b.failed=true;this.publish({consuming:false});await this.reviewConflict(b);}throw error;}
 }
}
