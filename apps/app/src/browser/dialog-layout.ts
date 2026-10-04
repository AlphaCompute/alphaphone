/** Product presentation only. Call after content assembly; callers own actions and lifecycle. */
export function layoutBrowserDialog(dialog:HTMLDialogElement,actions:HTMLElement[]){
 dialog.style.cssText='';dialog.classList.add('alpha-browser-dialog');
 const shell=document.querySelector('.os');
 if(shell){const theme=getComputedStyle(shell);for(const token of ['--bg','--fg','--s2','--line'])dialog.style.setProperty(token,theme.getPropertyValue(token));dialog.style.colorScheme=theme.getPropertyValue('--bg').trim().toLowerCase()==='#000000'?'dark':'light';}
 const content=document.createElement('div');content.className='alpha-browser-dialog-content';content.setAttribute('role','region');content.setAttribute('aria-label',(dialog.getAttribute('aria-label')||'Dialog')+' content');content.tabIndex=0;
 const footer=document.createElement('footer');
 for(const action of actions){action.style.removeProperty('margin');footer.append(action);}
 content.append(...Array.from(dialog.childNodes));dialog.append(content,footer);
}
