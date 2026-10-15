let decoder:HTMLTextAreaElement|undefined;
/** Gmail snippets contain HTML character references, but are displayed as text.
 * Parse only individual references, never the provider's markup, and decode once. */
export function decodeMailPreview(text:string):string{
 if(!text.includes('&'))return text;
 return text.replace(/&(?:#[0-9]{1,7}|#x[0-9a-f]{1,6}|[a-z][a-z0-9]{1,31});/gi,reference=>{
  decoder??=document.createElement('textarea');
  decoder.innerHTML=reference;
  return decoder.value;
 });
}
