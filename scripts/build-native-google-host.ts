import fs from 'node:fs';
import path from 'node:path';

const [root,sdk,file,metadataFile]=process.argv.slice(2);
if(!root||!sdk||!file||!metadataFile)throw Error('Native host build paths are required');
const result=await Bun.build({
 entrypoints:[path.join(root,'backend/native-google-agent-host.ts')],
 target:'bun',format:'esm',minify:{syntax:true},conditions:['eliza-source'],
 tsconfig:path.join(sdk,'tsconfig.json'),metafile:true,
 define:{'import.meta.env':'{"VITE_ELIZA_DEV_ALLOW_TEST_MOCKS":"0"}'},
 plugins:[{name:'pinned-native-server-sdk',setup(builder){
  builder.onResolve({filter:/^@elizaos\//},args=>{
   const resolved=Bun.resolveSync(args.path,sdk),relative=path.relative(sdk,resolved);
   if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('Native server SDK import escaped its prepared source');
   return {path:resolved};
  });
 }}],
});
if(!result.success)throw new AggregateError(result.logs,'Native host compilation failed');
const output=result.outputs.find(item=>item.kind==='entry-point');
if(!output||!result.metafile)throw Error('Native host compiler did not produce its module and source graph');
await Bun.write(file,output);
const inputs:typeof result.metafile.inputs={};
for(const [name,value] of Object.entries(result.metafile.inputs)){
 const relative=path.relative(root,path.resolve(root,name));
 if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('Native host source graph escaped the product');
 inputs[relative.split(path.sep).join('/')]=value;
}
fs.writeFileSync(metadataFile,JSON.stringify({...result.metafile,inputs},null,2)+'\n');
