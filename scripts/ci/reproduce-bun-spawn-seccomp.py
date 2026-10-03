"""Disposable Linux-only reproduction; does not modify Android or its policy."""
import json
import os
import pathlib
import platform
import resource
import subprocess
import tempfile

assert platform.system() == 'Linux' and platform.machine() == 'x86_64'
resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
revision = subprocess.check_output(['bun', '--revision'], text=True).strip()
assert revision.startswith('1.4.2+') and '744846f' in revision, revision
output = pathlib.Path('test-results/bun-spawn-seccomp')
output.mkdir(parents=True, exist_ok=True)
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
    subprocess.run(['cc', '-O2', str(root/'filter.c'), '-o', str(root/'filter')], check=True)
    subprocess.run(['cc', '-O2', '-shared', '-fPIC', str(root/'handler.c'), '-o', str(root/'handler.so')], check=True)
    env = {'PATH': os.environ['PATH'], 'HOME': temporary, 'TMPDIR': temporary,
           'LD_PRELOAD': str(root/'handler.so'), 'BUN_FEATURE_FLAG_DISABLE_IO_POOL': '1',
           'BUN_FEATURE_FLAG_FORCE_WAITER_THREAD': '1', 'BUN_FEATURE_FLAG_DISABLE_SPAWNSYNC_FAST_PATH': '1'}
    cases = {'baseline': ['bun', str(root/'spawn.mjs')],
             'trap_start': [str(root/'filter'), '1', 'bun', '--version'],
             'trap_spawn': [str(root/'filter'), '1', 'bun', str(root/'spawn.mjs')],
             'errno_spawn': [str(root/'filter'), '0', 'bun', str(root/'spawn.mjs')]}
    results = {'revision': revision, 'syntheticLinuxRestriction': True, 'androidAcceptance': False, 'cases': {}}
    for name, command in cases.items():
        try:
            result = subprocess.run(command, env=env, text=True, capture_output=True, timeout=30)
            results['cases'][name] = {'returncode': result.returncode, 'stdout': result.stdout[:4096], 'stderr': result.stderr[:4096]}
        except subprocess.TimeoutExpired:
            results['cases'][name] = {'timedOut': True}
    (output/'result.json').write_text(json.dumps(results, indent=2)+'\n')
    print(json.dumps(results, indent=2))
    for name in ['baseline', 'errno_spawn']:
        case=results['cases'][name]
        assert case.get('returncode') == 0 and json.loads(case['stdout'].strip()) == {'code': 0, 'signal': None, 'ready': True, 'stderrBytes': 0}, name
    assert results['cases']['trap_start'].get('returncode') == 0
    trapped=results['cases']['trap_spawn']
    assert trapped.get('returncode') == 0 and json.loads(trapped['stdout'].strip())['signal'] == 'SIGSYS', trapped
