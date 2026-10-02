import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';

function launch({route,override,redaction}={}) {
 const dir=mkdtempSync(join(tmpdir(),'alpha-model-')),profile=join(dir,'profile'),source=join(dir,'source'),receipt=join(dir,'models.json'),bun=join(dir,'fake-bun');
 mkdirSync(profile);mkdirSync(join(source,'packages/app/src/runtime'),{recursive:true});writeFileSync(join(source,'packages/app/src/runtime/dev-server.ts'),'');
 execFileSync('git',['init','-q',source]);execFileSync('git',['-C',source,'-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--allow-empty','-qm','fixture']);
 writeFileSync(bun,`#!/usr/bin/env node\nrequire('node:fs').writeFileSync(${JSON.stringify(receipt)},JSON.stringify(Object.fromEntries(['CEREBRAS_MODEL','CEREBRAS_SMALL_MODEL','CEREBRAS_LARGE_MODEL'].map(k=>[k,process.env[k]]))));`,{mode:0o700});
 const config=join(profile,'eliza.json');if(route)writeFileSync(config,JSON.stringify({serviceRouting:{llmText:route},fixtureKeep:'preserve'}),{mode:0o600});
 const before=existsSync(config)?readFileSync(config,'utf8'):null;
 const env={...process.env,ALPHA_ELIZA_SOURCE:source,ALPHA_REMOTE_PROFILE:profile,ALPHA_REMOTE_PORT:'47999',ALPHA_BUN:bun,CEREBRAS_API_KEY:'synthetic-fixture-key'};delete env.ALPHA_EGRESS_REDACTION;if(redaction!==undefined)env.ALPHA_EGRESS_REDACTION=redaction;delete env.ALPHA_AGENT_MODEL;if(override!==undefined)env.ALPHA_AGENT_MODEL=override;
 try {
  const result=spawnSync(process.execPath,[resolve('scripts/start-local-remote.mjs')],{env,encoding:'utf8',timeout:15000});
  return {status:result.status,error:result.stderr,models:existsSync(receipt)?JSON.parse(readFileSync(receipt,'utf8')):null,before,after:existsSync(config)?readFileSync(config,'utf8'):null};
 } finally {rmSync(dir,{recursive:true,force:true});}
}
test('new local profile uses the selected model consistently in saved routing and child environment',()=>{
 const r=launch({override:'fixture-model'});assert.equal(r.status,0,r.error);assert.deepEqual(r.models,{CEREBRAS_MODEL:'fixture-model',CEREBRAS_SMALL_MODEL:'fixture-model',CEREBRAS_LARGE_MODEL:'fixture-model'});assert.equal(JSON.parse(r.after).serviceRouting.llmText.largeModel,'fixture-model');
});
test('existing local profile retains distinct reviewed models without rewriting its configuration',()=>{
 const r=launch({route:{backend:'cerebras',transport:'direct',smallModel:'fixture-small',largeModel:'fixture-large'}});assert.equal(r.status,0,r.error);assert.deepEqual(r.models,{CEREBRAS_MODEL:'fixture-large',CEREBRAS_SMALL_MODEL:'fixture-small',CEREBRAS_LARGE_MODEL:'fixture-large'});assert.equal(r.after,r.before);
});
test('conflicting or malformed explicit model selection fails before a child starts and preserves the profile',()=>{
 for(const override of ['different-model','bad model']){const r=launch({route:{backend:'cerebras',transport:'direct',smallModel:'saved',largeModel:'saved'},override});assert.notEqual(r.status,0);assert.equal(r.models,null);assert.equal(r.after,r.before);assert.match(r.error,override==='bad model'?/Invalid agent model identifier/:/conflicts with the saved profile/);}
});

test('redaction rejects unqualified source before starting a child or creating configuration',()=>{
 const r=launch({redaction:'all'});assert.notEqual(r.status,0);assert.equal(r.models,null);assert.equal(r.after,null);assert.match(r.error,/Prepared runtime base commit changed/);
});
test('invalid redaction selection cannot silently start an unprotected agent',()=>{
 const r=launch({redaction:'pii'});assert.notEqual(r.status,0);assert.equal(r.models,null);assert.equal(r.after,null);assert.match(r.error,/ALPHA_EGRESS_REDACTION must be off or all/);
});
