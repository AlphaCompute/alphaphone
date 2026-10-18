# Explicit development Cloud speech

The Mac browser preview may use its already paired agent's Eliza Cloud gateway
for ASR and TTS. This is separate from a renderer Cloud account and from direct
Cartesia development voice. The agent retains its Cloud credentials server-side;
the browser receives only owner-bound transcript/audio results.

Both sides must explicitly opt in: Vite `VITE_ALPHA_DEV_CLOUD_VOICE=1` and the
Vite host bridge `ALPHA_DEV_CLOUD_VOICE=1`, in a development build with
`ELIZA_DEV_ALLOW_TEST_MOCKS=1` and the existing local-agent bridge enabled.
Native Android and production builds never select this route. An unavailable
Cloud service fails visibly; it does not switch to direct Cartesia or native
speech. Normal production on-device speech policy is unchanged.

The host forwards only POST `/api/asr/cloud` (bounded WAV) and POST
`/api/tts/cloud` (`text` only, retaining the gateway’s default billing model).
Actual synthesis is verified from the provider response; the billing model is
not used as evidence of the synthesis engine. It retains the existing same-origin,
private owner enrollment, selected owner, request cancellation and size checks.
The paired runtime proxy must verify the actual gateway provider and normalize
successful replies with `X-Eliza-Speech-Provider: cartesia` and
`X-Eliza-Speech-Route: cloud`. TTS must be `audio/mpeg`. Missing or different
proof fails closed. The browser cannot supply these response markers.

ASR returns a completed transcript to the existing conversation coordinator,
which submits it once through the selected agent. These batch endpoints do not
provide realtime partial transcripts. Playback uses the existing owned audio
handles and Stop retirement. Mute and Stop presentation are unchanged.

The tests use mocked runtime responses over loopback and in-memory capture/playback
ports. Passing them proves the adapter contracts, not actual Cartesia service,
latency, microphone capture, native Android support, or live Cloud acceptance.
