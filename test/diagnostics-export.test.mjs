// Settings > About "Export diagnostics": the report copies allowlisted shapes only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDiagnostics,diagnosticsText,DIAGNOSTICS_FORMAT} from '../apps/app/src/runtime/diagnostics-export.ts';
import {sanitizeCrashEntries,errorClassOf,describeCrashEntry} from '../apps/app/src/runtime/crash-log.ts';

const now=Date.UTC(2026,9,8,12);
const pin='45242af234e7f3d55c433f327798e7cb2130e06e';
const hash='a'.repeat(64);
// Synthetic sensitive values: note text, a provider key, a bearer token, account and session ids, mail and a URL.
const secrets=['Buy milk and call Dana at 555-0100','csk-synthetic-provider-key-7f3a9c0e5b','Bearer synthetic-session-token','acct_7f3a9c0e5b11','6f1d3c3e-8c55-4c1b-9d1f-2b6f0b0d3a11','dana@example.com','https://agent.example.test/api','com.example.otherlauncher','/data/user/0/ai.elizaresearch.alphaphone'];

test('diagnostics keep versions, pin, runtime hashes, permission and role state and crash classes',()=>{
 const report=buildDiagnostics({generatedAt:now,platform:'android',
  app:{version:'0.1.0',versionCode:7,variant:'launcher',buildType:'release',testMocks:false},
  os:{androidRelease:'16',securityPatch:'2026-09-05',sdkInt:36},upstreamPin:pin,
  runtimeHashes:{'agent/alpha-source.json':hash,'agent/agent-bundle.js':'b'.repeat(64)},
  permissions:{Microphone:true,Location:false,Camera:true,Calendar:false},
  roles:[{role:'home',held:true,available:true,holders:['ai.elizaresearch.alphaphone']},{role:'assistant',held:false,available:true,holders:['com.example.otherlauncher']}],
  connection:{kind:'resident',connected:true},
  crashes:[{at:now-1000,source:'uncaught',errorClass:'java.lang.IllegalStateException',rootClass:'java.io.IOException',thread:'main',process:'main'},{at:now-500,source:'exit',reason:'anr',process:':isolated_pdf'},{at:now-100,source:'renderer',kind:'render',errorClass:'TypeError'}],
 },now);
 assert.equal(report.format,DIAGNOSTICS_FORMAT);
 assert.deepEqual(report.app,{version:'0.1.0',versionCode:7,variant:'launcher',buildType:'release',testMocks:false});
 assert.deepEqual(report.os,{androidRelease:'16',securityPatch:'2026-09-05',sdkInt:36});
 assert.equal(report.upstreamPin,pin);
 assert.deepEqual(report.runtimeHashes,{'agent/alpha-source.json':hash,'agent/agent-bundle.js':'b'.repeat(64)});
 assert.deepEqual(report.permissions,{Microphone:true,Location:false,Camera:true,Calendar:false});
 assert.deepEqual(report.roles,[{role:'home',held:true,available:true},{role:'assistant',held:false,available:true}]);
 assert.deepEqual(report.connection,{kind:'resident',connected:true});
 assert.equal(report.crashes.count,3);
 assert.deepEqual(report.crashes.recent.map(e=>e.errorClass??e.reason),['java.lang.IllegalStateException','anr','TypeError']);
 assert.doesNotMatch(diagnosticsText(report),/otherlauncher|holders/);
});

test('redaction: content, keys, tokens, account and session ids, mail, URLs and paths never reach the export',()=>{
 const [note,key,token,account,session,mail,url,otherApp,path]=secrets;
 const report=buildDiagnostics({generatedAt:now,platform:'android',
  app:{version:`0.1.0 ${mail}`,versionCode:'7',variant:url,buildType:token,testMocks:'yes'},
  os:{androidRelease:note,securityPatch:path,sdkInt:1e9},upstreamPin:key,
  runtimeHashes:{'agent/alpha-source.json':key,[note]:hash,'agent/agent-bundle.js':hash.toUpperCase()},
  permissions:{Microphone:'granted',Contacts:true,[mail]:true,Calendar:true},
  roles:[{role:otherApp,held:true,available:true},{role:'home',held:'yes',available:true,holders:[otherApp]},{role:'home',held:true}],
  connection:{kind:session,connected:'true',sessionId:session,accountId:account,origin:url},
  crashes:[
   {at:now-1,source:'uncaught',errorClass:`Error: ${note}`,rootClass:path,message:note,stack:`at ${url}`,thread:note,process:path},
   {at:now-2,source:'exit',reason:note,process:'main'},
   {at:now-3,source:'renderer',kind:'render',errorClass:'TypeError',text:key},
   {at:now-4,source:'note',errorClass:'Error'},
   {at:now-40*24*60*60*1000,source:'renderer',kind:'render',errorClass:'OldError'},
  ],
  notes:[note],apiKey:key,authorization:token,accountId:account,email:mail,
 },now);
 const json=diagnosticsText(report);
 for(const secret of secrets)assert.equal(json.includes(secret),false,`leaked ${secret}`);
 for(const fragment of ['Dana','555-0100','synthetic','example','acct_','6f1d3c3e','/data/','Bearer','OldError','message','stack','notes','apiKey'])assert.equal(json.includes(fragment),false,`leaked ${fragment}`);
 assert.equal(report.app.version,null);assert.equal(report.upstreamPin,null);
 assert.deepEqual(report.app,{version:null});assert.deepEqual(report.os,{});assert.deepEqual(report.runtimeHashes,{});
 assert.deepEqual(report.permissions,{Calendar:true});
 assert.deepEqual(report.roles,[{role:'home',held:false,available:true}]);
 assert.deepEqual(report.connection,{kind:'offline',connected:false});
 // The uncaught entry survives as a class-free record; the bad exit reason and unknown source are dropped.
 assert.deepEqual(report.crashes.recent,[{at:now-3,source:'renderer',kind:'render',errorClass:'TypeError'},{at:now-1,source:'uncaught'}]);
 assert.deepEqual(Object.keys(report).sort(),['app','connection','crashes','format','generatedAt','os','permissions','platform','roles','runtimeHashes','upstreamPin']);
});

test('crash entries keep classes only, are bounded and expire after 30 days',()=>{
 const many=Array.from({length:80},(_,i)=>({at:now-80+i,source:'renderer',kind:'uncaught',errorClass:'RangeError'}));
 const kept=sanitizeCrashEntries(many,now);
 assert.equal(kept.length,50);assert.equal(kept[0].at,now-50);
 assert.deepEqual(sanitizeCrashEntries('not a list',now),[]);
 assert.equal(errorClassOf(new TypeError('secret note text')),'TypeError');
 const custom=new Error('x');custom.name='Account 12345 failed';
 assert.equal(errorClassOf(custom),'Error');
 assert.equal(errorClassOf('a string with content'),'string');
 assert.deepEqual(describeCrashEntry({at:now,source:'exit',reason:'anr',process:':isolated_pdf'}),{title:'App process stopped: anr',detail:'Reported by Android · :isolated_pdf process'});
 assert.deepEqual(describeCrashEntry({at:now,source:'uncaught',errorClass:'java.lang.IllegalStateException',rootClass:'java.io.IOException',thread:'main'}),{title:'App crashed',detail:'java.lang.IllegalStateException · caused by java.io.IOException · main thread'});
});
