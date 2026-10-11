import {test,expect,type Page} from '@playwright/test';
// MVP-15: startup backstop for a permanent voice deletion ("Delete forever without Trash") that
// process death interrupted. Each test writes the exact durable state a killed process leaves
// (recovery row, tombstone, recording receipts), restarts, and stays on Home: the deletion must be
// finished or rolled back by the startup pass, never by opening Notes.
// Browser build only. The Android slot store and the native backstop
// (NotesTrashBackstopInstrumentedTest) are separate gates and are not exercised here.
test.describe.configure({timeout:60_000});
type Stage='row'|'tombstone'|'trashed'|'recording-trashed-first'|'recording-erased-first';
const savedRecords=(page:Page)=>page.evaluate(async()=>JSON.parse(await (await import('/src/runtime/browser-notes-document.ts')).readBrowserNotesRaw()).records as any[]);
const tombstones=(page:Page)=>page.evaluate(async()=>JSON.parse(await (await import('/src/runtime/browser-notes-document.ts')).readBrowserNotesRaw()).deleted as any[]);
const trashEntries=(page:Page)=>page.evaluate(async()=>(await (await import('/src/runtime/notes-trash.ts')).readNotesTrash()).entries as any[]);
const pendingDeletions=(page:Page)=>page.evaluate(async()=>Object.values(await (await import('/src/runtime/note-audio-deletions.ts')).pendingAudioDeletions()) as any[]);
const describeAudio=(page:Page,audioId:string)=>page.evaluate(async audioId=>{const {registerPlugin}=await import('/src/platform-plugins.ts');return registerPlugin<any>('AlphaNoteAudio').describe({audioId});},audioId);
const audioBytes=(page:Page,audioId:string)=>page.evaluate(async audioId=>(await (await import('/src/browser/note-audio-store.ts')).audioRecord(audioId,true)).blob.size,audioId);
async function openNotes(page:Page){await page.getByRole('button',{name:'Notes',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-notes-storage-state','ready');}
async function start(page:Page){
 await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));
 await page.goto('/');
}
async function seedVoice(page:Page,noteId:string,audioId:string,title:string,words:string){
 await page.evaluate(async({noteId,audioId,title,words})=>{
  const {openBrowserNotes}=await import('/src/runtime/browser-notes-document.ts');const {retainAudio}=await import('/src/browser/note-audio-store.ts');
  const audio=await retainAudio(audioId,noteId,words,{blob:new Blob(['synthetic'],{type:'audio/wav'}),durationMs:1000});
  const store=await openBrowserNotes();
  await store.replace([...store.list,{id:noteId,kind:'voice',title,body:words,audio,dur:1,lines:[],summary:[],actions:[]}]);
 },{noteId,audioId,title,words});
}
/**
 * The durable state of a permanent deletion killed at `stage`, written with the product's own
 * storage modules in the product's own order (or, for the two "-first" stages, with the recording
 * effect ahead of the note). Returns the deletion's operation id.
 *
 * The writer takes the deletion-effects lock and, like a process that is killed, never releases
 * it: this page cannot settle anything afterwards. Only the reload (the restart) frees the lock,
 * so whatever is settled later was settled by the next start.
 */
async function interrupt(page:Page,noteId:string,stage:Stage){
 return page.evaluate(async({noteId,stage})=>{
  const {openBrowserNotes}=await import('/src/runtime/browser-notes-document.ts');
  const deletions=await import('/src/runtime/note-audio-deletions.ts');
  const audio=await import('/src/browser/note-audio-store.ts');
  const store=await openBrowserNotes(),note=store.list.find((n:any)=>n.id===noteId) as any;
  const row={id:crypto.randomUUID(),target:await store.target(noteId),note,audioId:note.audio.audioId,permanent:true as const};
  await ((window as any).deletionLockHeld??=new Promise<void>(held=>void navigator.locks.request('alpha.notes-audio-effects.v1',()=>{held();return new Promise(()=>{});})));
  await deletions.changeAudioDeletion(row as any,true);
  if(stage==='tombstone'||stage==='trashed')await store.execute({type:'notes_delete',target:row.target} as any,row.id,new AbortController().signal,()=>{});
  if(stage!=='row'&&stage!=='tombstone')await audio.changeAudioDeleted(row.audioId,noteId,true,row.id);
  if(stage==='recording-erased-first')await audio.purgeAudio(row.audioId,noteId,row.id);
  return row.id;
 },{noteId,stage});
}
async function expectNoReview(page:Page){
 await openNotes(page);
 await expect(page.getByRole('button',{name:'Check deletion status',exact:true})).toHaveCount(0);
 await expect(page.getByText('Voice note deletion needs review.',{exact:false})).toHaveCount(0);
}

test('death after the tombstone commit, before the recording moved: startup finishes the erase for that recording only, without opening Notes',async({page})=>{
 await start(page);
 await seedVoice(page,'cut-voice','cut-audio','Cut memo','Interrupted words');
 await seedVoice(page,'other-voice','other-audio','Other memo','Words to keep');
 const other=(await savedRecords(page)).find(n=>n.id==='other-voice');
 const operation=await interrupt(page,'cut-voice','tombstone');
 // What the killed process left: tombstone committed, recording live and playable, one recovery row.
 expect((await savedRecords(page)).map(n=>n.id)).toEqual(['other-voice']);
 expect((await tombstones(page)).map(d=>[d.id,d.operationId])).toEqual([['cut-voice',operation]]);
 expect((await pendingDeletions(page)).map(row=>[row.id,row.note.id,row.audioId,row.permanent])).toEqual([[operation,'cut-voice','cut-audio',true]]);
 const live=await describeAudio(page,'cut-audio');
 expect(live.transcript).toBe('Interrupted words');expect(live.deletedAt).toBeUndefined();expect(live.deletionOperations).toBeUndefined();

 await page.reload();
 await expect(page.locator('html')).not.toHaveAttribute('data-active-view','notes');
 await expect.poll(()=>pendingDeletions(page)).toEqual([]);
 const erased=await describeAudio(page,'cut-audio');
 expect(erased.noteId).toBe('cut-voice');expect(erased.transcript).toBe('');expect(erased.expired).toBe(true);
 expect(erased.deletionOperations).toEqual({[operation]:'purged'});expect(erased.activeDeletionOperation).toBe(operation);
 expect(await audioBytes(page,'cut-audio')).toBe(0);
 // Exact ownership: the other note and its recording are byte-identical and untouched.
 expect(await savedRecords(page)).toEqual([other]);
 const kept=await describeAudio(page,'other-audio');
 expect(kept.transcript).toBe('Words to keep');expect(kept.deletedAt).toBeUndefined();expect(kept.deletionOperations).toBeUndefined();
 expect(await audioBytes(page,'other-audio')).toBeGreaterThan(0);
 // A permanent deletion never leaves a restorable copy.
 expect(await trashEntries(page)).toEqual([]);
 await expectNoReview(page);
 await expect(page.getByRole('button',{name:'Open Other memo',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Open Cut memo',exact:true})).toHaveCount(0);
 // A further restart repeats nothing.
 await page.reload();
 await expect.poll(()=>pendingDeletions(page)).toEqual([]);
 expect((await describeAudio(page,'cut-audio')).deletionOperations).toEqual({[operation]:'purged'});
 expect(await savedRecords(page)).toEqual([other]);
});

test('death after the recording reached the audio trash, before its erase: startup erases it on Home',async({page})=>{
 await start(page);
 await seedVoice(page,'held-voice','held-audio','Held memo','Held words');
 const operation=await interrupt(page,'held-voice','trashed');
 const held=await describeAudio(page,'held-audio');
 expect(held.transcript).toBe('Held words');expect(held.deletionOperations).toEqual({[operation]:'removed'});
 expect((await pendingDeletions(page)).map(row=>row.id)).toEqual([operation]);

 await page.reload();
 await expect(page.locator('html')).not.toHaveAttribute('data-active-view','notes');
 await expect.poll(()=>pendingDeletions(page)).toEqual([]);
 const erased=await describeAudio(page,'held-audio');
 expect(erased.transcript).toBe('');expect(erased.expired).toBe(true);expect(erased.deletionOperations).toEqual({[operation]:'purged'});
 expect(await savedRecords(page)).toEqual([]);
 await expectNoReview(page);
});

test('death before the tombstone commit: startup rolls back, and the note and its recording are exactly as they were',async({page})=>{
 await start(page);
 await seedVoice(page,'kept-voice','kept-audio','Kept memo','Never deleted');
 const before=await savedRecords(page),audioBefore=await describeAudio(page,'kept-audio');
 await interrupt(page,'kept-voice','row');
 expect((await pendingDeletions(page)).map(row=>[row.note.id,row.permanent])).toEqual([['kept-voice',true]]);

 await page.reload();
 await expect(page.locator('html')).not.toHaveAttribute('data-active-view','notes');
 await expect.poll(()=>pendingDeletions(page)).toEqual([]);
 expect(await savedRecords(page)).toEqual(before);
 expect(await tombstones(page)).toEqual([]);
 expect(await describeAudio(page,'kept-audio')).toEqual(audioBefore);
 expect(await audioBytes(page,'kept-audio')).toBeGreaterThan(0);
 await expectNoReview(page);
 await expect(page.getByRole('button',{name:'Open Kept memo',exact:true})).toBeVisible();
});

test('the other order: a recording moved or erased before its note was deleted is rolled back or finished for that exact note',async({page})=>{
 await start(page);
 await seedVoice(page,'moved-voice','moved-audio','Moved memo','Moved words');
 await seedVoice(page,'erased-voice','erased-audio','Erased memo','Erased words');
 await seedVoice(page,'bystander-voice','bystander-audio','Bystander memo','Bystander words');
 const before=await savedRecords(page);
 const moved=await interrupt(page,'moved-voice','recording-trashed-first');
 const erasedOperation=await interrupt(page,'erased-voice','recording-erased-first');
 expect((await savedRecords(page)).length).toBe(3);
 expect((await pendingDeletions(page)).map(row=>row.id).sort()).toEqual([moved,erasedOperation].sort());
 expect((await describeAudio(page,'moved-audio')).deletionOperations).toEqual({[moved]:'removed'});
 expect((await describeAudio(page,'erased-audio')).deletionOperations).toEqual({[erasedOperation]:'purged'});

 await page.reload();
 await expect(page.locator('html')).not.toHaveAttribute('data-active-view','notes');
 await expect.poll(()=>pendingDeletions(page)).toEqual([]);
 // Recording in the audio trash, note still saved: the recording is given back to its note.
 const restored=await describeAudio(page,'moved-audio');
 expect(restored.deletedAt).toBeUndefined();expect(restored.activeDeletionOperation).toBeUndefined();
 expect(restored.transcript).toBe('Moved words');expect(restored.deletionOperations).toEqual({[moved]:'restored'});
 expect(await audioBytes(page,'moved-audio')).toBeGreaterThan(0);
 // Recording already erased under the confirmed deletion: the exact reviewed note is deleted with this operation's tombstone.
 expect((await savedRecords(page))).toEqual(before.filter(n=>n.id!=='erased-voice'));
 expect((await tombstones(page)).map(d=>[d.id,d.operationId])).toEqual([['erased-voice',erasedOperation]]);
 expect((await describeAudio(page,'erased-audio')).deletionOperations).toEqual({[erasedOperation]:'purged'});
 const bystander=await describeAudio(page,'bystander-audio');
 expect(bystander.transcript).toBe('Bystander words');expect(bystander.deletionOperations).toBeUndefined();
 await expectNoReview(page);
 await expect(page.getByRole('button',{name:'Open Moved memo',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Open Erased memo',exact:true})).toHaveCount(0);
});

test('startup never erases a recording that a different or a restored note owns; those deletions stay under review',async({page})=>{
 await start(page);
 await seedVoice(page,'shared-voice','shared-audio','Shared memo','Shared words');
 await seedVoice(page,'edited-voice','edited-audio','Edited memo','First words');
 await seedVoice(page,'changed-voice','changed-audio','Changed memo','Before the edit');
 await seedVoice(page,'undone-voice','undone-audio','Undone memo','Restored words');
 const shared=await interrupt(page,'shared-voice','tombstone');
 const edited=await interrupt(page,'edited-voice','tombstone');
 const changed=await interrupt(page,'changed-voice','recording-erased-first');
 const undone=await interrupt(page,'undone-voice','trashed');
 const undoneNote=(await pendingDeletions(page)).find(row=>row.id===undone).note;
 await page.evaluate(async({undone})=>{
  const {openBrowserNotes}=await import('/src/runtime/browser-notes-document.ts');const audio=await import('/src/browser/note-audio-store.ts');
  const store=await openBrowserNotes();
  await store.replace([
   // The edited note of a recording that was erased first: no longer the reviewed revision.
   ...store.list.map((n:any)=>n.id==='changed-voice'?{...n,body:'After the edit'}:n),
   // A different saved note now references the first recording.
   {id:'adopter',kind:'voice',title:'Adopter memo',body:'Adopted',audio:{audioId:'shared-audio',noteId:'adopter',durationMs:1000,transcript:'Shared words'},dur:1,lines:[],summary:[],actions:[]},
   // The deleted note is saved again under its own id as a newer revision.
   {id:'edited-voice',kind:'voice',title:'Edited memo',body:'Second words',audio:{audioId:'edited-audio',noteId:'edited-voice',durationMs:1000,transcript:'First words'},dur:1,lines:[],summary:[],actions:[]},
  ]);
  // A restore of the fourth deletion was started: its recording is live again under that operation.
  await audio.changeAudioDeleted('undone-audio','undone-voice',false,undone);
 },{undone});
 const before=await savedRecords(page);

 await page.reload();
 await expect(page.locator('html')).not.toHaveAttribute('data-active-view','notes');
 // The startup pass ran (it settled nothing) once Notes storage is open; then nothing may have changed.
 await openNotes(page);
 await expect(page.getByRole('button',{name:'Check deletion status',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Check deletion status',exact:true}).click();
 await expect.poll(async()=>(await pendingDeletions(page)).map(row=>row.id).sort()).toEqual([shared,edited,changed,undone].sort());
 expect(await savedRecords(page)).toEqual(before);
 for(const [audioId,words] of [['shared-audio','Shared words'],['edited-audio','First words'],['undone-audio','Restored words']]){
  const audio=await describeAudio(page,audioId);
  expect(audio.transcript).toBe(words);expect(audio.deletedAt).toBeUndefined();expect(audio.expired).toBeUndefined();
  expect(await audioBytes(page,audioId)).toBeGreaterThan(0);
 }
 expect((await describeAudio(page,'shared-audio')).deletionOperations).toBeUndefined();
 expect((await describeAudio(page,'edited-audio')).deletionOperations).toBeUndefined();
 expect((await describeAudio(page,'undone-audio')).deletionOperations).toEqual({[undone]:'restored'});
 // The edited note whose recording was already erased is kept; its text is never deleted for it.
 expect((await savedRecords(page)).find(n=>n.id==='changed-voice').body).toBe('After the edit');
 expect((await tombstones(page)).some(d=>d.id==='changed-voice')).toBe(false);

 // The started restore can still be completed from the review row: note and recording come back together.
 const review=page.getByRole('status').filter({hasText:'Voice note deletion needs review.'});
 await review.locator('div',{hasText:'Undone memo'}).getByRole('button',{name:'Restore note and recording',exact:true}).click();
 await expect(page.getByText('Voice note restored.',{exact:true})).toBeVisible();
 await expect.poll(async()=>(await pendingDeletions(page)).map(row=>row.id).sort()).toEqual([shared,edited,changed].sort());
 expect((await savedRecords(page)).find(n=>n.id==='undone-voice')).toEqual(undoneNote);
 const back=await describeAudio(page,'undone-audio');
 expect(back.transcript).toBe('Restored words');expect(back.deletedAt).toBeUndefined();
});
