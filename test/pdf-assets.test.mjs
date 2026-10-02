import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,readdirSync} from 'node:fs';import {createRequire} from 'node:module';import path from 'node:path';
import {browserPdfAssets} from '../scripts/browser-pdf-assets.ts';
test('PDF distribution preserves upstream and font/decoder license files byte for byte',()=>{
 const root=path.dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'));const emitted=new Map();browserPdfAssets().generateBundle.call({emitFile:asset=>emitted.set(asset.fileName,asset.source)});
 const required=['LICENSE',...['cmaps','standard_fonts','wasm'].flatMap(dir=>readdirSync(path.join(root,dir)).filter(name=>name.startsWith('LICENSE')).map(name=>dir+'/'+name))];assert.ok(required.length>=9);
 for(const file of required)assert.deepEqual(emitted.get('pdfjs-assets/'+file),readFileSync(path.join(root,file)),file);
});
