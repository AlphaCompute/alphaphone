import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
// Device photo/video library rules (issue 408). Source-level: this proves the renderer contract and
// the native source shape, not Android behaviour (see PhotoLibraryInstrumentedTest for that).
const m=await import('../apps/app/src/runtime/photo-library.ts');
const java=readFileSync('android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaPhotoLibraryPlugin.java','utf8');
const rules=readFileSync('android/app/src/main/java/ai/elizaresearch/alphaphone/PhotoLibraryAccess.java','utf8');
const manifest=readFileSync('android/app/src/main/AndroidManifest.xml','utf8');
const adapter=readFileSync('apps/app/src/prototype/photo-library-adapter.ts','utf8');

const scope=(extra={})=>({scope:'full',images:true,videos:true,canSelectMore:false,canEditOthers:true,locked:false,version:'v1',...extra});
const item=(row,extra={})=>({id:`lib:i:${row}:${row*10}`,revision:`${1700000000+row}:${1000+row}:${row}`,kind:'image',mime:'image/jpeg',name:`IMG_${row}.jpg`,album:'Camera',width:4000,height:3000,takenAt:1700000000000+row,modifiedAt:1700000000000,size:1000+row,duration:0,favorite:false,owned:false,image:'data:image/jpeg;base64,AA==',...extra});
const page=(rows,next='',extra={})=>({...scope(extra),items:rows.map(row=>typeof row==='number'?item(row):row),next,generation:42});

test('manifest declares the media permissions Android needs per API level, legacy read capped at API 32',()=>{
 assert.match(manifest,/<uses-permission android:name="android\.permission\.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" \/>/);
 for(const name of ['READ_MEDIA_IMAGES','READ_MEDIA_VIDEO','READ_MEDIA_VISUAL_USER_SELECTED'])assert.match(manifest,new RegExp(`<uses-permission android:name="android\\.permission\\.${name}" />`));
 // No write-all or manage-all storage shortcut.
 assert.doesNotMatch(manifest,/MANAGE_EXTERNAL_STORAGE|ACCESS_MEDIA_LOCATION/);
 assert.match(manifest,/WRITE_EXTERNAL_STORAGE" tools:node="remove"/);
 assert.match(readFileSync('android/app/src/main/java/ai/elizaresearch/alphaphone/MainActivity.java','utf8'),/registerPlugin\(AlphaPhotoLibraryPlugin\.class\);/);
});

test('native scope mirrors the renderer: full, Android 14 selected, or denied',()=>{
 const body=rules.slice(rules.indexOf('static String scope('),rules.indexOf('static String[] requestAliases('));
 assert.match(body,/if \(sdk < 33\) return legacyRead \? "full" : "denied";/);
 assert.match(body,/if \(images \|\| videos\) return "full";/);
 assert.match(body,/if \(sdk >= 34 && userSelected\) return "selected";/);
 assert.match(rules,/if \(sdk < 33\) return new String\[\] \{"mediaLegacy"\};[\s\S]*return new String\[\] \{"media", "mediaSelected"\};/);
 for(const [name,value] of [['PAGE_MAX',100],['THUMBNAIL_ROWS_MAX',30],['VALIDATE_MAX',200],['CHANGES_MAX',200],['ACTION_MAX',20],['QUERY_MAX',80]]){
  assert.match(rules,new RegExp(`${name} = ${value}\\b`),name);
 }
 assert.equal(m.LIBRARY_LIMITS.page,100);assert.equal(m.LIBRARY_LIMITS.thumbnailRows,30);assert.equal(m.LIBRARY_LIMITS.validate,200);assert.equal(m.LIBRARY_LIMITS.action,20);assert.equal(m.LIBRARY_LIMITS.query,80);
 // Same id grammar on both sides.
 assert.ok(rules.includes('"^lib:([iv]):([1-9][0-9]{0,18}):([0-9]{1,19})$"'));
 assert.equal(m.LIBRARY_ID.source,'^lib:([iv]):([1-9][0-9]{0,18}):([0-9]{1,19})$');
});

test('reads refuse without a grant or while the device is locked; changes use Android review dialogs',()=>{
 assert.match(java,/"denied"\.equals\(scopeName\(\)\)\) \{ call\.reject\("Photo library access is not allowed", "LIBRARY_DENIED"\)/);
 assert.match(java,/if \(locked\(\)\) \{ call\.reject\("Unlock the phone to use the device library", "LIBRARY_LOCKED"\)/);
 for(const request of ['createFavoriteRequest','createTrashRequest','createDeleteRequest'])assert.match(java,new RegExp(`MediaStore\\.${request}\\(`));
 // Media the app does not own is never updated or deleted directly.
 assert.doesNotMatch(java,/getContentResolver\(\)\.(update|delete)\(/);
 assert.doesNotMatch(java,/resolver\.(update|delete)\(/);
 // Pending rows are excluded; trashed rows are excluded from pages and count as missing on validate.
 assert.match(java,/BASE = "media_type IN \(1,3\) AND " \+ MediaStore\.MediaColumns\.IS_PENDING \+ "=0"/);
 // Grants are re-read on resume and reported as a scope change.
 assert.match(java,/handleOnResume\(\)[\s\S]*notifyListeners\("scopeChanged"/);
 // No background indexer: the observer only notifies, debounced.
 assert.match(java,/main\.postDelayed\(changed, 1500\)/);
 assert.doesNotMatch(java,/WorkManager|JobScheduler|startForegroundService/);
});

test('scope parsing and honest scope copy',()=>{
 assert.throws(()=>m.parseScope({scope:'all'}));
 const full=m.parseScope(scope());assert.equal(full.scope,'full');
 const copy=m.scopePresentation(full);
 assert.equal(copy.label,'Full access');assert.match(copy.detail,/Nothing is uploaded automatically/);assert.match(copy.detail,/work-profile/);assert.equal(copy.actionKind,'settings');
 assert.match(m.scopePresentation(m.parseScope(scope({videos:false}))).detail,/Videos are not allowed/);
 const selected=m.scopePresentation(m.parseScope(scope({scope:'selected',images:false,videos:false,canSelectMore:true})));
 assert.equal(selected.label,'Selected items');assert.match(selected.detail,/only the items you chose/);assert.equal(selected.actionKind,'request');
 const denied=m.scopePresentation(m.parseScope(scope({scope:'denied',images:false,videos:false})));
 assert.equal(denied.label,'Not allowed');assert.equal(denied.action,'Allow access');
 assert.equal(m.scopePresentation(m.parseScope(scope({scope:'denied',settingsRequired:true}))).actionKind,'settings');
 assert.equal(m.scopePresentation(m.parseScope(scope({locked:true}))).label,'Locked');
 assert.equal(m.scopePresentation(undefined).label,'Unavailable');
 // Never claims full access for a selected grant, nor anything about uploads having happened.
 for(const state of [scope({scope:'selected'}),scope({scope:'denied'})])assert.doesNotMatch(m.scopePresentation(m.parseScope(state)).label,/Full/);
});

test('pages validate identities, cursors and duplicates',()=>{
 const parsed=m.parsePage(page([5,4,3],'3'));
 assert.deepEqual(parsed.items.map(row=>row.id),['lib:i:5:50','lib:i:4:40','lib:i:3:30']);assert.equal(parsed.next,'3');
 assert.throws(()=>m.parsePage(page([5,5])),/Duplicate/);
 assert.throws(()=>m.parsePage(page([5],'abc')),/cursor/);
 assert.throws(()=>m.parsePage(page([item(5,{kind:'video'})])),/kind/);
 assert.throws(()=>m.parsePage(page([item(5,{id:'lib:i:0:1'})])));
 assert.throws(()=>m.parsePage(page([item(5,{revision:'x|y'})])));
 assert.throws(()=>m.parsePage(page(Array.from({length:101},(_,i)=>i+1))));
 // Thumbnails are local JPEG data only.
 assert.equal(m.parseItem(item(1,{image:'https://example.invalid/x.jpg'})).image,undefined);
});

test('a large catalog pages without gaps or repeats and stays bounded in memory',()=>{
 const catalog=new m.LibraryCatalog();
 const all=Array.from({length:2600},(_,i)=>2600-i);
 let cursor='',first=true,pages=0;
 do{
  const start=cursor?all.indexOf(Number(cursor))+1:0,rows=all.slice(start,start+24);
  const next=start+24<all.length?String(rows.at(-1)):'';
  catalog.apply(m.parsePage(page(rows,next)),first);first=false;cursor=catalog.next;pages++;
 }while(cursor&&pages<500);
 assert.equal(catalog.items.length,m.LIBRARY_LIMITS.kept,'bounded');
 assert.equal(new Set(catalog.items.map(row=>row.id)).size,catalog.items.length,'no repeats');
 assert.deepEqual(catalog.items.map(row=>Number(row.id.split(':')[2])),all.slice(0,m.LIBRARY_LIMITS.kept),'no gaps, newest first');
 assert.equal(catalog.next,'','stops at the bound instead of growing');
 assert.equal(catalog.items.filter(row=>row.image).length,m.LIBRARY_LIMITS.thumbnailsKept,'thumbnails bounded');
 // A repeated page (insert between reads) does not duplicate rows.
 const small=new m.LibraryCatalog();small.apply(m.parsePage(page([9,8,7],'7')),true);small.apply(m.parsePage(page([8,7,6],'')),false);
 assert.deepEqual(small.items.map(row=>row.id),['lib:i:9:90','lib:i:8:80','lib:i:7:70','lib:i:6:60']);
});

test('external edits and deletes reconcile; a row id reused after delete is a different identity',()=>{
 const catalog=new m.LibraryCatalog();catalog.apply(m.parsePage(page([3,2,1])),true);
 const edited=item(2,{revision:'1700000999:2000:77'});
 const result=catalog.reconcile(m.parseValidation({items:[{id:'lib:i:3:30',status:'current'},{id:'lib:i:2:20',status:'changed',item:edited},{id:'lib:i:1:10',status:'missing'}]}));
 assert.deepEqual(result,{removed:['lib:i:1:10'],changed:['lib:i:2:20']});
 assert.equal(catalog.items.find(row=>row.id==='lib:i:2:20').revision,'1700000999:2000:77');
 assert.throws(()=>m.parseValidation({items:[{id:'lib:i:2:20',status:'changed',item:item(3)}]}),/mismatch/);
 // Incremental changes: trashed rows leave, changed rows update, unknown rows are counted as new.
 const changes=catalog.applyChanges([{...item(3),trashed:true},{...item(2,{revision:'1:1:99'})},{...item(9)}],99);
 assert.deepEqual(changes,{removed:['lib:i:3:30'],changed:['lib:i:2:20'],added:1});assert.equal(catalog.generation,99);
 assert.equal('trashed' in catalog.items[0],false);
 // MediaStore _id 2 reused with a new add generation is not the old item.
 assert.notEqual('lib:i:2:20','lib:i:2:21');assert.ok(m.isLibraryId('lib:i:2:21'));
});

test('permission downgrade or a MediaStore version change clears the catalog and selection',()=>{
 const catalog=new m.LibraryCatalog(),selection=new m.LibrarySelection();
 catalog.apply(m.parsePage(page([3,2,1])),true);selection.toggle(catalog.items[0]);
 assert.equal(catalog.observeScope(m.parseScope(scope())),false,'unchanged full grant keeps the catalog');
 assert.equal(catalog.observeScope(m.parseScope(scope({scope:'selected',images:false,videos:false}))),true,'full to selected clears');
 assert.equal(catalog.items.length,0);selection.reconcile(catalog);assert.equal(selection.size,0);
 catalog.apply(m.parsePage(page([3])),true);
 assert.equal(catalog.observeScope(m.parseScope(scope({scope:'denied'}))),true,'revoke clears');
 catalog.apply(m.parsePage(page([3])),true);
 assert.equal(catalog.observeScope(m.parseScope(scope({version:'v2'}))),true,'new MediaStore version clears');
});

test('selection is bounded and drops changed or removed items instead of acting on stale ones',()=>{
 const catalog=new m.LibraryCatalog(),selection=new m.LibrarySelection();
 catalog.apply(m.parsePage(page(Array.from({length:22},(_,i)=>22-i))),true);
 for(const row of catalog.items.slice(0,20))selection.toggle(row);
 assert.throws(()=>selection.toggle(catalog.items[20]),/at most 20/);
 assert.equal(selection.toggle(catalog.items[0]),false,'toggle unselects');
 catalog.reconcile([{id:catalog.items[1].id,status:'missing'},{id:catalog.items[2].id,status:'changed',item:{...catalog.items[2],revision:'1:1:1'}}]);
 assert.deepEqual(selection.reconcile(catalog),{dropped:1,changed:1});assert.equal(selection.size,17);
});

test('destructive and share actions are reviewed against exact revisions and expire',()=>{
 const catalog=new m.LibraryCatalog();catalog.apply(m.parsePage(page([2,1])),true);
 const review=m.prepareReview('trash',[{id:catalog.items[0].id,revision:catalog.items[0].revision}],1000,()=>'r1');
 assert.equal(review.title,'Move 1 item to trash?');assert.match(review.detail,/Android asks you to confirm/);
 assert.equal(m.reviewCurrent(review,catalog,1001),true);
 assert.equal(m.reviewCurrent(review,catalog,1000+120000),false,'expired');
 catalog.reconcile([{id:catalog.items[0].id,status:'changed',item:{...catalog.items[0],revision:'1:1:5'}}]);
 assert.equal(m.reviewCurrent(review,catalog,1001),false,'changed item invalidates the review');
 assert.match(m.reviewText('delete',2).detail,/cannot be undone/);assert.match(m.reviewText('share',1).detail,/Nothing is sent until/);
 assert.throws(()=>m.prepareReview('rename',[{id:'lib:i:1:1',revision:'1:1'}]));
 assert.throws(()=>m.prepareReview('share',[]));
 assert.throws(()=>m.prepareReview('share',[{id:'lib:i:1:1',revision:'1:1'},{id:'lib:i:1:1',revision:'1:1'}]));
 for(const action of m.DESTRUCTIVE_LIBRARY_ACTIONS)assert.ok(m.REVIEWED_LIBRARY_ACTIONS.includes(action));
 assert.ok(m.REVIEWED_LIBRARY_ACTIONS.includes('share'));
 // The adapter calls native change/share only from the confirmed review, never from a tap.
 const confirm=adapter.slice(adapter.indexOf('async function confirmReview'),adapter.indexOf('function attach'));
 assert.match(confirm,/port\.share\(\{ items: pending\.items \}\)/);assert.match(confirm,/port\.requestChange\(\{ operation: pending\.action, items: pending\.items \}\)/);
 assert.equal((adapter.match(/port\.(share|requestChange)\(/g)||[]).length,2,'no other native change path');
});

test('agent operations: search/inspect/select read locally; every change or share is a review',()=>{
 assert.deepEqual(m.validateLibraryOperation({type:'photo_library_search',query:'beach',kind:'image',from:1,to:2,limit:10}),{type:'photo_library_search',query:'beach',kind:'image',from:1,to:2,limit:10});
 for(const bad of [{type:'photo_library_search',limit:51},{type:'photo_library_search',query:'x'.repeat(81)},{type:'photo_library_search',from:5,to:1},{type:'photo_library_search',extra:1},{type:'photo_library_delete',ids:['lib:i:1:1']},{type:'photo_library_inspect',id:'content://media/external/images/1'},{type:'photo_library_select',ids:[]}])assert.throws(()=>m.validateLibraryOperation(bad));
 assert.deepEqual(m.validateLibraryOperation({type:'photo_library_select',ids:['lib:v:4:9']}),{type:'photo_library_select',ids:['lib:v:4:9']});
 assert.deepEqual(m.validateLibraryOperation({type:'photo_library_review',action:'delete',items:[{id:'lib:i:1:1',revision:'1:2:3'}]}),{type:'photo_library_review',action:'delete',items:[{id:'lib:i:1:1',revision:'1:2:3'}]});
});

test('selected outbound model context carries no names, album names or pixels',()=>{
 const parsed=m.parsePage(page([item(7,{name:'PRIVATE_NAME.jpg',album:'PRIVATE_ALBUM',favorite:true}),item(6,{id:'lib:v:6:60',kind:'video',duration:12.4})],'6'));
 const result=m.modelSearchResult(parsed,10);
 assert.equal(result.more,true);
 const wire=JSON.stringify(result);
 assert.doesNotMatch(wire,/PRIVATE_NAME|PRIVATE_ALBUM|base64|image\/jpeg/);
 assert.deepEqual(result.items[0],{id:'lib:i:7:70',revision:parsed.items[0].revision,kind:'image',takenAt:parsed.items[0].takenAt,width:4000,height:3000,favorite:true});
 assert.equal(result.items[1].duration,12);
 // The assistant's selected object is one item's identity and a local counter revision.
 assert.match(adapter,/if \(selection\.size !== 1 \|\| !visible\(\)\) return null;/);
 assert.match(adapter,/revisions\(\{ kind: item\.kind, id: item\.id, revision: item\.revision \}\)/);
 const agent=readFileSync('apps/app/src/prototype/agent-adapter.ts','utf8');
 assert.match(agent,/state\.album === 'device' && !state\.open && state\.nativeLibrarySelection\) providerSelection = state\.nativeLibrarySelection;/);
});
