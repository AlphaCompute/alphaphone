/** Published icons keep media review tools compact without losing accessible names. */
export function mediaToolIcon(button:HTMLButtonElement,icon:string){
 const label=button.textContent||'';button.setAttribute('aria-label',label);button.title=label;
 const glyph=document.createElement('span');glyph.className='media-review-icon';glyph.setAttribute('aria-hidden','true');
 glyph.style.maskImage=`url('/icons/lucide/${icon}.svg')`;glyph.style.webkitMaskImage=`url('/icons/lucide/${icon}.svg')`;
 button.replaceChildren(glyph);button.classList.add('scan-icon-button');
}
