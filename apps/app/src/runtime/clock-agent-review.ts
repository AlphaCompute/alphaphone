import {registerPlugin} from '../platform-plugins';
import type {ClockOperation,ClockHandoffResult} from './clock-contract';
import type {DeviceJournalIdentity} from './device-actions';

type Identity=DeviceJournalIdentity&{operationId:string};
type NativeReply={result?:ClockHandoffResult;reviewToken?:string};
const bridge=registerPlugin<{
 reviewClock(input:Identity&{operation:ClockOperation}):Promise<NativeReply>;
 confirmClock(input:Identity&{reviewToken:string}):Promise<NativeReply>;
 cancelClock(input:Identity):Promise<unknown>;
}>('AlphaActionJournal');
const active=new Set<()=>Promise<void>>();
/** Connection retirement waits for native cancellation before another owner activates. */
export async function retireClockReviews():Promise<void>{const results=await Promise.allSettled([...active].map(cancel=>cancel()));const failed=results.find(result=>result.status==='rejected');if(failed?.status==='rejected')throw failed.reason;}
export async function reviewAgentClock(operation:ClockOperation,operationId:string,identity:DeviceJournalIdentity,signal:AbortSignal,assertCurrent:()=>void):Promise<ClockHandoffResult>{
 const input={...identity,operationId};let cancellation:Promise<void>|undefined;let cancellationFailed=false;let retired=false;
 const retryCancellation=()=>cancel(true);
 const cancel=(retry=false)=>{
  retired=true;
  if(cancellation&&(!cancellationFailed||!retry))return cancellation;
  cancellationFailed=false;
  cancellation=bridge.cancelClock(input).then(()=>{active.delete(retryCancellation);},error=>{cancellationFailed=true;throw error;});
  return cancellation;
 };
 const current=()=>{signal.throwIfAborted();if(retired)throw Error('Clock review retired');assertCurrent();};
 const onAbort=()=>{void cancel().catch(()=>{});};active.add(retryCancellation);signal.addEventListener('abort',onAbort,{once:true});
 try{
  current();
  const reviewed=await bridge.reviewClock({...input,operation});
  current();
  if(reviewed.result)return reviewed.result;
  if(typeof reviewed.reviewToken!=='string'||!reviewed.reviewToken)throw Error('Clock review unavailable');
  // The native gesture is necessary but not sufficient: retain the exact live owner.
  current();
  const confirmed=await bridge.confirmClock({...input,reviewToken:reviewed.reviewToken});
  if(!confirmed.result)throw Error('Clock handoff outcome unavailable');
  return confirmed.result;
 }finally{
  signal.removeEventListener('abort',onAbort);
  // A failed acknowledgement remains registered. Only explicit retirement can
  // retry cancellation; no failed cleanup is permission to activate another owner.
  await cancel();
 }
}
