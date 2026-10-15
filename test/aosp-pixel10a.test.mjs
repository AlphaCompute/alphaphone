import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pixel10aOptions, writePixel10aProduct} from '../scripts/aosp-pixel10a.mjs';

test('physical target requires explicit development and exact source/factory inputs', () => {
  const options = {target:'pixel10a', development:true, source:'/source', factory:'/factory'};
  assert.equal(pixel10aOptions(options), true);
  assert.equal(pixel10aOptions({development:true, target:null}), false);
  assert.equal(pixel10aOptions({production:true}), false);
  for (const change of [{target:'stallion'}, {development:false}, {production:true}, {source:null}, {factory:null}]) assert.throws(() => pixel10aOptions({...options, ...change}));
  assert.throws(() => pixel10aOptions({factory:'/factory'}));
});

test('physical overlay installs ARM64 JNI and development product without boot claims', t => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-pixel-stage-'));
  t.after(() => fs.rmSync(temporary, {recursive:true, force:true}));
  const apk = path.join(temporary, 'input.apk'), output = path.join(temporary, 'overlay');
  fs.mkdirSync(output);
  execFileSync('python3', ['-c', "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1],'w'); z.writestr('lib/arm64-v8a/libcamera.so',b'\\x7fELF\\x02\\x01'+bytes(12)+b'\\xb7\\x00'+bytes(44)); z.close()", apk]);
  fs.writeFileSync(path.join(output, 'Android.bp'), '// Generated from a hash- and signer-verified downstream launcher.\nandroid_app_import {\n    name: "AlphaPhone",\n    apk: "Launcher.apk",\n    presigned: true,\n    preprocessed: true,\n    product_specific: true,\n    dex_preopt: { enabled: false },\n}\n');
  fs.writeFileSync(path.join(output, 'product.mk'), '# existing camera, clock and image capability\n');
  writePixel10aProduct({root:process.cwd(), output, apk, identity:{moduleName:'AlphaPhone'}, sourceEvidence:{fixture:true}});
  const product = fs.readFileSync(path.join(output, 'product.mk'), 'utf8');
  assert.match(product, /existing camera, clock and image capability/);
  assert.match(product, /TARGET_FS_CONFIG_GEN \+= vendor\/alphaphone\/config.fs/);
  assert.match(fs.readFileSync(path.join(output, 'AndroidProducts.mk'), 'utf8'), /alpha_stallion_phone/);
  assert.ok(fs.existsSync(path.join(output, 'stallion/vendor-config/Android.bp')));
  const report = JSON.parse(fs.readFileSync(path.join(output, 'physical-product.json')));
  assert.equal(report.developmentOnly, true);
  for (const key of ['imageBuilt','releaseQualified','deviceAcceptanceVerified']) assert.equal(report[key], false);
});

test('native admission fixtures cover corrupt provenance, policy, ELF and overlay inputs', () => {
  execFileSync('python3', ['test/aosp-native-fixtures.py'], {stdio:'pipe'});
});
