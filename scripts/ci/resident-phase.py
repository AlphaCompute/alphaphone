#!/usr/bin/env python3
"""Owned CI process-group supervisor; no retries, cache deletion or credential access."""
import argparse,json,os,signal,shutil,subprocess,time
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--name',required=True);p.add_argument('--seconds',type=int,required=True);p.add_argument('command',nargs=argparse.REMAINDER);a=p.parse_args()
assert os.environ.get('GITHUB_ACTIONS')=='true','CI only';assert a.command and 0<a.seconds<=7200
out=Path('test-results/resident-ci');out.mkdir(parents=True,exist_ok=True);free=lambda:shutil.disk_usage(Path.cwd()).free
assert free()>=10*1024**3,'10GiB pre-phase admission failed; do not prune or bypass'
def interrupted(*unused):raise KeyboardInterrupt('CI phase interrupted')
signal.signal(signal.SIGTERM,interrupted);signal.signal(signal.SIGINT,interrupted)
def group_live(pid):
 try:os.killpg(pid,0);return True
 except ProcessLookupError:return False
state={'command':a.command,'passed':False,'minimumFreeBytes':free(),'deadlineSeconds':a.seconds};start=time.monotonic();child=None
try:
 with (out/(a.name+'.log')).open('x') as log:
  child=subprocess.Popen(a.command,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
  while child.poll() is None:
   state['minimumFreeBytes']=min(state['minimumFreeBytes'],free())
   if free()<4*1024**3:raise RuntimeError('4GiB floor reached')
   if time.monotonic()-start>a.seconds:raise RuntimeError('Phase deadline')
   time.sleep(1)
  state['exitCode']=child.returncode;assert child.returncode==0,'Phase failed; inspect retained log'
  assert not group_live(child.pid),'Phase exited with owned descendants still running'
  state['passed']=True
finally:
 signal.signal(signal.SIGTERM,signal.SIG_IGN);signal.signal(signal.SIGINT,signal.SIG_IGN)
 try:
  if child and group_live(child.pid):
   try:os.killpg(child.pid,signal.SIGTERM)
   except ProcessLookupError:pass
   end=time.monotonic()+180
   while group_live(child.pid) and time.monotonic()<end:child.poll();time.sleep(.1)
   if group_live(child.pid):
    os.killpg(child.pid,signal.SIGKILL);state['ownedGroupCleanup']='forced-native-cleanup-unconfirmed'
   else:state['ownedGroupCleanup']='graceful'
   if child.poll() is None:child.wait(timeout=10)
 except BaseException as error:
  state['passed']=False;state['ownedGroupCleanup']='unconfirmed';state['cleanupErrorClass']=type(error).__name__
 state['elapsedSeconds']=time.monotonic()-start;(out/(a.name+'.json')).write_text(json.dumps(state,indent=2)+'\n')

if not state['passed']:raise SystemExit(1)
