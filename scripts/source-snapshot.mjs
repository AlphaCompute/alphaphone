/** Record build input identities without capturing file contents or private state. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const roots=['apps/app/src','apps/app/public','android/app/src/main/java','android/app/src/main/res','android/app/src/androidTest','android/app/src/debug','android/app/src/main/AndroidManifest.xml','android/app/build.gradle','android/settings.gradle','capacitor.config.ts','vite.config.ts','package.json','package-lock.json','app.config.json'];
// Record flavor manifests and build policy as well as renderer/bridge sources.
// Generated web assets and Gradle output remain outputs, not source inputs.
roots.push('android/app/src/launcher','android/app/src/standalone','android/app/src/release',
 'android/build.gradle','android/variables.gradle','android/gradle.properties',
 'android/gradle/wrapper/gradle-wrapper.properties','android/gradle/wrapper/gradle-wrapper.jar',
 'android/gradlew','android/gradlew.bat','android/app/proguard-rules.pro',
 'android/notification-fixture/build.gradle','android/notification-fixture/src',
 'scripts/build-android.mjs','scripts/toolchain.mjs','scripts/verify-upstream.mjs',
 'scripts/verify-apks.mjs','scripts/apk.mjs','scripts/source-snapshot.mjs');
// Generated speech models and the qualified JNI archive are APK inputs, unlike
// Gradle outputs. Include their bytes so a model/runtime change invalidates the archive.
roots.push('android/local-speech/build.gradle','android/local-speech/consumer-rules.pro','android/local-speech/LICENSE',
 'android/local-speech/runtime-manifest.json','android/local-speech/libs',
 'android/local-speech/src');
if(fs.existsSync('scripts/local-speech'))for(const name of fs.readdirSync('scripts/local-speech').sort()){
 const entry=path.join('scripts/local-speech',name);
 if(fs.lstatSync(entry).isFile() && /\.(?:py|json|patch|md)$/.test(name))roots.push(entry);
}
const files=[];
function walk(entry){if(!fs.existsSync(entry))return;const stat=fs.lstatSync(entry);if(stat.isDirectory())for(const name of fs.readdirSync(entry).sort())walk(path.join(entry,name));else if(stat.isFile())files.push(entry);}
roots.forEach(walk);
const hashes=Object.fromEntries(files.sort().map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const digest=crypto.createHash('sha256').update(JSON.stringify(hashes)).digest('hex');
console.log(JSON.stringify({schemaVersion:3,digest,files:hashes},null,2));
