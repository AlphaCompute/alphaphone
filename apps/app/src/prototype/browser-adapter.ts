import { registerPlugin } from '../platform-plugins';
import { Capacitor } from '@capacitor/core';
import { DailyApps } from '../daily';
import { createPairedVoice } from '../runtime/paired-voice';
import { connectionController } from '../runtime/connection-ui';
type Bag = Record<string, any>;
const Browser = registerPlugin<any>('AlphaBrowser');

/** Public browsing only. Install last, only outside visual fixture mode. */
export function installPrototypeBrowserAdapter(Component: any, views: Record<string, Bag>) {
  const session = crypto.randomUUID();
  const metadata = new Map<string, Bag>();
  const documentRevisions = new Map<string, number>();
  const created = new Map<string, Promise<any>>();
  let shell: any, lastGeometry = '', disposed = false, sharing = false;
  let bookmarkRead: Promise<void> | undefined, bookmarkQueue = Promise.resolve();
  let bookmarkHydrated = false, bookmarkRefreshQueued = false, initialBookmarkRead = false, browserWasActive = false;
  function loadBookmarks() {
    if (bookmarkRead) return bookmarkRead;
    bookmarkRead = Browser.bookmarks({session}).then((result: Bag) => {
      if (!disposed) { shell?.vset('browser', {marks: result.urls}); bookmarkHydrated = true; }
    }).catch((error: unknown) => { bookmarkHydrated = false; throw error; }).finally(() => { bookmarkRead = undefined; });
    return bookmarkRead;
  }
  function refreshBookmarks() {
    if (disposed || bookmarkRefreshQueued) return;
    bookmarkRefreshQueued = true;
    bookmarkQueue = bookmarkQueue.then(() => disposed ? undefined : loadBookmarks()).catch(report).finally(() => { bookmarkRefreshQueued = false; });
  }
  function saveBookmark(url: string, saved?: boolean) {
    bookmarkQueue = bookmarkQueue.then(async () => {
      if (!bookmarkHydrated) await loadBookmarks();
      if (disposed) return;
      const result = await Browser.setBookmark({session, url, saved: saved ?? !state().marks.includes(url)});
      if (!disposed) shell.vset('browser', {marks: result.urls, menu: false});
    }).catch(report);
  }
  const state = () => shell?.vget('browser');
  const refresh = () => shell?.vset('browser', { nativeRevision: Date.now() });
  const report = (error: unknown) => !disposed && shell?.toast(error instanceof Error ? error.message : 'Browser unavailable');
  let reading: AbortController | undefined;
  function stopReading() { const active=reading; reading=undefined; active?.abort(); void Browser.cancelReading({session}).catch(()=>{}); }
  const unsubscribeReading = connectionController.subscribe(()=>{ if(reading && (connectionController.getSnapshot().open || document.hidden)) stopReading(); });
  async function readPage() {
    if(reading){stopReading();shell?.toast('Reading stopped');return;}
    const id=state()?.cur, info=metadata.get(id), revision=documentRevisions.get(id);
    const voice=createPairedVoice(), binding=connectionController.getPairedVoiceBinding();
    if(!voice || !binding){report(new Error('Connect a paired agent with voice to read this page.'));return;}
    if(!info?.committed || info.loading || info.error){report(new Error('Load an HTTPS page before reading.'));return;}
    const controller=new AbortController();reading=controller;
    const valid=()=>{controller.signal.throwIfAborted();if(disposed||document.hidden||shell.S().view!=='browser'||state()?.cur!==id||documentRevisions.get(id)!==revision||JSON.stringify(connectionController.getPairedVoiceBinding())!==JSON.stringify(binding)||connectionController.getSnapshot().open)throw new DOMException('Reading cancelled','AbortError');};
    const unsubscribe=connectionController.subscribe(()=>{try{valid();}catch{stopReading();}});
    try {
      shell.vset('browser',{menu:false});await new Promise(resolve=>setTimeout(resolve,150));valid();lastGeometry='';await update();
      if(!await voice.ready(controller.signal))throw new Error('The selected agent is not ready for speech.');valid();
      const result=await Browser.reviewReading({session,id,url:info.url,navigation:info.navigation,...binding});valid();
      shell.toast('Preparing reviewed page speech');
      await voice.speak('',controller.signal,result.readingToken);valid();shell.toast('Reading finished');
    }catch(error){if(!controller.signal.aborted)report(error);}finally{unsubscribe();if(reading===controller){reading=undefined;void Browser.cancelReading({session}).catch(()=>{});}}
  }
  function hide() {
    const next = JSON.stringify({session,id:null});
    if (lastGeometry === next) return;
    lastGeometry = next;
    void Browser.present({session,id:null}).catch(() => { if(lastGeometry === next) lastGeometry=''; });
  }
  function ensure(id: string) {
    if (!created.has(id)) created.set(id, Browser.create({ session, id }).catch((error: unknown) => { created.delete(id); throw error; }));
    return created.get(id)!;
  }
  async function navigate(raw: string, newTab = false, approvedSignal?: AbortSignal) {
    let url: URL;
    try {
      const input = raw.trim();
      if (!input || input.length > 4096 || /[\u0000-\u001f\u007f]/.test(input)) throw new Error();
      const scheme = /^[a-z][a-z0-9+.-]*:/i.test(input);
      const address = !/\s/.test(input) && (/^(?:localhost|\[[0-9a-f:]+\]|[^/?#]+\.[^/?#]+)(?::\d+)?(?:[/?#]|$)/i.test(input));
      if (scheme || address) {
        const hostPort = address && /^[^/?#]+:\d+(?:[/?#]|$)/.test(input);
        url = new URL(scheme && !hostPort ? input : 'https://' + input);
        if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password || /\s/.test(input)) throw new Error();
      } else {
        // Submit only on Enter. No suggestions, background query traffic or agent upload.
        url = new URL('https://www.google.com/search');
        url.searchParams.set('q', input);
      }
    } catch { if (approvedSignal) throw new Error('Invalid approved browser destination'); report(new Error('Enter search words or a valid HTTP or HTTPS address without credentials.')); return; }
    const s = state(); if (!s) { if (approvedSignal) throw new Error('Browser unavailable'); return; }
    const id = newTab ? 'b' + crypto.randomUUID().replaceAll('-', '') : s.cur;
    try {
      await ensure(id);
      approvedSignal?.throwIfAborted();
      if (disposed) { if (approvedSignal) throw new Error('Browser closed'); return; }
      if (newTab) shell.vset('browser', { tabs: [...state().tabs, { id, hist: ['newtab'], pos: 0 }], cur: id });
      metadata.set(id, { ...metadata.get(id), url: url.href, loading: true, committed: false, error: '' });
      documentRevisions.set(id, (documentRevisions.get(id) || 0) + 1);
      shell.vset('browser', { editing: false, tabsOpen: false, menu: false, lib: null, share: false });
      await Browser.navigate({ session, id, url: url.href });
      refresh();
    } catch (error) { if (approvedSignal) throw error; report(error); }
  }
  async function command(command: string) {
    const id = state()?.cur; if (!id || !created.has(id)) return;
    try { await Browser.command({ session, id, command }); } catch (error) { report(error); }
  }
  async function sharePage() {
    const id=state()?.cur, info=metadata.get(id), revision=documentRevisions.get(id);
    if(sharing)return;
    if(!info?.committed || info.loading || info.error || !info.navigation){report(new Error('Load a page before sharing it.'));return;}
    sharing=true;
    try {
      shell.vset('browser',{menu:false,share:false});
      // Restore the actual child surface after the reference menu closes.
      await new Promise(resolve=>setTimeout(resolve,150));
      if(disposed || document.hidden || shell.S().view!=='browser' || state()?.cur!==id || documentRevisions.get(id)!==revision)throw new Error('The page changed before sharing. Try again.');
      lastGeometry='';await update();
      await Browser.share({session,id,navigation:info.navigation,url:info.url});
    } catch(error){report(error);} finally {sharing=false;}
  }
  const definition = views.browser;
  definition.state = { ...definition.state, tabs: [{ id: 'b0', hist: ['newtab'], pos: 0 }], cur: 'b0', marks: [], visits: [], booked: null, ag: null, confirm: null };
  // These are in-memory view-reset keys, not disk persistence. Keep the native
  // tab identities while visiting other apps; a cold start begins with b0.
  definition.persist = ['tabs', 'cur', 'marks', 'visits'];
  definition.onLeave = () => {stopReading();hide();};
  definition.reply = () => null;
  definition.back = (s: Bag, api: Bag) => {
    for (const key of ['editing', 'tabsOpen', 'menu', 'lib', 'share']) if(s[key]) { api.set({ [key]: key === 'lib' ? null : false }); return true; }
    if (metadata.get(s.cur)?.canBack) { void command('back'); return true; }
    return false;
  };
  const render = definition.render;
  definition.render = (s: Bag, api: Bag) => {
    const out = render(s, api), info = metadata.get(s.cur), url = info?.url ? new URL(info.url) : null;
    const unavailable = () => api.toast('This browser currently supports public navigation only.');
    const openNew = () => { if (s.tabs.length >= 8) { api.toast('Close a tab before opening another.'); return; } const id='b'+crypto.randomUUID().replaceAll('-',''); api.set({ tabs:[...s.tabs,{id,hist:['newtab'],pos:0}],cur:id,tabsOpen:false,editing:true,addr:'' }); };
    return { ...out, isNews:false,isEnc:false,isBook:false,isSearch:false,isGeneric:false,isNew:!info,
      recents:[],sugg:[],people:[],agOn:false,confirm:false,
      host:url?.host || 'Search or type address',path:url ? url.pathname + url.search : '', hasLock:!!url && url.protocol==='https:' && !!info?.committed && !info?.loading && !info?.error,
      nativeControls:true,openDownloads:()=>{api.set({menu:false});void Browser.downloads({session}).catch(report);},reload:()=>{api.set({menu:false});void command('reload');},stopLoading:()=>{api.set({menu:false});void command('stop');},loading:!!info?.loading,goBack:()=>void command('back'),goFwd:()=>void command('forward'),backOp:info?.canBack?1:0.3,fwdOp:info?.canForward?1:0.3,
      startEdit:()=>api.set({editing:true,addr:info?.url||'',menu:false}),onAddrKey:(e:KeyboardEvent)=>{ if(e.key==='Enter'){e.preventDefault();void navigate((e.target as HTMLInputElement).value);} else if(e.key==='Escape')api.set({editing:false}); },
      toggleMark:()=>{if(!info?.committed || info.loading || info.error || url?.protocol!=='https:'){api.toast('Load an HTTPS page before bookmarking it.');return;}saveBookmark(info.url);},markLabel:s.marks.includes(info?.url)?'Bookmarked':'Bookmark',markFill:s.marks.includes(info?.url)?'currentColor':'none',libRows:(s.lib==='history'?s.visits:s.marks).map((u:string)=>({title:u,host:u,ini:new URL(u).hostname[0],go:()=>void navigate(u),canRemove:s.lib!=='history',removeAria:'Remove bookmark',remove:()=>saveBookmark(u,false)})),libEmpty:!(s.lib==='history'?s.visits:s.marks).length,newTab:openNew,readAloud:()=>void readPage(),bookNow:unavailable,cfOk:unavailable,openShare:()=>void sharePage(),
      tabCards:s.tabs.map((tab:Bag)=>({title:metadata.get(tab.id)?.title || metadata.get(tab.id)?.url || 'New tab',host:metadata.get(tab.id)?.url||'',css:tab.id===s.cur?'box-shadow:inset 0 0 0 2px var(--acc)':'',prev:'background:var(--s2)',aria:'Switch to '+(metadata.get(tab.id)?.title||'New tab'),closeAria:'Close tab',pick:()=>api.set({cur:tab.id,tabsOpen:false}),close:()=>{ const rest=state().tabs.filter((t:Bag)=>t.id!==tab.id); const fallback='b'+crypto.randomUUID().replaceAll('-','');if(created.has(tab.id))void Browser.close({session,id:tab.id}).catch(report);created.delete(tab.id);metadata.delete(tab.id);api.set({tabs:rest.length?rest:[{id:fallback,hist:['newtab'],pos:0}],cur:state().cur===tab.id?(rest[0]?.id||fallback):state().cur}); }})),
      rootRef:(element:HTMLElement)=>{out.rootRef?.(element); if(!element)return; const viewport=element.querySelector('[data-bscroll]'); if(viewport){viewport.setAttribute('data-native-browser-viewport','true'); viewport.setAttribute('aria-label',info?.error || (info?.loading?'Loading website':'Browser page'));} },
    };
  };
  const oldRender = Component.prototype.renderVals;
  Component.prototype.renderVals = function(){shell=this;
    const browserActive = this.S().view === 'browser';
    if (!initialBookmarkRead || (browserActive && !browserWasActive)) { initialBookmarkRead = true; refreshBookmarks(); }
    browserWasActive = browserActive;
    this.browserNavigateApproved = async (raw: string, signal: AbortSignal) => {
      const url = new URL(raw);
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Only HTTPS destinations may be approved');
      signal.throwIfAborted();
      await navigate(url.href, true, signal);
      // The native tab was created before this view transition. A normal
      // openView resets the destination state and loses its current-tab ID.
      if (!disposed) shell.openView('browser', null, null, { restore: true });
    };
    // Identity only: visible page content, URL and browsing history are not
    // transmitted merely by opening the agent. Navigation changes the revision
    // so a proposal for an earlier document cannot retain current authority.
    this.browserSelection = () => {
      const id = state()?.cur, info = metadata.get(id);
      return id && info?.url && !info.error
        ? { kind:'browser-tab', id:session + ':' + id, revision:String(documentRevisions.get(id) || 0) }
        : undefined;
    };
    const S=this.S();const b=this.vget('browser');if(S.view!=='browser'||b.menu||b.editing||b.tabsOpen||b.lib||S.shade||['sheet','full'].includes(S.chat))hide();return oldRender.call(this);};
  let listener: any, resumeListener: any;
  void DailyApps.addListener('appResumed', () => { if (shell?.S().view === 'browser') refreshBookmarks(); }).then(value => { resumeListener=value; }).catch(()=>{});
  void Browser.addListener('stateChanged',(event:Bag)=>{
    if(event.session!==session || !created.has(event.id) || event.sequence <= (metadata.get(event.id)?.sequence||0))return;
    // Android hides child surfaces while a system picker/activity is foreground.
    // Resume must resend geometry even when the host's visibility event did not fire.
    if(event.surfaceResumed)lastGeometry='';
    const previous = metadata.get(event.id);
    if(reading && event.id===state()?.cur && (event.loading || event.error || event.navigation!==previous?.navigation || event.url!==previous?.url)) stopReading();
    if ((event.url && event.url !== previous?.url) || (event.loading && !previous?.loading))
      documentRevisions.set(event.id, (documentRevisions.get(event.id) || 0) + 1);
    metadata.set(event.id,{...metadata.get(event.id),...event});if(event.url && !event.loading && !event.error && state())shell.vset('browser',{visits:[event.url,...state().visits.filter((u:string)=>u!==event.url)].slice(0,50)});refresh();
  }).then((value:any)=>{listener=value;}).catch(()=>{});
  // A native surface sits above the host WebView. Hide it for every host overlay.
  const update = () => {
    if(disposed)return;
    const s=state(), S=shell?.S();
    const element=document.querySelector('[data-native-browser-viewport]') as HTMLElement|null;
    const hidden=!s || !element || !element.isConnected || !element.getClientRects().length || S?.view!=='browser' || s.editing || s.tabsOpen || s.menu || s.lib || s.share || s.ag || s.confirm || S?.shade || S?.screen !== 'home' || ['sheet','full'].includes(S?.chat) || document.hidden;
    if(reading && (disposed || document.hidden || S?.view!=='browser' || s?.tabsOpen || s?.editing || S?.shade || ['sheet','full'].includes(S?.chat)))stopReading();
    const rect=element?.getBoundingClientRect();
    const composer=document.querySelector('[aria-label="Open conversation"]')?.parentElement?.getBoundingClientRect();
    const height=rect ? Math.max(0,Math.min(rect.bottom,composer && composer.height ? composer.top-8 : rect.bottom)-rect.top) : 0;
    const payload=hidden || !created.has(s?.cur) ? {session,id:null} : {session,id:s.cur,x:rect!.x,y:rect!.y,width:rect!.width,height};
    const next=JSON.stringify(payload);
    if(next!==lastGeometry){lastGeometry=next;return Browser.present(payload).catch(()=>{lastGeometry='';});}
  };
  const openBrowserView = (event: Event) => shell?.openView((event as CustomEvent<string>).detail);
  window.addEventListener('alpha:browser-open-view', openBrowserView);
  const timer=window.setInterval(update,100);
  const visibility = () => { lastGeometry=''; update(); if (!document.hidden && shell?.S().view === 'browser') refreshBookmarks(); };
  window.addEventListener('resize',update);document.addEventListener('visibilitychange',visibility);
  return ()=>{window.removeEventListener('alpha:browser-open-view',openBrowserView);stopReading();unsubscribeReading();disposed=true;clearInterval(timer);window.removeEventListener('resize',update);document.removeEventListener('visibilitychange',visibility);void resumeListener?.remove();void listener?.remove();for(const id of created.keys())void Browser.close({session,id}).catch(()=>{});};
}
