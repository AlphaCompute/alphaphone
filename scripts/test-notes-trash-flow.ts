import assert from 'node:assert/strict';
import {NotesStore} from '../apps/app/src/runtime/notes-store';
import {
 NOTES_TRASH_RETENTION_MS,addNotesTrashEntry,emptyNotesTrash,notesTrashDaysLabel,notesTrashDaysLeft,notesTrashExpired,
 planNotesTrash,removeNotesTrashEntries,restoreNotesTrashEntry,sortedNotesTrash,validateNotesTrash,type NotesTrashDocument,type NotesTrashEntry,
} from '../apps/app/src/runtime/notes-trash-policy';

const DAY=24*60*60*1000,t0=Date.UTC(2026,9,7,12);
assert.equal(NOTES_TRASH_RETENTION_MS,3*DAY);
const memory=()=>{const values=new Map<string,string>();return {getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);}};};
const text={id:'text-1',kind:'text',title:'Groceries',body:'Milk',pinned:false,createdAt:t0-DAY,modifiedAt:t0-DAY,custom:{kept:'verbatim'}};
const list={id:'list-1',kind:'list',title:'Packing',items:[{t:'Passport',done:true}],pinned:true};
const voice={id:'voice-1',kind:'voice',title:'Standup',body:'Transcript',audio:{audioId:'audio-1',noteId:'voice-1'}};
const entry=(note:any,id:string,deletedAt:number,index=0,extra:Partial<NotesTrashEntry>={}):NotesTrashEntry=>({id,note,index,deletedAt,...extra});

// Validation: absent storage is an empty Trash; malformed or ambiguous rows are refused, never guessed.
assert.deepEqual(validateNotesTrash(null),emptyNotesTrash());
for(const bad of [{version:2,entries:[]},{version:1,entries:{}},{version:1,entries:[],extra:true},
 {version:1,entries:[entry(text,'a',t0),entry(text,'b',t0)]},
 {version:1,entries:[entry(text,'a',t0),entry(list,'a',t0)]},
 {version:1,entries:[entry(text,'bad id!',t0)]},
 {version:1,entries:[entry(text,'a',0)]},
 {version:1,entries:[entry(text,'a',t0,-1)]},
 {version:1,entries:[entry(text,'a',t0,0,{audio:{audioId:'audio-1'}})]},
 {version:1,entries:[entry(voice,'a',t0,0,{audio:{audioId:'other'}})]},
 {version:1,entries:[entry(text,'a',t0,0,{target:{sourceId:'s',sourceRevision:'r',noteId:'other',revision:'x'}})]}])
 assert.throws(()=>validateNotesTrash(bad));

// Add: newest first; a fresh deletion of the same note replaces a stale row; an operation id is recorded once.
let doc:NotesTrashDocument=emptyNotesTrash();
doc=addNotesTrashEntry(doc,entry(text,'op-1',t0,0));
doc=addNotesTrashEntry(doc,entry(list,'op-2',t0+1000,1));
doc=addNotesTrashEntry(doc,entry(voice,'op-3',t0+2000,2,{audio:{audioId:'audio-1'}}));
assert.deepEqual(doc.entries.map(e=>e.id),['op-3','op-2','op-1']);
assert.throws(()=>addNotesTrashEntry(doc,entry(text,'op-1',t0)),/already recorded/);
const again=addNotesTrashEntry(doc,entry(text,'op-4',t0+5000,0));
assert.deepEqual(again.entries.map(e=>e.id),['op-4','op-3','op-2']);
assert.deepEqual(sortedNotesTrash(again).map(e=>e.id),['op-4','op-3','op-2']);
assert.deepEqual(removeNotesTrashEntries(doc,['op-2','missing']).entries.map(e=>e.id),['op-3','op-1']);
assert.deepEqual(JSON.parse(JSON.stringify(doc)),doc,'stored as plain JSON');

// Clock injection: the 3-day boundary is exact.
const row=entry(text,'op-1',t0);
assert.equal(notesTrashExpired(row,t0),false);
assert.equal(notesTrashExpired(row,t0+3*DAY-1),false);
assert.equal(notesTrashExpired(row,t0+3*DAY),true);
assert.equal(notesTrashExpired(row,t0+30*DAY),true);
assert.deepEqual([0,1,DAY-1,DAY,DAY+1,2*DAY,2*DAY+1,3*DAY-1,3*DAY,4*DAY].map(d=>notesTrashDaysLeft(row,t0+d)),[3,3,3,2,2,1,1,1,0,0]);
assert.equal(notesTrashDaysLabel(row,t0),'3 days left');
assert.equal(notesTrashDaysLabel(row,t0+2*DAY+1),'1 day left');
assert.equal(notesTrashDaysLabel(row,t0+3*DAY),'Deleting permanently');
// A clock moved backwards never shows or keeps more than the 3-day window.
assert.equal(notesTrashDaysLeft(row,t0-10*DAY),3);
assert.equal(notesTrashExpired(row,t0-10*DAY),false);

// Planning: live notes are stale rows (undo, restore, uncommitted deletion); absent notes expire at 3 days.
const live=new Set(['list-1']);
let plan=planNotesTrash(doc,live,t0+3*DAY-1);
assert.deepEqual(plan.stale.map(e=>e.id),['op-2']);
assert.deepEqual(plan.expired.map(e=>e.id),[]);
assert.deepEqual(plan.kept.map(e=>e.id),['op-3','op-1']);
plan=planNotesTrash(doc,live,t0+3*DAY);
assert.deepEqual(plan.expired.map(e=>e.id),['op-1']);
plan=planNotesTrash(doc,live,t0+3*DAY+2000);
assert.deepEqual(plan.expired.map(e=>e.id),['op-3','op-1']);
// Idempotent: applying a plan and planning again leaves nothing to do, however often it runs.
let applied=removeNotesTrashEntries(doc,[...plan.stale,...plan.expired].map(e=>e.id));
for(let run=0;run<3;run++){const next=planNotesTrash(applied,live,t0+3*DAY+2000);assert.equal(next.stale.length+next.expired.length,0);applied=removeNotesTrashEntries(applied,[]);}
assert.deepEqual(applied.entries,[]);
// A failed recording purge is retained (not dropped) and simply planned again on the next run.
const retained=removeNotesTrashEntries(doc,['op-1','op-2']);
assert.deepEqual(planNotesTrash(retained,live,t0+4*DAY).expired.map(e=>e.id),['op-3']);

// Restore: exact record, original position (clamped), refuses to replace a live note with the same identity.
assert.deepEqual(restoreNotesTrashEntry([list],entry(text,'op',t0,0)),[text,list]);
assert.deepEqual(restoreNotesTrashEntry([list],entry(text,'op',t0,9)),[list,text]);
assert.throws(()=>restoreNotesTrashEntry([text],entry(text,'op',t0)),/already exists/);

// Identity and revision rules with the real shared store: a restored note has the same id and revision.
{
 const storage=memory(),store=new NotesStore(storage,[text,list]);
 const before=await store.target('text-1');
 const trashed=entry(store.list[0],'touch-op',t0,0,{target:before});
 store.replace(store.list.filter(n=>n.id!=='text-1'));
 await assert.rejects(store.target('text-1'));
 store.replace(restoreNotesTrashEntry(store.list,trashed));
 assert.deepEqual(store.list[0],text);
 assert.deepEqual(await store.target('text-1'),before,'restore keeps identity and revision');
 // Any edit after restore follows the normal revision rule.
 store.replace(store.list.map(n=>n.id==='text-1'?{...n,body:'Oat milk'}:n));
 assert.notEqual((await store.target('text-1')).revision,before.revision);
}
{
 // An approved agent deletion leaves a content-free tombstone; Trash holds the content under the same operation id.
 const storage=memory(),store=new NotesStore(storage,[text]);const target=await store.target('text-1');
 const trashDoc=addNotesTrashEntry(emptyNotesTrash(),entry(store.list[0],'agent-op',t0,0,{target}));
 await store.execute({type:'notes_delete',target},'agent-op',new AbortController().signal,()=>{});
 const envelope=JSON.parse(store.raw);
 assert.equal(JSON.stringify(envelope.deleted).includes('Milk'),false,'tombstone stays content-free');
 assert.deepEqual(envelope.deleted,[{id:'text-1',revision:target.revision,operationId:'agent-op'}]);
 assert.deepEqual(planNotesTrash(trashDoc,new Set(store.list.map(n=>n.id)),t0+DAY).kept.map(e=>e.id),['agent-op']);
 store.replace(restoreNotesTrashEntry(store.list,trashDoc.entries[0]));
 assert.deepEqual(await store.target('text-1'),target);
 assert.deepEqual(planNotesTrash(trashDoc,new Set(store.list.map(n=>n.id)),t0+DAY).stale.map(e=>e.id),['agent-op'],'restored note makes its row stale');
}
console.log('notes trash flow ok');
