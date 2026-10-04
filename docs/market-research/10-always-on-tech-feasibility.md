# 10 — Always-on assistant: technical feasibility and competitive technology

Alpha Phone's capability statements come from the repository: [`docs/standalone-paired-asr.md`](../standalone-paired-asr.md) and [`docs/mvp-scope-and-gap-report.md`](../mvp-scope-and-gap-report.md). Current state: ASR is whisper.cpp `tiny.en` (a 77,704,698-byte model) on a **paired host**, and TTS is Kokoro, also on the host. On-device STT/TTS is an MVP requirement that is **not met**. Physical-microphone acceptance has not happened. The AOSP test emulator has neither a recognition service nor a TTS service installed.

**Product baseline.** Alpha's own AOSP image does not ship banking apps, Play Integrity or GMS, so AICore and ML Kit GenAI are absent on that image by design. Cloud inference stays on Qwen (`qwen-3.8-27b`) on Cerebras.

**Conventions.** **(est.)** marks an engineering estimate; **(unverified)** marks a figure not confirmed against a primary source and not to be quoted externally until checked. Phone real-time factors (RTF) for most open models are not published for Tensor G5, so the phone figures are estimates to be replaced by the measurement harness in the roadmap (section 11). Open ASR Leaderboard figures are GPU throughput (RTFx, batch processing) on English short-form sets: they rank accuracy well but do **not** predict phone latency or power.

---

## 1. Executive summary

1. **Accuracy is no longer the blocker for on-device ASR. Integration, power and platform policy are.**
   - Open-weight models at or under 0.6B parameters now match or beat Whisper large-v3 on the Open ASR Leaderboard. Parakeet TDT 0.6B v2 scores 6.05% average WER, against 7.44% for Whisper large-v3 ([Open ASR Leaderboard paper, Table 3](https://arxiv.org/html/2510.06961)).
   - The current `tiny.en` choice is roughly two generations behind.
2. **Recommended primary stack (licence-clean, all open weights):**
   - Silero VAD (MIT) runs continuously.
   - Moonshine (MIT) or streaming Zipformer handles low-latency command and live captions.
   - Parakeet TDT 0.6B v2/v3 (CC-BY-4.0) finalizes meeting and long-form transcripts.
   - Sortformer or pyannote community-1 (CC-BY-4.0) performs anonymous diarization.
   - GLiNER-PII (Apache-2.0) plus deterministic rules performs redaction.
   - Kokoro-82M (Apache-2.0) provides TTS.
   - The runtime is sherpa-onnx or LiteRT.
3. **Do not make Google's on-device stack (AICore/Gemini Nano/ML Kit GenAI) a hard dependency.** The ML Kit GenAI APIs:
   - are unsupported on unlocked bootloaders ([ML Kit GenAI speech recognition](https://developers.google.com/ml-kit/genai/speech-recognition/android));
   - run inference only when the app is the top foreground app, and are subject to quotas ([ML Kit GenAI overview](https://developers.google.com/ml-kit/genai));
   - depend on the Google AICore service.

   The platform `SpeechRecognizer` on-device mode is documented as not intended for continuous listening ([SpeechRecognizer reference](https://developer.android.com/reference/android/speech/SpeechRecognizer)). All of this conflicts with a custom-image, always-on product. Alpha's AOSP image ships without GMS, so these Google services are not available there by design; the on-device stack must be Alpha's own (sherpa-onnx, LiteRT-LM).
4. **Always-on capture is feasible only as a policy-privileged or visibly foreground mode.**
   - A third-party app cannot start a microphone foreground service from the background (Android 14+). It cannot start one from `BOOT_COMPLETED` either (Android 15+).
   - The exemptions are system components, `VoiceInteractionService` providers, and holders of the privileged `START_ACTIVITIES_FROM_BACKGROUND` permission ([FGS background-start restrictions](https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start)).
   - True low-power DSP hotword listening (Sound Trigger HAL) requires `CAPTURE_AUDIO_HOTWORD` and `MANAGE_SOUND_TRIGGER`. These are system-app permissions ([Sound Trigger](https://source.android.com/docs/core/audio/sound-trigger)).
   - Alpha's current vendor add-on is **non-privileged**, so it gets none of this.
5. **The power reference point is Google's Now Playing.** It is a two-stage DSP detector with an AP recognizer, and it averages under 1% of daily battery ([Now Playing paper](https://arxiv.org/abs/1711.10958)). Continuous transcription on the application processor costs an order of magnitude more (est.). The design must duty-cycle: DSP or VAD gating, then batching speech segments to the NPU/GPU.
6. **The differentiator: "sensitive data never leaves the device", enforced by an isolated on-device VM.**
   - The Android Virtualization Framework (pKVM protected VMs) already runs Google's own on-device content-safety classification for Play Protect live threat detection. OPPO uses it for an "AI private computing space" ([AVF use cases](https://source.android.com/docs/core/virtualization/usecases)).
   - Limits: pVMs need the privileged `MANAGE_VIRTUAL_MACHINE` permission, and Microdroid has no HALs or graphics ([AVF overview](https://source.android.com/docs/core/virtualization), [Microdroid](https://source.android.com/docs/core/virtualization/microdroid)). In-VM ML is therefore **CPU-only** today.
   - A small ASR model plus a redaction model running inside a pVM, with only redacted text crossing the boundary, is a credible and rare claim (est.). It needs a privileged system image.
7. **Cloud fallback: Nitro Enclaves are CPU-only.** An enclave talks only to its parent over vsock, with no GPU ([Nitro Enclaves](https://docs.aws.amazon.com/enclaves/latest/user/nitro-enclave.html)). Today's Cerebras inference path (`qwen-3.8-27b`) therefore sits **outside** the attested boundary. Cerebras publishes no attestation or TEE product; it does publicly state zero data retention for inference prompts and outputs ([Cerebras support](https://support.cerebras.net/articles/1811589793-does-cerebras-retain-my-data)), which is a contractual control, not an attested one. GPU confidential computing (H100 CC) adds under 7% overhead for typical LLM queries ([Zhu et al. 2024](https://arxiv.org/abs/2409.03992)). It is the realistic "attested inference" option, using self-hosted Qwen open weights so the model stays the same across tiers.
8. **Build or license:** build on open weights. Keep one commercial option open: Argmax Pro SDK for Android, GA March 18, 2026, $1.00 (yearly) to $1.33 (monthly) per device per month with a 1,000-license minimum; Enterprise from 10,000 licences ([Argmax blog](https://www.argmaxinc.com/blog), [Argmax pricing](https://www.argmaxinc.com/pricing)). It is the fastest path to NPU-accelerated Parakeet and diarization.

---

## 2. On-device ASR options

### 2.1 Accuracy and throughput (Open ASR Leaderboard and model cards)

Open ASR Leaderboard facts:
- It compares 86 systems across 12 datasets ([arXiv 2510.06961](https://arxiv.org/abs/2510.06961)).
- Conformer encoders with transformer decoders give the best average WER.
- CTC and TDT decoders give the best RTFx, which makes them better for long-form and batched work (same source).

| Model | Params / size | Licence | Languages | Streaming | Open ASR avg WER (EN short-form) | GPU RTFx | Notes and source |
|---|---|---|---|---|---|---|---|
| IBM Granite Speech 4.0 1B | ~1B | Apache-2.0 for the Granite Speech family ([3.3 card](https://huggingface.co/ibm-granite/granite-speech-3.3-8b); 4.0 unverified) | EN, FR, DE, ES, PT on 3.3 (4.0 scope unverified) | no (est.) | **5.52** | 280 | [Table 3](https://arxiv.org/html/2510.06961) |
| NVIDIA Canary-Qwen 2.5B | 2.5B (FastConformer + Qwen 1.7B LLM) | CC-BY-4.0 | English only | no; 40 s max input | **5.63** | 418 | [model card](https://huggingface.co/nvidia/canary-qwen-2.5b) |
| Microsoft Phi-4-multimodal-instruct | 5.6B | MIT | speech in EN, ZH, DE, FR, IT, JA, ES, PT | no | 6.02 | 151 | [Table 3](https://arxiv.org/html/2510.06961), [card](https://huggingface.co/microsoft/Phi-4-multimodal-instruct) |
| **NVIDIA Parakeet TDT 0.6B v2** | 600M; ≥2 GB RAM to load (NeMo) | CC-BY-4.0 | English | chunked streaming via NeMo | **6.05** | 3,386 | LS-clean 1.69, LS-other 3.19, **AMI 11.16**, **Earnings-22 11.15**; up to 24 min per pass ([card](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v2)) |
| **NVIDIA Parakeet TDT 0.6B v3** | 600M | CC-BY-4.0 | **25 European languages** | chunked streaming | 6.32 | 3,333 | FLEURS EN 4.85, ES 3.45, IT 3.00; released 2025-08-14; word timestamps ([card](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3)) |
| NVIDIA Canary 1B | 1B | **CC-BY-NC-4.0: non-commercial only** (not usable in a commercial product) | EN/DE/ES/FR | no | 6.50 | 235 | [Table 3](https://arxiv.org/html/2510.06961), [card](https://huggingface.co/nvidia/canary-1b) |
| Distil-Whisper large-v3.5 | 756M | MIT | English | no (buffered) | 7.21 (leaderboard); card: 7.08 short-form OOD, 11.39 long-form OOD | 202 | ~1.5× faster than turbo; works as a speculative-decoding draft for large-v3 ([card](https://huggingface.co/distil-whisper/distil-large-v3.5)) |
| OpenAI Whisper large-v3 | 1.55B | MIT (code); the Hugging Face model card lists Apache-2.0 | 99 | no | 7.44 | 146 | [Table 3](https://arxiv.org/html/2510.06961), [card](https://huggingface.co/openai/whisper-large-v3) |
| OpenAI Whisper large-v3-turbo | 809M (decoder cut from 32 to 4 layers) | MIT | 99 | no | 7.83 | 200 | **AMI 16.13** ([card](https://huggingface.co/openai/whisper-large-v3-turbo)) |
| Kyutai STT 1B (en/fr) | ~1B | CC-BY-4.0 weights; MIT (Python) / Apache-2.0 (Rust) code | EN, FR | **native streaming, 0.5 s delay**, semantic VAD | not retrieved | H100: 400 real-time streams | handles up to 2 h of audio; MLX on-device for Apple ([card](https://huggingface.co/kyutai/stt-1b-en_fr), [repo](https://github.com/kyutai-labs/delayed-streams-modeling)) |
| Kyutai STT 2.6B (en) | ~2.6B | CC-BY-4.0 | EN | streaming, 2.5 s delay | not retrieved | — | [repo](https://github.com/kyutai-labs/delayed-streams-modeling) |
| Moonshine Tiny / Base | **27M / 61M** | MIT | English (v1) | yes (Moonshine Voice) | not retrieved | — | Tiny needs **5× less compute than Whisper tiny.en on a 10 s segment, at no WER increase** ([paper](https://arxiv.org/abs/2410.15608), [card](https://huggingface.co/UsefulSensors/moonshine)) |
| Moonshine Voice (2026 family) | "tiny 1MB" up to large models | MIT by default; legacy non-English non-streaming models under a non-commercial community licence | STT: EN, ES, ZH, JA, KO, VI, UK, AR | yes, streaming-optimized | vendor claims the top model beats Whisper large-v3 accuracy (unverified) | — | Android, iOS, DSPs, microcontrollers ([docs](https://moonshine-voice.readthedocs.io/en/latest/), [repo](https://github.com/moonshine-ai/moonshine)) |
| whisper.cpp tiny.en (**current Alpha**) | 77.7 MB GGML | MIT | EN | no | not on current leaderboard | — | repo evidence ([standalone-paired-asr.md](../standalone-paired-asr.md)) |
| Vosk small EN 0.15 | 40 MB; ~300 MB RAM | Apache-2.0 | EN (plus ~20 others) | yes (Kaldi) | LS-clean 9.85, TED-LIUM 10.38 | — | [Vosk models](https://alphacephei.com/vosk/models) |
| Vosk EN 0.22 (server) | 1.8 GB; up to 16 GB RAM | Apache-2.0 | EN | yes | LS-clean 5.69, TED 6.05 | — | [Vosk models](https://alphacephei.com/vosk/models) |

**Contradiction flagged.** Distil-large-v3.5 is 7.21 on the leaderboard and 7.08 on its model card. The card measures out-of-distribution short-form sets, so the two use different evaluation sets. Parakeet v2's RTFx is 3,386 on the card and 3,390 in the paper (rounding).

**Proprietary reference points** (same Table 3):
- ElevenLabs Scribe v2: 5.83
- AssemblyAI Universal 3 Pro: 6.21
- Speechmatics Enhanced: 6.91 ([arXiv 2510.06961](https://arxiv.org/html/2510.06961))

The best open 0.6B on-device-sized model (Parakeet v2, 6.05) is therefore **within about 0.2 WER points of the best cloud APIs** on this benchmark.

**The meeting domain is the hard case.**
- Parakeet v2 scores 11.16% WER on AMI meetings, against 1.69% on LibriSpeech-clean ([card](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v2)).
- Whisper turbo scores 16.13% on AMI ([card](https://huggingface.co/openai/whisper-large-v3-turbo)).
- For always-on meeting capture, expect **10–20% WER** in real rooms from a phone on a table (est.). That is why far-field audio (section 6) matters as much as model choice.

### 2.2 Platform and commercial engines

| Engine | Deployment | Accuracy evidence | Pricing and licence | Fit for Alpha | Source |
|---|---|---|---|---|---|
| **Android `SpeechRecognizer` on-device** | `createOnDeviceSpeechRecognizer`, API 31+; `triggerModelDownload`; availability checks | none published | platform; needs an installed recognition service (none on Alpha's AOSP emulator) | **Not for continuous or always-on use**, per the docs. OK for push-to-talk on GMS devices. | [reference](https://developer.android.com/reference/android/speech/SpeechRecognizer); repo gap report |
| **ML Kit GenAI Speech Recognition** | Basic mode (classic on-device, API 31+, 15 languages); Advanced mode (GenAI model, **Pixel 10 and Pixel 11 only**, ~20 locales) | "beta languages may have slightly higher WER" | free; ML Kit GenAI terms | Needs AICore; **not supported with an unlocked bootloader**; raw 16 kHz mono PCM16 | [ML Kit GenAI speech](https://developers.google.com/ml-kit/genai/speech-recognition/android) |
| Google SODA / Gboard/Recorder recognizer | system-internal | the 2019 all-neural RNN-T was **80 MB** after 4× compression and 4× speed-up | not licensable to third parties (est.) | reference design only | [Google Research 2019](https://research.google/blog/an-all-neural-on-device-speech-recognizer/) |
| Pixel Recorder | on-device transcription, speaker labels; cloud summaries expanding via Private AI Compute | none published | bundled | competitor benchmark; its language expansion now uses Private AI Compute | [Private AI Compute announcement](https://blog.google/technology/ai/google-private-ai-compute/) |
| **Apple SpeechAnalyzer** (iOS 26) | on-device; model lives in system storage outside the app; long-form and distant audio; volatile and final results | Earnings-22 **14.0% WER, 70× real time** on an M4 Mac mini | free to iOS apps; no custom vocabulary | iOS-only; the benchmark bar for "free platform ASR" | [WWDC25 session 277](https://developer.apple.com/videos/play/wwdc2025/277/), [Argmax benchmark](https://www.argmaxinc.com/blog/apple-and-argmax) |
| **Argmax WhisperKit / Pro SDK** | iOS, macOS; **Android Pro SDK GA 2026-03-18, Kotlin-first on Google LiteRT**; WhisperKit Android with Qualcomm since 2024-10-22 | Earnings-22: WhisperKit base.en 15.2% at 111×; small.en 12.8% at 35×; **Pro 11.7% at 359×**; Parakeet v2 real-time latency **160 ms** | Basic MIT (free); **Pro $1.33/device/mo monthly or $1.00 yearly, minimum 1,000 devices**; Enterprise custom beyond 10k | the strongest "buy" option for NPU-accelerated Parakeet plus diarization on Android | [benchmark](https://www.argmaxinc.com/blog/apple-and-argmax), [blog index](https://www.argmaxinc.com/blog), [pricing](https://www.argmaxinc.com/pricing) |
| **Picovoice Leopard / Cheetah** | on-device batch (Leopard) and streaming (Cheetah); Android, iOS, web, Raspberry Pi | English avg WER: **Leopard 9.7%**, **Cheetah 10.1%** (vs Amazon 4.3% batch and 5.6% streaming); Leopard **37 MB, 0.026 core-hours per audio hour** vs Whisper Medium 1.52 core-hours / 1,457 MB | SDK Apache-2.0, but **an AccessKey is required and usage is account-limited**; list prices not published (unverified) | cheap CPU footprint, but accuracy lags 2025–26 open models by ~3–4 WER points | [Picovoice benchmark repo](https://github.com/Picovoice/speech-to-text-benchmark), [Leopard repo](https://github.com/Picovoice/leopard) |
| **Speechmatics** | cloud, on-prem **and on-device**; 55+ languages; code-switching; diarization | Open ASR "Enhanced" 6.91; vendor-cited Pipecat pooled WER 1.07% (Aug 2026, vendor-reported, not comparable) | usage-based; $100 free credit; ISO 27001, SOC 2 Type II, HIPAA | a commercial on-device option; get an on-device SDK quote | [Speechmatics](https://www.speechmatics.com/), [Table 3](https://arxiv.org/html/2510.06961) |
| **sherpa-onnx (k2-fsa)** | framework: streaming Zipformer/Paraformer, non-streaming Whisper/Moonshine, VAD, KWS, diarization, speaker ID, TTS; Android, iOS; **Qualcomm/Rockchip/Ascend/Axera NPU backends** | model-dependent | open source (15.1k stars) | **recommended runtime** for the open stack | [repo](https://github.com/k2-fsa/sherpa-onnx) |

**Argmax company facts:**
- $8M seed on 2024-11-13, led by Salesforce Ventures with General Catalyst participating ([Argmax blog](https://www.argmaxinc.com/blog)).
- SpeakerKit launched 2025-03-07.
- A pyannoteAI partnership was announced 2025-06-23.
- Pro SDK 3, with real-time STT plus speakers plus custom vocabulary, shipped 2026-09-23 (same source).
- The Argmax blog lists no funding after the Nov 2024 seed.

### 2.3 Phone real-time factor on a Pixel 10-class device (estimates)

There are no published third-party RTF figures for these models on Tensor G5. The anchors that exist:
- Tensor G5 is built on TSMC 3 nm (N3E) and paired with the Titan M2 security chip ([Wikipedia: Pixel 10](https://en.wikipedia.org/wiki/Pixel_10)). Against G4, its TPU is up to 60% faster and its CPU 34% faster. Gemini Nano runs "2.6× faster and 2× more efficiently" ([Google blog](https://blog.google/products/pixel/tensor-g5-pixel-10/)).
- The CPU is 1× Cortex-X4 at 3.78 GHz, 5× A725 and 2× A520. The GPU is a PowerVR DXT-48-1536 ([Wikipedia: Google Tensor](https://en.wikipedia.org/wiki/Google_Tensor)).
- Tensor G6 / Pixel 11 was announced 2026-08-12 (same source) and shipped 2026-08-20 from $899 with 12 GB RAM and 7 years of updates ([Engadget](https://www.engadget.com/2234844/google-pixel-11-announced-specs-availability/)). A "Pixel 10-class" target now means last year's flagship.
- LiteRT supports the Google Tensor NPU with **ahead-of-time compilation only (JIT in beta)**. Qualcomm and MediaTek support both AOT and on-device compilation ([LiteRT NPU](https://developers.google.com/edge/litert/next/npu)).

| Model on Pixel 10 | Backend | Expected RTF (lower is faster) | Memory | Confidence |
|---|---|---|---|---|
| Silero VAD | CPU, 1 thread | <1 ms per 30 ms chunk, i.e. RTF <0.033 ([Silero](https://github.com/snakers4/silero-vad)); ~2 MB | ~2 MB | measured by vendor (desktop CPU) |
| Moonshine Tiny/Base | CPU int8 | 0.02–0.06 (est.) | 50–150 MB (est.) | est. |
| Streaming Zipformer (sherpa-onnx, ~70M) | CPU int8 | 0.05–0.15 (est.) | 100–200 MB (est.) | est. |
| Parakeet TDT 0.6B v2/v3 | CPU int8 (4 big cores) | 0.1–0.3 (est.) | 0.7–1.2 GB (est.) | est. |
| Parakeet TDT 0.6B | GPU/NPU via LiteRT (Argmax path) | 0.02–0.08 (est.); Argmax reports 160 ms streaming latency on Apple silicon ([Argmax](https://www.argmaxinc.com/blog)) | 0.6–1 GB (est.) | est. |
| Whisper large-v3-turbo (whisper.cpp) | CPU/GPU | 0.3–1.0 (est.) | 1.5 GB+ (est.) | est. |
| Kyutai STT 1B | CPU/GPU | likely too heavy for always-on on phone (est.) | 2 GB+ (est.) | est. |

**Action:** replace every (est.) cell with measured cold and warm RTF, energy per audio minute and peak temperature on a physical Pixel 10. See the Month 1 roadmap.

---

## 3. Speaker diarization on device, and voiceprint law

### 3.1 Models

| System | Size | Licence | Accuracy (DER, lower is better) | Streaming / latency | On-device fit | Source |
|---|---|---|---|---|---|---|
| pyannote **community-1** | segmentation plus embedding (~tens of MB, est.) | **CC-BY-4.0** (gated HF token) | AISHELL-4 11.7%, **AMI-IHM 17.0%**, DIHARD3 20.2% (legacy 3.1: 12.2 / 18.8 / 21.4) | offline | CPU OK for post-meeting passes (est.) | [card](https://huggingface.co/pyannote/speaker-diarization-community-1) |
| pyannoteAI **precision-2** | hosted/commercial | commercial | AISHELL-4 11.4%, **AMI-IHM 12.9%**, DIHARD3 14.7% | — | cloud or licence; also via Argmax SDK partnership | [card](https://huggingface.co/pyannote/speaker-diarization-community-1), [Argmax blog](https://www.argmaxinc.com/blog) |
| NVIDIA **Streaming Sortformer 4spk v2** | **117M** | **CC-BY-4.0** | DIHARD III 1–4 speakers **13.24%**; ≥5 speakers **42.56%** | profiles: 30.4 s (RTF 0.002), 10 s (0.005), **1.04 s (RTF 0.093)**, **0.32 s (RTF 0.180)**, measured on GPU | good for ≤4 people; fails for large meetings | [card](https://huggingface.co/nvidia/diar_streaming_sortformer_4spk-v2) |
| Argmax **SpeakerKit** | **~10 MB** | commercial subscription | "matches pyannote across 13 datasets" (vendor; SDBench) | ~1 s to diarize 4 min of audio on iPhone | iOS/macOS; Argmax's platform docs list Android support without detail, and the Pro plan bundles "SpeakerKit Pro"; no dedicated SpeakerKit Android release found (unverified) | [SpeakerKit](https://www.argmaxinc.com/blog/speakerkit), [platforms](https://app.argmaxinc.com/docs/wiki/supported-platforms) |
| sherpa-onnx diarization | pyannote segmentation plus 3D-Speaker/NeMo embeddings (ONNX) | open source | model-dependent | offline | runs on Android CPU | [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) |

**Recommendation:**
- Use Sortformer (≤4 speakers, streaming) for live labels.
- Run a pyannote community-1 pass after the meeting for final labels.
- Offer precision-2 or SpeakerKit only as a licensed upgrade if measured DER on real phone audio is unacceptable.

### 3.2 BIPA and voiceprints

- Illinois BIPA (740 ILCS 14) names "voiceprint" among biometric identifiers ([statute](https://www.ilga.gov/legislation/ilcs/ilcs3.asp?ActID=3004&ChapterID=57); widely reported, wording unverified at source). See [11](11-fit-gtm-risks.md) for the amendment status.
- Private right of action: **$1,000 per negligent violation and $5,000 per intentional or reckless violation**. *Rosenbach v. Six Flags* held that no actual injury is needed. Facebook settled for $650M in 2021 ([Wikipedia: BIPA](https://en.wikipedia.org/wiki/Biometric_Information_Privacy_Act)).
- The 2024 amendment (SB 2979, Public Act 103-0769) reportedly limits damages to one recovery per person for repeated collection by the same method and allows electronic signatures for consent (unverified; see [05](05-regulation-compliance.md) and [11](11-fit-gtm-risks.md)).
- Texas (CUBI) and Washington have similar laws with no private right of action ([Wikipedia](https://en.wikipedia.org/wiki/Biometric_Information_Privacy_Act)).

**Engineering implications:**

| Design choice | Voiceprint created? | BIPA exposure (est., get legal review) | Recommendation |
|---|---|---|---|
| Anonymous clustering ("Speaker 1/2/3") with embeddings kept only in RAM for the session, then discarded | transient embeddings; arguably not "collected or stored" (legal question) | low to moderate | **Default** |
| Persisting per-meeting embeddings to relabel later | yes | moderate to high | only with a retention schedule, and only for the owner |
| Owner enrollment ("this is me") | yes, the owner's own | manageable with written consent and a retention policy | opt-in, stored in Keystore-encrypted storage, never uploaded |
| Enrolling or recognizing named third parties (contacts) | yes, of bystanders | **high**; bystanders cannot consent in the flow | **do not ship** in the US without counsel; geofence off in IL, TX and WA |
| Sending audio to a cloud diarizer | the vendor creates voiceprints | vendor-dependent, plus subprocessor issues | avoid for the sensitive tier |

---

## 4. On-device NER/PII redaction and small LLMs

### 4.1 Redaction models

| Option | Size and runtime | Accuracy | Licence | Notes | Source |
|---|---|---|---|---|---|
| **GLiNER-PII base v1.0** (Knowledgator + Wordcab) | base encoder (~200M, est.); **FP16 and UINT8 ONNX** with quantization-aware training | **F1 80.99%** (P 79.28, R 82.78) on synthetic-multi-pii-ner-v1 | Apache-2.0 (GLiNER) | 60+ PII/PHI/PCI types, zero-shot custom labels | [card](https://huggingface.co/knowledgator/gliner-pii-base-v1.0), [GLiNER](https://github.com/urchade/GLiNER) |
| GLiNER multi-PII | small/medium | not retrieved | Apache-2.0 | 40+ types, 100+ languages; INT8, ONNX | [GLiNER](https://github.com/urchade/GLiNER) |
| Microsoft Presidio with a small NER backend | regex/checksum recognizers plus spaCy or GLiNER | depends on recognizers | MIT | the best deterministic layer for SSNs, cards (Luhn), IBANs, phone numbers | [Presidio](https://github.com/microsoft/presidio); see [04](04-redaction.md) |
| Gemini Nano via ML Kit **Prompt API** / Summarization | on AICore | not published for PII | ML Kit GenAI terms | **foreground-only, quota-limited, locked bootloader, AICore required** | [ML Kit GenAI](https://developers.google.com/ml-kit/genai) |
| Gemma 3n E2B / Gemma 4 E2B as an LLM redactor | 2.58 GB (Gemma 4 E2B) | not benchmarked for PII | Gemma terms | too slow and heavy for always-on redaction; fine as a second-pass verifier | [LiteRT-LM](https://developers.google.com/edge/litert-lm/overview) |

At 80–81% F1 a model alone is **not good enough** for "never leaves the device" claims. Redaction must be layered:
1. Deterministic recognizers.
2. GLiNER.
3. Policy tiers that block rather than redact when uncertain.
4. Recall-weighted evaluation on real transcripts with ASR errors.

See [04-redaction.md](04-redaction.md).

### 4.2 Small LLMs for local summarization: measured throughput

| Model | Device / backend | Prefill tok/s | Decode tok/s | Source |
|---|---|---|---|---|
| Gemma 3n E2B | Samsung S24 Ultra (SD 8 Gen 3), GPU | 816 | **15.6** | [HF LiteRT-LM card](https://huggingface.co/google/gemma-3n-E2B-it-litert-lm) |
| Gemma 3n E2B | MacBook Pro M3, CPU | 232.5 | 27.6 | same |
| **Gemma 4 E2B** (2.58 GB) | **Samsung S26 Ultra**, GPU | **3,808** | **52** | [LiteRT-LM overview](https://developers.google.com/edge/litert-lm/overview) |
| Qwen2.5-1.5B | Samsung S25 Ultra (SD 8 Elite), GPU | 1,668 | 31 | same |
| Qwen3-0.6B | Vivo X300 Pro (Dimensity), GPU | 580 | 21 | same |
| FastVLM-0.5B | **Snapdragon 8 Elite Gen 5, NPU (LiteRT QNN)** | **>11,000** | **>100**; TTFT 0.12 s on a 1024² image | [Google Developers Blog](https://developers.googleblog.com/en/unlocking-peak-performance-on-qualcomm-npu-with-litert/) |
| Gemini Nano (latest) | Tensor G5 TPU | not published | "2.6× faster, 2× more efficient" than G4 | [Google](https://blog.google/products/pixel/tensor-g5-pixel-10/) |
| Phi-4-mini (3.8B), Llama 3.2 1B/3B, Qwen3 1.7B/4B | Tensor G5 / SD 8 Elite Gen 5 | not retrieved | **est.** 1B: 30–60 decode; 3–4B: 10–25 decode on GPU (est.) | LiteRT-LM lists Llama, Phi-4 and Qwen as supported ([repo](https://github.com/google-ai-edge/LiteRT-LM)) |

**Qualcomm vs Tensor for third-party NPU access:**
- The LiteRT QNN accelerator claims up to **100× over CPU and 10× over GPU**.
- On SD 8 Elite Gen 5, 56 models run under 5 ms on the NPU, against 13 on CPU.
- 64 of 72 tested models fully delegate to the NPU ([Google Developers Blog](https://developers.googleblog.com/en/unlocking-peak-performance-on-qualcomm-npu-with-litert/)).
- Tensor's NPU is AOT-only in LiteRT ([LiteRT NPU](https://developers.google.com/edge/litert/next/npu)).
- Practical inference: third-party NPU acceleration is **more mature on Snapdragon than on Tensor**. A Pixel-targeted product will likely run ASR on CPU/GPU at first (est.).
- The G5's PowerVR GPU is a new vendor for Pixel, so GPU delegate maturity is a risk (est., from the [Wikipedia](https://en.wikipedia.org/wiki/Google_Tensor) note that the choice was uncommon).

**NNAPI** was deprecated in Android 15. Google directs developers to LiteRT/TFLite in Play services, the GPU delegate, and AICore for GenAI ([NNAPI migration guide](https://developer.android.com/ndk/guides/neuralnetworks/migration-guide)). A **de-Googled image cannot rely on the Play-services runtime**, so bundle LiteRT or ONNX Runtime statically.

**Summarization sizing (est.):** a 30-minute meeting is about 4,500 words, or about 6,000 tokens (est.).
- Prefill at 1,600–3,800 tok/s: **2–4 s**.
- A 300-token summary at 30–50 tok/s: **6–10 s**.
- Total: about 10–15 s on a 2025–26 flagship GPU (est.).

This is acceptable as a background job after the meeting. It is not interactive.

---

## 5. Always-on power, thermal and Android platform constraints

### 5.1 Reference points

| Reference | Architecture | Power evidence | Source |
|---|---|---|---|
| Pixel **Now Playing** | two stages: always-on music detector on the **DSP** wakes the AP only when confident; on-device fingerprint DB of "tens of thousands" of songs | **<1% of daily battery on average** | [Now Playing paper](https://arxiv.org/abs/1711.10958) |
| Sound Trigger HAL | vendor DSP hotword models; the app receives the audio stream around the trigger | "minimal power"; runs until stop, trigger or resource limits | [AOSP Sound Trigger](https://source.android.com/docs/core/audio/sound-trigger) |
| Pixel 10 | Tensor G5 | "over 30 hours of battery life" (Google marketing, typical use) | [Google](https://blog.google/products/pixel/tensor-g5-pixel-10/) |

### 5.2 Always-on energy model (all est.; replace with measurements)

Assumptions (est.):
- battery 4,970 mAh at ~3.87 V, about 19.2 Wh, rounded to 19 Wh below (Pixel 10 base model, [Wikipedia](https://en.wikipedia.org/wiki/Pixel_10); Pro/XL capacities not covered);
- speech present 30% of a 16-hour waking day;
- 4 hours of meetings.

| Mode | Components awake | Average power (est.) | Daily energy (est.) | % of 19 Wh (est.) |
|---|---|---|---|---|
| A. DSP hotword only (Sound Trigger, privileged) | DSP plus mic | 5–10 mW | 0.08–0.16 Wh | **~0.5–1%** (consistent with Now Playing) |
| B. AP-side mic plus Silero VAD, 16 h | little core, audio HAL | 25–60 mW | 0.4–1.0 Wh | 2–5% |
| C. B plus batched ASR on detected speech (Moonshine/Zipformer, CPU) | + bursty big-core ASR | +40–120 mW while speech is present | +0.2–0.6 Wh | +1–3% |
| D. B plus continuous streaming Parakeet on CPU during 4 h of meetings | big cores sustained | 400–900 mW | 1.6–3.6 Wh | **8–19%** |
| E. D moved to NPU/GPU with 30 s batches | accelerator bursts | 150–350 mW | 0.6–1.4 Wh | 3–7% |
| F. Post-meeting summary (Gemma-class, 15 s × 8 meetings) | GPU | 3–5 W bursts | ~0.1–0.2 Wh | ~1% |

**Conclusion (est.):** an always-listening day with meeting transcription costs about **5–15% of battery** if it is batched and accelerated. Naive continuous CPU streaming costs up to about **20%**.

Thermal risk comes from sustained big-core use in a pocket or on a charger. Mitigations:
- batch processing;
- a cap on sustained CPU frequency;
- deferring the high-accuracy re-pass to charging (the Pixel "while charging" pattern);
- tracking `PowerManager` thermal status (est.).

**Duty-cycling strategy (recommended):**
1. **Tier 0**: DSP hotword/VAD (privileged build) or the lowest-rate AP VAD (app build).
2. **Tier 1**: on speech, buffer 16 kHz PCM in an encrypted ring buffer; run streaming Moonshine/Zipformer only while the screen is on or captions are requested.
3. **Tier 2**: every 30–60 s, or at segment end, batch-transcribe with Parakeet on GPU/NPU.
4. **Tier 3**: re-pass and diarize after the meeting; summarize while charging or on request.
5. Hard gates: stop on low battery (<15%), on thermal ≥ `THERMAL_STATUS_MODERATE`, on user sensitive places or times, and whenever the privacy indicator would be misleading.

### 5.3 Android rules for background microphone use

| Rule | Detail | Source |
|---|---|---|
| FGS type `microphone` | needs `FOREGROUND_SERVICE_MICROPHONE` plus runtime `RECORD_AUDIO`; persistent notification | [FGS types](https://developer.android.com/develop/background-work/services/fgs/service-types) |
| While-in-use restriction (Android 14+) | cannot create a mic FGS while the app is in the background → `SecurityException` | [background start](https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start) |
| Boot | apps targeting Android 15 cannot launch a mic FGS from `BOOT_COMPLETED` | [FGS types](https://developer.android.com/develop/background-work/services/fgs/service-types) |
| While-in-use exemptions | started by a system component; widget or notification interaction; a `PendingIntent` from a visible app; a device-owner DPC; **an app providing `VoiceInteractionService`**; an app holding **`START_ACTIVITIES_FROM_BACKGROUND` (privileged)** | [background start](https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start) |
| Privacy indicator | Android 12+: green dot for active or <5 s-old mic use; tap to see the app; config flag `privacy/mic_camera_indicators_enabled` | [AOSP privacy indicators](https://source.android.com/docs/core/permissions/privacy-indicators) |
| Low-power hotword | Sound Trigger needs `CAPTURE_AUDIO_HOTWORD` and `MANAGE_SOUND_TRIGGER` (system/vendor apps) | [Sound Trigger](https://source.android.com/docs/core/audio/sound-trigger) |
| On-device recognizer | not intended for continuous use | [SpeechRecognizer](https://developer.android.com/reference/android/speech/SpeechRecognizer) |
| GenAI APIs | foreground-only inference, quotas, locked bootloader | [ML Kit GenAI](https://developers.google.com/ml-kit/genai) |

**What each Alpha distribution can do:**

| Capability | Standalone app (Play-style) | HOME launcher flavor (current, non-privileged) | Privileged system app in a signed AOSP image | Default assistant (`VoiceInteractionService` role) |
|---|---|---|---|---|
| Start a mic FGS from the UI | yes | yes; HOME is frequently the visible activity, so starts from HOME are "while in use" | yes | yes |
| Start or restart the mic from the background or at boot | no | no; being HOME is not an FGS exemption | yes (system component or privileged permission) | yes (exempt) |
| DSP hotword / Sound Trigger | no | no | **yes** (with a vendor model on the Tensor DSP; needs vendor HAL access, unverified for Pixel) | via the platform hotword path (HotwordDetectionService sandbox, unverified details) |
| Hide the privacy indicator | no | no | technically possible via config, but **must not** be done: it is a trust and consent feature | no |
| pKVM protected VM for isolated ML | no (`MANAGE_VIRTUAL_MACHINE` is privileged) | no | **yes** | only if also privileged |
| AICore / Gemini Nano | GMS devices with a locked bootloader only | same | **not available**: Alpha's image ships without GMS/AICore | same |

**Implication:** the always-on story requires **either** the assistant role **or** a privileged image. The repository's add-on is currently non-privileged. Always-on should be positioned as an image-level feature, with "tap-to-record, visible foreground capture" in the app build.

---

## 6. Audio capture hardware: phone on a table vs a puck or pendant

| Option | Mics / processing | Far-field quality (est.) | BOM (est.) | Retail comparables | Notes |
|---|---|---|---|---|---|
| Phone flat on a table (Pixel 10: 3 mics; geometry not published) | 2–3 MEMS; OS noise suppression; limited beamforming exposed to apps | 1–2 m radius acceptable; poor for far talkers, table noise, face-down occlusion | $0 | — | AMI-type WER (11–16% for top models, section 2.1) is already hard with close mics; expect worse (est.) |
| Wearable pendant or clip (Plaud NotePin, Limitless Pendant, Bee) | 1–2 MEMS, BLE, local flash | good for the wearer, weak for the far side of a room | $15–35 (est.) | **Plaud NotePin $159 / NotePin S $179** ([Plaud](https://www.plaud.ai/blogs/news)); **Limitless Pendant $99** ([TechCrunch](https://techcrunch.com/2025/12/05/meta-acquires-ai-device-startup-limitless/)); **Bee $49.99 plus $19/mo** ([TechCrunch](https://techcrunch.com/2025/07/22/amazon-acquires-bee-the-ai-wearable-that-records-everything-you-say/)) | the social-acceptability and consent-indicator issues in [01](01-transcription-competitors.md) and [02](02-agentic-phones-devices.md) |
| Desk puck (4–8-mic circular array plus DSP beamforming/AEC; e.g. an XMOS XVF3800-class or Knowles/Synaptics voice DSP) | 4–8 MEMS, 360° beamforming, AEC, dereverberation | good for 3–5 m meeting rooms (est.) | $25–60 (est., unverified; parts pricing not retrieved) | conference-speakerphone category | best accuracy per dollar for meetings; can do VAD on-puck and stream **only** over an encrypted link to the phone |
| USB-C or clip lavalier pair | 1–2 close mics | excellent per speaker | $5–20 (est.) | — | cheapest accuracy gain for interviews |

**Recommendation:** do not build hardware in the first 6 months.
- Qualify phone-on-table capture.
- Support certified USB-C or Bluetooth LE Audio conference mics as accessories.
- Revisit a **"trust puck"** once pilots show that meeting-room capture dominates. A trust puck would have a hardware mute switch, a hardwired LED, on-puck VAD and encryption with a Keystore-attested pairing.

---

## 7. On-device TTS

| Engine | Size | Licence | Languages / voices | Quality and speed | Fit | Source |
|---|---|---|---|---|---|---|
| **Kokoro-82M** (current, on host) | 82M (StyleTTS 2 + iSTFTNet) | **Apache-2.0** | 8 languages, 54 voices | high quality for its size; <$1 per 1M characters served | **move on-device** (ONNX via sherpa-onnx) | [card](https://huggingface.co/hexgrad/Kokoro-82M) |
| Piper (original) | small VITS voices | MIT, **archived 2025-10-06** | many | fast on a Raspberry Pi | frozen; no fixes | [rhasspy/piper](https://github.com/rhasspy/piper) |
| Piper1-gpl (successor) | same | **GPL-3.0**, and espeak-ng is GPL | many | — | **licence risk** for a proprietary image; avoid unless isolated as a separate GPL process with counsel sign-off | [OHF-Voice/piper1-gpl](https://github.com/OHF-Voice/piper1-gpl) |
| Moonshine Voice TTS | not retrieved | MIT default | 16 languages | streaming-oriented | alternative to watch | [docs](https://moonshine-voice.readthedocs.io/en/latest/) |
| Argmax TTSKit | not retrieved | MIT (Basic) | — | — | bundled in the Argmax option | [pricing](https://www.argmaxinc.com/pricing) |
| Android `TextToSpeech` | installed engine | engine-dependent | engine-dependent | — | **no engine on Alpha's AOSP emulator**; must provision one | repo gap report |

**Recommendation:** ship Kokoro through sherpa-onnx as Alpha's own `TextToSpeechService`, so other apps and accessibility can use it too. Measure time-to-first-audio on the Pixel 10. Keep espeak-ng out of the default phonemizer path unless GPL obligations are accepted.

---

## 8. End-to-end latency budget and recommended architecture

### 8.1 Latency budget: voice query to first audible answer

The DoD target is **6 s** for a simple query ([gap report](../mvp-scope-and-gap-report.md)). The current paired-host path has exceeded it (same source).

| Stage | Local-first target (est.) | Basis |
|---|---|---|
| Endpointing (VAD hangover or semantic end-of-turn) | 300–600 ms | Silero <1 ms per chunk ([Silero](https://github.com/snakers4/silero-vad)); the hangover is a design choice; Kyutai semantic VAD ([card](https://huggingface.co/kyutai/stt-1b-en_fr)) |
| ASR finalization (streaming, so the transcript is mostly ready) | 100–400 ms | Argmax Parakeet 160 ms streaming latency ([Argmax](https://www.argmaxinc.com/blog)); est. on Pixel |
| Redaction (rules plus GLiNER int8 on ≤100 tokens) | 20–80 ms (est.) | ONNX UINT8 ([GLiNER-PII](https://huggingface.co/knowledgator/gliner-pii-base-v1.0)) |
| Transport to the enclave (TLS, LTE/5G/Wi-Fi) | 50–200 ms (est.) | — |
| Agent planning and LLM first token (Cerebras) | 200–800 ms (est.; not yet measured) | — |
| Rehydration of pseudonyms on the phone | <10 ms (est.) | — |
| TTS first audio chunk (Kokoro on device, sentence 1) | 150–400 ms (est.) | — |
| **Total to first audio** | **≈0.9–2.5 s (est.)** | comfortably inside 6 s if the pieces stream |

### 8.2 Recommended architecture: local first, with a confidential-cloud fallback

```
Mic(s) ──► [Tier0 VAD / hotword] ──► encrypted PCM ring buffer (Keystore AES-GCM, RAM-first)
                                              │
                ┌─────────────────────────────┴─────────────────────────────┐
                │  SENSITIVE ZONE (target: pKVM protected VM; fallback: isolated process)
                │   streaming ASR (Moonshine/Zipformer) ─► final ASR (Parakeet)
                │   anonymous diarization (Sortformer, RAM-only embeddings)
                │   redaction: rules + GLiNER-PII  ─► pseudonym vault (never exported)
                │   OUTPUT: redacted transcript + typed pseudonyms + policy label
                └─────────────────────────────┬─────────────────────────────┘
                                              │ (only redacted text crosses)
      local store (encrypted notes)  ◄────────┼────────►  egress policy gate (per-tier allow/deny, receipts)
                                              │
                              ┌───────────────┴────────────────┐
                              │ Confidential cloud (attested)  │
                              │ Nitro Enclave agent runtime    │──► GPU TEE inference (H100/H200 CC)
                              │ (CPU-only, KMS attestation)    │    or Cerebras (outside TEE, redacted only)
                              └────────────────────────────────┘
      reply ─► rehydrate pseudonyms locally ─► Kokoro TTS ─► speaker
```

**Policy tiers:**
- **T0 "never leaves"**: raw audio, voiceprints, the pseudonym vault. These stay local and inside the pVM, with no network path.
- **T1 "redacted egress"**: redacted text may reach the attested enclave.
- **T2 "attested inference only"**: goes only to GPU-TEE inference with a verified attestation.
- **T3 "public"**: may use any provider.

### 8.3 Cloud TEE options

| Option | What is attested | GPU inside the TEE? | Overhead | Fit for Alpha | Source |
|---|---|---|---|---|---|
| **AWS Nitro Enclaves** (current) | enclave image PCRs; KMS policy bound to measurements | **no**: vsock to the parent only, no network, no persistent storage; up to 4 enclaves per parent; no extra charge | CPU-only | keep for the agent runtime, key release and redaction verification; **not for LLM or ASR at scale** | [AWS docs](https://docs.aws.amazon.com/enclaves/latest/user/nitro-enclave.html) |
| **NVIDIA H100/H200 CC** (CVM on AMD SEV-SNP or Intel TDX, plus a GPU in CC mode) | CPU TEE plus a signed GPU attestation report over SPDM | **yes** | GPU compute and HBM unchanged; CPU↔GPU limited to ~4 GB/s by bounce-buffer encryption; **<7% for typical LLM queries** | the right home for any cloud ASR or LLM that sees T2 data | [NVIDIA](https://developer.nvidia.com/blog/confidential-computing-on-h100-gpus-for-secure-and-trustworthy-ai/), [arXiv 2409.03992](https://arxiv.org/abs/2409.03992) |
| Hosted GPU-TEE providers (Tinfoil, Privatemode) | attested open models | yes | — | Tinfoil: private chat $20/mo, containers $20/mo plus usage ([Tinfoil](https://tinfoil.sh/)); Privatemode: open models including Qwen, a **speech-to-text** offering, BSI C5 attestation criteria, EU hosting ([Privatemode](https://www.privatemode.ai/)) | a fast way to get attested ASR or LLM fallback without building GPU CC ops |
| **Cerebras** (current LLM, `qwen-3.8-27b`, $0.99/M in, $1.49/M out, ~1,850 tok/s; [Cerebras docs](https://inference-docs.cerebras.ai/models/qwen-3.8-27b)) | none published; public zero-data-retention statement ([Cerebras support](https://support.cerebras.net/articles/1811589793-does-cerebras-retain-my-data)) | no public TEE found | fastest tokens/s | only for T1 redacted text, under contractual zero-retention; do not describe it as "attested" |  — |
| Apple PCC (reference) | published images, transparency log, stateless, non-targetable, no privileged access | Apple silicon | — | architectural reference for claims language | [Apple Security](https://security.apple.com/blog/private-cloud-compute/) |
| Google Private AI Compute (reference, 2025-11-11) | TPUs plus "Titanium Intelligence Enclaves", remote attestation | TPU | — | powers Magic Cue and Recorder summary language expansion | [Google](https://blog.google/technology/ai/google-private-ai-compute/) |

### 8.4 On-device secure hardware and isolation

| Primitive | What it gives Alpha | Limits | Source |
|---|---|---|---|
| **StrongBox** (Titan M2 on Pixel 10) | keys in a secure element with its own CPU, TRNG and tamper resistance; key attestation | slow; limited algorithms (RSA-2048, AES-128/256, P-256, HMAC-SHA256, 3DES); not for bulk audio encryption | [Keystore](https://developer.android.com/privacy-and-security/keystore) |
| TEE-backed Keystore | per-recording AES-GCM keys (already used by Alpha for credentials) | — | repo manifest |
| **Android Protected Confirmation** | a trusted-UI prompt; the signature proves the user saw the exact text (for approvals of sensitive egress or actions) | "supported devices" on Android 9+; not a confidential channel; **no deprecation notice on the developer page**; per-Pixel support list not published | [APC](https://developer.android.com/privacy-and-security/security-android-protected-confirmation) |
| **AVF / pKVM protected VM** | isolation that holds even if Android is compromised; Microdroid (bionic NDK subset, verified boot, SELinux, binder-over-vsock) | ARM64 only; `MANAGE_VIRTUAL_MACHINE` is **privileged**; **no Java APIs, graphics or HALs**, so ML runs on CPU only; RAM carved out for the VM | [AVF](https://source.android.com/docs/core/virtualization), [Microdroid](https://source.android.com/docs/core/virtualization/microdroid) |
| Precedent | Google runs **Play Protect live threat detection content-safety classifiers in pVMs**; OPPO's "AI private computing space" | — | [AVF use cases](https://source.android.com/docs/core/virtualization/usecases) |

**pVM feasibility sketch (est.):** a Microdroid payload with sherpa-onnx CPU, Moonshine Base (61M), GLiNER-PII UINT8 and Silero VAD needs about 0.5–1 GB of VM RAM (est.). It would run around 0.1–0.3 RTF on 2–4 big cores (est.). That is enough for streaming captions and redaction.

Parakeet 0.6B inside the pVM is plausible on CPU for batch work (est.). NPU and GPU are unavailable inside the VM until AVF device assignment matures (unverified).

**The claim this enables:** "Raw audio and speaker embeddings are processed only inside a hardware-isolated VM on your phone, whose code is measured. Only redacted text can leave it." The VM's measured identity would be bound to Keystore attestation, and could be chained to the Nitro enclave's KMS policy for end-to-end attestation (est. design).

---

## 9. How competitors built theirs

| Company | Capture | ASR / LLM location | Privacy architecture | Status | Source |
|---|---|---|---|---|---|
| **Plaud** (NotePin $159, NotePin S $179) | dedicated recorder/wearable, phone app sync | **cloud** transcription and LLM summaries (providers not disclosed on the page retrieved) | "Trust Center"; consent prompt copy; certifications not retrieved (unverified) | calls itself the "No.1 AI note-taking brand" (vendor claim) | [Plaud](https://www.plaud.ai/blogs/news); see [01](01-transcription-competitors.md) |
| **Limitless** (Pendant $99; raised >$33M from a16z, First Round, NEA) | pendant, BLE to phone | cloud; had a "Confidential Cloud" (details not retrievable, unverified) | encrypted in transit and at rest with HSMs; user-set audio retention (1 day to forever); users must obtain consent | **acquired by Meta 2025-12-05**; hardware sales discontinued; users get a year of support | [TechCrunch](https://techcrunch.com/2025/12/05/meta-acquires-ai-device-startup-limitless/), [Limitless privacy](https://www.limitless.ai/privacy) |
| **Bee** ($49.99 plus $19/mo) | wristband, Apple Watch app | cloud; "audio recordings are not saved, stored, or used for AI training"; derived memories stored | planned on-device processing; consent-based voice capture | **acquired by Amazon, announced July 2025** | [TechCrunch](https://techcrunch.com/2025/07/22/amazon-acquires-bee-the-ai-wearable-that-records-everything-you-say/) |
| **Apple** | iPhone mics | SpeechAnalyzer on device; Apple Intelligence on device; PCC for larger models | PCC: stateless, enforceable guarantees, no privileged access, non-targetable, verifiable transparency | shipping (iOS 26) | [WWDC25](https://developer.apple.com/videos/play/wwdc2025/277/), [PCC](https://security.apple.com/blog/private-cloud-compute/) |
| **Google Pixel** | Pixel mics; Now Playing DSP | Recorder/SODA on device; Gemini Nano on Tensor G5 (Magic Cue, Call Notes, Journal on device); **Private AI Compute** for cloud Gemini | Private Compute Core: AICore package isolation, indirect internet via Private Compute Services, no retention of requests | shipping; Pixel 11 / G6 announced Aug 2026 | [Tensor G5](https://blog.google/products/pixel/tensor-g5-pixel-10/), [Gemini Nano](https://developer.android.com/ai/gemini-nano), [PAC](https://blog.google/technology/ai/google-private-ai-compute/) |
| **Samsung** | Galaxy mics | Galaxy AI transcript assist; an on-device-only processing toggle (unverified) | Knox Vault (unverified) | shipping | see [02](02-agentic-phones-devices.md) |
| **Argmax** (supplier) | — | on-device SDK (iOS, Android on LiteRT) | on-device; licence check once per 30 days (Pro) | seed $8M (2024-11-13) | [Argmax](https://www.argmaxinc.com/blog), [pricing](https://www.argmaxinc.com/pricing) |

**Pattern:** every standalone recorder startup that relied on cloud ASR and cloud LLMs has been acquired or commoditized (Limitless → Meta, Bee → Amazon). Platform owners (Apple, Google) are moving the same features on device, with an attested cloud for overflow. Alpha cannot win on "we transcribe meetings". It can win on **verifiable containment**: on-device capture, pVM isolation, redacted egress and attested inference, plus agent actions with receipts.

---

## 10. Build vs license recommendation

| Component | Recommendation | Why | Fallback or buy option |
|---|---|---|---|
| VAD | **Build** on Silero (MIT) | tiny, proven | sherpa-onnx VAD |
| Streaming ASR (captions, commands) | **Build** on Moonshine (MIT) or streaming Zipformer via sherpa-onnx | small, streaming, permissive | Picovoice Cheetah (accuracy lags) |
| Final ASR (meetings) | **Build** on Parakeet TDT 0.6B v2 (EN) / v3 (25 languages) (CC-BY-4.0, attribution required) | near cloud-API WER at 0.6B | **Argmax Pro SDK Android** ($1–1.33/device/mo) for NPU acceleration; Speechmatics on-device for 55+ languages |
| Diarization | **Build**: Sortformer (≤4 speakers, streaming) plus a pyannote community-1 pass | CC-BY-4.0 | pyannoteAI precision-2 or SpeakerKit licence |
| Redaction | **Build** rules plus GLiNER-PII (Apache-2.0) and our own eval set | core IP and core claim | Private AI or others ([04](04-redaction.md)) for benchmarking only |
| Summarization on device | **Defer** (the MVP defers offline LLM); prototype Gemma/Qwen 1–2B on LiteRT-LM | latency is acceptable only in batch | Gemini Nano via ML Kit on GMS builds, **opportunistically only** |
| TTS | **Build** on Kokoro (Apache-2.0) as the system TTS service | already used on the host | avoid Piper GPL |
| Runtime | sherpa-onnx (ASR, VAD, diarization, TTS) plus LiteRT-LM (LLM); bundled, not from Play services | NNAPI deprecated; de-Googled images | Argmax SDK (LiteRT-based) |
| Isolation | **Build**: a pVM payload in a privileged image | differentiator | isolated process plus SELinux domain (weaker) |
| Cloud inference | Nitro for the agent; add a GPU-CC provider for T2 | Nitro has no GPU | Tinfoil or Privatemode as a hosted attested fallback |

Licence hygiene:
- CC-BY-4.0 (Parakeet, Sortformer, pyannote community-1, Kyutai) requires **attribution**, so add it to the About/licences screen.
- MIT/Apache models need only a notice.
- Gated Hugging Face downloads (pyannote) must be mirrored into the reviewed, digest-pinned asset set, as the repo already does for whisper.cpp.

---

## 11. Six-month engineering roadmap to credible "sensitive data never leaves the device" claims

Starting in October 2026. Each exit gate needs recorded evidence in the acceptance ledger. Do not let one kind of evidence stand in for another: emulator ≠ physical device ≠ user acceptance.

| Month | Focus | Deliverables | Exit gate (evidence) | Claim allowed after gate |
|---|---|---|---|---|
| **M1 (Oct)** | Measurement harness plus first on-device ASR | sherpa-onnx in the native voice plugin; Moonshine Base plus Parakeet v2 int8 behind the existing capability interface; digest-pinned assets; bench of RTF, energy (Battery Historian / ODPM rails), temperature and WER on a 2-hour internal meeting set, on a **physical Pixel 10** | measured RTF/energy table replaces the (est.) cells; Notes transcription works with airplane mode on | "Transcription can run entirely on the phone" (for the qualified device and model only) |
| **M2 (Nov)** | Streaming voice loop plus on-device TTS | Silero VAD endpointing; streaming captions; Kokoro as the in-app TTS service; latency instrumentation from end of speech to first audio (cold/warm, n≥30) | P50/P90 inside the DoD's 6 s with the local path; physical-mic acceptance | "Voice commands work offline" (excluding LLM) |
| **M3 (Dec)** | Redaction plus diarization plus egress gate | rules plus GLiNER-PII; typed pseudonyms and a local vault; policy tiers T0–T3; an egress gate in the native layer (single choke point, receipts); anonymous Sortformer diarization with RAM-only embeddings | recall ≥ target on a labelled transcript set that includes ASR errors; unit tests prove raw PCM and embeddings have no network path | "Only redacted text is sent to the cloud" (for the app build) |
| **M4 (Jan)** | Privileged image plus pVM prototype | a privileged vendor build with a Microdroid payload for VAD, ASR, diarization and redaction; binder-over-vsock API; measured payload digest; Keystore attestation linking | pVM runs on a physical Pixel with custom AVB keys and a relocked bootloader; red-team test with a compromised host app cannot read raw audio | "Raw audio is processed in a hardware-isolated VM" (image build only) |
| **M5 (Feb)** | Always-on mode plus consent UX | duty-cycled always-on (privileged FGS or assistant role); DSP hotword feasibility with the Tensor vendor HAL; a visible recording indicator (never suppressed); geofenced BIPA-safe defaults; all-party-consent prompts; battery and thermal governor | a 7-day dogfood with battery drain within budget (e.g. ≤10%/day of always-on overhead); zero indicator-suppression paths | "Always-on assistant with on-device processing" |
| **M6 (Mar)** | Cloud attestation chain plus external review | GPU-CC inference for T2 (self-hosted H100/H200 CC or Tinfoil/Privatemode); client verifies the enclave plus GPU attestation before egress; public claims document; third-party security review of the pVM, egress gate and redaction | an auditor's report; reproducible build digests published; claims copy reviewed by counsel | "Sensitive data never leaves the device; redacted requests are processed only in attested enclaves" (bounded wording) |

**Staffing (est.):**
- 2 Android/native audio engineers
- 1 ML engineer (quantization and evaluation)
- 1 platform/security engineer (AOSP, pKVM, attestation)
- 0.5 data/eval annotator
- external counsel for BIPA and recording consent

---

## Implications for Alpha Phone

1. **Replace whisper.cpp tiny.en now.** The MVP gap "on-device STT/TTS" can be closed with open, permissively licensed models. Parakeet (6.05 avg WER) and Moonshine run inside the phone app with no paired host. Paired-host ASR should become a fallback route, not the default.
2. **Two product tiers follow from Android policy, not preference:**
   - The **app/launcher build** can offer visible, user-started, foreground capture with on-device ASR.
   - **Always-on, DSP hotword and pVM isolation** require a **privileged signed image** or the assistant role. The current non-privileged add-on cannot deliver them. Roadmap, marketing and pilot contracts should state this.
3. **The strongest differentiator is verifiable containment.**
   - Platform owners give away transcription (Apple SpeechAnalyzer, Pixel Recorder), and independents have been absorbed (Limitless → Meta, Bee → Amazon).
   - What remains is pVM-isolated capture and redaction with attested egress. Google already uses pVMs for Play Protect classifiers, so the approach is platform-sanctioned.
4. **Fix the cloud narrative gap.** Nitro Enclaves cannot host GPU inference. Today's Cerebras path is therefore outside any attested boundary.
   - Either restrict Cerebras to T1 redacted text and say so,
   - or add a GPU-CC inference tier (<7% overhead) running self-hosted Qwen open weights for anything more sensitive, so the model and its provenance file stay the same across tiers.
5. **Avoid hard dependencies on Google AICore/ML Kit GenAI.** They require a locked bootloader and GMS/AICore, run only in the foreground, and are quota-limited. Alpha's own AOSP image ships without GMS, so they are absent there by design. Use them only opportunistically in the app/launcher build on stock Pixels.
6. **Diarize anonymously by default.** Keep embeddings RAM-only and do not enroll third-party voiceprints. This keeps BIPA exposure manageable and doubles as a privacy selling point.
7. **Meetings are an audio problem as much as a model problem.** Even the best models score 11–16% WER on AMI. Plan an accessory-mic program before a custom puck.
8. **Licences are clean if Piper-GPL and NVIDIA Canary 1B (CC-BY-NC) are avoided** and CC-BY attribution is shipped.

## Open questions

1. What are the measured RTF, energy per audio minute and thermal behaviour of Moonshine, Zipformer and Parakeet (CPU vs GPU vs Tensor NPU AOT) on a **physical Pixel 10**? No public numbers were found.
2. Can a privileged vendor app load a custom **Sound Trigger** model on Tensor G5's DSP? Does Google expose this HAL to non-Google images?
3. Is AVF **device assignment** (GPU/NPU into a pVM) available on Pixel 10 or 11? If not, is CPU-only in-VM ASR fast enough for real-time meetings?
4. Which Pixel devices support Android Protected Confirmation, and what is the exact StrongBox (Titan M2) feature set on Pixel 10?
5. Does **Cerebras** have an attestation or TEE roadmap? It publicly states zero data retention; what terms does Alpha have in writing?
6. BIPA: confirm the voiceprint coverage and the effect of the 2024 per-person damages amendment (SB 2979). Get counsel's view on transient, RAM-only diarization embeddings (see [05](05-regulation-compliance.md)).
7. What do Picovoice and Speechmatics charge for on-device licences, and when will Argmax ship SpeakerKit for Android? Get quotes.
8. What is the real always-on overhead on a Pixel 10 (4,970 mAh, 3 microphones with unpublished geometry, 12 GB RAM) against the ≤10%/day target?
9. Should the "Pixel 10-class" target move to Pixel 11 / Tensor G6 for pilot hardware bought in 2027? Pixel 11 shipped 2026-08-20 from $899 (256 GB, 12 GB RAM, 7 years of updates) ([Engadget](https://www.engadget.com/2234844/google-pixel-11-announced-specs-availability/)); reported Tensor G6 claims (TSMC N3P, +50% TPU) are unverified.
10. What multilingual scope does the pilot need? Parakeet v3 covers 25 European languages; Moonshine Voice covers 8, including Arabic, Mandarin, Japanese and Korean.
11. Is a GPU-CC fallback (self-hosted vs Tinfoil/Privatemode) acceptable to government buyers, given hosting location and certification (FedRAMP, BSI C5)? (See [03](03-secure-phones-confidential-ai.md) and [05](05-regulation-compliance.md).)

---

## Sources

- Open ASR Leaderboard paper: https://arxiv.org/abs/2510.06961 and https://arxiv.org/html/2510.06961
- Other model cards: https://huggingface.co/nvidia/canary-1b · https://huggingface.co/microsoft/Phi-4-multimodal-instruct · https://huggingface.co/openai/whisper-large-v3 · https://huggingface.co/ibm-granite/granite-speech-3.3-8b · https://github.com/microsoft/presidio
- Parakeet TDT v2/v3, Canary-Qwen, Sortformer: https://huggingface.co/nvidia/parakeet-tdt-0.6b-v2 · https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3 · https://huggingface.co/nvidia/canary-qwen-2.5b · https://huggingface.co/nvidia/diar_streaming_sortformer_4spk-v2
- Whisper and Distil-Whisper: https://huggingface.co/openai/whisper-large-v3-turbo · https://huggingface.co/distil-whisper/distil-large-v3.5
- Moonshine: https://arxiv.org/abs/2410.15608 · https://huggingface.co/UsefulSensors/moonshine · https://github.com/moonshine-ai/moonshine · https://moonshine-voice.readthedocs.io/en/latest/
- Kyutai: https://huggingface.co/kyutai/stt-1b-en_fr · https://github.com/kyutai-labs/delayed-streams-modeling
- sherpa-onnx: https://github.com/k2-fsa/sherpa-onnx · Vosk: https://alphacephei.com/vosk/models · Silero: https://github.com/snakers4/silero-vad
- Picovoice: https://github.com/Picovoice/speech-to-text-benchmark · https://github.com/Picovoice/leopard · https://picovoice.ai/docs/benchmark/stt/
- Speechmatics: https://www.speechmatics.com/
- Argmax: https://www.argmaxinc.com/blog · https://www.argmaxinc.com/blog/apple-and-argmax · https://www.argmaxinc.com/blog/speakerkit · https://www.argmaxinc.com/pricing · https://app.argmaxinc.com/docs/wiki/supported-platforms
- Cerebras: https://inference-docs.cerebras.ai/models/qwen-3.8-27b · https://support.cerebras.net/articles/1811589793-does-cerebras-retain-my-data
- Pixel hardware: https://en.wikipedia.org/wiki/Pixel_10 · https://www.engadget.com/2234844/google-pixel-11-announced-specs-availability/
- Apple: https://developer.apple.com/videos/play/wwdc2025/277/ · https://security.apple.com/blog/private-cloud-compute/
- Google/Android: https://developer.android.com/reference/android/speech/SpeechRecognizer · https://developers.google.com/ml-kit/genai · https://developers.google.com/ml-kit/genai/speech-recognition/android · https://developer.android.com/ai/gemini-nano · https://research.google/blog/an-all-neural-on-device-speech-recognizer/ · https://arxiv.org/abs/1711.10958 · https://blog.google/products/pixel/tensor-g5-pixel-10/ · https://blog.google/technology/ai/google-private-ai-compute/ · https://en.wikipedia.org/wiki/Google_Tensor
- LiteRT: https://developers.google.com/edge/litert-lm/overview · https://github.com/google-ai-edge/LiteRT-LM · https://developers.google.com/edge/litert/next/npu · https://developers.googleblog.com/en/unlocking-peak-performance-on-qualcomm-npu-with-litert/ · https://huggingface.co/google/gemma-3n-E2B-it-litert-lm · https://developer.android.com/ndk/guides/neuralnetworks/migration-guide
- Android platform: https://developer.android.com/develop/background-work/services/fgs/service-types · https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start · https://source.android.com/docs/core/audio/sound-trigger · https://source.android.com/docs/core/permissions/privacy-indicators · https://source.android.com/docs/core/virtualization · https://source.android.com/docs/core/virtualization/usecases · https://source.android.com/docs/core/virtualization/microdroid · https://developer.android.com/privacy-and-security/keystore · https://developer.android.com/privacy-and-security/security-android-protected-confirmation
- Redaction: https://github.com/urchade/GLiNER · https://huggingface.co/knowledgator/gliner-pii-base-v1.0
- Diarization: https://huggingface.co/pyannote/speaker-diarization-community-1
- TTS: https://huggingface.co/hexgrad/Kokoro-82M · https://github.com/rhasspy/piper · https://github.com/OHF-Voice/piper1-gpl
- Cloud TEEs: https://docs.aws.amazon.com/enclaves/latest/user/nitro-enclave.html · https://developer.nvidia.com/blog/confidential-computing-on-h100-gpus-for-secure-and-trustworthy-ai/ · https://arxiv.org/abs/2409.03992 · https://tinfoil.sh/ · https://www.privatemode.ai/
- Competitors: https://www.plaud.ai/blogs/news · https://www.limitless.ai/privacy · https://techcrunch.com/2025/12/05/meta-acquires-ai-device-startup-limitless/ · https://techcrunch.com/2025/07/22/amazon-acquires-bee-the-ai-wearable-that-records-everything-you-say/
- BIPA: https://en.wikipedia.org/wiki/Biometric_Information_Privacy_Act · statute https://www.ilga.gov/legislation/ilcs/ilcs3.asp?ActID=3004&ChapterID=57
