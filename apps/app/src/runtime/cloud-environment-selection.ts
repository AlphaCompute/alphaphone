import type {CloudEnvironment} from './cloud-protocol';

/** A public preview default never selects an issuer for a production/native build or replaces an explicit choice. */
export function resolveCloudEnvironment(policy: {development: boolean; testMocks: boolean; android: boolean; previewEnvironment?: unknown; cloudResident?:boolean}, selected?: unknown): CloudEnvironment {
  if(policy.development&&!policy.android&&policy.cloudResident)return policy.previewEnvironment==='staging'?'staging':'production';
  if (selected === 'production' || policy.testMocks && selected === 'staging') return selected;
  return policy.development && policy.testMocks && !policy.android && policy.previewEnvironment === 'staging' ? 'staging' : 'production';
}
