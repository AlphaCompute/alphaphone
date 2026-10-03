import type { Plugin } from 'vite';
import path from 'node:path';
import { realpathSync,readFileSync,readdirSync } from 'node:fs';
import {createHash} from 'node:crypto';
/** Prototype adapters patch class methods during bootstrap; replay once per content edit. */
export function browserFullReload():Plugin {
 const fingerprints=new Map<string,string>();
 const fingerprint=(file:string)=>createHash('sha256').update(readFileSync(file)).digest('hex');
 const snapshot=(directory:string)=>{for(const entry of readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory())snapshot(file);else if(entry.isFile())fingerprints.set(file,fingerprint(file));}};
 return {name:'alpha-browser-full-reload',enforce:'pre',configureServer(server){
   // macOS can deliver queued filesystem notifications after the new server starts.
   // Compare bytes, not event timestamps, so real edits with preserved mtimes still work.
   snapshot(path.join(realpathSync(server.config.root),'src'));
 },handleHotUpdate(context){
   const file=realpathSync(context.file),relative=path.relative(realpathSync(context.server.config.root),file).split(path.sep).join('/');
   if(!relative.startsWith('src/'))return;
   const current=fingerprint(file);if(fingerprints.get(file)===current)return [];fingerprints.set(file,current);
   if(!relative.endsWith('.css')){context.server.ws.send({type:'full-reload',path:'*'});return [];}
 }};
}
