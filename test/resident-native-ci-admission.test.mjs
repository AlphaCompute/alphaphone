import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
test('real CI source verifier binds the reviewed pair and rejects forged receipts, source and generated hashes',()=>{
 const result=execFileSync('python3',['-c',String.raw`
import sys,copy,json,hashlib,subprocess
from pathlib import Path
sys.path.insert(0,'scripts/ci')
from resident_native_source import verify_generated_native
h=lambda value:hashlib.sha256(value).hexdigest()
lock=json.loads(Path('upstream.lock.json').read_text())
code="import {preparePatchedNative,nativePatchReceipt} from './scripts/prepare-patched-native.mjs';console.log(JSON.stringify(nativePatchReceipt(preparePatchedNative({manifestFile:'resident-native-manifest.json'}))));"
receipt=json.loads(subprocess.check_output(['node','--input-type=module','-e',code],text=True))
generated={'runtimeSource':{'commit':lock['commit']},'patches':[receipt],'files':[]};frozen={}
for relative in ['scripts/prepare-patched-native.mjs','scripts/upstream-native-source.mjs','scripts/stage-local-agent-sources.mjs','patches/eliza/resident-native-manifest.json','patches/eliza/resident-ipc-recovery.patch']:
 frozen[relative]=h(Path(relative).read_bytes())
originals=list(receipt['files'])+['packages/app/platforms/android/app/src/main/java/ai/elizaos/app/SecureStoreFrameInput.java']
for index,origin in enumerate(originals):
 committed=subprocess.check_output(['git','-C','vendor/eliza','show',lock['commit']+':'+origin]);target='android/app/build/generated/local-agent/java/fixture'+str(index)+'.java';output=h(('synthetic identity-specific output '+str(index)).encode());frozen[target]=output
 generated['files'].append({'path':origin,'sourceSha256':h(committed),'sha256':receipt['files'].get(origin,h(committed)),'generatedPath':target,'generatedSha256':output})
assert verify_generated_native(generated,frozen)==receipt
mutations=[lambda g:g.update(patches=[]),lambda g:g['patches'][0].update(manifestSha256='0'*64),lambda g:g['files'][0].update(sourceSha256='0'*64),lambda g:g['files'][2].update(sha256='0'*64),lambda g:g['files'][0].update(generatedSha256='0'*64),lambda g:g['files'].pop(0)]
for mutate in mutations:
 changed=copy.deepcopy(generated);mutate(changed)
 try:verify_generated_native(changed,frozen)
 except AssertionError:pass
 else:raise AssertionError('Tampered native source was accepted')
changed=copy.deepcopy(frozen);changed['patches/eliza/resident-ipc-recovery.patch']='0'*64
try:verify_generated_native(generated,changed)
except AssertionError:pass
else:raise AssertionError('Changed build patch was accepted')
print('PASS: valid original/patched source plus seven tamper cases; no device actions')
`],{cwd:root,encoding:'utf8',timeout:30000,env:{...process.env,PATH:path.dirname(process.execPath)+path.delimiter+process.env.PATH}});
 assert.match(result,/PASS: valid original\/patched source plus seven tamper cases/);
});
