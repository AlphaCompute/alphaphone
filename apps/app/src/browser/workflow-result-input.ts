const cancelled=()=>new DOMException('Result input cancelled','AbortError');
/** Explicit local test data for an unconstrained Write instruction; never represented as model output. */
export function requestWorkflowResult(instruction:string,input:string,signal:AbortSignal):Promise<string>{
 signal.throwIfAborted();
 if(document.hidden||document.documentElement.dataset.devBackground==='true'||document.querySelector('[aria-label="Unlock with fingerprint"], [aria-label="Wake"]')?.getClientRects().length)return Promise.reject(cancelled());
 return new Promise((resolve,reject)=>{
  let settled=false;const previous=document.activeElement as HTMLElement|null;
  const dialog=document.createElement('dialog');dialog.setAttribute('aria-label','Workflow step result');dialog.style.cssText='box-sizing:border-box;width:min(380px,92vw);max-height:85dvh;overflow:auto;border:0;border-radius:20px;padding:24px;background:var(--bg,#fff);color:var(--fg,#111);font:16px/1.5 system-ui';
  const shell=document.querySelector('.os');if(shell){const theme=getComputedStyle(shell);for(const name of ['--bg','--fg','--s2'])dialog.style.setProperty(name,theme.getPropertyValue(name));}
  const title=document.createElement('h2');title.textContent='Workflow step result';title.style.margin='0 0 12px';
  const prompt=document.createElement('p');prompt.textContent=instruction;
  const sourceLabel=document.createElement('label');sourceLabel.textContent='Step input';const source=document.createElement('textarea');source.value=input;source.readOnly=true;source.rows=3;sourceLabel.append(source);
  const resultLabel=document.createElement('label');resultLabel.textContent='Development result';const result=document.createElement('textarea');result.rows=5;result.maxLength=16000;resultLabel.append(result);
  for(const label of [sourceLabel,resultLabel])label.style.cssText='display:grid;gap:8px;margin:12px 0';
  for(const field of [source,result])field.style.cssText='box-sizing:border-box;width:100%;padding:10px;border:1px solid #999;border-radius:10px;font:inherit;color:inherit;background:transparent';
  const use=document.createElement('button');use.textContent='Use result';use.disabled=true;
  const cancel=document.createElement('button');cancel.textContent='Cancel run';
  for(const button of [use,cancel])button.style.cssText='min-height:44px;padding:10px 14px;margin:4px;border:1px solid #ccc;border-radius:10px;font:inherit;color:inherit;background:var(--s2,#f3f3f3)';
  const finish=(value?:string)=>{if(settled)return;settled=true;signal.removeEventListener('abort',close);window.removeEventListener('alpha-back',back,true);for(const name of ['pagehide','alpha:device-state','launcher-home','alpha:dev-incoming-call'])window.removeEventListener(name,close);document.removeEventListener('visibilitychange',hidden);dialog.close();dialog.remove();if(previous?.isConnected)previous.focus();value===undefined?reject(cancelled()):resolve(value);};
  const close=()=>finish();const hidden=()=>{if(document.hidden)close();};const back=(event:Event)=>{event.preventDefault();event.stopImmediatePropagation();close();};
  result.oninput=()=>{use.disabled=!result.value.trim()||result.value.length>16000;};use.onclick=()=>{if(result.value.trim()&&result.value.length<=16000)finish(result.value);};cancel.onclick=close;dialog.onclose=close;
  dialog.append(title,prompt,sourceLabel,resultLabel,use,cancel);document.body.append(dialog);
  signal.addEventListener('abort',close,{once:true});window.addEventListener('alpha-back',back,true);for(const name of ['pagehide','alpha:device-state','launcher-home','alpha:dev-incoming-call'])window.addEventListener(name,close);document.addEventListener('visibilitychange',hidden);
  if(signal.aborted){close();return;}try{dialog.showModal();result.focus();}catch{close();}
 });
}
