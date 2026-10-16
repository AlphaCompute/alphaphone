import { withMapsNavigationRelay } from '../../../../.eliza/client-features/plugins/plugin-maps/src/client/navigation-relay.ts';
import { residentMapsNavigationPort } from './agent-navigation.ts';
import { deviceNavigationFailure, type AgentPlaceRef, type MapsDeviceNavigation } from './device-navigation.ts';
import type { TravelMode } from './contracts.ts';

type Request = (path: string, body: unknown, signal: AbortSignal) => Promise<unknown>;
let activeOffer: string | undefined;
/** Only the launcher, Cloud Maps account, resident enrollment and current turn can offer this host. */
export function withResidentMapsNavigation<T>(request: Request | undefined, conversationId: string, signal: AbortSignal, send: () => Promise<T>): Promise<T> {
 return withMapsNavigationRelay<T, MapsDeviceNavigation>({
  current:()=>residentMapsNavigationPort.current,
  async execute(navigation,value,signal){
   const operation=value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:undefined;
   if(operation?.kind==='select')return navigation.select(operation.place as AgentPlaceRef,signal);
   if(operation?.kind==='start')return navigation.start(operation.request as {destination:AgentPlaceRef;travelMode:TravelMode},signal);
   if(operation?.kind==='reroute')return navigation.reroute(signal);
   if(operation?.kind==='stop')return navigation.stop(signal);
   throw Error('Invalid Maps navigation operation');
  },
  failure:error=>deviceNavigationFailure(error).code,
  connected(value,id){if(value){activeOffer=id;residentMapsNavigationPort.relay=true;}else if(activeOffer===id){activeOffer=undefined;residentMapsNavigationPort.relay=false;}},
 },request,conversationId,signal,send);
}
