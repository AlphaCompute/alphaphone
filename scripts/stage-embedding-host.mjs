import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(import.meta.dirname,'..');
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const names=['libelizainference.so','libelizavoicejni.so','libc++_shared.so'];
const model={path:'android/app/src/main/assets/agent/models/bge-small-en-v1.5-f16.gguf',sha256:'f0b2fef971e8366438bfd2d9aefea1b0115919389448806d290237f638bae999',dimensions:384};
/** Build admission reads exact staged bytes; it never downloads or repairs a missing artifact. */
export function verifyEmbeddingHost(productRoot) {
 const manifest=JSON.parse(fs.readFileSync(path.join(productRoot,'android/embedding-host/qualified-host.json'),'utf8'));
 const pin=JSON.parse(fs.readFileSync(path.join(productRoot,'upstream.lock.json'),'utf8')).commit;
 const identity=JSON.parse(fs.readFileSync(path.join(productRoot,'app.config.json'),'utf8')).appId;
 if(manifest.pin!==pin||manifest.identity!==identity||manifest.abi!=='arm64-v8a'||manifest.model?.sha256!==model.sha256||manifest.model?.path!==model.path||manifest.model?.dimensions!==384)throw Error('Embedding host source, identity or model admission changed');
 if(!Array.isArray(manifest.libraries)||manifest.libraries.length!==names.length||new Set(manifest.libraries.map(row=>row.name)).size!==names.length)throw Error('Incomplete embedding host library set');
 for(const row of manifest.libraries){
  if(!names.includes(row.name)||!/^[a-f0-9]{64}$/.test(row.sha256)||row.alignment16KiB!==true)throw Error('Invalid qualified embedding library');
  const file=path.join(productRoot,'android/app/src/main/jniLibs',manifest.abi,row.name);
  if(!fs.existsSync(file)||fs.lstatSync(file).isSymbolicLink()||hash(file)!==row.sha256)throw Error('Qualified embedding host library missing or changed: '+row.name);
 }
 const file=path.join(productRoot,model.path);
 if(!fs.existsSync(file)||fs.lstatSync(file).isSymbolicLink()||hash(file)!==model.sha256)throw Error('Pinned BGE384 model missing or changed');
 return manifest;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 if(args.length===1&&args[0]==='--verify'){verifyEmbeddingHost(root);console.log('Qualified ARM64 embedding host and BGE384 bytes verified. No device execution claimed.');}
 else if(args.length===2&&args[0]==='--receipt'){
  const receipt=JSON.parse(fs.readFileSync(args[1],'utf8'));
  const pin=JSON.parse(fs.readFileSync(path.join(root,'upstream.lock.json'),'utf8')).commit,identity=JSON.parse(fs.readFileSync(path.join(root,'app.config.json'),'utf8')).appId;
  if(receipt.pin!==pin||receipt.identity!==identity||receipt.abi!=='arm64-v8a'||receipt.built!==true||!receipt.qualifiedAt||!Array.isArray(receipt.libraries)||receipt.libraries.length!==3)throw Error('Exact qualified ARM64 receipt required');
  const libraries=names.map(name=>{
   const matches=receipt.libraries.filter(row=>path.basename(row.path)===name);
   if(matches.length!==1)throw Error('Incomplete embedding host receipt');
   const row=matches[0];if(row.alignment16KiB!==true||hash(row.path)!==row.sha256)throw Error('Qualified library bytes changed');
   const target=path.join(root,'android/app/src/main/jniLibs',receipt.abi,name);
   if(fs.existsSync(target)&&(fs.lstatSync(target).isSymbolicLink()||hash(target)!==row.sha256))throw Error('Existing native library differs; review ownership before replacing '+name);
   return {name,sha256:row.sha256,bytes:row.bytes,alignment16KiB:true,source:row.path,target};
  });
  if(hash(path.join(root,model.path))!==model.sha256)throw Error('Pinned BGE model bytes changed');
  const manifest={pin,forkPin:receipt.forkPin,identity,abi:receipt.abi,model,libraries:libraries.map(({source,target,...row})=>row),qualificationReceiptSha256:hash(args[1]),jniIdentityRelocated:true};
  const manifestFile=path.join(root,'android/embedding-host/qualified-host.json');
  if(fs.existsSync(manifestFile)&&fs.readFileSync(manifestFile,'utf8')!==JSON.stringify(manifest,null,2)+'\n')throw Error('Existing embedding qualification differs; review before replacing');
  for(const row of libraries){fs.mkdirSync(path.dirname(row.target),{recursive:true});if(!fs.existsSync(row.target))fs.copyFileSync(row.source,row.target,fs.constants.COPYFILE_EXCL);}
  fs.mkdirSync(path.dirname(manifestFile),{recursive:true});fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');
  verifyEmbeddingHost(root);console.log('Qualified ARM64 embedding host staged. Runtime policy and Cloud text/speech unchanged.');
 }else throw Error('Usage: node scripts/stage-embedding-host.mjs --receipt <QUALIFICATION.json> | --verify');
}
