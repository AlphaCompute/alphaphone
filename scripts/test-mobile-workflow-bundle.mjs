/** Load the actual mobile bundle and its workflow routes without a source checkout. */
import assert from 'node:assert/strict';
import {cpSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {sourceDirectory} from './local-agent-source.mjs';
const root=resolve(import.meta.dirname,'..');
const bundle=join(sourceDirectory(root),'packages/agent/dist-mobile');
const manifest=JSON.parse(readFileSync(join(bundle,'plugins-manifest.json'),'utf8'));
assert.ok(manifest.plugins.optional.includes('@elizaos/plugin-workflow'));
assert.ok(!manifest.externalsAsStubs.includes('@elizaos/plugin-workflow'));
const temporary=mkdtempSync(join(tmpdir(),'alpha-mobile-workflow-bundle-'));
try{
 cpSync(bundle,join(temporary,'bundle'),{recursive:true});
 const program=`import assert from 'node:assert/strict';
await import(${JSON.stringify(pathToFileURL(join(temporary,'bundle/agent-bundle.js')).href)});
const registry=globalThis[Symbol.for('elizaos.app.route-plugin-registry')];
const entry=registry?.entries?.get('@elizaos/plugin-workflow:routes');
assert.equal(typeof entry?.load,'function','Workflow route loader was not bundled/registered');
const plugin=await entry.load();
assert.equal(plugin.name,'@elizaos/plugin-workflow:routes');
for(const path of ['/api/workflow/status','/api/workflow/phone/validate','/api/workflow/phone/workflows']){
 const route=plugin.routes.find(route=>route.path===path);assert.ok(route,path);assert.equal(route.rawPath,true);assert.equal(typeof route.handler,'function');
}
console.log('ALPHA_MOBILE_WORKFLOW_BUNDLE '+JSON.stringify({isolatedDirectory:true,workflowRouteCount:plugin.routes.length,nativeExecution:false}));process.exit(0);`;
 const output=execFileSync(process.env.ALPHA_BUN||'bun',['--no-install','-e',program],{cwd:temporary,env:{PATH:process.env.PATH,HOME:temporary,TMPDIR:temporary,ELIZA_STATE_DIR:join(temporary,'state'),ELIZA_DISABLE_TRAJECTORY_LOGGING:'1'},encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024});
 const result=output.split('\n').find(line=>line.startsWith('ALPHA_MOBILE_WORKFLOW_BUNDLE '));assert.ok(result,'Missing qualification result');console.log(result);
}finally{rmSync(temporary,{recursive:true,force:true});}
