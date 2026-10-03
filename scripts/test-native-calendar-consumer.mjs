import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const serial=process.env.ALPHA_CALENDAR_TEST_SERIAL;
if(!serial)throw Error('Set ALPHA_CALENDAR_TEST_SERIAL to an explicitly owned disposable emulator');
if(!/^emulator-[0-9]+$/.test(serial))throw Error('This disposable fixture requires an emulator');
const expected=process.env.ALPHA_CALENDAR_TEST_AVD;
if(!expected)throw Error('Set ALPHA_CALENDAR_TEST_AVD to the exact owned AVD name');
const adb=path.join(process.env.ANDROID_HOME??path.join(process.env.HOME,'Library/Android/sdk'),'platform-tools/adb');
const call=(args)=>execFileSync(adb,['-s',serial,...args],{encoding:'utf8',timeout:120000});
const avd=call(['emu','avd','name']).split(/\r?\n/)[0].trim();
if(avd!==expected)throw Error('Owned AVD identity mismatch');
const original=call(['shell','am','get-current-user']).trim();
if(original!=='0')throw Error('Fixture requires original owner user 0');
for(const pkg of ['example.calendar.consumer','example.calendar.consumer.test'])if(call(['shell','pm','list','packages',pkg]).trim())throw Error('Fixture package already installed; refusing to overwrite');
const output=path.join(root,'test-results',`native-calendar-consumer-${Date.now()}`);fs.mkdirSync(output,{recursive:true});
const fixture=path.join(root,'scripts/fixtures/native-calendar-consumer/build/outputs/apk');
const artifactHashes=Object.fromEntries(['debug/native-calendar-consumer-debug.apk','androidTest/debug/native-calendar-consumer-debug-androidTest.apk'].map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(fixture,file))).digest('hex')]));
const installed=[];let user;let evidence='';let primary;
try{
 const created=call(['shell','pm','create-user',`calendar-consumer-${Date.now()}`]);evidence+=created;
 const match=created.match(/Success: created user id (\d+)/);if(!match)throw Error('Could not create owned fixture user');user=match[1];if(user==='0')throw Error('Invalid disposable user');
 for(const [file,pkg] of [['debug/native-calendar-consumer-debug.apk','example.calendar.consumer'],['androidTest/debug/native-calendar-consumer-debug-androidTest.apk','example.calendar.consumer.test']]){
  const result=call(['install','--user',user,'-t',path.join(fixture,file)]);evidence+=result;if(!result.includes('Success'))throw Error('Fixture install failed');installed.push(pkg);
 }
 call(['shell','am','start-user','-w',user]);call(['shell','am','switch-user',user]);if(call(['shell','am','get-current-user']).trim()!==user)throw Error('Fixture user not foreground');
 for(const permission of ['READ_CALENDAR','WRITE_CALENDAR'])call(['shell','pm','grant','--user',user,'example.calendar.consumer',`android.permission.${permission}`]);
 const result=call(['shell','am','instrument','--user',user,'-w','-e','calendarCreationRecovery','1','-e','class','example.calendar.ConsumerCreationRecoveryTest','example.calendar.consumer.test/androidx.test.runner.AndroidJUnitRunner']);evidence+=result;
 if(!/OK \(1 test\)/.test(result)||/FAILURES!!!|INSTRUMENTATION_FAILED/.test(result))throw Error('Native Calendar consumer recovery did not pass');
}catch(error){primary=error;}
finally{
 const cleanup=[];
 try{call(['shell','am','switch-user',original]);if(call(['shell','am','get-current-user']).trim()!==original)throw Error('Original user not restored');cleanup.push('Original user restored');}catch(error){primary??=error;cleanup.push(String(error));}
 if(user&&user!=='0')try{if(call(['shell','pm','list','users']).includes(`UserInfo{${user}:`)){cleanup.push(call(['shell','am','stop-user','-w',user]));const result=call(['shell','pm','remove-user','--wait',user]);cleanup.push(result);}if(call(['shell','pm','list','users']).includes(`UserInfo{${user}:`))throw Error('Disposable user still present');}catch(error){primary??=error;cleanup.push(String(error));}
 for(const pkg of installed.reverse())try{cleanup.push(call(['uninstall',pkg]));if(call(['shell','pm','list','packages',pkg]).trim())throw Error('Fixture package remains installed');}catch(error){primary??=error;cleanup.push(String(error));}
 fs.writeFileSync(path.join(output,'instrumentation.log'),evidence);fs.writeFileSync(path.join(output,'cleanup.json'),JSON.stringify({serial,avd,user,artifactHashes,cleanup,passed:!primary,error:primary?.message},null,2));
}
console.log(output);if(primary)throw primary;
