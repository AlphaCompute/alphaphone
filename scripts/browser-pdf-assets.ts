import type { Plugin } from 'vite';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
/** Ship PDF fonts/CMaps/decoders locally in both web and APK distributions. */
export function browserPdfAssets():Plugin {
 const root=path.dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'));
 const assets=new Map<string,string>();
 for(const directory of ['cmaps','standard_fonts','wasm'])for(const file of readdirSync(path.join(root,directory)))assets.set(`pdfjs-assets/${directory}/${file}`,path.join(root,directory,file));
 assets.set('pdfjs-assets/LICENSE',path.join(root,'LICENSE'));
 return {name:'alpha-browser-pdf-assets',
  configureServer(server){server.middlewares.use((req,res,next)=>{const key=(req.url||'').split('?')[0].replace(/^\//,''),file=assets.get(key);if(!file)return next();res.setHeader('Content-Type',file.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.end(readFileSync(file));});},
  generateBundle(){for(const [fileName,file] of assets)this.emitFile({type:'asset',fileName,source:readFileSync(file)});},
 };
}
