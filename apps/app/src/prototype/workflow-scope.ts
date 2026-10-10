/**
 * Local scope check for typed workflow generation. It runs before any
 * /api/workflow/phone/generate request so requests the typed phone catalog can
 * never satisfy (calls, SMS, payments, Contacts, arbitrary code, email to
 * unnamed recipients) are refused on the phone and never sent to the model.
 * This is a refusal filter only: anything it lets through is still bounded by
 * the agent's typed catalog, compiler validation and separate review/Save/Run.
 * It recognizes phrasings, not intent: wording it does not recognize reaches the
 * generator, which still cannot emit a step outside the typed catalog.
 */
export type WorkflowScopeCategory='calls'|'sms'|'payments'|'contacts'|'code'|'email';
export type WorkflowScopeResult={refused:false}|{refused:true;categories:WorkflowScopeCategory[];message:string};

/** Reviewable names for the typed operations a phone workflow can use. */
export const WORKFLOW_OPERATION_LABELS:Readonly<Record<string,string>>={
 supplied_text:'Read supplied text',
 selected_notes:'Read selected Notes',
 calendar_range:'Read a Calendar range',
 contains:'Continue if text matches',
 compose_draft:'Compose text',
 model_draft:'Ask the agent to draft text',
 save_note:'Save a note',
 app_notification:'Post a notification',
 read_aloud:'Read aloud',
};

const reasons:Record<WorkflowScopeCategory,string>={
 calls:'place or answer phone calls',
 sms:'send text messages',
 payments:'make payments or move money',
 contacts:'read or change Contacts',
 code:'run arbitrary code, scripts or web requests',
 email:'send email to recipients you have not named',
};

// A verb at the start of a clause ("call Maya", "…, then text Sam"), never a noun such as "call notes" or "supplied text".
const clause=String.raw`(?:^|[.,;:!?]\s*|\b(?:[Tt]o|[Aa]nd|[Tt]hen|[Pp]lease|[Aa]lso|[Oo]r)\s+)`;
const target=String.raw`(?:me\b|him\b|her\b|them\b|us\b|back\b|[Mm]y\s+\w+|[Mm]om\b|[Dd]ad\b|[A-Z][\w'-]*|\+?\d)`;
const verb=(words:string)=>new RegExp(clause+'(?:'+words+')\\s+'+target);
// An imperative at the start of a clause in any letter case ("call maya", "CALL MAYA", "text the group"),
// unless the next word makes it a noun phrase ("call notes", "text from the note") or a naming ("call it Morning").
const anyClause=String.raw`(?:^|[.,;:!?]\s*|\b(?:to|and|then|please|also|or)\s+)`;
const nounTail=String.raw`(?:notes?|logs?|sheets?|summar(?:y|ies)|histor(?:y|ies)|transcripts?|lists?|recordings?|agendas?|digests?|prep|it|this|that|these|those|from|in|on|of|for|is|was|are|were|should|must|will|can|and|or|to|with|about|files?|messages?|texts?|contents?|body|fields?|titles?|sizes?|only|if|when|then|notifications?|steps?)\b`;
const interface_=String.raw`(?:an?|the|my|this|that)\s+(?:\w+\s+)?(?:api|endpoint|webhook|function|script|url|command|program)\b`;
const imperative=(words:string)=>new RegExp(anyClause+'(?:'+words+')\\s+(?!'+nounTail+')(?!'+interface_+')[\\p{L}\\d+]','iu');
// A determiner target ("the dentist", "a taxi") for verbs that are too often nouns to match broadly.
const determined=(words:string)=>new RegExp(anyClause+'(?:'+words+')\\s+(?:the|an?|our|his|her|their|your|every(?:one|body)|some(?:one|body))\\s+\\p{L}','iu');
const callPatterns=[
 /\b(?:make|place|start|schedule|return)\s+(?:a\s+|the\s+)?(?:phone\s+|voice\s+|video\s+)?calls?\b/i,
 /\b(?:answer|pick\s+up|decline|reject)\s+(?:the\s+|my\s+|incoming\s+)*calls?\b/i,
 /\b(?:when(?:ever)?|if)\s+\S+\s+calls\b/i,
 verb('[Cc]all|[Pp]hone|[Dd]ial|[Rr]ing'),
 imperative('call|dial|facetime'),
 determined('phone|ring'),
];
const smsPatterns=[
 /\b(?:sms|mms|imessage|whatsapp|text\s+messages?|signal\s+messages?)\b/i,
 /\bsend\s+(?:a\s+|an\s+)?(?:quick\s+)?(?:message|text)\b/i,
 /\b(?:when(?:ever)?|if)\s+\S+\s+(?:texts|messages)\b/i,
 verb('[Tt]ext|[Mm]essage|[Rr]eply\\s+to'),
 imperative('text|message'),
];
// A purchase stated as an instruction ("buy milk", "then purchase the tickets"), never "what to buy".
const instruction=String.raw`(?:^|[.,;:!?]\s*|\b(?:and|then|please|also|or)\s+)`;
const paymentPatterns=[
 /\b(?:make|send|schedule|process|submit|initiate|authori[sz]e|approve)\s+(?:a\s+|the\s+|my\s+|any\s+)?(?:\w+\s+)?payments?\b/i,
 new RegExp(clause+'(?:[Pp]ay|[Vv]enmo|[Zz]elle|[Rr]efund|[Rr]eimburse)\\s+(?!attention\\b)'),
 /\b(?:with|via|through|using|on|in|use)\s+(?:my\s+)?(?:venmo|paypal|zelle|cash\s*app|apple\s+pay|google\s+pay)\b/i,
 /\b(?:wire|bank)\s+transfer\b/i,
 /\b(?:charge|bill|debit)\s+(?:my\s+|the\s+|a\s+)?(?:credit\s+card|debit\s+card|bank\s+account|card|account)\b/i,
 /\b(?:buy|sell|trade|swap|send)\s+(?:some\s+|my\s+|\d[\d.,]*\s+)?(?:bitcoin|btc|eth(?:ereum)?|crypto(?:currency)?|stocks?|shares)\b/i,
 new RegExp(instruction+'(?:buy|purchase|donate)\\s+\\S','i'),
 /\b(?:with|using)\s+(?:my|our)\s+(?:credit\s+|debit\s+)?card\b/i,
 /\bplace\s+(?:an?|the|my)\s+order\b/i,
 /\bsubscribe\s+to\b/i,
 /\bbook\s+(?:an?|the|my)\s+(?:flight|hotel|table|tickets?|ride|room|car|taxi|cab)\b/i,
 /\b(?:tip|donate)\b[^.!?\n]{0,30}(?:\$|€|£|\d+\s*(?:dollars|euros|pounds))/i,
 new RegExp(instruction+'tip\\s+(?:the|my|our)\\s+\\p{L}','iu'),
 /\b(?:send|transfer|move|withdraw|deposit|wire)\s+(?:the\s+|some\s+)?(?:money|funds|cash|\$|€|£|\d+\s*(?:dollars|euros|pounds))/i,
 /\b(?:to|in|into|from)\s+(?:my\s+)?wallet\b/i,
];
// The Contacts app or address book as a data source or target, never "my contact at Acme".
const contactPatterns=[/\bContacts\b/,/\b(?:my|the|all|our|your|phone)\s+contacts\b/i,/\bcontact\s+(?:list|card|details|info(?:rmation)?)\b/i,/\baddress\s*book\b/i,/\bphone\s*book\b/i,
 /\b(?:add|create|save|update|delete|remove|edit|import|export|sync)\s+(?:(?:a|an|the|new|my|these|those)\s+)*contacts?\b(?!\s+lens)/i];
const codePatterns=[
 /\b(?:run|execute|eval|evaluate|use|write|create|add|call)\s+(?:a\s+|an\s+|this\s+|my\s+|some\s+|the\s+)?(?:custom\s+)?(?:(?:python|javascript|typescript|node|bash|ruby|perl|lua|sql|shell)\s+)?(?:code|script|shell|command|program|python|javascript|js|bash|sql|query|snippet|function)\b/i,
 /\b(?:run|execute)\s+(?:a\s+|an\s+|this\s+|some\s+|the\s+)?(?:shell|terminal|bash|powershell)\b/i,
 /\b(?:curl|wget|sudo|webhook|http\s+(?:request|call|post|get)|api\s+(?:call|request)|fetch\s+(?:the\s+)?url)\b/i,
 /```|<script\b|\beval\s*\(|\bfunction\s*\(|=>\s*\{/i,
 /\b(?:run|execute|exec)\s+(?:rm|ls|cat|npm|npx|pip|git|python3?|node|sh|bash|zsh|powershell|cmd|chmod|ssh)\b/i,
 /\b(?:open|start|launch|spawn|use)\s+(?:a\s+|the\s+|my\s+)?(?:shell|terminal|command\s+line|console)\b/i,
 /\b(?:call|hit|query|use|invoke|ping)\s+(?:an?\s+|the\s+|my\s+|this\s+|that\s+)?(?:\w+\s+)?(?:api|endpoint|webhook)\b/i,
 /\b(?:fetch|download|scrape|crawl|request|load|visit|open|get|post\s+to)\b[^.!?\n]{0,40}(?:https?:\/\/|\bwww\.|\burl\b|\bwebsite\b|\bweb\s*page\b|\bendpoint\b)/i,
];
const emailSend=[
 /\b(?:send|forward|reply|cc|bcc)\b[^.!?\n]{0,60}\b(?:e-?mails?|mail)\b/i,
 new RegExp(anyClause+'(?:mail|forward)\\s+(?:it|this|that|these|those|them|the|my|our|a|an|all|every)\\b','i'),
 /\be-?mail\s+(?!me\b|myself\b)(?:it|this|that|these|them|him|her|everyone|everybody|someone|somebody|people|the\s+\w+|a\s+\w+|an\s+\w+|my\s+\w+|our\s+\w+|all\b|to\b)/i,
];
const explicitAddress=/[^\s@<>()"',;]+@[^\s@<>()"',;]+\.[a-z]{2,}/i;
const ownerOnly=/\b(?:to\s+me|to\s+myself|e-?mail\s+me|e-?mail\s+myself|send\s+me|mail\s+me|me\s+an?\s+e-?mail)\b/i;

// Subjects of supported steps ("notes about bill payments", "remind me to call Mom", "a notification
// saying text Sam") describe what a note, reminder or notification says. They are not actions, so
// that span is ignored up to the next clause boundary.
const subject=/\b(?:remind(?:er)?\s+(?:me\s+)?(?:to|about)|(?:a|the)\s+(?:note|notification|reminder)\s+(?:to|about|saying|that\s+says)|notes?\s+(?:about|on|mentioning|containing|that\s+mention)|notify\s+me\s+(?:to|about)|(?:titled|called|named|labell?ed))\s+[^.;:!?\n,]*?(?=[.;:!?\n,]|\s+(?:and\s+)?then\b|$)/gi;
// Invisible characters that would split a recognized word without changing how the request reads.
const invisible=/[\u00AD\u200B-\u200D\u2060\uFEFF]/g;

/** Categories the typed phone catalog cannot satisfy, in a stable order. */
export function workflowScopeCategories(prompt:string):WorkflowScopeCategory[]{
 const text=prompt.normalize('NFKC').replace(invisible,'').replace(subject,' ');
 const found:WorkflowScopeCategory[]=[];
 if(callPatterns.some(p=>p.test(text)))found.push('calls');
 if(smsPatterns.some(p=>p.test(text)))found.push('sms');
 if(paymentPatterns.some(p=>p.test(text)))found.push('payments');
 if(contactPatterns.some(p=>p.test(text)))found.push('contacts');
 if(codePatterns.some(p=>p.test(text)))found.push('code');
 if(emailSend.some(p=>p.test(text))&&!explicitAddress.test(text)&&!ownerOnly.test(text))found.push('email');
 return found;
}

function list(items:string[]){return items.length<=1?items.join(''):items.slice(0,-1).join(', ')+' and '+items[items.length-1];}

/** Refuses before generation and names the operations this agent and phone can use instead. */
export function checkWorkflowScope(prompt:string,operations:readonly string[]):WorkflowScopeResult{
 const categories=workflowScopeCategories(prompt);
 if(!categories.length)return {refused:false};
 const available=operations.map(id=>WORKFLOW_OPERATION_LABELS[id]).filter((label):label is string=>!!label);
 const offer=available.length?` Workflows here can use: ${available.join('; ')}.`:' No typed workflow steps are available on this agent right now.';
 return {refused:true,categories,message:`Workflows can’t ${list(categories.map(c=>reasons[c]))}. Nothing was sent to the agent.${offer} Rephrase the request using these steps.`};
}
