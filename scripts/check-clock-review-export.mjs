import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
const upstream=path.join(root,'vendor/eliza');
const pin=JSON.parse(fs.readFileSync(path.join(root,'upstream.lock.json'),'utf8')).commit;
if(!/^[a-f0-9]{40}$/.test(pin)||execFileSync('git',['rev-parse','HEAD'],{cwd:upstream,encoding:'utf8'}).trim()!==pin)throw Error('Clock source pin changed');
for(const name of ['clock-review-executor.ts','clock-contract.ts']){
 const source=`plugins/plugin-assistant/src/services/device-actions/${name}`;
 const file=path.join(upstream,source);
 const stat=fs.lstatSync(file);
 if(!stat.isFile()||stat.isSymbolicLink()||!fs.readFileSync(file).equals(execFileSync('git',['show',`${pin}:${source}`],{cwd:upstream})))throw Error('Clock renderer source differs from pinned upstream');
}
console.log('Clock renderer imports verified pinned upstream sources');
