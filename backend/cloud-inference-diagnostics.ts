/** Failure metadata only. Never inspect an inference request's headers or body. */
const codes=new Set(['invalid_request_error','invalid_json_schema','unsupported_parameter','invalid_parameter','invalid_value','context_length_exceeded','missing_required_parameter','invalid_reasoning_effort']);
const fields=new Set(['model','messages','role','content','tools','tool_choice','function','name','parameters','response_format','type','json_schema','schema','strict','required','properties','additionalProperties','max_tokens','max_completion_tokens','temperature','top_p','reasoning_effort','stream','stop']);
type Diagnostic={status:400;code?:string;parameter?:string;reason?:'unsupported_parameter'|'invalid_schema'|'context_length_exceeded'|'invalid_request';metadata:'available'|'unavailable'};
const record=(value:unknown):Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
export function cloudFailureMetadata(value:unknown):Diagnostic{
 const body=record(value),error=record(body.error),result:Diagnostic={status:400,metadata:'available'};
 const code=error.code??body.code??error.type;if(typeof code==='string'&&codes.has(code))result.code=code;
 const parameter=error.param??error.parameter;
 if(typeof parameter==='string'&&parameter.length<=160){
  const segments=parameter.replace(/\[(\d+)\]/g,'.$1').split('.');
  if(segments.length<=12&&fields.has(segments[0])&&segments.every((part,index)=>fields.has(part)||/^\d{1,3}$/.test(part)&&index>0&&['messages','tools'].includes(segments[index-1])))result.parameter=parameter;
 }
 // Classifications are fixed labels; provider prose is never emitted.
 const message=typeof error.message==='string'?error.message:'';
 if(/context.{0,20}(length|window)|too many tokens/i.test(message))result.reason='context_length_exceeded';
 else if(/(invalid|unsupported).{0,30}(json schema|schema)|additionalProperties|required.{0,20}schema/i.test(message))result.reason='invalid_schema';
 else if(/unsupported.{0,20}(parameter|argument)|unknown.{0,20}parameter/i.test(message))result.reason='unsupported_parameter';
 else if(code==='invalid_request_error')result.reason='invalid_request';
 return result;
}
async function readFailure(response:Response,lifetime:AbortSignal):Promise<Diagnostic>{
 const reader=response.clone().body?.getReader();if(!reader)return {status:400,metadata:'unavailable'};
 const timeout=AbortSignal.timeout(750),abort=new AbortController();
 const cancel=()=>{abort.abort();void reader.cancel().catch(()=>{});};
 lifetime.addEventListener('abort',cancel,{once:true});timeout.addEventListener('abort',cancel,{once:true});
 const chunks:Uint8Array[]=[];let bytes=0;
 try{
  if(lifetime.aborted)cancel();
  while(!abort.signal.aborted){
   const next=await reader.read();if(next.done)break;
   bytes+=next.value.byteLength;if(bytes>16384)throw Error('Diagnostic limit');chunks.push(next.value);
  }
  if(abort.signal.aborted)throw Error('Diagnostic retired');
  const joined=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.byteLength;}
  return cloudFailureMetadata(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(joined)));
 }catch{return {status:400,metadata:'unavailable'};}
 finally{lifetime.removeEventListener('abort',cancel);timeout.removeEventListener('abort',cancel);void reader.cancel().catch(()=>{});}
}
/** Returns the original response immediately; diagnostic teardown never retries or affects it. */
export function cloudInferenceDiagnosticFetch(request:typeof fetch,report:(value:Diagnostic)=>void,lifetime:AbortSignal):typeof fetch{
 return async(input,init)=>{
  const response=await request(input,init);
  try{
   const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
   const method=init?.method??(input instanceof Request?input.method:'GET');
   if(!lifetime.aborted&&method.toUpperCase()==='POST'&&response.status===400&&url.href==='https://api.eliza.app/api/v1/chat/completions'){
    const emit=(value:Diagnostic)=>{if(!lifetime.aborted)try{report(value);}catch{/* Diagnostics cannot change inference. */}};
    void readFailure(response,lifetime).then(emit,()=>emit({status:400,metadata:'unavailable'}));
   }
  }catch{/* Unrecognized requests retain their original response. */}
  return response;
 };
}
