import {CloudPersonalProtocol} from '../runtime/cloud-personal-protocol';
import {browserDevProfile} from './dev-profile';
import {revision} from './revision';
import {cloudSetupDocument,type DevelopmentSetup as Setup,type DevelopmentScenario} from './development-cloud-document';
export type {DevelopmentScenario} from './development-cloud-document';
export const developmentCloudKey='alpha.browser.cloud.account.v1';
export type DevelopmentAccount='first'|'second';
type Account={account:DevelopmentAccount;session:string}|null;
const valid=(v:unknown):v is DevelopmentAccount=>v==='first'||v==='second';
export function developmentCloudAccount():Account {if(!browserDevProfile)throw Error('Choose development mode.');const raw=localStorage.getItem(developmentCloudKey),account:Account=raw?JSON.parse(raw):null;if(account&&(!valid(account.account)||typeof account.session!=='string'))throw Error('Development account data needs recovery.');return account;}
export async function selectDevelopmentCloud(account:DevelopmentAccount|null,signal:AbortSignal){
 if(!browserDevProfile||account!==null&&!valid(account))throw Error('Choose a development account.');
 return navigator.locks.request(developmentCloudKey,{signal},()=>{signal.throwIfAborted();const value=account?{account,session:crypto.randomUUID()}:null;localStorage.setItem(developmentCloudKey,JSON.stringify(value));window.dispatchEvent(new Event('alpha:development-account-changed'));return value;});
}
export function developmentCloudSetupDocument(account:NonNullable<Account>){
 return cloudSetupDocument(account.account,signal=>{signal?.throwIfAborted();const current=developmentCloudAccount();if(current?.account!==account.account||current.session!==account.session)throw Error('Development account changed.');});
}
export async function configureDevelopmentCloud(scenario:DevelopmentScenario,signal:AbortSignal){
 const account=developmentCloudAccount();if(!account||!['new','existing','insufficient','failed','changed'].includes(scenario))throw Error('Choose a development setup.');
 await developmentCloudSetupDocument(account).edit(state=>{Object.keys(state).forEach(key=>delete (state as any)[key]);Object.assign(state,{phase:'review',scenario,quote:revision()});},signal);
 window.dispatchEvent(new Event('alpha:development-account-changed'));
}
export function developmentPersonal(account:NonNullable<Account>){
 const index=account.account==='first'?'1':'2',userId=`00000000-0000-4000-8000-00000000000${index}`,personal=`personal:00000000-0000-5000-8000-00000000000${index}`,target=`10000000-0000-4000-8000-00000000000${index}`,job=`20000000-0000-4000-8000-00000000000${index}`;
 const domain=developmentCloudSetupDocument(account);
 const check=(signal:AbortSignal)=>{signal.throwIfAborted();const current=developmentCloudAccount();if(current?.account!==account.account||current.session!==account.session)throw Error('Development account changed.');};
 const status=(state:Setup)=>state.phase==='review'?'stopped':state.scenario==='failed'&&Date.now()-(state.startedAt||0)>=1000?'error':state.phase==='ready'||Date.now()-(state.startedAt||0)>=1000?'running':'provisioning';
 const ok=(data:unknown,status=200)=>({status,data:{success:true,data}});
 const base=`/api/v1/eliza/agents/${encodeURIComponent(personal)}/upgrade-tier`;
 return new CloudPersonalProtocol({environment:'development',credentialId:account.session,userId,organizationId:`development-${account.account}`},async(path,signal,body)=>{
  check(signal);const state=await domain.read(signal);
  const amounts=(data:Setup)=>({hourlyRateUsd:data.quote==='f'.repeat(64)?0.2:0.1,dailyRateUsd:data.quote==='f'.repeat(64)?4.8:2.4,minimumActivationChargeUsd:data.quote==='f'.repeat(64)?0.2:0.1,minimumBalanceUsd:10,minimumRunwayDays:1,balanceUsd:data.scenario==='insufficient'?0:100,deficitUsd:data.scenario==='insufficient'?10:0});
  if(body===undefined){
   if(path==='/api/v1/eliza/personal')return ok({identity:{id:personal,displayName:'Development Cloud agent',runtime:state.phase==='ready'?'dedicated':'shared',...(state.phase==='ready'?{activeAgentId:target,apiBase:'https://development.invalid'}:{})}});
   if(path===base)return ok({action:'activate_dedicated',sourceAgentId:personal,quoteId:state.quote,requiresConfirmation:true,...amounts(state),canActivate:state.scenario!=='insufficient',activation:state.phase==='review'&&state.scenario!=='existing'?{state:'available'}:{state:'in_progress',dedicatedAgentId:target,status:status(state)}});
   if(path===base+'/adopt-existing')return ok({action:'adopt_existing_dedicated',quoteId:state.quote,requiresConfirmation:true,...amounts(state),canAdopt:state.scenario!=='insufficient',dedicatedAgentId:target,adoptionState:'available',status:status(state),startsCompute:true,requiresCatalogRestore:false,stateDisposition:'fresh_boot_no_verified_backup'});
   if(path===`/api/v1/jobs/${job}`)return ok({id:job,status:status(state)==='error'?'failed':status(state)==='running'?'completed':'in_progress'});
   throw Error('Unknown development setup read.');
  }
  return domain.edit(data=>{check(signal);const input=body as Record<string,unknown>;
   if(path===base&&data.scenario==='changed'&&data.quote!=='f'.repeat(64)){data.quote='f'.repeat(64);return {status:409,data:{code:'dedicated_quote_changed'}};}
   if(path===base+'/adopt-existing'){if(!['stopped','error'].includes(status(data))||input.action!=='adopt_existing_dedicated'||input.quoteId!==data.quote||input.minimumActivationChargeUsd!==amounts(data).minimumActivationChargeUsd)throw Error('Review the current existing instance.');data.phase='provisioning';data.scenario='new';data.startedAt=Date.now();return ok({runtime:'dedicated_pending_cutover',dedicatedAgentId:target,jobId:job},202);}
   if(path===base){if(data.scenario==='insufficient'||data.scenario==='existing'||data.phase!=='review'||input.action!=='activate_dedicated'||input.quoteId!==data.quote||input.minimumActivationChargeUsd!==amounts(data).minimumActivationChargeUsd)throw Error('Review the current development quote.');data.phase='provisioning';data.startedAt=Date.now();return ok({dedicatedAgentId:target,jobId:job},202);}
   if(path===base+'/cutover'){if(data.phase!=='provisioning'||status(data)!=='running'||input.dedicatedAgentId!==target)throw Error('Check development setup status.');data.phase='ready';return ok({personalElizaId:personal,activeAgentId:target,runtime:'dedicated',apiBase:'https://development.invalid',importedMessages:0});}
   throw Error('Unknown development setup operation.');
  },signal);
 },async(id,signal)=>{check(signal);if(id!==target)throw Error('Development target changed.');return status(await domain.read(signal));});
}
