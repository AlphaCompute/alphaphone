import {installSimulatedInbox} from './simulated-inbox';
import {loadSimulatedState,simulatorNeedsRecovery,showSimulatorRecovery} from './simulator-recovery';
import { browserDevProfile } from './dev-profile';
type Bag=Record<string,any>;
const names=['phone','messages','contacts','inbox','workflows','wallet'];
/** Capture product-owned local interactions before native adapters replace effects. */
export function captureSimulatedApps(views:Bag){return Object.fromEntries(names.map(name=>[name,{...views[name],state:structuredClone(views[name].state)}]));}
export function installSimulatedApps(Component:any,views:Bag,original:Bag){
 if(!browserDevProfile)return;
 original.inbox.persist=[...original.inbox.persist,'localDrafts'];original.inbox.state.localDrafts=[];
 for(const name of names){Object.assign(views[name],original[name]);views[name].state={...views[name].state,...loadSimulatedState(name,original[name])};}
 installSimulatedInbox(views.inbox);
 const walletRender=views.wallet.render;
 views.wallet.render=(state:Bag,api:Bag)=>{
  // Dev cards are predefined tokens; the simulator never collects card credentials.
  const out=walletRender({...state,add:null,form:{num:'',exp:'',name:'',cvv:''}},api);
  out.startAdd=()=>{const cards=api.get('wallet').cards||[];api.set({cards:[...cards,{id:crypto.randomUUID(),name:'Development card',last4:'0000',kind:'Test',bg:'#355caa',fg:'#fff',def:cards.length===0,locked:false,tx:[]}]});};return out;
 };
 const open=Component.prototype.openView;
 Component.prototype.openView=function(name:string,...args:any[]){if(simulatorNeedsRecovery(name)){showSimulatorRecovery();return;}return open.call(this,name,...args);};
 const set=Component.prototype.vset;
 Component.prototype.vset=function(name:string,patch:Bag){
  if(simulatorNeedsRecovery(name)){showSimulatorRecovery();throw Error('Saved app data needs recovery.');}
  const fields=views[name]?.persist||[];
  if(names.includes(name)&&fields.some((key:string)=>Object.prototype.hasOwnProperty.call(patch,key))){
    const value={...this.vget(name),...patch},stored:Bag={};for(const key of fields)stored[key]=value[key];
    try{localStorage.setItem('alpha.dev.app.'+name,JSON.stringify(stored));}
    catch{this.toast('Could not save '+views[name].title+'. Your changes are still here. Try again after freeing browser storage.');throw Error('Development app save failed.');}
  }
  return set.call(this,name,patch);
 };
}
