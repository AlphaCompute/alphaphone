import json, subprocess, os
for s in json.load(open('/tmp/vid/scenes.json')):
    i = s['id']; pcm = f'audio/{i}.pcm'; wav = f'audio/{i}.wav'
    for attempt in range(3):
        r = subprocess.run(['python3', 'tts.py', s['say'], pcm, 'sage'], capture_output=True, text=True, stdin=subprocess.DEVNULL)
        ok = os.path.exists(pcm) and os.path.getsize(pcm) > 20000 and 'retry 5' not in r.stderr
        if ok: break
    subprocess.run(['ffmpeg', '-nostdin', '-y', '-loglevel', 'error', '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', pcm, wav])
    d = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav], capture_output=True, text=True).stdout.strip()
    print(f'{i:9s} {d:>8s} | {r.stdout.strip()[:110]} | retries: {r.stderr.count("retry")}', flush=True)
