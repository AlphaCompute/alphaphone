let decoder:HTMLTextAreaElement|undefined;
/** Gmail snippets contain HTML character references, but are displayed as text.
 * Parse only individual references, never the provider's markup, and decode once. */
export function decodeMailPreview(text:string):string{
 const decoded=text.includes('&')?text.replace(/&(?:#[0-9]{1,7}|#x[0-9a-f]{1,6}|[a-z][a-z0-9]{1,31});/gi,reference=>{
  decoder??=document.createElement('textarea');
  decoder.innerHTML=reference;
  return decoder.value;
 }):text;
 // Marketing preheaders pad snippets with long runs of invisible characters.
 // Preserve individual language joiners and ordinary non-breaking spaces.
 return decoded.replace(/[ \u00a0\u00ad\u034f\u200b-\u200f\u2060\ufeff]{3,}/g,' ').trim();
}
