import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import child from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import {createHash,randomBytes} from 'node:crypto';
import {copyFilesClone} from '../scripts/copy-file-clone.mjs';
const root=path.resolve(import.meta.dirname,'..');
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function fixture(t){
 const directory=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'alpha-source-clone-')));
 t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const cache=path.join(directory,'cache'),consumer=path.join(directory,'consumer'),destination=path.join(consumer,'artifacts/source');
 const write=(file,bytes)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);};
 write(path.join(cache,'package.json'),JSON.stringify({workspaces:['packages/*']}));write(path.join(cache,'turbo.json'),'{"tasks":{}}');
 write(path.join(cache,'.gitignore'),'ignored/\n');write(path.join(cache,'packages/example/package.json'),'{"name":"fixture"}');
 write(path.join(cache,'packages/example/data.bin'),randomBytes(1024*1024));write(path.join(cache,'packages/example/tool.sh'),'#!/bin/sh\nexit 0\n');fs.chmodSync(path.join(cache,'packages/example/tool.sh'),0o755);
 for(let index=0;index<40;index++)write(path.join(cache,'packages/example',`extra-${index}.txt`),'small fixture file\n');
 fs.symlinkSync('data.bin',path.join(cache,'packages/example/linked-data'));
 const common=execFileSync('git',['rev-parse','--git-common-dir'],{cwd:root,encoding:'utf8'}).trim();
 const upstreamGit=path.join(path.resolve(root,common),'modules/vendor/eliza');
 const upstreamPin=JSON.parse(fs.readFileSync(path.join(root,'upstream.lock.json'))).commit;
 for(const name of ['immutable-workspace-source.mjs','committed-source.mjs']){
  const relative='packages/app/scripts/lib/'+name;
  write(path.join(cache,relative),execFileSync('git',['--git-dir',upstreamGit,'show',upstreamPin+':'+relative]));
 }
 const git=(...args)=>execFileSync('git',['-C',cache,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 const external=path.join(cache,'packages/example/external');write(path.join(external,'submodule-only.txt'),'must not be seeded');
 const subgit=(...args)=>execFileSync('git',['-C',external,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 subgit('init','-q');subgit('add','.');subgit('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','External submodule');
 git('init','-q');git('add','.');git('update-index','--add','--cacheinfo',`160000,${subgit('rev-parse','HEAD')},packages/example/external`);git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','Small committed cache');
 const commit=git('rev-parse','HEAD');
 write(path.join(cache,'ignored/native-build.bin'),'ignored cache output');
 for(const file of ['scripts/prepare-local-agent.mjs','scripts/local-agent-source.mjs','scripts/copy-file-clone.mjs'])write(path.join(consumer,file),fs.readFileSync(path.join(root,file)));
 write(path.join(consumer,'upstream.lock.json'),JSON.stringify({commit,url:cache}));
 fs.mkdirSync(path.join(consumer,'vendor'),{recursive:true});fs.symlinkSync(cache,path.join(consumer,'vendor/eliza'));
 const snapshot=()=>({head:git('rev-parse','HEAD'),index:hash(path.join(cache,'.git/index')),data:hash(path.join(cache,'packages/example/data.bin')),tool:fs.statSync(path.join(cache,'packages/example/tool.sh')).mode,ignored:hash(path.join(cache,'ignored/native-build.bin')),submoduleHead:subgit('rev-parse','HEAD'),submoduleFile:hash(path.join(external,'submodule-only.txt')),files:Object.fromEntries(git('ls-files','-z').split('\0').filter(Boolean).map(name=>{const file=path.join(cache,name),stat=fs.lstatSync(file);return [name,{mode:stat.mode,value:stat.isSymbolicLink()?fs.readlinkSync(file):stat.isFile()?hash(file):null}];}))});
 const run=(options={})=>spawnSync(process.execPath,[...(options.preload?['--import',options.preload]:[]),path.join(consumer,'scripts/prepare-local-agent.mjs'),'--source-only'],{cwd:consumer,env:{...process.env,ALPHA_LOCAL_AGENT_SOURCE_DIR:destination,ALPHA_RUNTIME_GIT_CACHE:options.cache??cache},encoding:'utf8',timeout:20000});
 return {directory,cache,consumer,destination,commit,git,write,snapshot,run};
}
test('verified cache seeds independent committed files and metadata, excluding ignored output',t=>{
 const f=fixture(t),before=f.snapshot(),result=f.run();assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/Seeded/);assert.deepEqual(f.snapshot(),before);
 assert.equal(execFileSync('git',['-C',f.destination,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),f.commit);
 assert.equal(spawnSync('git',['-C',f.destination,'symbolic-ref','-q','HEAD']).status,1);
 assert.equal(fs.lstatSync(path.join(f.destination,'.git')).isDirectory(),true);assert.equal(fs.existsSync(path.join(f.destination,'.git/objects/info/alternates')),false);
 for(const name of ['data.bin','tool.sh']){const source=path.join(f.cache,'packages/example',name),target=path.join(f.destination,'packages/example',name);assert.equal(hash(target),hash(source));assert.notEqual(fs.statSync(target).ino,fs.statSync(source).ino);assert.equal(fs.lstatSync(target).isFile(),true);}
 assert.equal(fs.statSync(path.join(f.destination,'packages/example/tool.sh')).mode&0o777,0o755);
 assert.equal(fs.readlinkSync(path.join(f.destination,'packages/example/linked-data')),'data.bin');assert.equal(fs.existsSync(path.join(f.destination,'ignored')),false);
 assert.ok(fs.lstatSync(path.join(f.destination,'packages/example/external')).isDirectory());assert.deepEqual(fs.readdirSync(path.join(f.destination,'packages/example/external')),[]);
 const stamp=JSON.parse(fs.readFileSync(path.join(f.destination,'.alpha-runtime-source.json')));
 assert.equal(stamp.base,f.commit);assert.equal(stamp.copySha256,hash(path.join(f.consumer,'scripts/copy-file-clone.mjs')));
 const moved=f.cache+'.moved';fs.renameSync(f.cache,moved);
 try{assert.equal(spawnSync('git',['-C',f.destination,'fsck','--connectivity-only','--no-reflogs']).status,0);}finally{fs.renameSync(moved,f.cache);}
 if(process.platform==='darwin'){
  const ids=JSON.parse(execFileSync('python3',['-c',`import ctypes,os,struct,sys,json
class Attr(ctypes.Structure): _fields_=[('count',ctypes.c_uint16),('reserved',ctypes.c_uint16),('common',ctypes.c_uint32),('volume',ctypes.c_uint32),('directory',ctypes.c_uint32),('file',ctypes.c_uint32),('extended',ctypes.c_uint32)]
libc=ctypes.CDLL(None,use_errno=True);libc.getattrlist.argtypes=[ctypes.c_char_p,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_size_t,ctypes.c_ulong];libc.getattrlist.restype=ctypes.c_int
ids=[]
for filename in sys.argv[1:]:
 attr=Attr(5,0,0,0,0,0,0x100);value=ctypes.create_string_buffer(64)
 if libc.getattrlist(os.fsencode(filename),ctypes.byref(attr),value,64,0x20): raise OSError(ctypes.get_errno(),'clone mapping unavailable')
 ids.append(struct.unpack_from('<Q',value.raw,4)[0])
print(json.dumps(ids))`,path.join(f.cache,'packages/example/data.bin'),path.join(f.destination,'packages/example/data.bin')],{encoding:'utf8'}));
  assert.ok(ids[0]>0);assert.equal(ids[0],ids[1]);
  assert.equal(fs.statSync(path.join(f.cache,'packages/example/data.bin')).dev,fs.statSync(path.join(f.destination,'packages/example/data.bin')).dev);
  console.log(JSON.stringify({sameVolumeApfsCloneId:ids[0],sharedDataStreamBytes:1024*1024,independentFileIdentity:true}));
 }
 fs.appendFileSync(path.join(f.destination,'packages/example/data.bin'),'destination-only');assert.deepEqual(f.snapshot(),before);
 const refused=f.run();assert.notEqual(refused.status,0);assert.match(refused.stderr,/Unexpected runtime source change/);
});
for(const mutation of ['bytes','mode','symlink'])test(`cache ${mutation} tampering bypassing Git stat flags is refused`,t=>{
 const f=fixture(t),relative='packages/example/'+(mutation==='bytes'?'data.bin':mutation==='mode'?'tool.sh':'linked-data');
 f.git('update-index','--assume-unchanged',relative);
 if(mutation==='bytes')fs.appendFileSync(path.join(f.cache,relative),'unreviewed');
 else if(mutation==='mode')fs.chmodSync(path.join(f.cache,relative),0o644);
 else{fs.unlinkSync(path.join(f.cache,relative));fs.symlinkSync('tool.sh',path.join(f.cache,relative));}
 const before=f.snapshot(),result=f.run();assert.notEqual(result.status,0);assert.match(result.stderr,/Runtime cache source drift|Tracked runtime cache changes/);assert.equal(fs.existsSync(path.join(f.destination,'.alpha-runtime-source.json')),false);assert.deepEqual(f.snapshot(),before);
});
test('interrupted clone preserves its incomplete destination and cannot be silently reused',t=>{
 const f=fixture(t),before=f.snapshot(),preload=path.join(f.directory,'interrupt.mjs');
 f.write(preload,`import fs from 'node:fs';import child from 'node:child_process';import path from 'node:path';import {syncBuiltinESMExports} from 'node:module';const copy=fs.copyFileSync,run=child.execFileSync;const fail=target=>{fs.writeFileSync(target,'partial');throw Object.assign(Error('simulated disk full'),{code:'ENOSPC'});};fs.copyFileSync=(source,target,flags)=>source.endsWith('/data.bin')?fail(target):copy(source,target,flags);child.execFileSync=(command,args,options)=>command==='/bin/cp'&&args.some(arg=>arg.endsWith('/data.bin'))?fail(path.join(args.at(-1),'data.bin')):run(command,args,options);syncBuiltinESMExports();`);
 const result=f.run({preload});assert.notEqual(result.status,0);assert.match(result.stderr,/simulated disk full/);assert.equal(fs.readFileSync(path.join(f.destination,'packages/example/data.bin'),'utf8'),'partial');assert.equal(fs.existsSync(path.join(f.destination,'.alpha-runtime-source.json')),false);assert.deepEqual(f.snapshot(),before);
 const retry=f.run();assert.notEqual(retry.status,0);assert.match(retry.stderr,/preparation was interrupted/);assert.equal(fs.readFileSync(path.join(f.destination,'packages/example/data.bin'),'utf8'),'partial');
});
test('mismatched cache HEAD retains exact Git fetch and checkout fallback',t=>{
 const f=fixture(t),original=hash(path.join(f.cache,'packages/example/data.bin'));
 fs.appendFileSync(path.join(f.cache,'packages/example/data.bin'),'next commit');f.git('add','.');f.git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','Different cache head');
 const before=f.snapshot(),result=f.run();assert.equal(result.status,0,result.stderr);assert.doesNotMatch(result.stdout,/Seeded/);assert.equal(hash(path.join(f.destination,'packages/example/data.bin')),original);assert.deepEqual(f.snapshot(),before);
});
test('copy-on-write hints retain correct independent files when the filesystem falls back to normal copying',t=>{
 const f=fixture(t),before=f.snapshot(),preload=path.join(f.directory,'fallback.mjs'),metrics=path.join(f.directory,'copies.json');
 f.write(preload,`import fs from 'node:fs';import child from 'node:child_process';import path from 'node:path';import {syncBuiltinESMExports} from 'node:module';const copy=fs.copyFileSync,run=child.execFileSync,copies=[];let nativeAttempts=0;child.execFileSync=(command,args,options)=>{if(command==='/bin/cp'){nativeAttempts++;throw Object.assign(Error('clone unsupported'),{code:'ENOTSUP'});}return run(command,args,options);};fs.copyFileSync=(source,target,flags)=>{const result=copy(source,target,flags&~fs.constants.COPYFILE_FICLONE),stat=fs.statSync(target);copies.push({target,bytes:fs.statSync(source).size,exclusive:!!(flags&fs.constants.COPYFILE_EXCL),inode:stat.ino,mtime:stat.mtimeMs});return result;};syncBuiltinESMExports();process.on('exit',()=>fs.writeFileSync(${JSON.stringify(metrics)},JSON.stringify({copies,nativeAttempts})));`);
 const result=f.run({preload});assert.equal(result.status,0,result.stderr);const measured=JSON.parse(fs.readFileSync(metrics)),copies=measured.copies;assert.ok(copies.length>0);assert.ok(copies.every(copy=>copy.exclusive&&fs.statSync(copy.target).ino===copy.inode&&fs.statSync(copy.target).mtimeMs===copy.mtime));if(process.platform==='darwin')assert.ok(measured.nativeAttempts<copies.length);assert.deepEqual(f.snapshot(),before);assert.equal(hash(path.join(f.destination,'packages/example/data.bin')),before.data);
 console.log(JSON.stringify({resourceGraph:{files:copies.length,trackedRegularBytes:copies.reduce((sum,copy)=>sum+copy.bytes,0),oldCheckoutMaterializedBytes:copies.reduce((sum,copy)=>sum+copy.bytes,0),nativeCloneProcesses:measured.nativeAttempts,normalCopyFallbackVerified:true}}));
});


test('clone helper provenance changes refuse reuse and existing APK copy semantics remain',t=>{
 const f=fixture(t),before=f.snapshot(),result=f.run();assert.equal(result.status,0,result.stderr);
 const helper=path.join(f.consumer,'scripts/copy-file-clone.mjs');fs.appendFileSync(helper,'\n');
 const changed=f.run();assert.notEqual(changed.status,0);assert.match(changed.stderr,/Prepared runtime differs/);assert.deepEqual(f.snapshot(),before);
 const copy=path.join(f.directory,'apk-copy');copyFilesClone([{source:path.join(f.cache,'packages/example/data.bin'),destination:copy}]);assert.equal(hash(copy),before.data);
 assert.throws(()=>copyFilesClone([{source:path.join(f.cache,'packages/example/data.bin'),destination:copy}],{exclusive:true}),error=>error.code==='EEXIST');assert.equal(hash(copy),before.data);
});


test('directory batches reduce real clone processes and preserve renamed files and bounded arguments',t=>{
 const f=fixture(t),before=f.snapshot(),files=f.git('ls-files','-z').split('\0').filter(Boolean).filter(name=>fs.lstatSync(path.join(f.cache,name)).isFile());
 const baseline=path.join(f.directory,'per-file'),batched=path.join(f.directory,'batched');
 const entries=directory=>files.map(name=>{const destination=path.join(directory,name);fs.mkdirSync(path.dirname(destination),{recursive:true});return {source:path.join(f.cache,name),destination};});
 const original=child.execFileSync,calls=[];
 child.execFileSync=(command,args,options)=>{if(command==='/bin/cp')calls.push(args);return original(command,args,options);};syncBuiltinESMExports();
 try{
  const one=entries(baseline),many=entries(batched);
  let start=performance.now();for(const file of one)copyFilesClone([file],{exclusive:true});const beforeMs=performance.now()-start,beforeProcesses=calls.length;
  start=performance.now();copyFilesClone(many,{exclusive:true});const afterMs=performance.now()-start,afterProcesses=calls.length-beforeProcesses;
  for(let index=0;index<one.length;index++)assert.equal(hash(one[index].destination),hash(many[index].destination));
  if(process.platform==='darwin'){assert.equal(beforeProcesses,files.length);assert.equal(afterProcesses,3);}
  console.log(JSON.stringify({copyPhase:{files:files.length,beforeProcesses,afterProcesses,beforeMs,afterMs}}));
  const long=path.join(f.directory,'long-sources'),target=path.join(f.directory,'long-target');fs.mkdirSync(long);fs.mkdirSync(target);
  const largeBatch=Array.from({length:240},(_,index)=>{const name=`part-${index}-`+'x'.repeat(210)+'.txt',source=path.join(long,name),destination=path.join(target,name);fs.writeFileSync(source,'small');return {source,destination};});
  const previous=calls.length;copyFilesClone(largeBatch,{exclusive:true});
  for(const file of largeBatch)assert.equal(fs.readFileSync(file.destination,'utf8'),'small');
  if(process.platform==='darwin'){assert.ok(calls.length-previous>=2);for(const args of calls.slice(previous))assert.ok(args.reduce((sum,arg)=>sum+Buffer.byteLength(arg)+16,0)<=64*1024);}
 }finally{child.execFileSync=original;syncBuiltinESMExports();}
 assert.deepEqual(f.snapshot(),before);
});
