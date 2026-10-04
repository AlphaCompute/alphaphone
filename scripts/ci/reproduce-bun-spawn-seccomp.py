"""Disposable Linux-only reproduction; does not modify Android or its policy."""
import json
import hashlib
import os
import pathlib
import platform
import resource
import signal
import subprocess
import tempfile

assert platform.system() == 'Linux' and platform.machine() == 'x86_64'
resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
bun = os.environ.get('ALPHA_REPRO_BUN', 'bun')
cc = os.environ.get('ALPHA_REPRO_CC', 'cc')
revision = subprocess.check_output([bun, '--revision'], text=True).strip()
assert revision.startswith('1.4.2+') and '744846f' in revision, revision
output = pathlib.Path('test-results/bun-spawn-seccomp')
output.mkdir(parents=True, exist_ok=True)
for previous in output.glob('trap-spawn.trace.*'):
    previous.unlink()
with tempfile.TemporaryDirectory(prefix='alpha-bun-seccomp-') as temporary:
    root = pathlib.Path(temporary)
    (root / 'filter.c').write_text(r'''
#include <linux/filter.h>
#include <linux/seccomp.h>
#include <stddef.h>
#include <stdlib.h>
#include <sys/prctl.h>
#include <sys/syscall.h>
#include <unistd.h>
#include <errno.h>
int main(int argc, char **argv) {
 if(argc<3)return 120;
 unsigned action = atoi(argv[1]) ? SECCOMP_RET_TRAP : (SECCOMP_RET_ERRNO | ENOSYS);
 struct sock_filter rules[] = {
  BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, nr)),
  BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, SYS_close_range, 0, 1),
  BPF_STMT(BPF_RET | BPF_K, action),
  BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ALLOW)
 };
 struct sock_fprog filter = { .len=4, .filter=rules };
 if(prctl(PR_SET_NO_NEW_PRIVS,1,0,0,0) || prctl(PR_SET_SECCOMP,SECCOMP_MODE_FILTER,&filter))return 121;
 execvp(argv[2],argv+2);return 122;
}
''')
    (root / 'handler.c').write_text(r'''
#define _GNU_SOURCE
#include <signal.h>
#include <sys/syscall.h>
#include <ucontext.h>
#include <unistd.h>
#include <errno.h>
static void handler(int signal, siginfo_t *info, void *context) {
 if(signal!=SIGSYS || info->si_syscall!=SYS_close_range)_exit(123);
 ((ucontext_t*)context)->uc_mcontext.gregs[REG_RAX]=-ENOSYS;
}
__attribute__((constructor)) static void install(void) {
 struct sigaction action={0};action.sa_sigaction=handler;action.sa_flags=SA_SIGINFO;
 sigemptyset(&action.sa_mask);if(sigaction(SIGSYS,&action,0))_exit(124);
}
''')
    (root / 'spawn.mjs').write_text('''
import {spawn} from 'node:child_process';
const child=spawn(process.execPath,['-e','console.log("SYNTHETIC_CHILD_READY")'],{stdio:['ignore','pipe','pipe']});
let out='',err='';child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>err+=x);
child.on('error',e=>{console.log(JSON.stringify({error:e.code}));process.exitCode=2;});
child.on('close',(code,signal)=>console.log(JSON.stringify({code,signal,ready:out.includes('SYNTHETIC_CHILD_READY'),stderrBytes:err.length})));
''')
    subprocess.run([cc, '-O2', str(root/'filter.c'), '-o', str(root/'filter')], check=True)
    subprocess.run([cc, '-O2', '-shared', '-fPIC', str(root/'handler.c'), '-o', str(root/'handler.so')], check=True)
    # Experimental control only: preserve the installed compatibility handler
    # when the pre-exec child resets signal dispositions. This does not change
    # Android artifacts, seccomp policy, or the production shim.
    (root/'preserve.c').write_text(r'''
#define _GNU_SOURCE
#include <dlfcn.h>
#include <signal.h>
#include <unistd.h>
static int (*real_sigaction)(int, const struct sigaction *, struct sigaction *);
__attribute__((constructor)) static void resolve(void) {
 real_sigaction=dlsym(RTLD_NEXT,"sigaction");
 if(!real_sigaction)_exit(125);
}
int sigaction(int signal, const struct sigaction *action, struct sigaction *old) {
 if(!real_sigaction)resolve();
 if(signal==SIGSYS && action && action->sa_handler==SIG_DFL)
  return real_sigaction(signal,0,old);
 return real_sigaction(signal,action,old);
}
''')
    subprocess.run([cc, '-O2', '-shared', '-fPIC', str(root/'preserve.c'), '-ldl', '-o', str(root/'preserve.so')], check=True)

    # Compile the exact pinned upstream source independently of the control.
    lock = json.loads(pathlib.Path('upstream.lock.json').read_text())
    assert subprocess.check_output(['git','-C','vendor/eliza','rev-parse','HEAD'],text=True).strip()==lock['commit']
    source = root/'product'; source.mkdir()
    relative = pathlib.Path('packages/app/scripts/aosp/seccomp-shim')
    (source/relative).mkdir(parents=True)
    product_hashes = {}
    for name in ('sigsys-handler.c','sigsys-handler-arm64.c','sigsys-handler-riscv64.c','preserve-sigsys.h'):
        data = subprocess.check_output(['git','-C','vendor/eliza','show',lock['commit']+':'+str(relative/name)])
        (source/relative/name).write_bytes(data)
        product_hashes[name] = hashlib.sha256(data).hexdigest()
    # Upstream documents shell continuations in // comments; GCC alone warns on these.
    subprocess.run([cc, '-O2', '-Wall', '-Werror', '-Wno-comment', '-shared', '-fPIC', str(source/relative/'sigsys-handler.c'), '-ldl', '-o', str(root/'product.so')], check=True)
    (root/'semantics.c').write_text(r'''
#define _GNU_SOURCE
#include <signal.h>
#include <stdio.h>
static void custom(int signal) {(void)signal;}
int main(void) {
 struct sigaction installed, reset={0}, old, readback, other={0};
 sigemptyset(&reset.sa_mask); reset.sa_handler=SIG_DFL;
 if(sigaction(SIGSYS,0,&installed) || !(installed.sa_flags&SA_SIGINFO))return 10;
 if(sigaction(SIGSYS,&reset,&old) || old.sa_sigaction!=installed.sa_sigaction)return 11;
 if(sigaction(SIGSYS,0,&readback) || readback.sa_sigaction!=installed.sa_sigaction)return 12;
 other.sa_handler=custom;sigemptyset(&other.sa_mask);
 if(sigaction(SIGSYS,&other,0) || sigaction(SIGSYS,&reset,0) || sigaction(SIGSYS,0,&readback) || readback.sa_handler!=SIG_DFL)return 13;
 if(sigaction(SIGUSR1,&other,0) || sigaction(SIGUSR1,&reset,&old) || old.sa_handler!=custom)return 14;
 if(sigaction(SIGUSR1,0,&readback) || readback.sa_handler!=SIG_DFL)return 15;
 puts("PASS product signal disposition ownership");return 0;
}
''')
    subprocess.run([cc, '-O2', str(root/'semantics.c'), '-o', str(root/'semantics')], check=True)
    env = {'PATH': os.environ['PATH'], 'HOME': temporary, 'TMPDIR': temporary,
           'LD_PRELOAD': str(root/'handler.so'), 'BUN_FEATURE_FLAG_DISABLE_IO_POOL': '1',
           'BUN_FEATURE_FLAG_FORCE_WAITER_THREAD': '1', 'BUN_FEATURE_FLAG_DISABLE_SPAWNSYNC_FAST_PATH': '1'}
    cases = {'baseline': [bun, str(root/'spawn.mjs')],
             'trap_start': [str(root/'filter'), '1', bun, '--version'],
             'trap_spawn': ['strace', '-ff', '-o', str(output.resolve()/'trap-spawn.trace'),
                            '-e', 'trace=close_range,rt_sigaction,rt_sigprocmask,clone,clone3,execve,wait4,waitid',
                            '-e', 'signal=SIGSYS', str(root/'filter'), '1', bun, str(root/'spawn.mjs')],
             'errno_spawn': [str(root/'filter'), '0', bun, str(root/'spawn.mjs')],
             'preserved_handler_spawn': [str(root/'filter'), '1', bun, str(root/'spawn.mjs')],
             'product_spawn': [str(root/'filter'), '1', bun, str(root/'spawn.mjs')],
             'product_semantics': [str(root/'semantics')]}
    results = {'revision': revision, 'compiler': cc, 'binary': bun, 'syntheticLinuxRestriction': True, 'androidAcceptance': False, 'productHashes': product_hashes, 'cases': {}}
    for name, command in cases.items():
        case_env = dict(env)
        if name == 'preserved_handler_spawn':
            case_env['LD_PRELOAD'] = str(root/'preserve.so')+':'+str(root/'handler.so')
        if name.startswith('product_'):
            case_env['LD_PRELOAD'] = str(root/'product.so')
        process = subprocess.Popen(command, env=case_env, text=True, stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE, start_new_session=True)
        try:
            stdout, stderr = process.communicate(timeout=30)
            results['cases'][name] = {'returncode': process.returncode, 'stdout': stdout[:4096], 'stderr': stderr[:4096]}
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            stdout, stderr = process.communicate()
            results['cases'][name] = {'timedOut': True, 'stdout': stdout[:4096], 'stderr': stderr[:4096]}
    # A fatal pre-exec signal can leave the vfork parent stalled. Require the
    # actual child sequence, rather than treating a timeout alone as evidence.
    child_traces = [trace.read_text() for trace in output.glob('trap-spawn.trace.*')]
    results['childResetThenCloseRangeTrapBeforeExec'] = any(
        'rt_sigaction(SIGSYS, {sa_handler=SIG_DFL' in trace and
        'si_syscall=__NR_close_range' in trace and
        trace.index('rt_sigaction(SIGSYS, {sa_handler=SIG_DFL') < trace.index('si_syscall=__NR_close_range') and
        'execve(' not in trace for trace in child_traces)
    (output/'result.json').write_text(json.dumps(results, indent=2)+'\n')
    print(json.dumps(results, indent=2))
    for name in ['baseline', 'errno_spawn', 'preserved_handler_spawn']:
        case=results['cases'][name]
        assert case.get('returncode') == 0 and json.loads(case['stdout'].strip()) == {'code': 0, 'signal': None, 'ready': True, 'stderrBytes': 0}, name
    assert results['cases']['trap_start'].get('returncode') == 0
    trapped=results['cases']['trap_spawn']
    assert results['childResetThenCloseRangeTrapBeforeExec'], results
    assert trapped.get('timedOut') or (trapped.get('returncode') == 0 and
        json.loads(trapped['stdout'].strip())['signal'] == 'SIGSYS'), trapped

    product = results['cases']['product_spawn']
    assert product.get('returncode') == 0, product
    child = json.loads(product['stdout'].strip())
    assert child['code'] == 0 and child['signal'] is None and child['ready'] is True, product
    semantics = results['cases']['product_semantics']
    assert semantics.get('returncode') == 0 and semantics['stdout'].strip() == 'PASS product signal disposition ownership', semantics
