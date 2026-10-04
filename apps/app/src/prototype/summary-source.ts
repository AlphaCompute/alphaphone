import {sourceOf,type Source} from './note-source-adapter';
import {sensitiveReadingUrl} from '../browser/reading-sensitive';
export type WebSource={kind:'web-page';version:1;name:string;url:string};
export type SummarySource=Source|WebSource;
export function webSourceOf(value:unknown):WebSource|undefined{
 const s=value as WebSource|undefined;
 if(!s||s.kind!=='web-page'||s.version!==1||typeof s.name!=='string'||!s.name.trim()||s.name.length>120||/[\x00-\x1f\x7f]/.test(s.name)||typeof s.url!=='string'||s.url.length>4096||/[\x00-\x20\x7f]/.test(s.url))return;
 try{const url=new URL(s.url);if(url.protocol!=='https:'||!url.hostname||url.username||url.password||sensitiveReadingUrl(url.href))return;return {kind:'web-page',version:1,name:s.name,url:url.href};}catch{return;}
}
export function summarySourceOf(value:unknown):SummarySource|undefined{return webSourceOf(value)||sourceOf(value);}
