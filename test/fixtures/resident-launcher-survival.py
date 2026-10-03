import pathlib,tempfile,subprocess,os,time,signal,json
import sys
assert len(sys.argv)==3
p=pathlib.Path(sys.argv[1]).resolve()
prepared=pathlib.Path(sys.argv[2]).resolve()
manifest=json.loads((p/'patches/eliza/android-local-runtime-source.json').read_text())
relative='packages/app/scripts/lib/stage-android-agent.ts'
current=(prepared/relative).read_text()
import hashlib
assert hashlib.sha256(current.encode()).hexdigest()==manifest['files'][relative]
with tempfile.TemporaryDirectory(prefix='alphaownedsource') as temp:
 originalFile=pathlib.Path(temp)/relative;originalFile.parent.mkdir(parents=True);originalFile.write_text(current)
 subprocess.run(['git','apply','-R',str(p/'patches/eliza/android-resident-launcher-no-kill.patch')],cwd=temp,check=True)
 original=originalFile.read_text()
results=[]
for kind,source in [('upstream-base',original),('upstream-files',current)]:
 start=source.index('const LAUNCH_SCRIPT = `')+len('const LAUNCH_SCRIPT = `'); end=source.index('\n`;',start)
 script=source[start:end].replace('\\${','${')
 with tempfile.TemporaryDirectory(prefix='alphaownedlaunch') as tmp:
  d=pathlib.Path(tmp); commands=d/'commands';commands.mkdir(); bun=str(d/'bun');marker=d/'launched';events=d/'signals'
  worker=subprocess.Popen(['python3','-c','import time;time.sleep(30)',bun,'trusted-worker.mjs'])
  try:
   # The shim can signal only this exact owned subprocess. Never call host pkill.
   (commands/'pkill').write_text('#!/usr/bin/env python3\nimport os,sys,signal\nassert sys.argv[1]=="-f"\nif sys.argv[2]==os.environ["BUN_PATH"]:\n open(os.environ["OWNED_SIGNALS"],"a").write("owned-bun-match\\n")\n os.kill(int(os.environ["OWNED_PID"]),signal.SIGTERM)\n')
   (commands/'setsid').write_text('#!/bin/sh\nprintf launched > "$OWNED_MARKER"\n')
   for f in commands.iterdir():f.chmod(0o755)
   (d/'launch.sh').write_text(script)
   env={**os.environ,'PATH':str(commands)+':'+os.environ['PATH'],'AGENT_ROOT':tmp,'BUN_PATH':bun,'LD_PATH':str(d/'loader'),'OWNED_PID':str(worker.pid),'OWNED_SIGNALS':str(events),'OWNED_MARKER':str(marker)}
   subprocess.run(['/bin/sh',str(d/'launch.sh')],env=env,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=5)
   limit=time.monotonic()+2
   while not marker.exists() and time.monotonic()<limit:time.sleep(.01)
   assert marker.exists()
   time.sleep(.05)
   if kind=='upstream-base':assert worker.poll()==-signal.SIGTERM and events.exists()
   else:assert worker.poll() is None and not events.exists()
   results.append({'source':kind,'realOwnedSiblingAlive':worker.poll() is None,'residentLaunchReached':True,'hostPkillInvoked':False})
  finally:
   if worker.poll() is None:worker.terminate()
   worker.wait(timeout=3)
print(json.dumps(results))
print('PASS source-derived original launcher kills owned sibling through bounded shim; fixed launcher preserves it and reaches resident launch')
