# Browser recording and transcription

The shared runtime retired its browser ONNX recognizer in elizaOS/eliza#36153. Alpha no longer downloads or publishes Whisper ONNX models or ONNX Runtime Web assets. Browser-local transcription reports unavailable; microphone and WebAssembly support do not imply recognition readiness.

Browser capture remains supported by the shared browser-capture package. Recordings stay local until an explicit transcription request. The existing development route can send a bounded PCM WAV to the explicitly selected local agent. A missing agent, failed request, changed selection, cancellation, or empty transcript never triggers another provider. A late result from an old selection is discarded.

Manual recording review and typed transcripts remain separate from inference. A transcript must be reviewed before use; using it in a conversation does not send the message automatically. Production Android speech uses its native engine, not this development bridge. Browser tests and bridge fixtures do not establish native model, carrier, or device acceptance.

Validation covers unavailable browser-local recognition without decoding/upload, the explicit selected-agent request, selection changes during decode and inference, cancellation, and empty results. The APK sync utility still removes stale browser-speech assets from older builds; it cannot acquire models.
