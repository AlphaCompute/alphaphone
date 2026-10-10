import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const m=await import('../apps/app/src/prototype/context-selection.ts');
const {sanitizePhoneContext}=await import('../apps/app/src/runtime/phone-context.ts');
// Android reports a folder revision that embeds its display name, size and time.
const androidRevision=(name,modified=1)=>`${name}|vnd.android.document/directory|-1|${modified}|8`;
const entry=(id,name,extra={})=>({id,parentId:'tree-root',name,mimeType:'text/plain',directory:false,size:3,revision:`${name}|text/plain|3|1|0`,...extra});
const listing=(entries,extra={})=>({status:'ready',message:'',folder:{id:'tree-root',name:'PRIVATE_FOLDER_NAME',revision:androidRevision('PRIVATE_FOLDER_NAME'),directory:true},entries,...extra});
const label=(mime,directory)=>directory?'Folder':mime==='text/plain'?'Text':'File';

test('a folder identity is its opaque tree id and a local counter, never the provider revision or a name',()=>{
 const revisions=m.createFolderRevisions();
 const first=revisions(m.folderScope(listing([entry('e1','PRIVATE_FILE_NAME.txt')])));
 assert.deepEqual(Object.keys(first).sort(),['id','kind','revision']);assert.equal(first.kind,'folder');assert.equal(first.id,'tree-root');
 assert.match(first.revision,/^listing-[0-9a-f]{12}-1$/);
 // Another app session never repeats a revision for the same folder id, whatever it lists.
 const later=m.createFolderRevisions()(m.folderScope(listing([entry('e9','other.txt')])));
 assert.equal(later.id,first.id);assert.notEqual(later.revision,first.revision);
 assert.doesNotMatch(JSON.stringify(first),/PRIVATE|\|/);
 // The wire contract accepts it for Files and nowhere else.
 assert.deepEqual(sanitizePhoneContext({view:'files',revision:1,sensitive:false,selectedObject:first}).selectedObject,first);
 assert.throws(()=>sanitizePhoneContext({view:'notes',revision:1,sensitive:false,selectedObject:first}));
 // The provider's own revision string would be refused, so it must never be used as the identity.
 assert.throws(()=>sanitizePhoneContext({view:'files',revision:1,sensitive:false,selectedObject:{kind:'folder',id:'tree-root',revision:androidRevision('PRIVATE_FOLDER_NAME')}}));
});
test('the folder revision is stable for an unchanged listing and changes with the folder or any loaded entry',()=>{
 const revisions=m.createFolderRevisions();
 const base=[entry('e1','a.txt'),entry('e2','b.txt')];
 const one=revisions(m.folderScope(listing(base))).revision;
 assert.equal(revisions(m.folderScope(listing([...base].reverse()))).revision,one,'order alone is not a change');
 const renamed=revisions(m.folderScope(listing([entry('e1','a.txt'),entry('e2','renamed.txt')]))).revision;
 assert.notEqual(renamed,one);
 const removed=revisions(m.folderScope(listing([entry('e1','a.txt')]))).revision;
 assert.notEqual(removed,renamed);
 const folderChanged=revisions(m.folderScope({...listing([entry('e1','a.txt')]),folder:{id:'tree-root',name:'PRIVATE_FOLDER_NAME',revision:androidRevision('PRIVATE_FOLDER_NAME',2)}})).revision;
 assert.notEqual(folderChanged,removed);
 // A different folder never reuses another folder's identity.
 const other=revisions(m.folderScope({...listing(base),folder:{id:'tree-other',name:'Other',revision:'x'}}));
 assert.equal(other.id,'tree-other');assert.notEqual(other.revision,one);
 assert.equal(revisions(undefined),undefined);
 // Remembered listings are bounded. A folder that was forgotten gets a new revision, never an old one.
 const issued=new Set([one,renamed,removed,folderChanged,other.revision]);
 for(let index=0;index<80;index++){const next=revisions(m.folderScope({...listing(base),folder:{id:'tree-many-'+index,name:'n',revision:'x'}})).revision;assert.ok(!issued.has(next));issued.add(next);}
 assert.ok(!issued.has(revisions(m.folderScope({...listing([entry('e1','a.txt')]),folder:{id:'tree-root',name:'PRIVATE_FOLDER_NAME',revision:androidRevision('PRIVATE_FOLDER_NAME',2)}})).revision));
 for(const bad of [undefined,{},{folder:{id:'/storage/emulated/0/Private',revision:'1'}},{folder:{id:'tree-root'}},{folder:{id:'tree-root',revision:'1'},entries:[{id:'e1'}]}])assert.equal(m.folderScope(bad),undefined);
});
test('a reviewed folder is current only when a fresh read matches it exactly',()=>{
 const reviewed=m.folderScope(listing([entry('e1','a.txt'),entry('e2','b.txt')]));
 assert.equal(m.folderScopeCurrent(reviewed,listing([entry('e2','b.txt'),entry('e1','a.txt')])),true);
 // Deleted, added, replaced-in-place and renamed entries, a changed folder and lost access all fail.
 assert.equal(m.folderScopeCurrent(reviewed,listing([entry('e1','a.txt')])),false,'deleted entry');
 assert.equal(m.folderScopeCurrent(reviewed,listing([entry('e1','a.txt'),entry('e2','b.txt'),entry('e3','c.txt')])),false,'added entry');
 assert.equal(m.folderScopeCurrent(reviewed,listing([entry('e1','a.txt'),entry('e9','b.txt')])),false,'neighbor with the same name');
 assert.equal(m.folderScopeCurrent(reviewed,listing([entry('e1','a.txt'),entry('e2','b.txt',{revision:'b.txt|text/plain|4|2|0'})])),false,'edited entry');
 assert.equal(m.folderScopeCurrent(reviewed,{...listing([entry('e1','a.txt'),entry('e2','b.txt')]),folder:{id:'tree-other',name:'x',revision:androidRevision('PRIVATE_FOLDER_NAME')}}),false,'another folder');
 for(const status of ['revoked','unavailable','unsupported'])assert.equal(m.folderScopeCurrent(reviewed,{status,message:'Folder access ended.'}),false,status);
 // Several loaded pages (Android lists 250 at a time): the fresh read is the first page. It must
 // be exactly the first entries that were loaded, and the reported total must be unchanged.
 const many=Array.from({length:300},(_,index)=>entry('p'+index,'f'+index+'.txt'));
 const paged=m.folderScope(listing(many,{total:300}));
 const firstPage=many.slice(0,250);
 assert.equal(m.folderScopeCurrent(paged,listing(firstPage,{total:300,cursor:'next'})),true);
 assert.equal(m.folderScopeCurrent(paged,listing(firstPage,{total:301,cursor:'next'})),false,'entry added beyond the loaded pages');
 assert.equal(m.folderScopeCurrent(paged,listing([...firstPage.slice(0,249),entry('p900','z.txt')],{total:300,cursor:'next'})),false,'unknown entry');
 // An entry named in the excerpt was deleted and another added elsewhere: the total is the same and
 // every fresh entry was loaded before, but the first page is no longer the reviewed first page.
 assert.equal(m.folderScopeCurrent(paged,listing(many.slice(1,251),{total:300,cursor:'next'})),false,'deleted entry replaced by a later one');
 // A fresh page too short to cover what the excerpt names proves nothing.
 assert.equal(m.folderScopeCurrent(paged,listing(many.slice(0,100),{total:300,cursor:'next'})),false,'short page');
 assert.equal(m.folderScopeCurrent(paged,listing(firstPage,{total:300})),false,'the later pages are gone');
 assert.equal(m.folderScopeCurrent(m.folderScope(listing(firstPage,{total:300,cursor:'next'})),listing(firstPage,{total:300,cursor:'next'})),true,'one loaded page');
 assert.equal(m.folderScopeCurrent(m.folderScope(listing([entry('e1','a.txt'),entry('e1','a.txt')])),listing([entry('e1','a.txt'),entry('e1','a.txt')])),false,'duplicate identities are not a listing');
});
test('the folder excerpt lists only the loaded entries of that one folder and says what is left out',()=>{
 const scope=m.folderScope(listing([entry('e1','a.txt'),entry('d1','Sub',{directory:true,mimeType:'vnd.android.document/directory'})],{cursor:'next',total:40}));
 const text=m.folderExcerpt(scope,label);
 assert.deepEqual(text.split('\n'),['Folder: PRIVATE_FOLDER_NAME','2 entries listed by name and type. File contents and subfolder contents are not included.','- a.txt (Text)','- Sub (Folder)','The folder has more entries that are not loaded (40 in total).']);
 assert.match(m.folderExcerpt(m.folderScope(listing([])),label),/This folder is empty\./);
 const many=m.folderScope(listing(Array.from({length:m.FOLDER_EXCERPT_LIMIT+3},(_,i)=>entry('e'+i,'f'+i+'.txt'))));
 const lines=m.folderExcerpt(many,label).split('\n');
 assert.equal(lines.filter(line=>line.startsWith('- ')).length,m.FOLDER_EXCERPT_LIMIT);assert.equal(lines.at(-1),'3 more loaded entries are not listed here.');
});
test('only an unredacted own notification is reviewable, and only while that exact revision is listed',()=>{
 const own={id:'reminder-1',revision:'occ-1',source:'own',appLabel:'Alpha Phone',title:'Call the clinic',text:'Before noon'};
 assert.equal(m.noticeReviewable(own),true);
 assert.equal(m.noticeExcerpt(own),'Call the clinic\nBefore noon');
 assert.equal(m.noticeReviewable({...own,source:'external'}),false,'another app');
 assert.equal(m.noticeReviewable({...own,source:'hosted'}),false,'hosted result');
 assert.equal(m.noticeReviewable({...own,title:'Alpha Phone',text:''}),false,'redacted while locked');
 assert.equal(m.noticeReviewable({...own,title:'',text:''}),false,'nothing shown');
 // Android withholds content with fixed wording instead of an empty row. That wording is not content.
 const java=readFileSync('android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaNotificationsPlugin.java','utf8');
 assert.ok(java.includes(`item.put("title",hidden?"${m.HIDDEN_NOTICE_TITLE}":`),'Android hidden title');
 assert.ok(java.includes(`item.put("text",hidden?(locked?"${m.HIDDEN_NOTICE_TEXTS[0]}":"${m.HIDDEN_NOTICE_TEXTS[1]}"):`),'Android hidden text');
 for(const text of m.HIDDEN_NOTICE_TEXTS){
  assert.equal(m.noticeReviewable({...own,title:m.HIDDEN_NOTICE_TITLE,text}),false,text);
  assert.equal(m.noticeHidden({...own,title:m.HIDDEN_NOTICE_TITLE,text}),true);
 }
 assert.equal(m.noticeReviewable({...own,title:m.HIDDEN_NOTICE_TITLE,text:''}),false);
 assert.equal(m.noticeReviewable({...own,text:'Unlock to view'}),true,'an ordinary reminder may say this');
 assert.equal(m.noticeReviewable({...own,text:''}),true,'a title-only reminder');
 assert.equal(m.noticeReviewable({...own,id:'has space'}),false);
 const reviewed={id:own.id,revision:own.revision,source:'own'};
 assert.equal(m.noticeCurrent(reviewed,[own,{...own,id:'reminder-2'}]),true);
 assert.equal(m.noticeCurrent(reviewed,[{...own,id:'reminder-2'}]),false,'dismissed: the neighbor never stands in');
 assert.equal(m.noticeCurrent(reviewed,[{...own,revision:'occ-2'}]),false,'updated');
 assert.equal(m.noticeCurrent(reviewed,[{...own,source:'external'}]),false,'same id from another source');
 assert.equal(m.noticeCurrent(reviewed,[own,{...own,revision:'occ-2'}]),false,'ambiguous');
 assert.equal(m.noticeCurrent(reviewed,undefined),false);
});
test('a capture question carries the exact open item; a library search is never a capture',()=>{
 assert.deepEqual(m.captureQuestion('camera','ask','ask',{}),{kind:'frame'});
 assert.deepEqual(m.captureQuestion('photos','ask','v.ask',{open:'native-photo-42'}),{kind:'item',id:'native-photo-42'});
 assert.deepEqual(m.captureQuestion('photos','ask','v.ask',{open:null}),{kind:'none'});
 assert.deepEqual(m.captureQuestion('photos','ask','groups.0.items.1.ask',{open:'native-photo-42'}),{kind:'none'});
 for(const key of ['askQ','askSearch'])for(const module of ['camera','photos'])assert.deepEqual(m.captureQuestion(module,key,key,{open:'native-photo-42',q:'beach'}),{kind:'search'});
 assert.equal(m.captureQuestion('files','ask','pv.ask',{open:'x'}),undefined);
 assert.equal(m.captureQuestion('photos','share','v.share',{open:'x'}),undefined);
});
test('a saved capture identity is opaque even when the library revision is not',()=>{
 // Browser library: already opaque, passed through unchanged.
 assert.deepEqual(m.captureSelection({kind:'image',id:'native-camera-3f0c',revision:'9d2e'}),{kind:'photo',id:'native-camera-3f0c',revision:'9d2e'});
 // Android before any favorite or trash change: DATE_ADDED:SIZE.
 assert.deepEqual(m.captureSelection({kind:'video',id:'native-camera-v:41',revision:'1760000000:52344'}),{kind:'video',id:'native-camera-v:41',revision:'1760000000:52344'});
 // Android after one (AlphaPhotosPlugin.metadata appends "|generation"): the wire contract refuses
 // '|', which would fail every message sent while that item is open.
 const flagged={kind:'image',id:'native-camera-42',revision:'1760000000:52344|917'};
 assert.throws(()=>sanitizePhoneContext({view:'photos',revision:1,sensitive:false,selectedObject:{kind:'photo',id:flagged.id,revision:flagged.revision}}));
 const selection=m.captureSelection(flagged);
 assert.deepEqual(selection,{kind:'photo',id:'native-camera-42',revision:'1760000000:52344.917'});
 assert.deepEqual(sanitizePhoneContext({view:'photos',revision:1,sensitive:false,selectedObject:selection}).selectedObject,selection);
 // Distinct library revisions stay distinct, and the generation still changes the identity.
 assert.notEqual(m.captureSelection({...flagged,revision:'1760000000:52344|918'}).revision,selection.revision);
 assert.notEqual(m.captureSelection({...flagged,revision:'1760000000:52344'}).revision,selection.revision);
 const java=readFileSync('android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaPhotosPlugin.java','utf8');
 assert.match(java,/item\.put\("revision",base\+\(Build\.VERSION\.SDK_INT>=30&&marker\.startsWith\(base\+"\|"\)\?"\|"\+row\.getLong\(9\):""\)\)/,'Android revision format');
 // Anything that cannot be made opaque one-to-one is not shared.
 for(const bad of [undefined,{},{id:'native-camera-1'},{id:'native-camera-1',revision:'a.b|c'},{id:'native-camera-1',revision:'has space'},{id:'/storage/DCIM/1.jpg',revision:'1'},{id:'native-camera-1',revision:7}])assert.equal(m.captureSelection(bad),null);
 const adapter=readFileSync('apps/app/src/prototype/camera-adapter.ts','utf8');
 assert.equal((adapter.match(/nativePhotoSelection: ?captureSelection\(/g)||[]).length,2);
 assert.doesNotMatch(adapter,/nativePhotoSelection: ?\{/,'every published photo identity goes through captureSelection');
});
test('the native adapter passes an item identity, not a generic wrapper, to the capture question',()=>{
 const source=readFileSync('apps/app/src/prototype/native-adapter.ts','utf8');
 assert.match(source,/askAboutCapture\(\{ id: capture\.id \}\)/);
 assert.match(source,/askAboutCapture\(\)/);
 assert.doesNotMatch(source,/askAboutCapture[^;]*\{ module, key, row/);
 // A failed question is reported, not silently dropped.
 assert.match(source,/Nothing has been sent\./);
});
test('location tiles ask the picker for a list of valid document types',()=>{
 const valid=/^[a-z]+\/([a-z0-9][a-z0-9.+-]{0,126}|\*)$/;
 for(const [name,expected] of [['Pictures',['image/*']],['Recordings',['audio/*']],['Movies',['video/*']],['Documents',['application/pdf','text/*','application/*']]]){
  const types=m.locationMimeTypes(name);assert.deepEqual(types,expected);
  // DailyAppsPlugin.mimeTypes refuses anything that is not an array of single types.
  assert.ok(Array.isArray(types)&&types.length<=12&&types.every(type=>valid.test(type)&&!type.includes(',')));
 }
 assert.equal(m.locationMimeTypes('Downloads'),undefined);
});
test('a Settings page identity is its section slug; credential pages have none',()=>{
 assert.deepEqual(m.settingsSelection({page:'privacy'}),{kind:'settings',id:'privacy'});
 assert.deepEqual(sanitizePhoneContext({view:'settings',revision:2,sensitive:false,selectedObject:m.settingsSelection({page:'display'})}).selectedObject,{kind:'settings',id:'display'});
 for(const page of ['passwords','vault','unlock','api-keys','Privacy','a b',null,undefined,7])assert.equal(m.settingsSelection({page}),undefined,String(page));
 assert.equal(m.settingsSelection(undefined),undefined);
});
