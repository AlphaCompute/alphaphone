/** Conservative parity with BrowserReading.java. This heuristic cannot establish
 * that arbitrary content is credential-free; ambiguous pages fail closed. */
const sensitive=/(?:api[\s_-]*key|access[\s_-]*token|refresh[\s_-]*token|password|passphrase|passcode|credential|vault|one[\s-]*time[\s-]*(?:password|code)|verification[\s-]*code|security[\s-]*code|authentication[\s-]*code|recovery[\s-]*(?:code|key|phrase)|backup[\s-]*(?:code|key)|seed[\s-]*phrase|secret[\s-]*key|private[\s-]*key|authenticator|two[\s-]*factor|multi[\s-]*factor|sign[\s-]*in|log[\s-]*in|\botp\b|\bmfa\b|\b2fa\b)/i;
const normalize=(value:string)=>value.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g,'');
export const sensitiveReadingText=(text:string)=>sensitive.test(normalize(text))||/(?:^|\D)\d{6,8}(?:\D|$)/.test(normalize(text));
export function sensitiveReadingUrl(address:string){
 try{if(address.length>8192)return true;const url=new URL(address);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return true;
 const host=url.hostname.toLowerCase().replace(/\.$/,'');if(["pass.proton.me","account.proton.me","accounts.google.com","passwords.google.com","bitwarden.com","bitwarden.eu","1password.com","lastpass.com","dashlane.com","keepersecurity.com","nordpass.com","passbolt.com"].some(provider=>host===provider||host.endsWith('.'+provider)))return true;
 return /(?:^|[^a-z0-9])(?:api[\s_-]*key|vault|passwords?|passphrase|signin|sign-in|login|log-in|logout|auth|oauth|sso|account|accounts|security|mfa|2fa|otp|recovery|reset-password|credentials?|access_token|id_token|refresh_token|secret|token)(?:$|[^a-z0-9])/.test(decodeURIComponent(address.replace(/\+/g,' ')).toLowerCase());
 }catch{return true;}
}
export function sensitiveReadingDocument(root:Node){
 const pending=[root];let inspected=0,characters=0,text='';
 while(pending.length){if(++inspected>12000)return true;const node=pending.pop()!;
 if(node.nodeType===Node.ELEMENT_NODE){const element=node as Element;if(['SCRIPT','STYLE','NOSCRIPT','TEMPLATE'].includes(element.tagName))continue;
 for(const attr of ['type','autocomplete','id','name','class','aria-label','title','placeholder']){const value=element.getAttribute(attr)||'';characters+=value.length;if(value.length>1024||characters>65536||sensitive.test(normalize(value)))return true;}
 }else if(node.nodeType===Node.TEXT_NODE){const value=node.nodeValue||'';characters+=value.length;if(value.length>20000||characters>65536)return true;text+=' '+normalize(value);}
 if(node.childNodes.length+pending.length>12000)return true;for(let i=node.childNodes.length-1;i>=0;i--)pending.push(node.childNodes[i]);
 }
 return sensitiveReadingText(text);
}
