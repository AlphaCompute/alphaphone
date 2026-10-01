// Loads the real authoring module into the same explicit boundary fixture as the
// legacy workflow tests. No native plugin or production account is contacted.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { normalizePhoneSpec, assertPhoneCapabilities } from '../apps/app/src/runtime/phone-workflow-authoring.ts';
import { workflowSha, workflowBytes } from '../apps/app/src/runtime/workflow-device-contract.ts';
import { alphaClient } from '../apps/app/src/runtime/alpha-client.ts';
const source = readFileSync(new URL('../apps/app/src/prototype/workflow-authoring.ts', import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export function','function');
export function workflowRendererFixture(context) {
  const scope = { document:{hidden:false,addEventListener(){},removeEventListener(){}}, window:{addEventListener(){},removeEventListener(){}}, ...context, normalizePhoneSpec, assertPhoneCapabilities, workflowSha, workflowBytes, alphaClient, crypto:globalThis.crypto, TextEncoder, registerPlugin:()=>new Proxy({}, {get:()=>()=>Promise.reject(Error('Unexpected native authoring operation in existing-workflow fixture'))}) };
  vm.runInNewContext('{'+stripTypeScriptTypes(source,{mode:'transform'})+'\nglobalThis.createWorkflowAuthoring=createWorkflowAuthoring;}', scope);
  return scope;
}
