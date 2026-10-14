# Browser speech

The browser owns microphone capture, bounded mono PCM WAV conversion, playback,
and transcript review. It sends a recording only after the user requests
transcription and only through the selected authenticated local-agent connection.

The host uses libelizainference at `/api/asr/libelizainference`; Paradee speech
uses `/api/tts/paradee`. The bridge checks the owner, payload limits, native
provider identity, response bounds, cancellation and connection changes. It
keeps host credentials off the page. With no configured native host, speech is
unavailable; there is no browser ONNX or operating-system speech fallback.

The browser local-agent bridge remains restricted to the explicit development
profile. Android on-device speech uses its packaged native bundle and does not
need that host connection. See [native speech](native-speech.md).

`test/browser-speech-engine.test.mjs` runs the actual bridge boundary tests with
controlled local HTTP peers. Those tests do not prove microphone, native model,
or device performance. Native execution must be validated separately with the
packaged assets.
