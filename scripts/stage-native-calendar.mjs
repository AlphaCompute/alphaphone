import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const metadata=JSON.parse(fs.readFileSync(path.join(root,'patches/eliza/native-calendar-android.json'),'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
if(metadata.patch!=='native-calendar-android.patch'||metadata.destination!=='plugins/plugin-native-calendar/android'||Object.keys(metadata.files).some(name=>!name.startsWith(metadata.destination+'/')||name.split('/').includes('..')))throw Error('Invalid Calendar source manifest');
const patch=path.join(root,'patches/eliza',metadata.patch);
if(sha(fs.readFileSync(patch))!==metadata.patchSha256)throw Error('Native Calendar patch identity changed');
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'alpha-calendar-source-'));
try {
 execFileSync('git',['init','--quiet',temporary],{stdio:'pipe'});
 execFileSync('git',['apply',patch],{stdio:'pipe',cwd:temporary});
 const paths=[];
 function walk(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){if(entry.name==='.git')continue;const target=path.join(directory,entry.name);if(entry.isDirectory())walk(target);else if(entry.isFile())paths.push(path.relative(temporary,target).split(path.sep).join('/'));else throw Error('Nonregular Calendar source');}}
 walk(temporary);
 if(paths.sort().join('\n')!==Object.keys(metadata.files).sort().join('\n'))throw Error('Unexpected Calendar source inventory');
 for(const [name,expected] of Object.entries(metadata.files))if(sha(fs.readFileSync(path.join(temporary,name)))!==expected)throw Error(`Calendar source identity mismatch: ${name}`);
 const output=path.join(root,'artifacts/native-calendar');
 const source=path.join(temporary,metadata.destination);
 // Only replace this regenerable artifact when content changes, preserving Gradle incremental input identity.
 if(!fs.existsSync(path.join(output,'.source-sha256'))||fs.readFileSync(path.join(output,'.source-sha256'),'utf8')!==metadata.patchSha256){
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.rmSync(output,{recursive:true,force:true});
  fs.cpSync(source,output,{recursive:true});
  fs.writeFileSync(path.join(output,'.source-sha256'),metadata.patchSha256);
 }else {
  const expectedNames=Object.keys(metadata.files).map(name=>path.relative(metadata.destination,name)).sort();
  const actualNames=[];
  function inspect(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){if(directory===output&&['build','.gradle','.source-sha256'].includes(entry.name))continue;const target=path.join(directory,entry.name);if(entry.isDirectory())inspect(target);else if(entry.isFile())actualNames.push(path.relative(output,target));else throw Error('Nonregular staged Calendar source');}}
  inspect(output);
  if(actualNames.sort().join('\n')!==expectedNames.join('\n'))throw Error('Unexpected staged Calendar source');
  for(const [name,expected] of Object.entries(metadata.files))if(sha(fs.readFileSync(path.join(output,path.relative(metadata.destination,name))))!==expected)throw Error('Staged Calendar source changed; remove artifacts/native-calendar and restage');
 }
 console.log(`Native Calendar source verified and staged (${paths.length} files)`);
}finally{fs.rmSync(temporary,{recursive:true,force:true});}
