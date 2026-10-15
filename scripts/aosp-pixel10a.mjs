import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

export function pixel10aOptions({target, development, production, source, factory}) {
  if (target != null && target !== 'pixel10a') throw Error('Only --target pixel10a is supported; omit --target for the existing product');
  if (!target) {
    if (factory) throw Error('--factory-image requires --target pixel10a');
    return false;
  }
  if (!development || production) throw Error('Pixel 10a staging is development-only; production qualification remains blocked');
  if (!source || !factory) throw Error('Pixel 10a staging requires --aosp-source and --factory-image');
  return true;
}

export function writePixel10aProduct({root, output, apk, identity, sourceEvidence}) {
  execFileSync('python3', [path.join(root, 'scripts/stage-aosp-native.py'), '--apk', path.resolve(apk), '--output', output, '--module', identity.moduleName, '--target', 'stallion'], {stdio:'inherit'});
  const product = path.join(root, 'android/aosp/stallion');
  for (const name of ['AndroidProducts.mk', 'alpha_stallion_phone.mk']) fs.copyFileSync(path.join(product, name), path.join(output, name), fs.constants.COPYFILE_EXCL);
  fs.cpSync(product, path.join(output, 'stallion'), {recursive:true, errorOnExist:true, force:false});
  fs.appendFileSync(path.join(output, 'product.mk'), '\n# Exact ARM64 bundled JNI modes for this development product.\nTARGET_FS_CONFIG_GEN += vendor/alphaphone/config.fs\n');
  fs.writeFileSync(path.join(output, 'physical-product.json'), JSON.stringify({schema:1, target:'pixel10a', product:'alpha_stallion_phone', lunch:'alpha_stallion_phone-cp2a-userdebug', sourceEvidence, developmentOnly:true, imageBuilt:false, releaseQualified:false, deviceAcceptanceVerified:false}, null, 2) + '\n', {flag:'wx'});
}
