/** Pair the explicitly isolated combined host through the production phone protocol. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { RemoteProtocol } from '../apps/app/src/runtime/remote-protocol.ts';
const origin='http://127.0.0.1:47858';
const profile=path.resolve(process.env.ALPHA_COMBINED_PROFILE||path.join(os.homedir(),'.local/share/alphaphone/combined-agent-47858'));
const output=path.join(profile,'paired-session.json');
const stat=fs.lstatSync(profile);
assert.ok(stat.isDirectory()&&!stat.isSymbolicLink()&&stat.uid===process.getuid()&&(stat.mode&0o077)===0);
assert.equal(JSON.parse(fs.readFileSync(path.join(profile,'combined-profile.json'))).kind,'alphaphone-combined');
if(fs.existsSync(output))throw Error('Existing paired session retained; no replacement');
const transport=input=>new Promise((resolve,reject)=>{
 const req=http.request(input.url,{method:input.method,headers:{...input.headers,Host:'10.0.2.2:47858','X-Forwarded-For':'192.0.2.1'},signal:input.signal??AbortSignal.timeout(15000)},res=>{
  const chunks=[];let size=0;
  res.on('data',chunk=>{size+=chunk.length;if(size>65536)req.destroy(Error('Response bound'));else chunks.push(chunk);});
  res.on('error',reject);res.on('end',()=>{try{resolve({status:res.statusCode,body:JSON.parse(Buffer.concat(chunks).toString())});}catch{reject(Error('Invalid protocol response'));}});
 });req.on('error',reject);req.end(input.body);
});
let stored,stage='pair-code';
const client=new RemoteProtocol(origin,transport,{read:async()=>stored,write:async value=>{stored=value;},remove:async()=>{stored=null;}},{developmentOrigins:[origin]});
try{
 const ownerPath=path.join(profile,'owner-token'),ownerStat=fs.lstatSync(ownerPath);
 assert.ok(ownerStat.isFile()&&!ownerStat.isSymbolicLink()&&ownerStat.uid===process.getuid()&&(ownerStat.mode&0o077)===0);
 const response=await fetch(origin+'/api/auth/pair-code',{headers:{Authorization:`Bearer ${fs.readFileSync(ownerPath,'utf8').trim()}`},redirect:'error',signal:AbortSignal.timeout(15000)});
 assert.equal(response.status,200);const pair=await response.json();assert.equal(typeof pair.code,'string');
 stage='protocol-pair';const identity=await client.pair(pair.code,AbortSignal.timeout(30000));assert.equal(identity.role,'OWNER');assert.ok(stored?.token);
 fs.writeFileSync(output,JSON.stringify(stored)+'\n',{mode:0o600,flag:'wx'});
 console.log(JSON.stringify({paired:true,ownerVerified:true,sessionFile:output}));
}catch(error){console.error(JSON.stringify({paired:false,stage,kind:error?.name,code:typeof error?.code==='string'&&/^[a-z_]+$/.test(error.code)?error.code:undefined,status:typeof error?.status==='number'?error.status:undefined}));process.exitCode=1;}
