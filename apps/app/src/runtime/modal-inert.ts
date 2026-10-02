/** Overlapping panels release the phone only after the last owner closes. */
const owners=new WeakMap<HTMLElement,{count:number;previous:boolean}>();
export function holdPhoneInert(phone:HTMLElement|null){
 if(!phone)return ()=>{};
 const state=owners.get(phone)||{count:0,previous:phone.inert};state.count++;owners.set(phone,state);phone.inert=true;
 let released=false;return ()=>{if(released)return;released=true;if(--state.count===0){phone.inert=state.previous;owners.delete(phone);}};
}
