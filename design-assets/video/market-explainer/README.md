# Market explainer source

Preserved design/pitch material, with its rendered export at
[alpha-phone-market-explainer.mp4](../alpha-phone-market-explainer.mp4).
The script's market figures and categorical competitor claims are not a verified
research record. Its privacy and device-capability narrative describes the concept;
it does not establish shipped behavior. Current implementation and acceptance are
tracked in [the browser review](../../../docs/mvp-browser-review.md) and
[architecture](../../../docs/architecture.md).

The checked-in voiceovers, soundtrack, scene timing and image/font assets reproduce
the existing composition. `index.html` loads GSAP 3.13.0 from jsDelivr. Rendering
requires the repository's Playwright installation, Chromium and `ffmpeg`:

```sh
mkdir -p design-assets/video/market-explainer/out
node design-assets/video/market-explainer/render.mjs --stills 0,30,60
node design-assets/video/market-explainer/render.mjs --fps 30
```

The renderer produces video-only output. Mux that output with `soundtrack.wav` to
make an audiovisual export. `audio.py` regenerates timing and the soundtrack from
`script.json` and `vo/*.wav`; it requires NumPy and SoundFile. `tts.py` additionally
requires `kokoro_onnx` and separately acquired compatible model/voice files under
`tts/`. Models are not included. The existing recordings do not require a TTS
service, credentials, or model download to play.

These assets are design references, not executable agent instructions.
