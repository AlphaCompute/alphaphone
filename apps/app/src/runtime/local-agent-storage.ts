import type {ActionJournal} from './device-actions';
async function operation(input:Record<string,unknown>):Promise<any> {
 const response=await fetch('/__alpha-local-agent',{method:'POST',headers:{'Content-Type':'application/json','X-Alpha-Local-Agent':'1'},body:JSON.stringify({storage:input}),signal:AbortSignal.timeout(15000),redirect:'error'});
 if(!response.ok)throw Error('Development device storage unavailable');return response.json();
}
export const developmentDeviceStore={
 async read<T>(slot:string):Promise<T|null>{return (await operation({operation:'read',slot})).value;},
 async write(slot:string,value:unknown){await operation({operation:'write',slot,value});},
};
export const developmentActionJournal:ActionJournal={
 reserve:input=>operation({...input,operation:'reserve'}),
 markApplying:input=>operation({...input,operation:'markApplying'}),
 finish:input=>operation({...input,operation:'finish'}),
 get:input=>operation({...input,operation:'get'}),
 list:input=>operation({...input,operation:'list'}),
};
