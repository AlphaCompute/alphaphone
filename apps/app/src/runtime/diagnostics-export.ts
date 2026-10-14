import {sanitizeCrashEntries,type CrashEntry} from './crash-log.ts';

/**
 * Redacted support diagnostics. The report is built by copying allowlisted fields whose
 * values match strict shapes (versions, a 40-hex pin, 64-hex hashes, booleans, enum
 * values, failure classes). Everything else is dropped rather than scrubbed, so note text,
 * mail, addresses, provider keys, tokens, session and account identifiers, URLs and other
 * apps' package names cannot reach the export even if a caller passes them in. Voice latency
 * records keep their timing fields only (marks, and for a live turn the ASR mode, partial count
 * and three spans); no transcript, partial or reply text is ever copied.
 */
export const DIAGNOSTICS_FORMAT='alpha-diagnostics/v1';
export const RUNTIME_ASSETS=['agent/alpha-source.json','agent/agent-bundle.js','agent/workflow-worker/manifest.json','agent/workflow-worker/files.sha256'] as const;
const PERMISSIONS=['Microphone','Location','Camera','Calendar','Notifications'] as const;
const ROLES=['home','assistant','dialer','sms'] as const;
// 'starting'/'recovering' are the resident before it has a session (P-43); 'offline' only parses older exports.
const CONNECTIONS=['starting','recovering','offline','resident','remote','local','cloud'] as const;
// Voice latency records (voice-timing.ts): the same allowlists as its validator and the aggregator.
export const VOICE_TIMING_FORMAT='alpha-voice-timing-v1';
const VOICE_MARKS=['recording-end','transcript-ready','send','first-token','final-reply','first-audio'] as const;
const VOICE_ROUTES=['on-device','browser','local-agent','eliza-cloud','paired-agent','development-agent','manual'] as const;
const VOICE_LIMIT=200;
const version=/^[0-9A-Za-z][0-9A-Za-z.+_-]{0,63}$/;
const pin=/^[0-9a-f]{40}$/;
const sha256=/^[0-9a-f]{64}$/;
const turnId=/^[0-9a-f-]{36}$/;

export type DiagnosticsInput={
 generatedAt?:unknown;platform?:unknown;
 app?:{version?:unknown;versionCode?:unknown;variant?:unknown;buildType?:unknown;testMocks?:unknown};
 os?:{androidRelease?:unknown;securityPatch?:unknown;sdkInt?:unknown};
 upstreamPin?:unknown;runtimeHashes?:unknown;permissions?:unknown;roles?:unknown;crashes?:unknown;
 connection?:{kind?:unknown;connected?:unknown};
 /** Parsed exportVoiceTiming() output. */
 voiceTiming?:unknown;
};
export type VoiceTimingLiveRow={mode:'stream'|'batch'|'unknown';partials:number;firstPartialMs?:number;finalFromSpeechEndMs?:number;asrFinalFromSpeechEndMs?:number};
export type VoiceTimingRow={version:1;id:string;recordedAt:number;route:string;cold:boolean;entry?:'conversation'|'notes';policy?:'auto-send'|'review';marks:Record<string,number>;live?:VoiceTimingLiveRow;outcome?:'abandoned'};
export type DiagnosticsReport={
 format:typeof DIAGNOSTICS_FORMAT;generatedAt:string;platform:'android'|'web';
 app:{version:string|null;versionCode?:number;variant?:'launcher'|'standalone';buildType?:'debug'|'release';testMocks?:boolean};
 os:{androidRelease?:string;securityPatch?:string;sdkInt?:number};
 upstreamPin:string|null;
 runtimeHashes:Record<string,string>;
 permissions:Record<string,boolean>;
 roles:Array<{role:string;held:boolean;available:boolean}>;
 connection:{kind:string;connected:boolean};
 crashes:{count:number;recent:CrashEntry[]};
 /** A complete alpha-voice-timing-v1 document, readable by scripts/aggregate-voice-latency.mjs. */
 voiceTiming:{format:typeof VOICE_TIMING_FORMAT;marks:string[];records:VoiceTimingRow[]};
};

const text=(value:unknown,pattern:RegExp)=>typeof value==='string'&&pattern.test(value)?value:undefined;
const one=<T extends string>(value:unknown,allowed:readonly T[]):T|undefined=>allowed.includes(value as T)?value as T:undefined;

/** Copies the timing fields of each record only: route, entry, policy, cold, a random turn id,
 * the record time and millisecond marks. Any other field (transcript or reply text, accounts)
 * is dropped, even if a stored record carries it. */
function voiceTimingRows(input:unknown):VoiceTimingRow[]{
 const document=input&&typeof input==='object'?input as Record<string,unknown>:{};
 if(document.format!==VOICE_TIMING_FORMAT||!Array.isArray(document.records))return [];
 const rows:VoiceTimingRow[]=[];
 for(const value of document.records.slice(-VOICE_LIMIT)){
  if(!value||typeof value!=='object'||Array.isArray(value))continue;
  const row=value as Record<string,unknown>,route=one(row.route,VOICE_ROUTES),id=text(row.id,turnId);
  if(row.version!==1||!id||!route||typeof row.cold!=='boolean'||!Number.isSafeInteger(row.recordedAt)||(row.recordedAt as number)<0)continue;
  const raw=row.marks&&typeof row.marks==='object'&&!Array.isArray(row.marks)?row.marks as Record<string,unknown>:null;
  if(!raw)continue;
  const marks:Record<string,number>={};
  for(const mark of VOICE_MARKS){const at=raw[mark];if(typeof at==='number'&&Number.isFinite(at)&&at>=0&&at<3_600_000)marks[mark]=at;}
  const out:VoiceTimingRow={version:1,id,recordedAt:row.recordedAt as number,route,cold:row.cold,marks};
  const entry=one(row.entry,['conversation','notes'] as const);if(entry)out.entry=entry;
  const policy=one(row.policy,['auto-send','review'] as const);if(policy)out.policy=policy;
  // Live ASR numbers only (voice-timing.ts recordLiveVoiceTiming): mode, a count and three spans.
  const live=row.live&&typeof row.live==='object'&&!Array.isArray(row.live)?row.live as Record<string,unknown>:null;
  const liveMode=live?one(live.mode,['stream','batch','unknown'] as const):undefined;
  if(live&&liveMode&&Number.isSafeInteger(live.partials)&&(live.partials as number)>=0&&(live.partials as number)<=100000){
   const numbers:VoiceTimingLiveRow={mode:liveMode,partials:live.partials as number};
   for(const key of ['firstPartialMs','finalFromSpeechEndMs','asrFinalFromSpeechEndMs'] as const){const at=live[key];if(typeof at==='number'&&Number.isFinite(at)&&at>=0&&at<3_600_000)numbers[key]=Math.round(at);}
   out.live=numbers;
  }
  if(row.outcome==='abandoned')out.outcome='abandoned';
  rows.push(out);
 }
 return rows;
}

export function buildDiagnostics(input:DiagnosticsInput,now=Date.now()):DiagnosticsReport{
 const app=input.app&&typeof input.app==='object'?input.app:{},os=input.os&&typeof input.os==='object'?input.os:{};
 const generatedAt=typeof input.generatedAt==='number'&&Number.isSafeInteger(input.generatedAt)?input.generatedAt:now;
 const report:DiagnosticsReport={
  format:DIAGNOSTICS_FORMAT,generatedAt:new Date(generatedAt).toISOString(),platform:input.platform==='android'?'android':'web',
  app:{version:text(app.version,version)??null},os:{},
  upstreamPin:text(input.upstreamPin,pin)??null,runtimeHashes:{},permissions:{},roles:[],
  connection:{kind:one(input.connection?.kind,CONNECTIONS)??'starting',connected:input.connection?.connected===true},
  crashes:{count:0,recent:[]},
  voiceTiming:{format:VOICE_TIMING_FORMAT,marks:[...VOICE_MARKS],records:voiceTimingRows(input.voiceTiming)},
 };
 if(Number.isSafeInteger(app.versionCode)&&(app.versionCode as number)>=0)report.app.versionCode=app.versionCode as number;
 const variant=one(app.variant,['launcher','standalone'] as const);if(variant)report.app.variant=variant;
 const buildType=one(app.buildType,['debug','release'] as const);if(buildType)report.app.buildType=buildType;
 if(typeof app.testMocks==='boolean')report.app.testMocks=app.testMocks;
 const release=text(os.androidRelease,version);if(release)report.os.androidRelease=release;
 const patch=text(os.securityPatch,/^\d{4}-\d{2}-\d{2}$/);if(patch)report.os.securityPatch=patch;
 if(Number.isSafeInteger(os.sdkInt)&&(os.sdkInt as number)>0&&(os.sdkInt as number)<1000)report.os.sdkInt=os.sdkInt as number;
 const hashes=input.runtimeHashes&&typeof input.runtimeHashes==='object'?input.runtimeHashes as Record<string,unknown>:{};
 for(const asset of RUNTIME_ASSETS){const value=text(hashes[asset],sha256);if(value)report.runtimeHashes[asset]=value;}
 const permissions=input.permissions&&typeof input.permissions==='object'?input.permissions as Record<string,unknown>:{};
 for(const name of PERMISSIONS)if(typeof permissions[name]==='boolean')report.permissions[name]=permissions[name] as boolean;
 if(Array.isArray(input.roles))for(const row of input.roles){
  const role=one(row?.role,ROLES);
  // Only Alpha's own state. Other role holders are other apps' package names and stay out.
  if(role&&!report.roles.some(r=>r.role===role))report.roles.push({role,held:row.held===true,available:row.available===true});
 }
 const crashes=sanitizeCrashEntries(input.crashes,now);
 report.crashes={count:crashes.length,recent:crashes.slice(-20)};
 return report;
}

export function diagnosticsText(report:DiagnosticsReport){return JSON.stringify(report,null,2)+'\n';}
export function diagnosticsFileName(report:DiagnosticsReport){return `alpha-diagnostics-${report.generatedAt.replace(/[:.]/g,'-')}.json`;}
