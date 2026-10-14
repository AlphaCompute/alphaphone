# Shared speech migration — October 14, 2026 (#397, #413, #423)

The consumer source now targets the shared `ai.eliza.voice.NativeAsr`,
`ParadeeVoice`, and `VoiceAssets` Java APIs at Eliza pin
`644d56c93df9e410b1ef4297f961cb1df9e7d152`. Production chat batch recording,
transcription, reply playback, Notes read-aloud, Maps guidance, and reviewed
app/workflow speech select the local bridge. Unavailable local speech offers
recovery or typed input; it does not select Cloud speech. Conversation playback
cancellation waits for synthesis settlement and owned native playback cleanup
before allowing another capture.

This is a source migration, not a qualified speech release. The shared ASR API
accepts a complete 16 kHz PCM array and returns one transcript; Paradee returns a
complete PCM buffer. No ASR GGUF/mmproj pair has been admitted for this product,
and no new runtime/model qualification record exists. Historical Sherpa/Piper
qualification cannot qualify these bytes. Strict release admission must remain
closed until the new inputs and qualification are present.

Issue #423 remains open for implementation as well as acceptance: a separate
editable Transcribe composer entry, incremental ASR revisions/finalization,
Clef model/tokenizer admission and calibrated semantic turn decisions, streaming
TTS output, played-prefix acknowledgements, and continuation/barge-in behavior
remain. `ElizaVoiceNative.nativeEotScore` is a generic next-token probability;
it does not establish a Clef implementation. The smallest coherent upstream
streaming step is an implemented, bounded PCM push/flush session with revisioned
partial/final transcript events and cancellation/close generation fencing,
backed by reviewed model and ABI inputs. Adding unused bridge declarations or
labeling whole-buffer calls as streaming does not satisfy that boundary.

Renderer tests use synthetic native ports. They establish routing, request
ownership, cancellation and no network fallback; they do not establish native
model execution, audible playback, latency, echo rejection or physical-device
acceptance.

