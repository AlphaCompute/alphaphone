/** Real provider + real pinned runtime integration; never substitutes model replies. */
import { mkdtemp, readFile, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const dataDir=await mkdtemp(join(tmpdir(),'alpha-eliza-live-'));
const reports=[];
for(const mode of ['seed','recover','proposal']){
 const proc=Bun.spawn([process.execPath,resolve(import.meta.dir,'run.ts'),'--test-'+mode],{env:{...process.env,ALPHA_ELIZA_DATA_DIR:dataDir},stdout:'ignore',stderr:'ignore'});
 const exit=await proc.exited;
 if(exit!==0)throw new Error('Real runtime '+mode+' failed; retained private fixture '+dataDir);
 reports.push(JSON.parse(await readFile(join(dataDir,'report-'+mode+'.json'),'utf8')));
}
const out=resolve(import.meta.dir,'../test-results');await mkdir(out,{recursive:true});
await writeFile(join(out,'eliza-runtime.json'),JSON.stringify({testedAt:new Date().toISOString(),kind:'real-provider-pinned-runtime',reports},null,2));
console.log(JSON.stringify({passed:true,report:'test-results/eliza-runtime.json'}));
