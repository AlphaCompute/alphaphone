import {readFileSync} from 'node:fs';
import type {Plugin} from 'vite';
import {browserSpeechFiles,browserSpeechManifest,PUBLISHED} from './browser-speech-assets.mjs';

const TYPES:Record<string,string>={'.onnx':'application/octet-stream','.wasm':'application/wasm','.mjs':'text/javascript','.json':'application/json'};
const typeOf=(name:string)=>TYPES[name.slice(name.lastIndexOf('.'))]||'application/octet-stream';

/**
 * Publish the verified Whisper model and ONNX Runtime WebAssembly under browser-speech/.
 * A build without verified assets fails; the development server reports them as absent,
 * which the recorder shows as a model load failure with the type-instead path.
 */
export function browserSpeechAssets():Plugin {
  const load=()=>{
    const {config,files,problems}=browserSpeechFiles();
    return {problems,files,manifest:JSON.stringify(browserSpeechManifest(config,files))+'\n'};
  };
  return {name:'alpha-browser-speech-assets',
    configureServer(server){
      let state:ReturnType<typeof load>|undefined,warned=false;
      server.middlewares.use((req,res,next)=>{
        const url=(req.url||'').split('?')[0];
        if(!url.startsWith(`/${PUBLISHED}/`)){next();return;}
        if(req.method!=='GET'&&req.method!=='HEAD'){res.statusCode=405;res.end();return;}
        state??=load();
        if(state.problems.length){
          if(!warned){warned=true;server.config.logger.warn(`Browser speech assets unavailable (run npm run browser-speech:prepare):\n- ${state.problems.join('\n- ')}`);}
          res.statusCode=404;res.end();return;
        }
        const file=url===`/${PUBLISHED}/manifest.json`?{body:Buffer.from(state.manifest),type:'application/json'}:(()=>{const match=state!.files.find(item=>'/'+item.published===url);return match?{body:readFileSync(match.source),type:typeOf(match.published)}:undefined;})();
        if(!file){res.statusCode=404;res.end();return;}
        res.writeHead(200,{'Content-Type':file.type,'Content-Length':file.body.length,'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});
        res.end(req.method==='HEAD'?undefined:file.body);
      });
    },
    generateBundle(){
      const {problems,files,manifest}=load();
      if(problems.length)this.error(`Browser speech assets are not ready. Run npm run browser-speech:prepare.\n- ${problems.join('\n- ')}`);
      for(const file of files)this.emitFile({type:'asset',fileName:file.published,source:readFileSync(file.source)});
      this.emitFile({type:'asset',fileName:`${PUBLISHED}/manifest.json`,source:manifest});
    },
  };
}
