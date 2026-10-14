import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('native qualification binds the source, build record, models and device evidence',()=>{
 const result=spawnSync('python3',['-c',String.raw`
import importlib.util,tempfile,pathlib,zipfile,hashlib
spec=importlib.util.spec_from_file_location('qualification','scripts/local-speech/verify-apk-qualification.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
sha=lambda b:hashlib.sha256(b).hexdigest()
with tempfile.TemporaryDirectory() as folder:
 apk=pathlib.Path(folder)/'test.apk'
 model='assets/paradee-voice/v1/manifest.json'
 with zipfile.ZipFile(apk,'w') as z:
  z.writestr('lib/arm64-v8a/libparadeevoicejni.so',b'jni')
  z.writestr(model,b'model-inventory')
 record={'schemaVersion':2,'sourceCommit':'source','buildRecordSha256':'build','qualifiedAbis':[{'abi':'arm64-v8a','native':[{'file':'libparadeevoicejni.so','bytes':3,'sha256':sha(b'jni')}]}],'functionalAcceptance':{'passed':True,'abis':{'arm64-v8a':{'passed':True}}},'assets':[{'path':model,'bytes':15,'sha256':sha(b'model-inventory')}]}
 assert m.qualify_native(apk,record,'source','build')['qualified']
 assert not m.qualify_native(apk,record,'other','build')['qualified']
 assert not m.qualify_native(apk,record,'source','other')['qualified']
 record['assets'][0]['sha256']='0'*64
 assert not m.qualify_native(apk,record,'source','build')['qualified']
 record['assets']=[]
 assert not m.qualify_native(apk,record,'source','build')['qualified']
 record['functionalAcceptance']['passed']=False
 assert not m.qualify_native(apk,record,'source','build')['functionalPassed']
`],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
});
