import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeBrowsing,browsingSnapshot,restoreBrowsing,MAX_SAVED_TABS,MAX_SAVED_HISTORY} from '../apps/app/src/browser/browsing-session.ts';

// Product decision: browser tabs keep sign-ins. Normal tabs and history are
// saved and restored; private tabs are ephemeral and never saved.
const read=file=>fs.readFileSync(file,'utf8');
const plugin=read('android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaBrowserPlugin.java');
const links=read('android/app/src/main/java/ai/elizaresearch/alphaphone/BrowserExternalLinks.java');

test('saved browsing is bounded and drops unsafe or malformed rows',()=>{
  const record=normalizeBrowsing({
    history:['https://a.example/','https://a.example/','javascript:alert(1)','https://user:pw@b.example/','https://c.example/\n',7,'http://d.example/x',...Array.from({length:200},(_,i)=>`https://h.example/${i}`)],
    tabs:[{id:'b1',url:'https://a.example/',title:'A\u0000title'},{id:'b1',url:'https://dup.example/'},{id:'bad id',url:'https://x.example/'},{id:'b2',url:'file:///etc/passwd'},{id:'b3',url:'https://b.example/',title:'x'.repeat(500)}],
    cur:'b9',
  });
  assert.equal(record.history.length,MAX_SAVED_HISTORY);
  assert.deepEqual(record.history.slice(0,2),['https://a.example/','http://d.example/x']);
  assert.deepEqual(record.tabs.map(tab=>tab.id),['b1','b3']);
  assert.equal(record.tabs[0].title,'A title');assert.equal(record.tabs[1].title.length,200);
  assert.equal(record.cur,'','unknown selected tab is not kept');
  assert.deepEqual(normalizeBrowsing(null),{history:[],tabs:[],cur:''});
  assert.equal(normalizeBrowsing({tabs:Array.from({length:12},(_,i)=>({id:'t'+i,url:'https://t.example/'+i}))}).tabs.length,MAX_SAVED_TABS);
});

test('the snapshot never contains private tabs or uncommitted pages',()=>{
  const pages={b1:{url:'https://mail.example/inbox',title:'Inbox'},p1:{url:'https://secret.example/',title:'Secret'},b2:{}};
  const snapshot=browsingSnapshot({tabs:[{id:'b1'},{id:'p1',priv:true},{id:'b2'}],visits:['https://mail.example/inbox'],cur:'p1'},id=>pages[id]);
  assert.deepEqual(snapshot,{history:['https://mail.example/inbox'],tabs:[{id:'b1',url:'https://mail.example/inbox',title:'Inbox'}],cur:''});
  assert.doesNotMatch(JSON.stringify(snapshot),/secret/);
});

test('restore replaces only an untouched new tab and always merges history',()=>{
  const saved={history:['https://a.example/','https://b.example/'],tabs:[{id:'b1',url:'https://a.example/',title:'A'},{id:'b2',url:'https://b.example/',title:'B'}],cur:'b2'};
  const fresh=restoreBrowsing(saved,{tabs:[{id:'b0'}],visits:[]},true);
  assert.deepEqual(fresh.tabs.map(tab=>tab.id),['b1','b2']);assert.equal(fresh.cur,'b2');assert.equal(fresh.restored.length,2);
  assert.deepEqual(fresh.visits,saved.history);
  const busy=restoreBrowsing(saved,{tabs:[{id:'live'}],visits:['https://now.example/']},false);
  assert.equal(busy.tabs,undefined,'an already-used browser keeps its tabs');assert.deepEqual(busy.restored,[]);
  assert.deepEqual(busy.visits,['https://now.example/','https://a.example/','https://b.example/']);
  assert.equal(restoreBrowsing({tabs:[{id:'b1',url:'https://a.example/'}]},{tabs:[{id:'b0'}],visits:[]},true).cur,'b1');
});

test('normal tabs share one persistent profile that is never the host profile; private profiles are purged',()=>{
  assert.match(plugin,/PERSISTENT_PROFILE = "alpha_browser_v1"/);
  assert.match(plugin,/"Default"\.equals\(profileName\)/,'the host default profile is refused');
  assert.match(plugin,/priv \? namespace \+ "_" \+ id : PERSISTENT_PROFILE/);
  assert.match(plugin,/PRIVATE_PREFIX = "alpha_private_"/);
  assert.match(plugin,/for\(String name:ProfileStore\.getInstance\(\)\.getAllProfileNames\(\)\) if\(ephemeralProfile\(name\)\)/,'startup deletes only ephemeral profiles');
  assert.match(plugin,/boolean purge=t\.priv&&ephemeralProfile\(t\.profile\)/,'only private profiles are purged on close');
  assert.match(plugin,/handleOnDestroy\(\) \{[^\n]*ArrayList<Tab> all=new ArrayList<>\(tabs\.values\(\)\);tabs\.clear\(\);/,'Activity destruction clears tabs before purging so shared private profiles are purged');
  assert.doesNotMatch(plugin,/addJavascriptInterface/,'child pages never receive an app bridge');
  assert.match(plugin,/WebStorageCompat\.deleteBrowsingData\(profile\.getWebStorage\(\)/,'Clear browsing data deletes profile data');
  assert.match(plugin,/deleteBrowsingDataForSite/);
});

test('pop-ups open as gesture-gated tabs and app links are sanitized',()=>{
  assert.doesNotMatch(plugin,/onCreateWindow\([^)]*\) \{ return false; \}/);
  assert.match(plugin,/onCreateWindow\(WebView v,boolean dialog,boolean gesture,android\.os\.Message message\) \{ return popup\(t,gesture,message\); \}/);
  assert.match(plugin,/if\(!gesture\)\{notice\(opener,"Blocked a pop-up/);
  assert.match(plugin,/build\(id,opener\.priv,opener\.profile\)/,'a pop-up stays in its opener profile');
  assert.match(plugin,/BrowserExternalLinks\.external\(target\)\) \{ if \(r\.isForMainFrame\(\)\) handoff\(t, target, r\.hasGesture\(\)\); return true; \}/);
  assert.match(plugin,/if\(intent==null\|\|ownsRoute\(intent\)\)/);
  assert.match(plugin,/boolean fresh=opener!=null&&!t\.handedOff&&!t\.committed&&t\.lastCommittedUrl\.isEmpty\(\);/,'an empty target=_blank pop-up may hand off once');
  assert.match(plugin,/if\(fresh\)\{t\.handedOff=true;/,'the pop-up handoff is single use');
  assert.match(plugin,/if\(!gesture\)\{notice\(t,"Blocked a link to another app/,'other handoffs need a gesture');
  for(const required of ['intent.setComponent(null);intent.setSelector(null);intent.setClipData(null);','intent.setFlags(0);','Intent.ACTION_DIAL','Intent.CATEGORY_BROWSABLE','"alphaphone"'])
    assert.ok(links.includes(required),required);
  assert.doesNotMatch(links,/ACTION_CALL\b(?!")/);
});

test('rendered browser exposes private tabs and confirmed data controls only on the native adapter',()=>{
  const template=read('apps/app/src/prototype/template.html');
  for(const label of ['aria-label="Private tab"','aria-label="New private tab"','aria-label="Clear browsing data"','aria-label="Clear data for this site"'])assert.ok(template.includes(label),label);
  const adapter=read('apps/app/src/prototype/browser-adapter.ts');
  assert.match(adapter,/reviews\.confirm\(id, title, details, 'Clear data'\)/,'clearing requires a confirmation');
  assert.match(adapter,/!isPrivate\(event\.id\) && !event\.private/,'private pages never enter history');
});
