/** Bundled website icons add no provider requests; decorative, never identity proof. */
export function mailSenderImage(email:string|null|undefined,enabled:boolean):string|null{
 if(!enabled||!email||email.length>320)return null;
 const match=/^[^\s<>@]+@([a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)$/i.exec(email);
 if(!match)return null;
 const domain=match[1].toLowerCase();
 // Shared personal-mail providers do not identify an individual sender.
 if(/(?:^|\.)(?:gmail\.com|googlemail\.com|outlook\.com|hotmail\.com|live\.com|yahoo\.com|icloud\.com|proton\.me|protonmail\.com|aol\.com)$/.test(domain))return null;
 if(!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)||/\.(?:local|localhost|internal|invalid|test|example|onion)$/.test(domain))return null;
 const brand=['turbotax.intuit.com','linkedin.com','cash.app','paypal.com','postman.com','indiegala.com','canva.com','robinhood.com','google.com','coinbase.com','github.com','zillow.com','mozilla.org','openai.com'].find(known=>domain===known||domain.endsWith('.'+known));
 return brand?`/icons/senders/${brand}.png`:null;
}
