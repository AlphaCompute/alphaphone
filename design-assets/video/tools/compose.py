import json,os,bisect,subprocess,shutil
tl=json.load(open('timeline.json'));st=tl['stamps'];first=st[0][1]
ins=[];fl=[]
for k,s in enumerate(tl['starts']):
    ins+=['-i',f'audio/{s["id"]}.wav']; ms=int((s['t']+tl['t0']-first+0.35)*1000)
    fl.append(f'[{k}:a]adelay={ms}|{ms}[a{k}]')
n=len(tl['starts'])
fc=';'.join(fl)+';'+''.join(f'[a{k}]' for k in range(n))+f'amix=inputs={n}:normalize=0[o]'
subprocess.run(['ffmpeg','-nostdin','-y','-loglevel','error',*ins,'-filter_complex',fc,'-map','[o]','-ar','48000','voice.wav'],check=True)
shutil.rmtree('seq',ignore_errors=True); os.mkdir('seq')
ts=[t-first for _,t in st]; end=ts[-1]+1.0
for k in range(int(end*30)):
    i=max(0,bisect.bisect_right(ts,k/30)-1); os.symlink(os.path.abspath(st[i][0]),f'seq/s{k:06d}.jpg')
subprocess.run(['ffmpeg','-nostdin','-y','-loglevel','error','-framerate','30','-i','seq/s%06d.jpg','-i','voice.wav','-vf','format=yuv420p','-c:v','libx264','-preset','slow','-crf','18','-profile:v','high','-r','30','-movflags','+faststart','-c:a','aac','-b:a','160k','-shortest','alpha-phone-walkthrough.mp4'],check=True)
