import {sanitizeCrashEntries,type CrashEntry} from './crash-log.ts';

/**
 * Redacted support diagnostics. The report is built by copying allowlisted fields whose
 * values match strict shapes (versions, a 40-hex pin, 64-hex hashes, booleans, enum
 * values, failure classes). Everything else is dropped rather than scrubbed, so note text,
 * mail, addresses, provider keys, tokens, session and account identifiers, URLs and other
 * apps' package names cannot reach the export even if a caller passes them in.
 */
export const DIAGNOSTICS_FORMAT='alpha-diagnostics/v1';
export const RUNTIME_ASSETS=['agent/alpha-source.json','agent/agent-bundle.js','agent/workflow-worker/manifest.json','agent/workflow-worker/files.sha256'] as const;
const PERMISSIONS=['Microphone','Location','Camera','Calendar','Notifications'] as const;
const ROLES=['home','assistant','dialer','sms'] as const;
const CONNECTIONS=['offline','resident','remote','local','cloud'] as const;
const version=/^[0-9A-Za-z][0-9A-Za-z.+_-]{0,63}$/;
const pin=/^[0-9a-f]{40}$/;
const sha256=/^[0-9a-f]{64}$/;

export type DiagnosticsInput={
 generatedAt?:unknown;platform?:unknown;
 app?:{version?:unknown;versionCode?:unknown;variant?:unknown;buildType?:unknown;testMocks?:unknown};
 os?:{androidRelease?:unknown;securityPatch?:unknown;sdkInt?:unknown};
 upstreamPin?:unknown;runtimeHashes?:unknown;permissions?:unknown;roles?:unknown;crashes?:unknown;
 connection?:{kind?:unknown;connected?:unknown};
};
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
};

const text=(value:unknown,pattern:RegExp)=>typeof value==='string'&&pattern.test(value)?value:undefined;
const one=<T extends string>(value:unknown,allowed:readonly T[]):T|undefined=>allowed.includes(value as T)?value as T:undefined;

export function buildDiagnostics(input:DiagnosticsInput,now=Date.now()):DiagnosticsReport{
 const app=input.app&&typeof input.app==='object'?input.app:{},os=input.os&&typeof input.os==='object'?input.os:{};
 const generatedAt=typeof input.generatedAt==='number'&&Number.isSafeInteger(input.generatedAt)?input.generatedAt:now;
 const report:DiagnosticsReport={
  format:DIAGNOSTICS_FORMAT,generatedAt:new Date(generatedAt).toISOString(),platform:input.platform==='android'?'android':'web',
  app:{version:text(app.version,version)??null},os:{},
  upstreamPin:text(input.upstreamPin,pin)??null,runtimeHashes:{},permissions:{},roles:[],
  connection:{kind:one(input.connection?.kind,CONNECTIONS)??'offline',connected:input.connection?.connected===true},
  crashes:{count:0,recent:[]},
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
