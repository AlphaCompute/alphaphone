"""Optional hosted-only crash projection. Raw crash data never leaves memory."""
import os,re,selectors,subprocess,time
from decimal import Decimal

LIMIT=512*1024

def bounded_read(argv,deadline):
    remaining=deadline-time.monotonic()
    if remaining<=0:raise TimeoutError()
    child=subprocess.Popen(argv,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    streams=selectors.DefaultSelector();streams.register(child.stdout,selectors.EVENT_READ);streams.register(child.stderr,selectors.EVENT_READ)
    data=bytearray();total=0
    try:
        while streams.get_map():
            remaining=deadline-time.monotonic()
            if remaining<=0:raise TimeoutError()
            for key,_ in streams.select(min(remaining,.1)):
                block=key.fileobj.read1(8192)
                if not block:streams.unregister(key.fileobj);continue
                total+=len(block)
                if total>LIMIT:raise ValueError('bound')
                if key.fileobj is child.stdout:data.extend(block)
        if child.wait(timeout=max(.001,deadline-time.monotonic()))!=0:raise ValueError('command')
        return data.decode('utf-8','strict')
    finally:
        streams.close()
        if child.poll() is None:child.kill();child.wait(timeout=1)
        child.stdout.close();child.stderr.close()

def project(raw,pid,uid,started,now):
    if len(raw.encode())>LIMIT:raise ValueError('bound')
    # Android15 liblog threadtime + epoch + uid: epoch writerUid writerPid writerTid priority tag: body.
    line_re=re.compile(r'^\s*(\d+\.\d+)\s+(\S+)\s+(\d+)\s+(\d+)\s+F\s+DEBUG\s*:\s?(.*)$')
    block=None;matches=[]
    def finish():
        if block and block.get('pid')==pid and block.get('uid')==uid and block.get('signal')==31 and block.get('code')==1 and 'syscall' in block:
            matches.append({k:block[k] for k in ('pid','uid','signal','code','syscall','timestamp')})
    for line in raw.splitlines():
        m=line_re.fullmatch(line)
        if not m:continue
        timestamp=int(Decimal(m[1])*1000);writer=(m[2],m[3],m[4]);body=m[5]
        if body.startswith('*** ***') or body.startswith('pid: '):
            finish();block=None
        header=re.fullmatch(r'pid: (\d+), tid: \d+, name: .{0,1024}  >>> .{0,1024} <<<',body)
        if header and started<=timestamp<=now:
            block={'pid':int(header[1]),'timestamp':timestamp,'writer':writer};continue
        if not block or block['writer']!=writer or not started<=timestamp<=now:continue
        fields=[('uid',r'uid: (\d+)'),('signal',r'signal (31) \(SIGSYS\), code (1) \(SYS_SECCOMP\), fault addr .{0,128}'),('syscall',r'Cause: seccomp prevented call to disallowed (?:x86_64|x86|arm64|arm|riscv64) system call ([0-9]{1,5})')]
        for key,pattern in fields:
            found=re.fullmatch(pattern,body)
            if found:
                if key in block:raise ValueError('ambiguous')
                block[key]=int(found[1])
                if key=='signal':block['code']=int(found[2])
    finish()
    if len(matches)!=1:return {'available':False}
    if matches[0]['syscall']>65535:return {'available':False}
    return {'available':True,'source':'debuggerd-crash-buffer',**matches[0]}

def capture(serial,user,name,runid,proof):
    try:
        assert os.environ.get('GITHUB_ACTIONS')=='true' and os.environ.get('ALPHA_RESIDENT_DISPOSABLE_CI')=='1'
        assert re.fullmatch(r'emulator-[0-9]+',serial) and re.fullmatch(r'[1-9][0-9]*',user) and re.fullmatch(r'alpha-ci-[a-f0-9]{32}',name)
        assert proof['runId']==runid and proof['case']=='lost-rpc'
        diagnostic=proof['missingModelRequest'];execution=diagnostic['execution']
        assert diagnostic['httpStatus']==200 and diagnostic['executionReadAvailable'] is True
        assert all(execution[k] is True for k in ('executionMatches','workflowMatches','versionMatches'))
        termination=execution['workerTermination'];assert termination['signal']=='SIGSYS';identity=termination['identity']
        assert all(type(identity[k]) is int for k in ('pid','uid','startedAt'))
        pid,uid,started=(identity[k] for k in ('pid','uid','startedAt'));assert 0<pid<=2147483647 and 0<uid<=2147483647 and 0<started<=8640000000000000
        deadline=time.monotonic()+10
        def read(*args):return bounded_read(['adb','-s',serial,*args],min(deadline,time.monotonic()+3))
        # Fresh read-only admission; never requires or stops a resident worker for observation.
        assert read('emu','avd','name').splitlines()[0]=='test'
        assert read('shell','getprop','ro.kernel.qemu').strip()=='1'
        assert read('shell','am','get-current-user').strip()=='0'
        inventory=re.findall(r'UserInfo\{(\d+):([^:}]+):',read('shell','pm','list','users'))
        assert len(inventory)==2 and dict(inventory).get(user)==name and set(dict(inventory))=={'0',user}
        actual=read('shell','run-as','ai.elizaresearch.alphaphone','--user',user,'id','-u').strip();assert actual==str(uid) and uid//100000==int(user)
        now=int(read('shell','date','+%s').strip())*1000+999;assert started<=now
        raw=read('logcat','-b','crash','-d','-v','threadtime','-v','epoch','-v','uid','-t','512')
        return project(raw,pid,uid,started,now)
    except Exception:
        return {'available':False}
