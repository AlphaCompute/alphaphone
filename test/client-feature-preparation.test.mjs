import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {prepareClientFeatures} from '../scripts/prepare-client-features.mjs';
function fixture(run){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'alpha-client-source-'));
 try{for(const file of ['upstream.lock.json','patches/eliza/client-features-source.json','patches/eliza/client-features.patch']){const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(file,target);}return run(root);}finally{fs.rmSync(root,{recursive:true,force:true});}
}
test('prepared client source repairs changed, missing and unexpected cached files',()=>fixture(root=>{
 const source=prepareClientFeatures({root}),manifest=JSON.parse(fs.readFileSync(path.join(root,'patches/eliza/client-features-source.json'))),file=Object.keys(manifest.files)[0],original=fs.readFileSync(path.join(source,file));
 fs.writeFileSync(path.join(source,file),'corrupt');fs.writeFileSync(path.join(source,'unexpected.ts'),'unreviewed');
 assert.equal(prepareClientFeatures({root}),source);assert.deepEqual(fs.readFileSync(path.join(source,file)),original);assert.equal(fs.existsSync(path.join(source,'unexpected.ts')),false);
 fs.unlinkSync(path.join(source,file));prepareClientFeatures({root});assert.deepEqual(fs.readFileSync(path.join(source,file)),original);
 const stamp=JSON.parse(fs.readFileSync(path.join(source,'.source.json')));assert.equal(stamp.baseCommit,manifest.baseCommit);assert.match(stamp.manifestSha256,/^[a-f0-9]{64}$/);
}));
test('client source rejects pin and patch mismatch without replacing its cache',()=>fixture(root=>{
 const source=prepareClientFeatures({root}),stamp=fs.readFileSync(path.join(source,'.source.json')),pin=fs.readFileSync(path.join(root,'upstream.lock.json'));
 fs.writeFileSync(path.join(root,'upstream.lock.json'),JSON.stringify({commit:'0'.repeat(40)}));assert.throws(()=>prepareClientFeatures({root}),/Requalify/);fs.writeFileSync(path.join(root,'upstream.lock.json'),pin);
 fs.appendFileSync(path.join(root,'patches/eliza/client-features.patch'),'\n');assert.throws(()=>prepareClientFeatures({root}),/hash mismatch/);assert.deepEqual(fs.readFileSync(path.join(source,'.source.json')),stamp);
}));
test('client source refuses unknown directories and cache symlinks',()=>fixture(root=>{
 const source=path.join(root,'.eliza/client-features');fs.mkdirSync(source,{recursive:true});fs.writeFileSync(path.join(source,'keep'),'owned elsewhere');assert.throws(()=>prepareClientFeatures({root}),/unrecognized/);assert.equal(fs.readFileSync(path.join(source,'keep'),'utf8'),'owned elsewhere');
 fs.rmSync(source,{recursive:true});prepareClientFeatures({root});fs.symlinkSync(path.join(root,'upstream.lock.json'),path.join(source,'unexpected-link'));assert.throws(()=>prepareClientFeatures({root}),/Symlink/);assert.equal(fs.existsSync(path.join(root,'upstream.lock.json')),true);
}));
test('client source cannot follow a linked staging parent or escaped manifest path',()=>fixture(root=>{
 const outside=path.join(root,'outside');fs.mkdirSync(outside);fs.writeFileSync(path.join(outside,'keep'),'retained');fs.symlinkSync(outside,path.join(root,'.eliza'));assert.throws(()=>prepareClientFeatures({root}),/Nonregular/);assert.deepEqual(fs.readdirSync(outside),['keep']);fs.unlinkSync(path.join(root,'.eliza'));
 const file=path.join(root,'patches/eliza/client-features-source.json'),manifest=JSON.parse(fs.readFileSync(file));manifest.files['plugins/plugin-files/../../escape.ts']='0'.repeat(64);fs.writeFileSync(file,JSON.stringify(manifest));assert.throws(()=>prepareClientFeatures({root}),/Invalid client feature manifest/);
}));

test('direct local development launcher prepares a clean client tree before starting services',()=>fixture(root=>{
 for(const file of ['scripts/dev-local.mjs','scripts/local-agent-source.mjs','scripts/prepare-client-features.mjs']){const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(file,target);}
 // Stop at configuration admission before binding ports or starting an agent.
 const result=spawnSync(process.execPath,[path.join(root,'scripts/dev-local.mjs')],{cwd:root,env:{...process.env,ALPHA_REMOTE_PORT:'0'},encoding:'utf8',timeout:20000});
 assert.equal(result.status,1);assert.match(result.stderr,/Invalid local agent port/);
 const stamp=JSON.parse(fs.readFileSync(path.join(root,'.eliza/client-features/.source.json')));
 assert.equal(stamp.baseCommit,JSON.parse(fs.readFileSync(path.join(root,'upstream.lock.json'))).commit);
}));
