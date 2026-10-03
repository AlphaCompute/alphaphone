/** Verify, build both distributions and retain immutable matching app/test artifacts. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const [destination]=process.argv.slice(2);
assert.ok(destination && path.resolve(destination).startsWith(path.resolve('test-results')+path.sep), 'Use a new archive beneath test-results');
assert.ok(!fs.existsSync(destination), 'Archive already exists; preserve earlier evidence');
fs.mkdirSync(destination,{recursive:true});
const snapshot=()=>JSON.parse(execFileSync(process.execPath,['scripts/source-snapshot.mjs'],{encoding:'utf8'}));
// Generated native Java is a build input: finish its normal source admission
// before freezing the baseline. Gradle repeats this stage; final equality below
// still rejects any non-deterministic regeneration or later source drift.
const nativeStageLog=fs.openSync(path.join(destination,'native-source-prestage.log'),'wx');
try{execFileSync(process.execPath,['scripts/stage-local-agent-sources.mjs'],{stdio:['ignore',nativeStageLog,nativeStageLog],timeout:180000});}
finally{fs.closeSync(nativeStageLog);}
// Capacitor generates res/xml/config.xml, an authenticated native build input.
// Complete normal sync before freezing; the build repeats sync and equality
// below still rejects drift in this file or any other captured input.
const capacitorStageLog=fs.openSync(path.join(destination,'capacitor-prestage.log'),'wx');
try{execFileSync('npm',['run','android:sync'],{stdio:['ignore',capacitorStageLog,capacitorStageLog],timeout:600000});}
finally{fs.closeSync(capacitorStageLog);}
const before=snapshot();
fs.writeFileSync(path.join(destination,'inputs-before.json'),JSON.stringify(before,null,2));
fs.writeFileSync(path.join(destination,'configuration.json'),JSON.stringify({mapsConfigured:Boolean(process.env.VITE_MAPS_BASE_URL),startedAt:new Date().toISOString()},null,2));
for(const command of ['verify','android:build']){
 const log=fs.openSync(path.join(destination,command.replace(':','-')+'.log'),'wx');
 try{execFileSync('npm',['run',command],{stdio:['ignore',log,log],timeout:1200000});}
 finally{fs.closeSync(log);}
 console.log(command+': passed');
}
const after=snapshot();
fs.writeFileSync(path.join(destination,'inputs-after.json'),JSON.stringify(after,null,2));
assert.equal(after.digest,before.digest,'Build inputs changed; do not qualify this archive');
const manifest={};
function retain(source,name){const target=path.join(destination,name);fs.copyFileSync(source,target,fs.constants.COPYFILE_EXCL);manifest[name]=crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');}
for(const variant of ['standalone','launcher']){
 for(const suffix of ['debug','release-unsigned'])retain(`artifacts/${variant}-${suffix}.apk`,`${variant}-${suffix}.apk`);
 retain(`android/app/build/outputs/apk/androidTest/${variant}/debug/app-${variant}-debug-androidTest.apk`,`${variant}-androidTest.apk`);
}
fs.cpSync('web-dist',path.join(destination,'web-dist'),{recursive:true,errorOnExist:true,force:false});
fs.writeFileSync(path.join(destination,'apk-manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({archive:destination,sourceFingerprint:after.digest,apks:Object.keys(manifest).length}));
