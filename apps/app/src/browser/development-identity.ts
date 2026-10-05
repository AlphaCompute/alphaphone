import {developmentCloudAccount} from './development-cloud';
import {devSurfacesEnabled} from '../build-flags';
import type {DevelopmentProfile} from './development-connection';
export type DevelopmentIdentity={profile:DevelopmentProfile;account?:'first'|'second';session?:string;namespace:string;ownerId:string;agentId:string};
/** Default reply for explicit development profiles; absent from flag-off builds. */
export const developmentDefaultReply:string=devSurfacesEnabled?'Development reply. Edit this response in Agent connection.':'';
export function developmentIdentity(profile:DevelopmentProfile):DevelopmentIdentity{
 if(!devSurfacesEnabled)throw Error('Development profiles are unavailable in this build.');
 const account=profile==='cloud'?developmentCloudAccount():null,namespace=profile+(account?`.${account.account}`:'');
 return {profile,...(account?{account:account.account,session:account.session}:{}),namespace,ownerId:`development-${namespace}-owner`,agentId:`development-${namespace}-agent`};
}
export function assertDevelopmentIdentity(identity:DevelopmentIdentity){const current=developmentIdentity(identity.profile);if(current.namespace!==identity.namespace||current.session!==identity.session)throw Error('Development account changed.');}
