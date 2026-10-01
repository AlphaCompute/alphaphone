#!/usr/bin/env python3
"""Compare existing reference/local captures; no browser interaction or fixtures altered."""
import argparse,json,pathlib,math
import numpy as np
from PIL import Image,ImageDraw
p=argparse.ArgumentParser();p.add_argument('--captures',default='test-results/prototype-all');args=p.parse_args()
root=pathlib.Path(args.captures);out=root/'comparison';out.mkdir(exist_ok=True)
manifest=json.loads((root/'manifest.json').read_text());by={(r['source'],r['theme'],r['state']):r for r in manifest['captures']}
rows=[];panels=[]
for (source,theme,state),local in by.items():
 if source!='local':continue
 ref=by.get(('reference',theme,state))
 if not ref or not local.get('sha256') or not ref.get('sha256'):continue
 a=Image.open(root/ref['file']).convert('RGB');b=Image.open(root/local['file']).convert('RGB')
 if a.size!=b.size:
  rows.append(dict(theme=theme,state=state,status='dimension-mismatch',reference=list(a.size),local=list(b.size)));continue
 w,h=a.size;mask=np.zeros((h,w),dtype=bool);mask[44:h-44,12:w-12]=True
 # Top44 excludes clock/status and upper rounded corners. Lower corner exclusion
 # does not hide the composer. These are fixed documented regions, not fitted masks.
 aa=np.asarray(a).astype(np.int16);bb=np.asarray(b).astype(np.int16);delta=np.abs(aa-bb);maxdelta=delta.max(axis=2)
 vals=delta[mask];changed=(maxdelta>16)&mask
 row=dict(theme=theme,state=state,status='compared',meanAbsoluteChannelError=round(float(vals.mean()),4),changedPixelPercent=round(float(changed.sum()/mask.sum()*100),4),maxChannelError=int(vals.max()),comparedPixels=int(mask.sum()),referenceCaptureOk=ref.get('ok'),localCaptureOk=local.get('ok'),referenceErrors=ref.get('failedRequests',[]),localErrors=local.get('errors',[]),referenceSha256=ref['sha256'],localSha256=local['sha256'])
 heat=np.zeros((h,w,3),dtype=np.uint8);heat[:,:,0]=np.minimum(maxdelta*4,255);heat[~mask]=0
 name=theme+'-'+state.replace(':','--')+'.png';Image.fromarray(heat).save(out/name);row['differenceImage']=name
 rows.append(row)
 panel=Image.new('RGB',(309,252),'white');draw=ImageDraw.Draw(panel);draw.text((3,3),theme+' '+state,fill='black');draw.text((3,17),str(row['changedPixelPercent'])+'% pixels >16',fill='black')
 for i,im in enumerate([a,b,Image.fromarray(heat)]):panel.paste(im.resize((103,228)),(i*103,24))
 panels.append(panel)
metrics=dict(sourceManifest=str(root/'manifest.json'),referenceSnapshotSha256=manifest.get('referenceSnapshotSha256'),mask='x=[12,width-12), y=[44,height-44); excludes clock/status and rounded frame corners',threshold='pixel changed if any RGB channel absolute difference >16',warning='Same-state captures are not necessarily same-time fixtures. Timers, clocks, seeded relative dates, playback and network/font errors require visual review; metric is not automatic acceptance.',pairs=rows)
(out/'metrics.json').write_text(json.dumps(metrics,indent=2)+'\n')
for start in range(0,len(panels),24):
 part=panels[start:start+24];sheet=Image.new('RGB',(309*4,252*math.ceil(len(part)/4)), '#bbb')
 for i,panel in enumerate(part):sheet.paste(panel,((i%4)*309,(i//4)*252))
 sheet.save(out/f'contact-{start//24+1:02}.png')
print(json.dumps({'pairs':len(rows),'dimensionMismatch':sum(r['status']!='compared' for r in rows),'worst':sorted([r for r in rows if r['status']=='compared'],key=lambda r:r['changedPixelPercent'],reverse=True)[:8]},indent=2))
