import {dirname,join} from 'node:path';
import {localAgentStorage} from './local-agent-dev-storage.ts';
import type { Plugin } from 'vite';
import { readFileSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';

export const LOCAL_AGENT_BRIDGE_PATH='/__alpha-local-agent';
const LIMIT=2*1024*1024;
export function localAgentPathAllowed(path:unknown):path is string {
  if(typeof path!=='string'||path.length>2048||/[\\#%\r\n]/.test(path)||path.includes('..'))return false;
  return /^\/api\/(auth\/me|agents|status|conversations(?:\/[A-Za-z0-9_-]+(?:\/messages)?)?|client-devices\/[A-Za-z0-9_/-]+|workflow(?:\/[A-Za-z0-9_/?=&-]+)?)$/.test(path);
}
export function createLocalAgentDevHandler(options:{origin:string;tokenFile:string;request?:typeof fetch}) {
  const origin=new URL(options.origin);
  if(origin.protocol!=='http:'||origin.hostname!=='127.0.0.1'||origin.pathname!=='/'||origin.search||origin.hash||origin.username||origin.password)
    throw new Error('The development agent must use an explicit 127.0.0.1 HTTP origin.');
  const request=options.request||fetch;
  let pairing:Promise<{root:string;token:string;ownerId:string;expiresAt:number}>|undefined;
  async function session(root:string) {
    if(pairing){const saved=await pairing;if(saved.root===root&&saved.expiresAt>Date.now()+30000)return saved;pairing=undefined;}
    pairing=(async()=>{
      const headers={Authorization:`Bearer ${root}`,'Content-Type':'application/json'};
      const json=async(path:string,body?:unknown)=>{
        const result=await request(origin.origin+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(15000)});
        if(!result.ok)throw Error('Local owner enrollment failed');return result.json();
      };
      const status=await json('/api/auth/status');
      const code=await json('/api/auth/pair-code');
      const paired=await json('/api/auth/pair',{code:code.code,instanceId:status.instanceId});
      if(paired.access!=='owner'||typeof paired.token!=='string'||paired.instanceId!==status.instanceId)throw Error('Invalid local owner enrollment');
      const verified=await request(origin.origin+'/api/auth/me',{headers:{Authorization:`Bearer ${paired.token}`},redirect:'error',signal:AbortSignal.timeout(15000)});
      if(!verified.ok)throw Error('Local owner verification failed');
      const who=await verified.json();
      if(who.identity?.id!==paired.identityId||who.access?.role!=='OWNER'||who.session?.id!==paired.token||!Number.isFinite(who.session?.expiresAt)||who.session.expiresAt<=Date.now())throw Error('Invalid local owner identity');
      return {root,token:paired.token,ownerId:paired.identityId,expiresAt:who.session.expiresAt};
    })();
    try{return await pairing;}catch(error){pairing=undefined;throw error;}
  }
  return async(req:IncomingMessage,res:ServerResponse)=>{
    const fail=(status:number,message:string)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:message}));};
    const host=req.headers.host;
    if(!host||!/^127\.0\.0\.1:\d+$/.test(host)||req.headers.origin!==`http://${host}`||
       req.headers['x-alpha-local-agent']!=='1'||req.method!=='POST'||req.headers['content-type']!=='application/json'){
      fail(403,'Local development origin required');return;
    }
    const abort=new AbortController();
    const onClose=()=>{if(!res.writableEnded)abort.abort();};res.on('close',onClose);
    try{
      const chunks:Buffer[]=[];let size=0;
      for await(const chunk of req){size+=chunk.length;if(size>LIMIT){fail(413,'Request too large');return;}chunks.push(Buffer.from(chunk));}
      const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if(input.storage){const result=localAgentStorage(join(dirname(options.tokenFile),'browser-device'),input.storage);res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(result));return;}
      if(!localAgentPathAllowed(input.path)||!['GET','POST'].includes(input.method)||
         (input.body!==undefined&&typeof input.body!=='string')||
         (input.method==='GET'&&input.body!==undefined)) {fail(400,'Unsupported local request');return;}
      const stat=statSync(options.tokenFile);
      if(!stat.isFile()||(stat.mode&0o077)!==0)throw new Error('Private runtime credential required');
      const token=readFileSync(options.tokenFile,'utf8').trim();
      if(!/^[a-f0-9]{64}$/.test(token))throw new Error('Invalid runtime credential');
      const credential=await session(token);
      if(input.ownerId!==undefined&&input.ownerId!==credential.ownerId){fail(409,'Local owner changed; reconnect before continuing');return;}
      const headers:Record<string,string>={Accept:'application/json','Content-Type':'application/json',Authorization:`Bearer ${credential.token}`};
      for(const key of ['X-Eliza-Device-Id','X-Eliza-Device-Key','X-Eliza-Device-Capabilities']){
        const value=input.headers?.[key];if(value!==undefined){if(typeof value!=='string'||value.length>2048||/[\r\n]/.test(value))throw new Error('Invalid device header');headers[key]=value;}
      }
      const result=await request(origin.origin+input.path,{method:input.method,headers,body:input.body,redirect:'error',
        signal:AbortSignal.any([abort.signal,AbortSignal.timeout(120000)])});
      const reader=result.body?.getReader();let received=0;const output:Uint8Array[]=[];
      if(reader)try{while(true){const item=await reader.read();if(item.done)break;received+=item.value.length;if(received>LIMIT)throw new Error('Response too large');output.push(item.value);}}finally{await reader.cancel();}
      if(abort.signal.aborted)return;
      res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      let body=Buffer.concat(output).toString('utf8');
      // The upstream machine session ID is its bearer token. Keep it on the host.
      if(input.path==='/api/auth/me'&&result.status===200){const who=JSON.parse(body);if(who.session)who.session.id='host-owned-session';body=JSON.stringify(who);}
      if(result.status===401)pairing=undefined; // Never replay the failed request.
      res.end(JSON.stringify({status:result.status,body}));
    }catch{if(!res.headersSent&&!abort.signal.aborted)fail(503,'Local runtime unavailable. Check the private host log.');}
    finally{res.off('close',onClose);}
  };
}
export function localAgentDevBridge():Plugin {
  return {name:'alpha-local-agent-development',apply:'serve',configureServer(server){
    if(process.env.VITE_LOCAL_AGENT!=='1')return;
    const tokenFile=process.env.ALPHA_LOCAL_AGENT_TOKEN_FILE;
    if(!tokenFile)throw new Error('ALPHA_LOCAL_AGENT_TOKEN_FILE is required for browser agent development.');
    const handler=createLocalAgentDevHandler({origin:process.env.ALPHA_LOCAL_AGENT_ORIGIN||'http://127.0.0.1:47839',tokenFile});
    server.middlewares.use((req,res,next)=>{if(req.url!==LOCAL_AGENT_BRIDGE_PATH){next();return;}void handler(req,res);});
  }};
}
