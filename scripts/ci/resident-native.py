#!/usr/bin/env python3
"""Fresh disposable GitHub emulator only. Synthetic native fixtures; no live provider."""
import hashlib,json,os,re,signal,subprocess,sys,uuid,zipfile
from pathlib import Path
from resident_absence import assert_no_resident
assert os.environ.get('GITHUB_ACTIONS')=='true' and os.environ.get('ALPHA_RESIDENT_DISPOSABLE_CI')=='1'
serial=os.environ['ANDROID_SERIAL'];assert re.fullmatch(r'emulator-[0-9]+',serial)
archive=Path('test-results/resident-ci-archive');out=Path('test-results/resident-ci-native');out.mkdir(exist_ok=False)
def interrupted(*unused):raise KeyboardInterrupt('Owned CI interrupted')
signal.signal(signal.SIGTERM,interrupted);signal.signal(signal.SIGINT,interrupted)
APP='ai.elizaresearch.alphaphone';TEST=APP+'.test';HELPER=APP+'.peerfixture';h=lambda b:hashlib.sha256(b).hexdigest()
def run(*args,input=None,timeout=60):
 return subprocess.run(['adb','-s',serial,*args],input=input,text=True,capture_output=True,timeout=timeout,check=True).stdout
assert run('shell','getprop','ro.kernel.qemu').strip()=='1';assert run('shell','getprop','ro.product.cpu.abi').strip()=='x86_64'
assert run('shell','am','get-current-user').strip()=='0'
assert set(re.findall(r'UserInfo\{(\d+):',run('shell','pm','list','users')))=={'0'}
assert not any(p in run('shell','pm','list','packages') for p in [APP,TEST,HELPER]),'Fresh emulator required; never replace original packages'
assert h((archive/'apk-manifest.json').read_bytes())==os.environ['ALPHA_RESIDENT_MANIFEST_SHA256']
manifest=json.loads((archive/'apk-manifest.json').read_text());expected={v+'-'+k+'.apk' for v in ['standalone','launcher'] for k in ['debug','release-unsigned','androidTest']};expected|={'private-peer-debug.apk','private-peer-manifest.json'};assert set(manifest)==expected
for n,digest in manifest.items():assert h((archive/n).read_bytes())==digest
helper=json.loads((archive/'private-peer-manifest.json').read_text());assert helper['package']==HELPER and helper['schemaVersion']==1
assert helper['apkSha256']==manifest['private-peer-debug.apk']
expected_helper_sources={str(p) for p in Path('android/private-peer-fixture/src').rglob('*') if p.is_file()}|{'android/private-peer-fixture/build.gradle','android/private-peer-fixture/settings.gradle','scripts/ci/build-private-peer.py'}
assert set(helper['sources'])==expected_helper_sources
for relative,digest in helper['sources'].items():
 assert relative.startswith('android/private-peer-fixture/') or relative=='scripts/ci/build-private-peer.py'
 assert '..' not in Path(relative).parts and Path(relative).is_file() and h(Path(relative).read_bytes())==digest
signer=Path(os.environ['ANDROID_HOME'])/'build-tools/36.0.0/apksigner'
badging=subprocess.check_output([str(signer.parent/'aapt'),'dump','badging',str(archive/'private-peer-debug.apk')],text=True)
assert re.search(r"^package: name='ai.elizaresearch.alphaphone.peerfixture' ",badging,re.M)
assert 'application-debuggable' in badging and 'launchable-activity:' not in badging and 'android.permission.INTERNET' not in badging
for name in ['private-peer-debug.apk']+[v+'-'+k+'.apk' for v in ['standalone','launcher'] for k in ['debug','androidTest']]:
 certs=re.findall(r'^Signer #\d+ certificate SHA-256 digest: ([a-f0-9]{64})$',subprocess.check_output([str(signer),'verify','--print-certs',str(archive/name)],text=True),re.M)
 assert certs==[helper['signerSha256']]
assert (archive/'inputs-before.json').read_bytes()==(archive/'inputs-after.json').read_bytes()
frozen=json.loads((archive/'inputs-before.json').read_text())['files']
native=json.loads(Path('patches/eliza/android-native-runtime-source.json').read_text())
generated=json.loads((archive/'native-generated-source-manifest.json').read_text())
assert h((archive/'native-generated-source-manifest.json').read_bytes())==frozen['android/app/build/generated/local-agent/source-manifest.json']
assert generated['runtimeSource']==native and native['commit']=='92fc988bbc2502b6dab5976014973bbe510b5045'
for relative,digest in frozen.items():
 if relative.startswith(('android/app/src/androidTest/','android/app/src/debug/','android/app/src/main/java/','patches/eliza/')):
  assert Path(relative).is_file() and h(Path(relative).read_bytes())==digest
compat=native['compatibilityPatch']
assert compat['patch']=='android-resident-exact-stop.patch'
assert set(compat['files'])=={'packages/app/platforms/android/app/src/main/java/ai/elizaos/app/'+name+'.java' for name in ['ElizaAgentService','WorkflowSurvivorInventory']}
assert h(Path('patches/eliza',compat['patch']).read_bytes())==compat['patchSha256']
assert generated['patches'][-1]==compat
for origin,proof in compat['files'].items():
 assert proof['sourceSha256']==native['files'][origin] and re.fullmatch('[a-f0-9]{64}',proof['patchedSha256'])
for name in ['ElizaAgentService','IpcStartupRecovery','WorkflowSurvivorInventory']:
 origin='packages/app/platforms/android/app/src/main/java/ai/elizaos/app/'+name+'.java'
 rows=[row for row in generated['files'] if row['path']==origin];assert len(rows)==1
 row=rows[0];assert row['sourceSha256']==native['files'][origin]
 assert row['sha256']==compat['files'].get(origin,{}).get('patchedSha256',native['files'][origin])
 assert frozen['android/app/build/generated/local-agent/java/ai/elizaresearch/alphaphone/'+name+'.java']==row['generatedSha256']

def guard():
 assert run('shell','am','get-current-user').strip()=='0';assert_no_resident(run)
 sockets=run('shell','cat','/proc/net/unix');assert not re.search(r'/data/(?:user|user_de)/\d+/ai\.elizaresearch\.alphaphone/.*/(?:ipc|ipc-recovery-[^/]+)/',sockets)
def installed(package,user,digest):
 paths=run('shell','pm','path','--user',user,package).strip().splitlines();assert len(paths)==1 and paths[0].startswith('package:')
 assert run('shell','sha256sum',paths[0][8:]).split()[0]==digest
def helper_absent():
 assert 'package:'+HELPER not in run('shell','pm','list','packages','-u').splitlines()
 assert not any(HELPER in line for line in run('shell','ps','-A','-o','NAME').splitlines())
helper_absent()
for variant in ['standalone','launcher']:
 guard();attempted=[]
 try:
  for pkg,kind in [(APP,'debug'),(TEST,'androidTest')]:
   attempted.append((pkg,kind));run('install','--user','0',str(archive/(variant+'-'+kind+'.apk')),timeout=180);installed(pkg,'0',manifest[variant+'-'+kind+'.apk'])
  with zipfile.ZipFile(archive/(variant+'-debug.apk')) as apk,zipfile.ZipFile(archive/(variant+'-androidTest.apk')) as test:
   entries={'bunSha256':'lib/x86_64/libeliza_bun.so','bundleSha256':'assets/agent/agent-bundle.js','sourceSha256':'assets/agent/alpha-source.json','processExecutableSha256':'lib/x86_64/libeliza_ld_musl_x86_64_real.so','workerIndexSha256':'assets/agent/workflow-worker/files.sha256','workerManifestSha256':'assets/agent/workflow-worker/manifest.json','compilerManifestSha256':'assets/agent/workflow-worker/compiler/compiler.json'}
   payload={k:h(apk.read(v)) for k,v in entries.items()};payload.update(abi='x86_64',processExecutableEntry=entries['processExecutableSha256'],trustedWorkerSha256=h(test.read('assets/trusted-worker.mjs')))
   stamp=json.loads(apk.read('assets/agent/alpha-source.json'));assert stamp['base']=='92fc988bbc2502b6dab5976014973bbe510b5045'
   assert stamp['consumerManifestSha256']==h(Path('patches/eliza/android-local-runtime-source.json').read_bytes())
   assert payload['trustedWorkerSha256']==frozen['android/app/src/androidTest/assets/trusted-worker.mjs']==h(Path('android/app/src/androidTest/assets/trusted-worker.mjs').read_bytes())
   indexed={}
   for line in apk.read('assets/agent/workflow-worker/files.sha256').decode().splitlines():
    match=re.fullmatch(r'([a-f0-9]{64})\t([A-Za-z0-9_./@+-]+)',line);assert match
    digest,name=match.groups();assert not name.startswith('/') and not any(part in ('','.', '..') for part in name.split('/')) and name not in indexed;indexed[name]=digest
    assert h(apk.read('assets/agent/workflow-worker/'+name))==digest
   assert 0<len(indexed)<=4096
   worker=json.loads(apk.read('assets/agent/workflow-worker/manifest.json'));assert 0<len(worker['files'])<=4095
   for name,digest in worker['files'].items():assert indexed.get(name)==digest and h(apk.read('assets/agent/workflow-worker/'+name))==digest
   assert set(indexed)==set(worker['files'])|{'manifest.json'}
   with zipfile.ZipFile(archive/(variant+'-release-unsigned.apk')) as release:
    for key,name in entries.items():assert h(release.read(name))==payload[key]
  phases=[('private-peer','PrivateResidentSocketInstrumentedTest','ordinaryOtherUidCannotReachPrivateEndpoint','privatePeerFixture','privatePeerRunId'),('ipc','ResidentStreamTransportInstrumentedTest','splitFramesCancellationAndNoReplay','residentStreamFixture','residentStreamRunId'),('trusted','ResidentWorkflowCrashInstrumentedTest','trustedPackagedWorkerSurvivesResidentRestart','residentCrash','residentRunId'),('lost-rpc','ResidentWorkflowCrashInstrumentedTest','lostParentModelRpcRemainsUnknownWithoutReplay','residentCrash','residentRunId')]
  for phase,cls,method,opt,uuidarg in phases:
   guard();name='alpha-ci-'+uuid.uuid4().hex;created=run('shell','pm','create-user',name);match=re.fullmatch(r'\s*Success: created user id (\d+)\s*',created);assert match;user=match[1];assert user!='0';runid=str(uuid.uuid4());helper_state='absent'
   try:
    run('shell','am','start-user','-w',user);assert run('shell','am','get-started-user-state',user).strip()=='RUNNING_UNLOCKED'
    for pkg,kind in [(APP,'debug'),(TEST,'androidTest')]:run('shell','cmd','package','install-existing','--user',user,pkg);installed(pkg,user,manifest[variant+'-'+kind+'.apk'])
    guard()
    if phase=='private-peer':
     helper_absent();helper_state='install-unknown'
     run('install','--user',user,str(archive/'private-peer-debug.apk'),timeout=180)
     installed(HELPER,user,manifest['private-peer-debug.apk']);helper_state='owned'
     assert 'package:'+HELPER not in run('shell','pm','list','packages','--user','0').splitlines()
     (out/(variant+'-helper-ownership.json')).write_text(json.dumps({'user':user,'name':name,'runId':runid,'sha256':manifest['private-peer-debug.apk'],'state':helper_state})+'\n')
    if phase not in ('ipc','private-peer'):
     text=json.dumps({**payload,'runId':runid});run('shell',f"run-as {APP} --user {user} sh -c 'umask 077; mkdir -p files; set -C; cat > files/resident-recovery-input.json'",input=text)
     assert run('shell','run-as',APP,'--user',user,'sha256sum','files/resident-recovery-input.json').split()[0]==h(text.encode())
    try:text=run('shell','am','instrument','--user',user,'-w','-r','-e','class',APP+'.'+cls+'#'+method,'-e',opt,'1','-e',uuidarg,runid,TEST+'/androidx.test.runner.AndroidJUnitRunner',timeout=900)
    except (subprocess.CalledProcessError,subprocess.TimeoutExpired) as error:
     def safe(v):return (v.decode(errors='replace') if isinstance(v,bytes) else v or '')[:1024*1024]
     (out/(variant+'-'+phase+'-failure.txt')).write_text(safe(error.stdout)+'\nSTDERR\n'+safe(error.stderr));raise
    (out/(variant+'-'+phase+'.txt')).write_text(text)
    assert set(re.findall(r'INSTRUMENTATION_STATUS: numtests=(\d+)',text))=={'1'}
    assert text.count('INSTRUMENTATION_STATUS_CODE: 1')==1 and text.count('INSTRUMENTATION_STATUS_CODE: 0')==1 and 'INSTRUMENTATION_CODE: -1' in text and 'OK (1 test)' in text
    assert 'INSTRUMENTATION_STATUS: class='+APP+'.'+cls in text and 'INSTRUMENTATION_STATUS: test='+method in text
    assert not re.search(r'INSTRUMENTATION_STATUS_CODE: -(?:1|2|3|4)|FAILURES|INSTRUMENTATION_FAILED',text)
    if phase not in ('ipc','private-peer'):
     proof=json.loads(run('shell','run-as',APP,'--user',user,'cat','files/resident-recovery-complete.json'));assert proof['passed'] is True and proof['cleanupComplete'] is True and proof['runId']==runid;(out/(variant+'-'+phase+'.json')).write_text(json.dumps(proof,indent=2)+'\n')
    guard()
   finally:
    primary=sys.exc_info()[0]
    # Preserve diagnostic result before deleting this uniquely owned user, even on failure.
    for filename in ['resident-recovery-complete.json','resident-recovery-identity.json']:
     try:
      value=run('shell','run-as',APP,'--user',user,'cat','files/'+filename,timeout=10)
      if len(value.encode())<=65536:
       (out/(variant+'-'+phase+'-'+filename)).write_text(value)
       if primary is not None and phase=='lost-rpc' and filename=='resident-recovery-complete.json':
        # Optional read-only observation; preserve the original assertion and cleanup.
        try:
         from resident_crash_diagnostic import capture
         projection=capture(serial,user,name,runid,json.loads(value))
         (out/(variant+'-'+phase+'-crash-projection.json')).write_text(json.dumps(projection)+'\n')
        except BaseException:
         # A signal during optional diagnostics must not replace the active failure
         # or skip the owned cleanup below. Original instrumentation remains interruptible.
         pass
     except Exception:pass
    signal.signal(signal.SIGINT,signal.SIG_IGN);signal.signal(signal.SIGTERM,signal.SIG_IGN)
    try:
     assert run('shell','am','get-current-user').strip()=='0';assert 'UserInfo{'+user+':'+name+':' in run('shell','pm','list','users')
     run('shell','am','stop-user','-w','-f',user)
     # Prove full resident absence after stop, before any destructive cleanup.
     # Unknown visibility fails closed and retains the owned user/helper for reconciliation.
     guard()
     if helper_state!='absent':
      assert helper_state=='owned','Ambiguous helper installation: preserve for reconciliation'
      assert set(re.findall(r'UserInfo\{(\d+):',run('shell','pm','list','users')))=={'0',user},'Unexpected user adoption; preserve helper'
      assert 'package:'+HELPER not in run('shell','pm','list','packages','--user','0').splitlines()
      installed(HELPER,user,manifest['private-peer-debug.apk'])
      assert not any(HELPER in line for line in run('shell','ps','-A','-o','NAME').splitlines())
      helper_state='uninstall-unknown';run('uninstall',HELPER);helper_absent();helper_state='absent'
     run('shell','pm','remove-user',user);assert 'UserInfo{'+user+':' not in run('shell','pm','list','users');guard()
    except BaseException:
     (out/(variant+'-'+phase+'-cleanup-incomplete.json')).write_text(json.dumps({'cleanupComplete':False,'user':user,'name':name,'helperState':helper_state})+'\n')
     if primary is None:raise
    signal.signal(signal.SIGINT,interrupted);signal.signal(signal.SIGTERM,interrupted)
 finally:
  original_failure=sys.exc_info()[1]
  try:
   helper_absent();guard()
   # A retained user (including ambiguous create-user output) retains its app data.
   # Recheck immediately before each global uninstall, not only at phase admission.
   assert set(re.findall(r'UserInfo\{(\d+):',run('shell','pm','list','users')))=={'0'},'Retained or unknown user: preserve all packages'
   for pkg,kind in reversed(attempted):
    if 'package:'+pkg in run('shell','pm','list','packages').splitlines():
     installed(pkg,'0',manifest[variant+'-'+kind+'.apk'])
     assert set(re.findall(r'UserInfo\{(\d+):',run('shell','pm','list','users')))=={'0'},'User changed: preserve package'
     run('uninstall',pkg)
   guard()
  except BaseException as cleanup_failure:
   (out/(variant+'-package-cleanup-incomplete.json')).write_text(json.dumps({'cleanupComplete':False,'packagesPreservedWhenUncertain':True,'errorType':type(cleanup_failure).__name__})+'\n')
   if original_failure is None:raise
   original_failure.add_note('Global package cleanup incomplete; see '+variant+'-package-cleanup-incomplete.json')
(out/'result.json').write_text(json.dumps({'passed':True,'variants':['standalone','launcher'],'abi':'x86_64','liveProvider':False,'uiAcceptance':False,'armDeviceAcceptance':False})+'\n')
