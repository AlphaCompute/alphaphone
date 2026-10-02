import {datedReceiptWallet} from './workflow-receipts';
import {installSimulatedWorkflows} from './simulated-workflows';
import {installSimulatedMessages} from './simulated-messages';
import {installSimulatedVoicemail} from './simulated-voicemail';
import {SimulatorWriter} from './simulator-writer';
import {installSimulatedInbox} from './simulated-inbox';
import {loadSimulatedState,simulatorNeedsRecovery,showSimulatorRecovery} from './simulator-recovery';
import { browserDevProfile } from './dev-profile';
type Bag=Record<string,any>;
const names=['phone','messages','contacts','inbox','workflows','wallet'];
/** Capture product-owned local interactions before native adapters replace effects. */
export function captureSimulatedApps(views:Bag){return Object.fromEntries(names.map(name=>[name,{...views[name],state:structuredClone(views[name].state)}]));}
export function installSimulatedApps(Component:any,views:Bag,original:Bag){
 if(!browserDevProfile)return;
 original.wallet.persist=[...original.wallet.persist,'workflowReceipts'];original.wallet.state.workflowReceipts={};
 original.workflows.persist=[...original.workflows.persist,'localRuns'];original.workflows.state.localRuns={};
 original.messages.persist=[...original.messages.persist,'localDrafts'];original.messages.state.localDrafts={};
 original.inbox.persist=[...original.inbox.persist,'localDrafts'];original.inbox.state.localDrafts=[];
 const snapshots=new Map<string,string|null>();
 for(const name of names){Object.assign(views[name],original[name]);views[name].state={...views[name].state,...loadSimulatedState(name,original[name],raw=>snapshots.set('alpha.dev.app.'+name,raw))};}
 const writer=new SimulatorWriter(snapshots);
 installSimulatedInbox(views.inbox);
 const disposeWorkflows=installSimulatedWorkflows(views.workflows);
 const disposeMessages=installSimulatedMessages(views.messages);
 const disposeVoicemail=installSimulatedVoicemail(views.phone);
 const walletRender=views.wallet.render,walletReply=views.wallet.reply;
 views.wallet.reply=(text:string,raw:string,api:Bag)=>walletReply(text,raw,{...api,get:(name:string)=>name==='wallet'?datedReceiptWallet(api.get(name),api.now):api.get(name)});
 views.wallet.render=(state:Bag,api:Bag)=>{
  // Dev cards are predefined tokens; the simulator never collects card credentials.
  const out=walletRender({...datedReceiptWallet(state,api.now),add:null,form:{num:'',exp:'',name:'',cvv:''}},api);
  out.startAdd=()=>{const cards=api.get('wallet').cards||[];api.set({cards:[...cards,{id:crypto.randomUUID(),name:'Development card',last4:'0000',kind:'Test',bg:'#355caa',fg:'#fff',def:cards.length===0,locked:false,tx:[]}]});};return out;
 };
 const mount=Component.prototype.componentDidMount,unmount=Component.prototype.componentWillUnmount;
 Component.prototype.componentDidMount=function(){mount?.call(this);this.devIncomingCall=()=>{const state=this.vget('phone');if(state.incoming||state.callWho||state.call||state.num){this.openView('phone');return;}this.openView('phone',{incoming:'maya',ring:'ring',scrN:0,rs:false});};window.addEventListener('alpha:dev-incoming-call',this.devIncomingCall);};
 Component.prototype.componentWillUnmount=function(){disposeWorkflows();disposeMessages();disposeVoicemail();window.removeEventListener('alpha:dev-incoming-call',this.devIncomingCall);unmount?.call(this);};
 const open=Component.prototype.openView;
 Component.prototype.openView=function(name:string,...args:any[]){if(simulatorNeedsRecovery(name)){showSimulatorRecovery();return;}return open.call(this,name,...args);};
 const set=Component.prototype.vset;
 Component.prototype.vset=function(name:string,patch:Bag){
  if(simulatorNeedsRecovery(name)){showSimulatorRecovery();throw Error('Saved app data needs recovery.');}
  if(name==='inbox'&&Array.isArray(patch.mails)){const known=new Set(this.vget('inbox').mails.map((mail:Bag)=>String(mail.id)));patch={...patch,mails:patch.mails.map((mail:Bag)=>known.has(String(mail.id))?mail:{...mail,receivedAt:Number.isFinite(mail.receivedAt)?mail.receivedAt:Date.now()})};}
  const fields=views[name]?.persist||[];
  if(names.includes(name)&&fields.some((key:string)=>Object.prototype.hasOwnProperty.call(patch,key))){
    const value={...this.vget(name),...patch},stored:Bag={};for(const key of fields)stored[key]=value[key];
    try{writer.write('alpha.dev.app.'+name,JSON.stringify(stored));}
    catch(error){this.toast(error instanceof Error&&/development|Saved app data changed/.test(error.message)?error.message:'Could not save '+views[name].title+'. Your changes are still here. Try again after freeing browser storage.');throw Error('Development app save failed.');}
  }
  return set.call(this,name,patch);
 };
}
