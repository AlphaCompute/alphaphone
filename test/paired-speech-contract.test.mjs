import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const cache=path.join(os.homedir(),'.gradle/caches/modules-2/files-2.1/org.json/json/20250517');
const jar=process.env.ALPHA_JSON_JAR||(fs.existsSync(cache)?fs.readdirSync(cache).flatMap(hash=>fs.readdirSync(path.join(cache,hash)).filter(name=>name==='json-20250517.jar').map(name=>path.join(cache,hash,name)))[0]:undefined);
test('native paired speech accepts the pinned host contract and rejects stale providers, wrong identities and invalid text',{skip:!jar?'Pinned JSON JVM dependency unavailable':false},()=>{
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'alpha-paired-speech-'));
 try{const binary=name=>process.env.JAVA_HOME?path.join(process.env.JAVA_HOME,'bin',name):name;
 execFileSync(binary('javac'),['--release','11','-cp',jar,'-d',out,'android/app/src/main/java/ai/elizaresearch/alphaphone/PairedSpeechContract.java','test/fixtures/PairedSpeechContractTest.java']);
 assert.match(execFileSync(binary('java'),['-cp',out+':'+jar,'ai.elizaresearch.alphaphone.PairedSpeechContractTest'],{encoding:'utf8'}),/PASS paired speech exact contract/);
 }finally{fs.rmSync(out,{recursive:true,force:true});}
});
