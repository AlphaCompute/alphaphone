import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {stripTypeScriptTypes} from 'node:module';
const source=readFileSync('apps/app/src/runtime/notes-secure-store.ts','utf8');
const region=source.slice(source.indexOf('// notes-draft-changes:begin'),source.indexOf('// notes-draft-changes:end'));
assert.ok(region.length>100);
const {notesDraftChanges,applyNotesDraft}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(region,{mode:'transform'})).toString('base64'));
const note=(id,body)=>({id,kind:'text',title:id,body,pinned:false});
const saved=[note('a','A'),note('b','B'),note('c','C')];
test('a draft records only edits, creations and removals',()=>{
 const attempted=[note('new','N'),note('a','A edited'),note('b','B')];
 const draft=notesDraftChanges(attempted,saved);
 assert.deepEqual(draft,{records:[note('new','N'),note('a','A edited')],added:['new'],removed:['c']});
});
test('applying a draft over the unchanged collection reproduces the attempted list',()=>{
 const attempted=[note('new','N'),note('a','A edited'),note('b','B')];
 assert.deepEqual(applyNotesDraft(saved,notesDraftChanges(attempted,saved)),attempted);
});
test('a completed uncertain commit leaves nothing to apply',()=>{
 const attempted=[note('new','N'),note('a','A edited')];
 assert.deepEqual(applyNotesDraft(attempted,notesDraftChanges(attempted,saved)),attempted);
});
test('newer saved edits survive and a note deleted since is not revived',()=>{
 const draft=notesDraftChanges([note('a','A draft'),note('b','B'),note('c','C'),note('n','New')],saved);
 const later=[note('b','B newer'),note('c','C')];// a was deleted elsewhere; b edited elsewhere
 assert.deepEqual(applyNotesDraft(later,draft),[note('n','New'),note('b','B newer'),note('c','C')]);
});
