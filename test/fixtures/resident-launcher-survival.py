import pathlib,tempfile,subprocess,os,time,signal,json
import sys
assert len(sys.argv)==3
p=pathlib.Path(sys.argv[1]).resolve()
prepared=pathlib.Path(sys.argv[2]).resolve()
manifest=json.loads((p/'upstream/runtime-consumer.json').read_text())
source_manifest=json.loads((p/'upstream/runtime-source.json').read_text())
pin=json.loads((p/'upstream.lock.json').read_text())['commit']
import re
assert re.fullmatch('[a-f0-9]{40}',pin)
assert manifest['baseCommit']==source_manifest['baseCommit']==pin
assert manifest['patches']==source_manifest['patches']==[] and manifest['patchHashes']=={}
assert subprocess.check_output(['git','-C',str(p/'vendor/eliza'),'rev-parse','HEAD'],text=True).strip()==pin
relative='packages/app/scripts/lib/stage-android-agent.ts'
committed=subprocess.check_output(['git','-C',str(p/'vendor/eliza'),'show',pin+':'+relative])
current_bytes=(prepared/relative).read_bytes()
assert current_bytes==committed==(p/'vendor/eliza'/relative).read_bytes()
assert subprocess.check_output(['git','-C',str(prepared),'rev-parse','HEAD'],text=True).strip()==pin
current=current_bytes.decode()
results=[]
# Normal-source check only; no historical destructive launcher is reconstructed.
for kind,source in [('pinned-upstream-launcher',current)]:
 start=source.index('const LAUNCH_SCRIPT = `')+len('const LAUNCH_SCRIPT = `'); end=source.index('\n`;',start)
 script=source[start:end].replace('\\${','${')
 with tempfile.TemporaryDirectory(prefix='alphaownedlaunch') as tmp:
  d=pathlib.Path(tmp); commands=d/'commands';commands.mkdir(); bun=str(d/'bun');marker=d/'launched';events=d/'signals'
  worker=subprocess.Popen(['python3','-c','import time;time.sleep(30)',bun,'trusted-worker.mjs'])
  try:
   # Record every attempted pkill call, without forwarding it or sending a signal.
   (commands/'pkill').write_text('#!/usr/bin/env python3\nimport os\nopen(os.environ["OWNED_SIGNALS"],"a").write("pkill-attempt\\n")\nraise SystemExit(97)\n')
   (commands/'setsid').write_text('#!/bin/sh\nprintf launched > "$OWNED_MARKER"\n')
   for f in commands.iterdir():f.chmod(0o755)
   (d/'launch.sh').write_text(script)
   env={**os.environ,'PATH':str(commands)+':'+os.environ['PATH'],'AGENT_ROOT':tmp,'BUN_PATH':bun,'LD_PATH':str(d/'loader'),'OWNED_PID':str(worker.pid),'OWNED_SIGNALS':str(events),'OWNED_MARKER':str(marker)}
   subprocess.run(['/bin/sh',str(d/'launch.sh')],env=env,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=5)
   limit=time.monotonic()+2
   while not marker.exists() and time.monotonic()<limit:time.sleep(.01)
   assert marker.exists()
   time.sleep(.05)
   assert worker.poll() is None and not events.exists(), 'Pinned launcher attempted broad process cleanup'
   results.append({'source':kind,'realOwnedSiblingAlive':worker.poll() is None,'residentLaunchReached':True,'hostPkillInvoked':False,'pkillAttempted':False,'historicalNegativeControl':False,'upstreamCommit':pin})
  finally:
   if worker.poll() is None:worker.terminate()
   worker.wait(timeout=3)
print(json.dumps(results))
print('PASS pinned upstream launcher preserves owned sibling, never invokes pkill, and reaches resident launch; no historical negative control')
