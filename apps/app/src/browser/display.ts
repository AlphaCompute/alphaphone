/** Scale declared pixel text sizes, leaving inherited/relative sizes and layout geometry intact. */
export function installBrowserDisplay(){
 const scale=(style:CSSStyleDeclaration)=>{const size=style.fontSize;if(/^\d*\.?\d+px$/.test(size))style.setProperty('font-size',`calc(${size} * var(--browser-text-scale, 1))`,style.getPropertyPriority('font-size'));};
 const inline=(node:Element)=>{if(node instanceof HTMLElement||node instanceof SVGElement)scale(node.style);for(const child of node.querySelectorAll<HTMLElement>('[style]'))scale(child.style);};
 const rules=(list:CSSRuleList)=>{for(const rule of Array.from(list)){if('style' in rule)scale((rule as CSSStyleRule).style);if('cssRules' in rule)rules((rule as CSSGroupingRule).cssRules);}};
 const sheets=()=>{for(const sheet of Array.from(document.styleSheets)){try{rules(sheet.cssRules);}catch{/* Cross-origin sheets remain governed by browser access rules. */}}};
 const style=document.createElement('style');style.textContent='.os{filter:brightness(var(--browser-brightness,1))}';document.head.append(style);
 inline(document.documentElement);sheets();
 const observer=new MutationObserver(records=>{let changedSheets=false;for(const record of records){if(record.type==='attributes')inline(record.target as Element);else {if((record.target as Element).closest?.('style'))changedSheets=true;for(const node of record.addedNodes)if(node instanceof Element){inline(node);if(node.matches('style,link')||node.querySelector('style,link'))changedSheets=true;}}}if(changedSheets)sheets();});
 observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['style']});document.addEventListener('load',event=>{if(event.target instanceof HTMLLinkElement)sheets();},true);
}
export function applyBrowserDisplay(state:{textScalePercent:number;brightness:number}){
 document.documentElement.style.setProperty('--browser-text-scale',String(state.textScalePercent/100));
 document.documentElement.style.setProperty('--browser-brightness',String(.2+.8*state.brightness/100));
}
