import {loadSimulatedState,simulatorNeedsRecovery,showSimulatorRecovery} from './simulator-recovery';
import { browserDevProfile } from './dev-profile';
type Bag=Record<string,any>;
const names=['phone','messages','contacts','inbox','workflows','wallet'];
/** Capture product-owned local interactions before native adapters replace effects. */
export function captureSimulatedApps(views:Bag){return Object.fromEntries(names.map(name=>[name,{...views[name],state:structuredClone(views[name].state)}]));}
export function installSimulatedApps(Component:any,views:Bag,original:Bag){
 if(!browserDevProfile)return;
 for(const name of names){Object.assign(views[name],original[name]);views[name].state={...views[name].state,...loadSimulatedState(name,original[name])};}
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
  if(names.includes(name)){const value={...this.vget(name),...patch},stored:Bag={};for(const key of views[name].persist||[])stored[key]=value[key];localStorage.setItem('alpha.dev.app.'+name,JSON.stringify(stored));}
  return set.call(this,name,patch);
 };
}
