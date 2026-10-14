import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
const built=buildSync({entryPoints:['apps/app/src/passwords/dev-vault.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {createDevelopmentVault}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].contents).toString('base64'));
test('development vault refuses the protected native editor without mutating records',async()=>{
 const vault=createDevelopmentVault();await vault.unlock();const before=await vault.list();
 await assert.rejects(vault.openEditor(),error=>error.code==='unavailable');
 assert.deepEqual(await vault.list(),before);
});
