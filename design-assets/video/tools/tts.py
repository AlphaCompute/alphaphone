import json, sys, os, base64, urllib.request, urllib.error, re
key = os.environ["ORK"]; text = sys.argv[1]; out = sys.argv[2]; voice = sys.argv[3] if len(sys.argv) > 3 else "sage"
body = {"model": "openai/gpt-audio", "modalities": ["text", "audio"], "audio": {"voice": voice, "format": "pcm16"}, "stream": True,
        "messages": [{"role": "system", "content": "You are a voiceover artist. Read the user's script exactly as written, word for word, in a calm, warm, confident product-demo tone at a natural pace. Do not add or change anything."},
                     {"role": "user", "content": "Read this script aloud, verbatim, and say nothing else:\n\n" + text}]}
def norm(x): return re.sub(r"[^a-z0-9 ]", "", x.lower().replace("-", " ")).split()
for attempt in range(6):
    req = urllib.request.Request("https://openrouter.ai/api/v1/chat/completions", data=json.dumps(body).encode(), headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"})
    pcm = bytearray(); transcript = ""
    try:
        r = urllib.request.urlopen(req, timeout=180)
    except urllib.error.HTTPError as e:
        import time; sys.stderr.write("http %s, waiting\n" % e.code); time.sleep(8 + attempt * 6); continue
    with r:
        for line in r:
            line = line.decode().strip()
            if not line.startswith("data:"): continue
            d = line[5:].strip()
            if d == "[DONE]": break
            try: j = json.loads(d)
            except Exception: continue
            for ch in j.get("choices", []):
                a = (ch.get("delta") or {}).get("audio") or {}
                if a.get("data"): pcm += base64.b64decode(a["data"])
                if a.get("transcript"): transcript += a["transcript"]
    a_, b_ = norm(transcript), norm(text)
    if a_ == b_ or (len(a_) >= len(b_) - 1 and len(a_) <= len(b_) + 1 and sum(1 for w in a_ if w in b_) >= len(b_) - 1): break
    sys.stderr.write("retry %d: %s\n" % (attempt, transcript[:80]))
open(out, "wb").write(bytes(pcm))
print(len(pcm), "bytes |", transcript[:200])
