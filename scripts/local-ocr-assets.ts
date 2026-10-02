import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
import type {Plugin} from 'vite';

/** Ship every supported LSTM core locally: no worker, model or WASM CDN fallback. */
export function localOcrAssets():Plugin {
  const require=createRequire(import.meta.url);
  const files=new Map<string,{source:Buffer;type:string}>();
  const add=(name:string,pkg:string,path:string,type:string)=>files.set(name,{source:readFileSync(join(dirname(require.resolve(pkg+'/package.json')),path)),type});
  const initialize=()=>{
    if(files.size)return;
    add('worker.min.js','tesseract.js','dist/worker.min.js','text/javascript');
    for(const variant of ['lstm','simd-lstm','relaxedsimd-lstm'])add(`tesseract-core-${variant}.wasm.js`,'tesseract.js-core',`tesseract-core-${variant}.wasm.js`,'text/javascript');
    add('eng.traineddata.gz','@tesseract.js-data/eng','4.0.0_best_int/eng.traineddata.gz','application/gzip');
    add('tesseract-LICENSE.txt','tesseract.js','LICENSE.md','text/plain');
    add('core-LICENSE.txt','tesseract.js-core','LICENSE','text/plain');
    files.set('tessdata-LICENSE.txt',{source:readFileSync(new URL('../licenses/tessdata-APACHE-2.0.txt',import.meta.url)),type:'text/plain'});
  };
  return {name:'alpha-local-ocr-assets',
    configureServer(server){initialize();server.middlewares.use((req,res,next)=>{
      const name=req.url?.startsWith('/ocr/')?req.url.slice(5):'';
      const file=files.get(name);if(!file){next();return;}
      if(req.method!=='GET'&&req.method!=='HEAD'){res.statusCode=405;res.end();return;}
      res.writeHead(200,{'Content-Type':file.type,'Content-Length':file.source.length,'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});
      res.end(req.method==='HEAD'?undefined:file.source);
    });},
    generateBundle(){initialize();for(const [name,file]of files)this.emitFile({type:'asset',fileName:'ocr/'+name,source:file.source});},
  };
}
