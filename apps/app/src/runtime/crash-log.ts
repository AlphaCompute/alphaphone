import {Capacitor} from '@capacitor/core';
import {registerPlugin} from '../platform-plugins.ts';

/**
 * Local, privacy-bounded problem log. Entries hold failure classes only: where the failure
 * happened, Android's exit reason or an error class name, and the time. Messages, stacks,
 * URLs, component trees and user content are never recorded, because any of them can carry
 * note text, addresses or account data. Android keeps the log natively (AlphaCrashLog, no-backup
 * storage); the web build keeps renderer failures in this browser profile.
 */
export type CrashSource='uncaught'|'exit'|'renderer';
export type CrashEntry={at:number;source:CrashSource;kind?:string;errorClass?:string;rootClass?:string;reason?:string;process?:string;thread?:string};
export type CrashLog={entries:CrashEntry[];exitHistory:boolean};
export type RendererFailureKind='render'|'startup'|'uncaught';

export const CRASH_LOG_MAX_ENTRIES=50;
export const CRASH_LOG_RETENTION_MS=30*24*60*60*1000;
export const browserCrashLogKey='alpha.crash-log.v1';

const native=registerPlugin<{
 crashLog():Promise<{entries:unknown;exitHistory?:boolean}>;
 recordRendererFailure(input:{kind:RendererFailureKind;errorClass:string}):Promise<void>;
 clearCrashLog():Promise<void>;
}>('AlphaDevice');

const javaClass=/^[A-Za-z_$][A-Za-z0-9_$.]{0,159}$/;
const jsClass=/^[A-Za-z][A-Za-z0-9]{0,63}$/;
const reasons=new Set(['crash','native-crash','anr','low-memory','signaled','initialization-failure','excessive-resource-usage','dependency-died','freezer','other','unknown','exit-self']);
const kinds=new Set(['render','startup','uncaught']);
const processLabel=/^(main|other|:[A-Za-z0-9_]{1,40})$/;

/** Error class only. A name that is not a plain identifier (it could be text) becomes "Error". */
export function errorClassOf(error:unknown):string{
 if(error instanceof Error)return jsClass.test(error.name)?error.name:'Error';
 return error===null?'null':typeof error;
}

/** Keeps only allowlisted fields with allowlisted shapes. Anything else is dropped, never copied. */
export function sanitizeCrashEntries(value:unknown,now=Date.now()):CrashEntry[]{
 if(!Array.isArray(value))return [];
 const out:CrashEntry[]=[];
 for(const raw of value){
  if(!raw||typeof raw!=='object')continue;
  const item=raw as Record<string,unknown>,at=item.at;
  if(typeof at!=='number'||!Number.isSafeInteger(at)||at<=now-CRASH_LOG_RETENTION_MS||at>now+CRASH_LOG_RETENTION_MS)continue;
  if(item.source!=='uncaught'&&item.source!=='exit'&&item.source!=='renderer')continue;
  const entry:CrashEntry={at,source:item.source};
  if(item.source==='renderer'){if(typeof item.kind!=='string'||!kinds.has(item.kind))continue;entry.kind=item.kind;}
  if(item.source==='exit'){if(typeof item.reason!=='string'||!reasons.has(item.reason))continue;entry.reason=item.reason;}
  const classPattern=item.source==='renderer'?jsClass:javaClass;
  if(typeof item.errorClass==='string'&&classPattern.test(item.errorClass))entry.errorClass=item.errorClass;
  if(typeof item.rootClass==='string'&&javaClass.test(item.rootClass))entry.rootClass=item.rootClass;
  if(typeof item.process==='string'&&processLabel.test(item.process))entry.process=item.process;
  if(item.thread==='main'||item.thread==='background')entry.thread=item.thread;
  out.push(entry);
 }
 return out.sort((a,b)=>a.at-b.at).slice(-CRASH_LOG_MAX_ENTRIES);
}

function readBrowser():CrashEntry[]{
 try{const raw=localStorage.getItem(browserCrashLogKey);return raw?sanitizeCrashEntries(JSON.parse(raw)?.entries):[];}catch{return [];}
}
function writeBrowser(entries:CrashEntry[]){
 try{localStorage.setItem(browserCrashLogKey,JSON.stringify({version:1,entries:sanitizeCrashEntries(entries)}));}catch{/* Storage blocked: the log is best effort. */}
}

const recent=new Map<string,number>();
/** Best effort and never throws: a failing log must not hide the failure it describes. */
export async function recordRendererFailure(kind:RendererFailureKind,error:unknown,now=Date.now()):Promise<void>{
 const errorClass=errorClassOf(error),key=kind+':'+errorClass;
 // A repeating failure is recorded once a minute so it cannot flush older problems out.
 if((recent.get(key)??-Infinity)>now-60_000)return;
 recent.set(key,now);
 try{
  if(Capacitor.isNativePlatform())await native.recordRendererFailure({kind,errorClass});
  else writeBrowser([...readBrowser(),{at:now,source:'renderer',kind,errorClass}]);
 }catch{/* Unrecorded. */}
}

export async function readCrashLog():Promise<CrashLog>{
 if(!Capacitor.isNativePlatform())return {entries:readBrowser(),exitHistory:false};
 const result=await native.crashLog();
 return {entries:sanitizeCrashEntries(result?.entries),exitHistory:result?.exitHistory===true};
}

export async function clearCrashLog():Promise<void>{
 recent.clear();
 if(Capacitor.isNativePlatform())await native.clearCrashLog();
 else try{localStorage.removeItem(browserCrashLogKey);}catch{/* Nothing stored. */}
}

/** One line per entry for Settings: time, where, and class or reason. */
export function describeCrashEntry(entry:CrashEntry):{title:string;detail:string}{
 const where=entry.process&&entry.process!=='main'?` · ${entry.process} process`:'';
 if(entry.source==='exit')return {title:`App process stopped: ${entry.reason}`,detail:`Reported by Android${where}`};
 if(entry.source==='renderer')return {title:`Screen failure: ${entry.kind}`,detail:entry.errorClass||'Error'};
 return {title:'App crashed',detail:[entry.errorClass,entry.rootClass&&entry.rootClass!==entry.errorClass?`caused by ${entry.rootClass}`:'',entry.thread?`${entry.thread} thread`:''].filter(Boolean).join(' · ')||'Unknown class'};
}
