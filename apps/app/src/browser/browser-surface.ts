import { WebPlugin } from '@capacitor/core';

type Tab = { session: string; id: string; frame: HTMLIFrameElement; container: HTMLDivElement; link: HTMLAnchorElement; history: string[]; position: number; sequence: number; navigation: number; loading: boolean };
/** Unprivileged web surfaces. Remote documents never receive the host bridge. */
export class BrowserSurface extends WebPlugin {
  private tabs = new Map<string, Tab>();
  private key(input: {session:string;id:string}) { return `${input.session}:${input.id}`; }
  private tab(input: {session:string;id:string}) { const tab=this.tabs.get(this.key(input)); if(!tab)throw Error('Reopen this tab.');return tab; }
  private address(raw:string) { const url=new URL(raw);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw Error('Enter an HTTP or HTTPS address.');return url.href; }
  private emit(tab:Tab) { void this.notifyListeners('stateChanged',{session:tab.session,id:tab.id,sequence:++tab.sequence,navigation:tab.navigation,url:tab.history[tab.position],title:tab.history[tab.position],loading:tab.loading,committed:!tab.loading,error:'',canBack:tab.position>0,canForward:tab.position<tab.history.length-1}); }
  async create(input:{session:string;id:string}) {
    if(this.tabs.has(this.key(input)))return;
    const container=document.createElement('div'),frame=document.createElement('iframe'),link=document.createElement('a');
    container.dataset.browserSurface=input.id;
    container.style.cssText='position:fixed;display:none;z-index:20;background:var(--bg,#fff);overflow:hidden;flex-direction:column';
    frame.title='Website';frame.referrerPolicy='no-referrer';
    // Opaque origin also isolates a same-origin development page from local state.
    frame.setAttribute('sandbox','allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads');
    frame.style.cssText='width:100%;flex:1;min-height:0;border:0;background:white';
    link.textContent='Open in browser ↗';link.target='_blank';link.rel='noopener noreferrer';link.style.cssText='padding:8px 12px;color:var(--fg,#111);font:12px system-ui;text-align:right';
    container.append(link,frame);document.body.append(container);
    const tab:Tab={...input,frame,container,link,history:[],position:-1,sequence:0,navigation:0,loading:false};
    frame.addEventListener('load',()=>{if(!this.tabs.has(this.key(input)))return;tab.loading=false;this.emit(tab);});
    this.tabs.set(this.key(input),tab);
  }
  private load(tab:Tab) { const url=tab.history[tab.position];tab.navigation++;tab.loading=true;tab.link.href=url;tab.frame.src=url;this.emit(tab); }
  async navigate(input:{session:string;id:string;url:string}) {const tab=this.tab(input),url=this.address(input.url);tab.history=tab.history.slice(0,tab.position+1);tab.history.push(url);tab.position++;this.load(tab);}
  async command(input:{session:string;id:string;command:string}) {
    const tab=this.tab(input);
    if(input.command==='back'&&tab.position>0){tab.position--;this.load(tab);}
    else if(input.command==='forward'&&tab.position<tab.history.length-1){tab.position++;this.load(tab);}
    else if(input.command==='reload'&&tab.position>=0)this.load(tab);
    else if(input.command==='stop'){tab.frame.src='about:blank';tab.loading=false;this.emit(tab);}
  }
  async present(input:{session:string;id:string|null;x?:number;y?:number;width?:number;height?:number}) {
    for(const tab of this.tabs.values())if(tab.session===input.session){const visible=tab.id===input.id;tab.container.style.display=visible?'flex':'none';if(visible)Object.assign(tab.container.style,{left:`${input.x||0}px`,top:`${input.y||0}px`,width:`${input.width||0}px`,height:`${input.height||0}px`});}
  }
  async close(input:{session:string;id:string}) {const tab=this.tabs.get(this.key(input));tab?.container.remove();this.tabs.delete(this.key(input));}
  async bookmarks() {return {urls:JSON.parse(localStorage.getItem('alpha.browser.bookmarks.v1')||'[]') as string[]};}
  async setBookmark(input:{url:string;saved:boolean}) {const url=this.address(input.url),{urls}=await this.bookmarks();const next=urls.filter(value=>value!==url);if(input.saved)next.unshift(url);localStorage.setItem('alpha.browser.bookmarks.v1',JSON.stringify(next));return {urls:next};}
  async share(input:{session:string;id:string;url:string;navigation:number}) {const tab=this.tab(input);if(tab.navigation!==input.navigation||tab.history[tab.position]!==input.url)throw Error('The page changed. Share it again.');if(navigator.share)await navigator.share({url:input.url});else await navigator.clipboard.writeText(input.url);}
  async downloads() {window.dispatchEvent(new CustomEvent('alpha:browser-open-view',{detail:'files'}));}
  async cancelReading() {window.speechSynthesis?.cancel();}
}
