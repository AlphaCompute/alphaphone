import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

// Reference patches 0077-0078 move the generic action journal into an upstream native plugin
// behind host config. Both only add files, so they are applied in series to an empty isolated
// directory (never vendor/eliza or .eliza/patched) and their upstream tests run there. Alpha's
// own AlphaActionJournalPlugin keeps serving the bridge until the module is included in Gradle;
// the slot-identity check pins that adoption will read every saved Alpha entry unchanged.
const root=path.resolve(import.meta.dirname,'..');
const eliza=path.join(root,'patches/eliza');
const series=[['0077-action-journal-android.patch','action-journal-android-source-base.json'],['0078-action-journal-client.patch','action-journal-client-source-base.json']];
const pin=JSON.parse(fs.readFileSync(path.join(root,'upstream.lock.json'),'utf8')).commit;
const alpha=fs.readFileSync(path.join(root,'android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaActionJournalPlugin.java'),'utf8');

function applied(t){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'action-journal-ref-'));
 t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 execFileSync('git',['init','-q',directory]);
 for(const [patch] of series){
  execFileSync('git',['apply','--check',path.join(eliza,patch)],{cwd:directory});
  execFileSync('git',['apply',path.join(eliza,patch)],{cwd:directory});
 }
 return path.join(directory,'plugins/plugin-native-action-journal');
}

test('reference manifests bind each patch to the pin, its hash and only added plugin files',()=>{
 for(const [patch,manifestName] of series){
  const manifest=JSON.parse(fs.readFileSync(path.join(eliza,manifestName),'utf8'));
  assert.equal(manifest.patch,patch);assert.equal(manifest.baseCommit,pin);
  assert.equal(manifest.patchSha256,createHash('sha256').update(fs.readFileSync(path.join(eliza,patch))).digest('hex'));
  const text=fs.readFileSync(path.join(eliza,patch),'utf8');
  const added=[...text.matchAll(/^\+\+\+ b\/(.+)$/gm)].map(match=>match[1]);
  assert.deepEqual(added,manifest.filesChanged);
  assert.ok(added.every(file=>file.startsWith('plugins/plugin-native-action-journal/')),patch);
  assert.equal((text.match(/^new file mode/gm)||[]).length,added.length,`${patch} only adds files`);
  // Reference-only: never materialized into Alpha's build.
  assert.equal(fs.existsSync(path.join(eliza,manifestName.replace('-source-base.json','-source.json'))),false);
 }
});

test('upstream action journal JVM and client tests pass on the patches applied in series',t=>{
 const plugin=applied(t);
 const {NODE_TEST_CONTEXT,...env}=process.env;
 for(const file of ['test/client.node.mjs','test/native-host/journal.node.mjs']){
  const output=execFileSync(process.execPath,['--test','--test-reporter=spec',path.join(plugin,file)],{encoding:'utf8',env,timeout:180000});
  assert.match(output,/ℹ fail 0/,file);assert.doesNotMatch(output,/ℹ pass 0\b/,file);
  if(/﹣|# SKIP/.test(output))t.diagnostic(`${file} skipped: org.json jar unavailable`);
 }
});

test('upstream slot identity and transition rules match the Alpha journal it replaces',t=>{
 const plugin=applied(t),java=path.join(plugin,'android/src/main/java/ai/eliza/plugins/actionjournal');
 const engine=fs.readFileSync(path.join(java,'ActionJournal.java'),'utf8'),config=fs.readFileSync(path.join(java,'ActionJournalConfiguration.java'),'utf8');
 // Slots: <namespace>:<scope>:entry:<id> and <namespace>:<scope>:index; Alpha's namespace is action-journal:v1.
 assert.match(engine,/configuration\.namespace \+ ":" \+ scope\(scope\) \+ ":entry:" \+ id\(id\)/);
 assert.match(engine,/configuration\.namespace \+ ":" \+ scope\(scope\) \+ ":index"/);
 assert.match(alpha,/"action-journal:v1:"\+scope\+":entry:"\+id/);
 assert.match(alpha,/"action-journal:v1:"\+scope\+":index"/);
 // Same bounds: 2048 entries, 64000-character records, 2000-character summaries.
 assert.match(config,/standard\(String namespace\) \{ return new ActionJournalConfiguration\(namespace, 2048, 64000, 2000\); \}/);
 assert.match(alpha,/index\.length\(\)>=2048/);assert.match(alpha,/record\.toString\(\)\.length\(\)>64000/);assert.match(alpha,/summary\.length\(\)>2000/);
 // Same order: index before entry; success only after a recorded dispatch.
 assert.ok(engine.indexOf('storage.write(indexSlot(scope), index.toString())')<engine.indexOf('writeEntry(scope, id, entry);\n   return new Reservation'),'index commits before the entry');
 assert.match(engine,/"succeeded"\.equals\(status\) && !"applying"\.equals\(entry\.getString\("phase"\)\)/);
 assert.match(alpha,/"succeeded"\.equals\(status\)&&!"applying"\.equals\(entry\.getString\("phase"\)\)/);
 // The upstream module performs no action, logs nothing and has no plaintext fallback.
 for(const name of fs.readdirSync(java)){
  const source=fs.readFileSync(path.join(java,name),'utf8');
  assert.doesNotMatch(source,/\bLog\.[a-z]+\(|printStackTrace|System\.(out|err)|SharedPreferences|startActivity|sendBroadcast/,name);
 }
});
