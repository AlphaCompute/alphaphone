import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'patches/eliza/android-local-runtime-source.json'),'utf8'));
const patch='clock-native-reviewed-executor.patch';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
if(!manifest.patches.includes(patch)||digest(fs.readFileSync(path.join(root,'patches/eliza',patch)))!==manifest.patchHashes[patch])throw Error('Clock executor upstream patch identity changed');
for(const name of ['clock-review-executor.ts','clock-contract.ts']){
 const source=`plugins/plugin-assistant/src/services/device-actions/${name}`;
 const bytes=fs.readFileSync(path.join(root,'patches/eliza/exports',name));
 if(!manifest.files[source]||digest(bytes)!==manifest.files[source])throw Error('Clock renderer export differs from authenticated upstream source');
}
console.log('Clock renderer exports match explicit upstream source identities');
