import type {RemoteChatReply} from './remote-protocol';

/** Render text only. Tool/status frames never become proposals or approvals. */
export async function readLocalAgentStream(response:Response, signal:AbortSignal, onText:(text:string)=>void):Promise<RemoteChatReply> {
 if(!response.ok)throw Object.assign(Error(`Local agent request failed (HTTP ${response.status}).`),{status:response.status});
 if(!response.headers.get('content-type')?.startsWith('text/event-stream')||!response.body)throw Error('Invalid local stream response');
 const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});
 let text='',received=0,lineParts:string[]=[],lines:string[]=[];
 const abort=()=>{void reader.cancel().catch(()=>{});};
 signal.addEventListener('abort',abort,{once:true});
 function frame(raw:string):RemoteChatReply|undefined {
  const data=raw.split('\n').filter(line=>line.startsWith('data:')).map(line=>line.slice(5).replace(/^ /,'')).join('\n');
  if(!data)return;
  const value=JSON.parse(data);
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid stream event');
  if(value.type==='error')throw Error('Local agent response interrupted. Check conversation and action history before retrying.');
  if(value.type==='token'){
   if(typeof value.fullText==='string')text=value.fullText;
   else if(typeof value.text==='string')text+=value.text;
   else throw Error('Invalid stream text');
   if(text.length>200000)throw Error('Local reply exceeds display limit');
   signal.throwIfAborted();onText(text);
  }
  if(value.type==='done'){
   if(typeof value.fullText!=='string'||value.fullText.length>200000||typeof value.agentName!=='string')throw Error('Invalid terminal reply');
   return {...value,text:value.fullText} as RemoteChatReply;
  }
 }
 try {
  while(true){
   signal.throwIfAborted();const part=await reader.read();signal.throwIfAborted();
   if(part.done)throw Error('Local agent stream ended without a completed reply. Check history before retrying.');
   received+=part.value.byteLength;if(received>2*1024*1024)throw Error('Local stream exceeds limit');
   const chunk=decoder.decode(part.value,{stream:true});let start=0,boundary;
   // Scan only new data. Re-scanning an accumulated frame is quadratic when
   // a server fragments a long token or terminal event into tiny chunks.
   while((boundary=chunk.indexOf('\n',start))!==-1){
    lineParts.push(chunk.slice(start,boundary));const line=lineParts.join('').replace(/\r$/,'');lineParts=[];start=boundary+1;
    if(line===''){const result=frame(lines.join('\n'));lines=[];if(result)return result;}else lines.push(line);
   }
   if(start<chunk.length)lineParts.push(chunk.slice(start));
  }
 } finally {signal.removeEventListener('abort',abort);await reader.cancel().catch(()=>{});reader.releaseLock();}
}
