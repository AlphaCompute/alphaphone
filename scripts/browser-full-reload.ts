import type { Plugin } from 'vite';
import path from 'node:path';
import { realpathSync } from 'node:fs';
/** Prototype adapters patch class methods during bootstrap; replay the bootstrap once per edit. */
export function browserFullReload():Plugin {
 return {name:'alpha-browser-full-reload',enforce:'pre',handleHotUpdate(context){
   const relative=path.relative(realpathSync(context.server.config.root),realpathSync(context.file)).split(path.sep).join('/');
   if(relative.startsWith('src/')&&!relative.endsWith('.css')){context.server.ws.send({type:'full-reload',path:'*'});return [];}
 }};
}
