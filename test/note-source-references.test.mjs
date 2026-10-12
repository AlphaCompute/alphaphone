// J03 option (a): a note's linked source keeps its Android read grant while a note references it.
// Host-JVM run of the reference counting and source checks of where it is applied. Not Android
// evidence: no provider grant has been held or released on a device or emulator here.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {root,nativeSource,fixture,runJvm} from './fixtures/jvm-tools.mjs';

test('a grant is kept while any note references it and released with the last reference',()=>{
 assert.match(runJvm([nativeSource('NoteSourceReferences.java'),fixture('NoteSourceReferencesTest.java')],'ai.elizaresearch.alphaphone.NoteSourceReferencesTest'),/^PASS note source references/);
});

test('forgetting or evicting a picker selection never releases a grant a note link names',()=>{
 const access=readFileSync(nativeSource('SelectedDocumentAccess.java'),'utf8');
 assert.match(access,/private static void releaseUnused\(Uri uri,int flags\)\{\n  if\(uri==null\|\|flags==0\|\|selected\.containsValue\(uri\)\|\|referencedByNote\(uri\)\)return;/);
 const release=access.slice(access.indexOf('static synchronized boolean releaseUnreferenced('),access.indexOf('static synchronized void forget('));
 assert.match(release,/selected\.containsValue\(uri\)\|\|referencedByNote\(uri\)\)return false;/);
 assert.match(release,/if\(!grant\.getUri\(\)\.equals\(uri\)\)continue;/,'only the exact document grant, never a covering tree grant');
});

test('Notes reconcile references after every Trash maintenance pass and when a link is replaced',()=>{
 const plugin=readFileSync(nativeSource('AlphaMailAttachmentsPlugin.java'),'utf8');
 const method=plugin.slice(plugin.indexOf('@PluginMethod public void releaseSourceReferences('),plugin.indexOf('private JSObject saveResult('));
 assert.match(method,/List<String> seed=NoteSourceReferences\.unseeded\(all,times\.getAll\(\),now\);\n   if\(!seed\.isEmpty\(\)\)\{android\.content\.SharedPreferences\.Editor edit=times\.edit\(\);for\(String key:seed\)edit\.putLong\(key,now\);if\(!edit\.commit\(\)\)throw new IOException\(\);\}\n   List<String> drop=NoteSourceReferences\.unreferenced\(all,keep,times\.getAll\(\),now\);/,'retain times are stored and seeded before anything is pruned');
 assert.match(method,/for\(String uri:NoteSourceReferences\.orphaned\(all,drop\)\)if\(SelectedDocumentAccess\.releaseUnreferenced\(getContext\(\),Uri\.parse\(uri\)\)\)released\+\+;/);
 assert.match(plugin,/getSharedPreferences\(NoteSourceReferences\.RETAINED_PREFERENCES,0\)\.edit\(\)\.putLong\(reference,System\.currentTimeMillis\(\)\)\.commit\(\)\|\|!refs\.edit\(\)\.putString\(reference,uri\.toString\(\)\)\.commit\(\)/,'every retain (re)starts a stored grace period, before the reference is written');
 assert.doesNotMatch(plugin,/retainedAt\.put\(/,'the grace period does not live only in process memory');
 const trash=readFileSync(join(root,'apps/app/src/prototype/notes-trash-adapter.ts'),'utf8');
 assert.match(trash,/releaseUnusedSourceReferences\(\[\.\.\.await savedNotes\(\),\.\.\.\(await readNotesTrash\(\)\)\.entries\.map\(entry=>entry\.note\)\]\)/,'saved and restorable notes keep their links');
 const source=readFileSync(join(root,'apps/app/src/prototype/note-source-adapter.ts'),'utf8');
 assert.match(source,/await attachments\.releaseSourceReferences\(\{keep\}\);/);
 assert.match(source,/if\(source\?\.reference&&source\.reference!==next\?\.reference\)void api\.notesTrash\?\.maintain\?\.\(\);/);
});
