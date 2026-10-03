// Synthetic provider boundary: no request can leave this child process.
import http from 'node:http';
const listen=http.Server.prototype.listen;
http.Server.prototype.listen=function(port,host,callback){return listen.call(this,0,'127.0.0.1',()=>{process.send({port:this.address().port});callback?.();});};
globalThis.fetch=async(url,options={})=>{
 if(url==='https://provider.invalid/models')return Response.json({data:[{id:process.env.ALPHA_DEV_MODEL}]});
 if(url!=='https://provider.invalid/chat/completions')throw new Error('Unexpected synthetic provider request');
 const body=JSON.parse(options.body);const schema=body.tools.find(t=>t.function.name==='open_view').function.parameters.properties.view.enum;
 process.send({schema});
 const request=body.messages.at(-1).content;
 return Response.json({choices:[{message:{content:'Review this synthetic proposal.',tool_calls:[{function:{name:'open_view',arguments:JSON.stringify({view:request})}}]}}]});
};
