/** Private Google tool port. Never a browser or general Cloud proxy. */
import {lstat,readFile} from 'node:fs/promises';
import {timingSafeEqual} from 'node:crypto';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {createGmailAgentReadHost} from './gmail-agent-read-host.ts';
export function createGmailAgentDevBroker(options:{profile:string;tokenFile:string}){
 const reader=createGmailAgentReadHost(options.profile);
 return async(req:IncomingMessage,res:ServerResponse)=>{
  const send=(status:number,data:unknown)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  const controller=new AbortController();const closed=()=>{if(!res.writableEnded)controller.abort();};res.once('close',closed);
  try{
   if(req.method!=='POST'||!['','/','/__alpha-owner-gmail'].includes(req.url||'')||req.headers.origin||!/^127\.0\.0\.1:\d+$/.test(req.headers.host||'')){send(403,{error:'Private agent request required'});return;}
   const st=await lstat(options.tokenFile);if(!st.isFile()||st.isSymbolicLink()||st.uid!==process.getuid?.()||(st.mode&0o077))throw Error('Agent credential unavailable');
   const token=(await readFile(options.tokenFile,'utf8')).trim();if(!/^[a-f0-9]{64}$/.test(token))throw Error('Agent credential unavailable');
   const provided=Buffer.from(req.headers.authorization||''),expected=Buffer.from('Bearer '+token);
   if(provided.length!==expected.length||!timingSafeEqual(provided,expected)){send(401,{error:'Agent authentication required'});return;}
   const chunks:Buffer[]=[];let bytes=0;for await(const chunk of req){const part=Buffer.from(chunk);bytes+=part.length;if(bytes>256*1024)throw Error('Agent request too large');chunks.push(part);}
   const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['limit','query','since','messageId','calendar','send'].includes(key))||input.query!==undefined&&(typeof input.query!=='string'||input.query.length>4096)||input.since!==undefined&&typeof input.since!=='string'||input.send===undefined&&bytes>8192)throw Error('Invalid Google tool request');
   controller.signal.throwIfAborted();
   let result:unknown;
   if(input.send!==undefined){
    if(Object.keys(input).length!==1||!input.send||typeof input.send!=='object'||Array.isArray(input.send))throw Error('Invalid send operation');
    const s=input.send,keys=Object.keys(s).sort().join();
    if(s.operation==='prepare'&&keys==='bodyText,operation,requestId,subject,to')result={send:await reader.prepareSend(s,controller.signal)};
    else if(s.operation==='dispatch'&&keys==='bodyText,id,operation,reviewDigest,subject,to')result={send:await reader.dispatchSend(s,controller.signal)};
    else if(s.operation==='receipt'&&keys==='id,operation'&&typeof s.id==='string')result={send:await reader.sendReceipt(s.id,controller.signal)};
    else throw Error('Unsupported send operation');
   }else if(input.calendar!==undefined){
    if(Object.keys(input).length!==1||!input.calendar||typeof input.calendar!=='object'||Array.isArray(input.calendar))throw Error('Invalid Calendar read');
    const c=input.calendar;
    if(c.operation==='sources'&&Object.keys(c).length===1)result={calendars:await reader.calendarSources(controller.signal)};
    else if(c.operation==='feed'&&Object.keys(c).sort().join()===['operation','grantId','calendarId','timeMin','timeMax','timeZone'].sort().join()&&['grantId','calendarId','timeMin','timeMax','timeZone'].every(key=>typeof c[key]==='string'&&c[key].length<=1024))result={feed:await reader.calendarFeed(c,controller.signal)};
    else throw Error('Unsupported Calendar operation');
   }else if(input.messageId!==undefined){if(typeof input.messageId!=='string'||Object.keys(input).length!==1)throw Error('Invalid exact-message read');result={message:await reader.message(input.messageId,controller.signal)};}else result={items:await reader.list(input,controller.signal)};
   controller.signal.throwIfAborted();const body=JSON.stringify(result);if(Buffer.byteLength(body)>256*1024)throw Error('Gmail result too large');
   res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(body);
  }catch{if(!res.writableEnded&&!res.destroyed)send(409,{error:'Google request could not be verified. Check the current account, permissions, and any saved operation receipt before retrying.'});}
  finally{res.removeListener('close',closed);}
 };
}
