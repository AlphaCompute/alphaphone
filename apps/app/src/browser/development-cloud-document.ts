import {browserDocuments} from './documents';
import {BrowserDomainDocument,type DomainRecovery} from './domain-document';
import {browserDevProfile} from './dev-profile';
export type DevelopmentScenario='new'|'existing'|'insufficient'|'failed'|'changed';
export type DevelopmentSetup={scenario?:DevelopmentScenario;phase:'review'|'provisioning'|'ready';startedAt?:number;quote:string};
export function cloudSetupDocument(account:'first'|'second',check:(signal?:AbortSignal)=>void|Promise<void>){
 if(!browserDevProfile||!['first','second'].includes(account))throw Error('Choose a development account.');
 const key=`alpha.browser.cloud.setup.${account}.v1`,domain=new BrowserDomainDocument(browserDocuments,key,()=>localStorage.getItem(key));
 const initial=():DevelopmentSetup=>({phase:'review',quote:(account==='first'?'1':'2').repeat(64)});
 const validate=(data:DevelopmentSetup)=>{if(!data||!['review','provisioning','ready'].includes(data.phase)||typeof data.quote!=='string'||!/^[a-f0-9]{64}$/.test(data.quote)||data.scenario!==undefined&&!['new','existing','insufficient','failed','changed'].includes(data.scenario)||data.phase==='provisioning'&&(!Number.isFinite(data.startedAt)||data.startedAt!<0))throw Error('Development setup needs recovery.');return data;};
 return {
  async read(signal?:AbortSignal){await check(signal);const data=await domain.read(initial,signal);await check(signal);return validate(data);},
  async edit<R>(editor:(data:DevelopmentSetup)=>R|Promise<R>,signal?:AbortSignal){await check(signal);const result=await domain.edit(initial,async data=>{await check(signal);validate(data);const result=await editor(data);validate(data);await check(signal);return result;},signal);await check(signal);return result;},
  async capture(signal?:AbortSignal){await check(signal);const result=await domain.capture(signal);await check(signal);return result;},
  async reset(expected:DomainRecovery,signal?:AbortSignal){await check(signal);await domain.reset(expected,signal);await check(signal);},
 };
}
