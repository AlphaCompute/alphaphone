import {test,expect,type Page} from '@playwright/test';
const DAY=24*60*60*1000;
const savedRecords=(page:Page)=>page.evaluate(async()=>JSON.parse(await (await import('/src/runtime/browser-notes-document.ts')).readBrowserNotesRaw()).records);
const trashEntries=(page:Page)=>page.evaluate(async()=>(await (await import('/src/runtime/notes-trash.ts')).readNotesTrash()).entries);
async function openNotes(page:Page){await page.getByRole('button',{name:'Notes',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-notes-storage-state','ready');}
async function createNote(page:Page,title:string,body:string){
 await page.getByRole('button',{name:'New note',exact:true}).click();
 await page.getByRole('textbox',{name:'Title',exact:true}).fill(title);
 await page.getByRole('textbox',{name:'Note',exact:true}).fill(body);
 await page.getByRole('button',{name:'Back to notes',exact:true}).click();
 await expect(page.getByRole('button',{name:`Open ${title}`,exact:true})).toBeVisible();
}
async function deleteNote(page:Page,title:string){
 await page.getByRole('button',{name:`Open ${title}`,exact:true}).click();
 await page.getByRole('button',{name:'Delete note',exact:true}).click();
 await expect(page.getByText(`${title} moved to Trash`,{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:`Open ${title}`,exact:true})).toHaveCount(0);
}

test('deleted notes survive a restart in Trash, restore with the same identity, and Undo still works',async({page})=>{
 await page.goto('/');await openNotes(page);
 await createNote(page,'Trash audit','Keep this exact text.\nSecond line.');
 await createNote(page,'Second note','Unrelated');
 const before=(await savedRecords(page)).find((n:any)=>n.title==='Trash audit');
 const revision=await page.evaluate(async id=>{const m=await import('/src/runtime/browser-notes-document.ts');return (await (await m.openBrowserNotes()).target(id)).revision;},before.id);

 // Immediate Undo from the toast puts the note back and leaves Trash empty.
 await deleteNote(page,'Second note');
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 await expect(page.getByRole('button',{name:'Open Second note',exact:true})).toBeVisible();
 await expect.poll(()=>trashEntries(page).then(e=>e.length)).toBe(0);

 await deleteNote(page,'Trash audit');
 expect((await savedRecords(page)).some((n:any)=>n.id===before.id)).toBe(false);
 // Content is durable outside the in-memory toast: reload is a restart of the web app.
 await page.reload();await openNotes(page);
 await expect(page.getByRole('button',{name:'Open Trash audit',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Open Trash',exact:true}).click();
 const trash=page.locator('[data-alpha-subview="notes-trash"]');
 await expect(trash.getByRole('heading',{name:'Trash',exact:true})).toBeVisible();
 await expect(trash.getByText('Trash audit',{exact:true})).toBeVisible();
 await expect(trash.getByText('Note · 3 days left',{exact:true})).toBeVisible();
 await page.screenshot({path:test.info().outputPath('notes-trash.png')});
 await trash.getByRole('button',{name:'Restore Trash audit',exact:true}).click();
 await expect(page.getByText('Trash audit restored',{exact:true})).toBeVisible();
 await expect(trash.getByText('Trash is empty.',{exact:true})).toBeVisible();
 await trash.getByRole('button',{name:'Close Trash',exact:true}).click();
 await page.getByRole('button',{name:'Open Trash audit',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Note',exact:true})).toHaveValue('Keep this exact text.\nSecond line.');
 // Same id, byte-identical record and therefore the same reviewed revision.
 expect((await savedRecords(page)).find((n:any)=>n.id===before.id)).toEqual(before);
 expect(await page.evaluate(async id=>{const m=await import('/src/runtime/browser-notes-document.ts');return (await (await m.openBrowserNotes()).target(id)).revision;},before.id)).toBe(revision);
 expect(await trashEntries(page)).toEqual([]);
});

test('Delete forever and Empty Trash ask first, and checklists use the same Trash',async({page})=>{
 await page.goto('/');await openNotes(page);
 await createNote(page,'First','One');await createNote(page,'Second','Two');
 await page.getByRole('button',{name:'Open Second',exact:true}).click();
 await page.getByRole('button',{name:'Turn into checklist',exact:true}).click();
 await page.getByRole('button',{name:'Back to notes',exact:true}).click();
 await createNote(page,'Third','Three');
 for(const title of ['First','Second','Third'])await deleteNote(page,title);
 await page.getByRole('button',{name:'Open Trash',exact:true}).click();
 const trash=page.locator('[data-alpha-subview="notes-trash"]');
 await expect(trash.getByText('Checklist · 3 days left',{exact:true})).toBeVisible();
 await trash.getByRole('button',{name:'Delete First forever',exact:true}).click();
 const confirm=page.getByRole('dialog',{name:'Delete forever?'});
 await expect(confirm).toContainText('“First” will be deleted permanently.');
 await confirm.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(trash.getByText('First',{exact:true})).toBeVisible();
 await trash.getByRole('button',{name:'Delete First forever',exact:true}).click();
 await page.getByRole('button',{name:'Confirm delete forever',exact:true}).click();
 await expect(page.getByText('Deleted forever',{exact:true})).toBeVisible();
 await expect(trash.getByText('First',{exact:true})).toHaveCount(0);
 expect((await trashEntries(page)).map((e:any)=>e.note.title).sort()).toEqual(['Second','Third']);
 await trash.getByRole('button',{name:'Empty Trash',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Empty Trash?'})).toContainText('2 items will be deleted permanently.');
 await page.getByRole('button',{name:'Confirm empty Trash',exact:true}).click();
 await expect(trash.getByText('Trash is empty.',{exact:true})).toBeVisible();
 await expect(trash.getByRole('button',{name:'Empty Trash',exact:true})).toBeDisabled();
 expect(await trashEntries(page)).toEqual([]);
 expect(await page.evaluate(async()=>JSON.stringify((await (await import('/src/browser/documents.ts')).browserDocuments.read('alpha.browser.notes-trash.v1'))??null).includes('Three'))).toBe(false);
});

test('Trash purges exactly three days after deletion, at startup and when Notes opens',async({page})=>{
 const t0=Date.UTC(2026,9,7,12);
 await page.clock.install({time:t0});
 await page.goto('/');await openNotes(page);
 await createNote(page,'Expiring','Gone after three days');await createNote(page,'Later','Deleted a day later');
 await deleteNote(page,'Expiring');
 const deletedAt=(await trashEntries(page))[0].deletedAt;
 await page.clock.setSystemTime(deletedAt+DAY);
 await deleteNote(page,'Later');

 // One minute before the boundary: still restorable after a restart.
 await page.clock.setSystemTime(deletedAt+3*DAY-60_000);
 await page.reload();await openNotes(page);
 await page.getByRole('button',{name:'Open Trash',exact:true}).click();
 const trash=page.locator('[data-alpha-subview="notes-trash"]');
 await expect(trash.getByText('Expiring',{exact:true})).toBeVisible();
 await expect(trash.getByText('Note · 1 day left',{exact:true})).toBeVisible();
 await expect(trash.getByText('Note · 2 days left',{exact:true})).toBeVisible();

 // Past the boundary, opening Notes purges without a restart.
 await page.clock.setSystemTime(deletedAt+3*DAY+60_000);
 await page.getByRole('button',{name:'Home',exact:true}).click();
 await openNotes(page);
 await expect.poll(()=>trashEntries(page).then(e=>e.map((x:any)=>x.note.title))).toEqual(['Later']);
 await page.getByRole('button',{name:'Open Trash',exact:true}).click();
 await expect(trash.getByText('Expiring',{exact:true})).toHaveCount(0);
 await expect(trash.getByText('Later',{exact:true})).toBeVisible();
 expect(await page.evaluate(async()=>JSON.stringify((await (await import('/src/browser/documents.ts')).browserDocuments.read('alpha.browser.notes-trash.v1'))??null).includes('Gone after three days'))).toBe(false);

 // Startup purge: the second note expires while the app is closed. Repeating it is a no-op.
 await page.clock.setSystemTime(deletedAt+4*DAY+60_000);
 await page.reload();
 await expect.poll(()=>trashEntries(page)).toEqual([]);
 await page.reload();await openNotes(page);
 expect(await trashEntries(page)).toEqual([]);
 expect((await savedRecords(page)).map((n:any)=>n.title)).toEqual([]);
});

test('voice notes share the Trash: the recording restores with its note and is erased at three days',async({page})=>{
 const t0=Date.UTC(2026,9,7,12);
 await page.clock.install({time:t0});
 await page.addInitScript(()=>localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'offline'})));
 await page.goto('/');
 await page.evaluate(async()=>{
  const {openBrowserNotes}=await import('/src/runtime/browser-notes-document.ts');const {retainAudio}=await import('/src/browser/note-audio-store.ts');
  const audio=await retainAudio('trash-audio','trash-voice','Spoken words',{blob:new Blob(['synthetic'],{type:'audio/wav'}),durationMs:1000});
  await (await openBrowserNotes()).replace([{id:'trash-voice',kind:'voice',title:'Voice memo',body:'Spoken words',audio,dur:1,lines:[],summary:[],actions:[]}]);
 });
 const describe=()=>page.evaluate(async()=>{const {registerPlugin}=await import('/src/platform-plugins.ts');return registerPlugin<any>('AlphaNoteAudio').describe({audioId:'trash-audio'});});
 await page.reload();await openNotes(page);
 const remove=async()=>{
  await page.getByRole('button',{name:'Open Voice memo',exact:true}).click();
  await page.getByRole('button',{name:'Delete note',exact:true}).click();
  await expect(page.getByText('Voice note moved to Trash',{exact:true})).toBeVisible();
  await expect.poll(async()=>(await describe()).deletedAt).toBeGreaterThan(0);
 };
 await remove();
 await page.reload();await openNotes(page);
 await page.getByRole('button',{name:'Open Trash',exact:true}).click();
 const trash=page.locator('[data-alpha-subview="notes-trash"]');
 await expect(trash.getByText('Voice note · 3 days left',{exact:true})).toBeVisible();
 await trash.getByRole('button',{name:'Restore Voice memo',exact:true}).click();
 await expect(page.getByText('Voice note restored.',{exact:true})).toBeVisible();
 await expect(trash.getByText('Trash is empty.',{exact:true})).toBeVisible();
 expect((await describe()).deletedAt).toBeUndefined();
 await trash.getByRole('button',{name:'Close Trash',exact:true}).click();

 await remove();
 const deletedAt=(await trashEntries(page))[0].deletedAt;
 await page.clock.setSystemTime(deletedAt+3*DAY+60_000);
 await page.getByRole('button',{name:'Home',exact:true}).click();await openNotes(page);
 await expect.poll(()=>trashEntries(page)).toEqual([]);
 const erased=await describe();
 expect(erased.transcript).toBe('');expect(erased.expired).toBe(true);
 expect(Object.values(erased.deletionOperations)).toContain('purged');
 // An erased recording can never be restored again.
 const op=Object.entries(erased.deletionOperations).find(([,v])=>v==='purged')![0];
 expect(await page.evaluate(async op=>{const {registerPlugin}=await import('/src/platform-plugins.ts');try{await registerPlugin<any>('AlphaNoteAudio').restore({audioId:'trash-audio',noteId:'trash-voice',operationId:op});return 'restored';}catch{return 'refused';}},op)).toBe('refused');
});
