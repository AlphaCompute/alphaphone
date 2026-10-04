import json,subprocess,sys,unittest
from unittest.mock import patch
from resident_crash_diagnostics import project_crashes,collect_crashes,project_audit

def fixture(uid=1010123):
    lines=['*** *** *** *** *** *** *** ***','Cmdline: /data/app/~~fixture/ai.elizaresearch.alphaphone-random/lib/x86_64/libeliza_ld_musl_x86_64_real.so PRIVATE_SENTINEL',
           'pid: 1234, tid: 1235, name: worker  >>> PRIVATE_SENTINEL <<<',f'uid: {uid}',
           'signal 31 (SIGSYS), code 1 (SYS_SECCOMP), fault addr --------',
           'Cause: seccomp prevented call to disallowed x86_64 system call 21','Abort message: PRIVATE_SENTINEL']
    return '\n'.join('F/DEBUG   ( 999): '+line for line in lines)+'\n'

class CrashDiagnostics(unittest.TestCase):
    def test_only_fixed_owned_seccomp_evidence(self):
        result=project_crashes(fixture(),1010123)
        self.assertEqual(result,{'schemaVersion':1,'reports':[{'pid':1234,'tid':1235,'uid':1010123,'abi':'x86_64','syscall':21}]})
        self.assertNotIn('PRIVATE_SENTINEL',json.dumps(result))
        self.assertEqual(project_crashes(fixture(123),1010123)['reports'],[])
        self.assertEqual(project_crashes(fixture().replace('libeliza_ld_musl_x86_64_real.so','unrelated.so'),1010123)['reports'],[])
        self.assertEqual(project_crashes(fixture().replace('SYS_SECCOMP','SI_USER'),1010123)['reports'],[])
    def test_reports_do_not_mix_and_are_bounded(self):
        self.assertEqual(project_crashes(fixture()+fixture(22),1010123)['reports'],project_crashes(fixture(),1010123)['reports'])
        self.assertEqual(len(project_crashes(fixture()*20,1010123)['reports']),16)
        with self.assertRaises(ValueError):project_crashes('',0)
    def test_real_process_capture_is_bounded_and_never_persists_raw_output(self):
        original=subprocess.Popen
        def child(command,**kwargs):
            self.assertIn(command,[['adb','-s','emulator-5554','logcat','-d','-b','crash','-v','brief','-t','500'],['adb','-s','emulator-5554','shell','dmesg | tail -n 500']])
            return original([sys.executable,'-c','import sys;sys.stdout.write('+repr(fixture())+');sys.stdout.write("PRIVATE_SENTINEL"*30000);sys.stdout.flush()'],**kwargs)
        with patch('resident_crash_diagnostics.subprocess.Popen',side_effect=child):result=collect_crashes('emulator-5554',1010123)
        self.assertTrue(result['truncated']);self.assertEqual(result['reports'][0]['syscall'],21)
        self.assertNotIn('PRIVATE_SENTINEL',json.dumps(result))
        with self.assertRaises(ValueError):collect_crashes('physical-device',1010123)
    def test_audit_records_require_owned_uid_runtime_and_seccomp_signal(self):
        line='audit: type=1326 uid=1010123 pid=3456 exe="/data/app/~~fixture/alpha/lib/x86_64/libeliza_bun.so" sig=31 arch=c000003e syscall=21 PRIVATE_SENTINEL'
        self.assertEqual(project_audit(line,1010123),[{'pid':3456,'uid':1010123,'abi':'x86_64','syscall':21}])
        self.assertEqual(project_audit(line.replace('uid=1010123','uid=123 comm="uid=1010123 sig=31"'),1010123),[])
        for old,new in [('uid=1010123','uid=123'),('sig=31','sig=11'),('libeliza_bun.so','other.so'),('type=1326','type=1400'),('syscall=21','syscall=PRIVATE_SENTINEL')]:
            self.assertEqual(project_audit(line.replace(old,new),1010123),[])
    def test_hung_read_has_a_deadline(self):
        original=subprocess.Popen
        with patch('resident_crash_diagnostics.subprocess.Popen',side_effect=lambda command,**kwargs:original([sys.executable,'-c','import time;time.sleep(30)'],**kwargs)):
            result=collect_crashes('emulator-5554',1010123)
        self.assertTrue(result['timedOut']);self.assertEqual(result['reports'],[])

if __name__=='__main__':unittest.main()
