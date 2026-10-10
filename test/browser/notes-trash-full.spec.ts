// B-10 (docs/core-loop-audit.md): a full Notes Trash refuses a deletion without losing data.
// Browser build only; source/test evidence. The native slot cap ("storage-full" from
// AlphaConnectionPlugin) and NotesStorageDurabilityInstrumentedTest are separate gates.
//
// Written to hold on two sources:
//  - this branch, where a Trash at its entry or byte limit refuses with the toast
//    "Could not move this note to Trash. Nothing was deleted." (the "Trash is full. Empty Trash in
//    Notes…" toast is reached only by the native slot cap, which the browser build never raises);
//  - origin/claude/r2-trash-recovery (MVP-15, not merged), where the same refusal opens the
//    "Trash is full" dialog with Open Trash, Cancel and a separately confirmed permanent delete.
// When that branch merges, tighten `refusal` below to the dialog alone; nothing else changes.
// Its own notes-trash-recovery.spec.ts covers the dialog's choices.
import {test,expect,type Page} from '@playwright/test';
const savedRecords=(page:Page)=>page.evaluate(async()=>JSON.parse(await (await import('/src/runtime/browser-notes-document.ts')).readBrowserNotesRaw()).records as any[]);
const trashEntries=(page:Page)=>page.evaluate(async()=>(await (await import('/src/runtime/notes-trash.ts')).readNotesTrash()).entries as any[]);
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
/**
 * The product limit is 10,000 entries. The served policy module is the product module with only
 * NOTES_TRASH_MAX_ENTRIES replaced, so the limit is reached with two deletions made through
 * rendered controls. Test-only; no production seam changes the limit.
 */
async function lowerEntryLimit(page:Page,limit:number){
 let rewritten=0;
 await page.route(/\/src\/runtime\/notes-trash-policy\.ts(\?.*)?$/,async route=>{
  const response=await route.fetch(),source=await response.text();
  const body=source.replace(/(NOTES_TRASH_MAX_ENTRIES\s*=\s*)[^;]+;/,`$1${limit};`);
  if(body===source)throw Error('Notes Trash entry limit was not found in the served module');
  rewritten++;await route.fulfill({response,body});
 });
 return ()=>rewritten;
}

test('a deletion that would overfill Trash is refused: the note stays saved, Trash is unchanged, and making room lets it through',async({page})=>{
 test.setTimeout(120_000);
 const rewritten=await lowerEntryLimit(page,2);
 await page.goto('/');await openNotes(page);
 expect(rewritten()).toBeGreaterThan(0);
 expect(await page.evaluate(async()=>(await import('/src/runtime/notes-trash-policy.ts')).NOTES_TRASH_MAX_ENTRIES)).toBe(2);
 for(const title of ['Alpha','Bravo','Charlie','Delta'])await createNote(page,title,`${title} body, exact.`);
 // Fill Trash to its limit through the Delete control.
 await deleteNote(page,'Alpha');await deleteNote(page,'Bravo');
 const full=await trashEntries(page),saved=await savedRecords(page);
 expect(full.map(entry=>entry.note.title).sort()).toEqual(['Alpha','Bravo']);
 expect(saved.map(note=>note.title).sort()).toEqual(['Charlie','Delta']);

 // One more deletion: refused, in words, before anything is written.
 await page.getByRole('button',{name:'Open Charlie',exact:true}).click();
 await page.getByRole('button',{name:'Delete note',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Trash is full'});
 const refusal=dialog.or(page.getByText('Could not move this note to Trash. Nothing was deleted.',{exact:true})).or(page.getByText('Trash is full. Empty Trash in Notes, then delete again. Nothing was deleted.',{exact:true}));
 await expect(refusal.first()).toBeVisible();
 await expect(page.getByText('Charlie moved to Trash',{exact:true})).toHaveCount(0);
 // The note is still the open, saved note, byte for byte; Trash holds exactly what it held.
 await expect(page.getByRole('textbox',{name:'Title',exact:true})).toHaveValue('Charlie');
 expect(await savedRecords(page)).toEqual(saved);
 expect(await trashEntries(page)).toEqual(full);
 // Pressing Delete again is refused again; a second press never forces the deletion through.
 if(await dialog.count())await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'Delete note',exact:true}).click();
 await expect(refusal.first()).toBeVisible();
 expect(await savedRecords(page)).toEqual(saved);
 expect(await trashEntries(page)).toEqual(full);
 if(await dialog.count())await dialog.getByRole('button',{name:'Cancel',exact:true}).click();

 // A reload loses nothing on either side of the refusal.
 await page.reload();await openNotes(page);
 expect(await savedRecords(page)).toEqual(saved);
 expect(await trashEntries(page)).toEqual(full);
 await expect(page.getByRole('button',{name:'Open Charlie',exact:true})).toBeVisible();

 // Make room the way the refusal says to: restore one trashed note. The refused deletion then works.
 await page.getByRole('button',{name:/^Open Trash|^Trash, 2 items$/}).first().click();
 const trash=page.locator('[data-alpha-subview="notes-trash"]');
 await trash.getByRole('button',{name:'Restore Alpha',exact:true}).click();
 await expect(page.getByText('Alpha restored',{exact:true})).toBeVisible();
 await trash.getByRole('button',{name:'Close Trash',exact:true}).click();
 await deleteNote(page,'Charlie');
 expect((await trashEntries(page)).map(entry=>entry.note.title).sort()).toEqual(['Bravo','Charlie']);
 expect((await savedRecords(page)).map(note=>note.title).sort()).toEqual(['Alpha','Delta']);
 // Every note written in this test still exists exactly once, in Notes or in Trash.
 const everywhere=[...(await savedRecords(page)).map(note=>note.title),...(await trashEntries(page)).map(entry=>entry.note.title)].sort();
 expect(everywhere).toEqual(['Alpha','Bravo','Charlie','Delta']);
 expect((await savedRecords(page)).find(note=>note.title==='Alpha')).toEqual(full.find(entry=>entry.note.title==='Alpha').note);
});
