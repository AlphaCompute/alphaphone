# Alpha Phone market research — manifest

Research date: 2026-09-30. Owner: product/strategy. Status: manifest issued; sections are filled by parallel research workstreams and consolidated in [REPORT.md](REPORT.md).

This is market research, not engineering acceptance. Product capability statements come from the repository's own evidence ledger (`docs/mvp-scope-and-gap-report.md`, `docs/current-acceptance-ledger.md`, `docs/enclave-candidate-validation.md`). Where the product is only planned, the research says so.

## Product baseline used for all workstreams

| Attribute | Current state (from repo) |
| --- | --- |
| Form factor | Android phone UI (Pixel 10 or similar target), in standalone-app and HOME-launcher flavors; an additive, non-privileged AOSP vendor add-on is generated. The full signed image has not been qualified on a physical device. |
| Agent runtime | elizaOS agent, owner-paired. Cloud agent runs in **AWS Nitro Enclaves** with PCR-measured images and attested KMS key release. Inference is Cerebras (`qwen-3.8-27b`). The latest candidate is not yet deployed. |
| Voice | Native capture and playback on the phone. ASR/TTS (whisper.cpp tiny.en, Kokoro) currently run on a paired host. **On-device STT/TTS is an MVP requirement** that is not yet met. |
| Daily tools | Notes, transcription, calendar CRUD, reminders and alarms, browser with a password-provider integration, files, camera and photos, maps handoff, workflows, digests, notifications and inbox. Gmail is recommended. |
| Deferred | Phone, SMS and contacts integration; wallet and payments; offline LLM; Telegram and Discord. |
| Security posture | Android Keystore AES-GCM credential storage, no backup, owner-scoped pairing, explicit approvals and receipts for native actions, and attested enclave inference. There is no redaction pipeline yet: "redaction" is named as a shared upstream contract in ADR-02. |
| Design | Alpha Compute brand: white/black with electric blue #0000FF, Fraunces/Denton serif and Public Sans. The prototype has 14 app modules. |

## Research questions and workstreams

| # | Workstream | Key questions | Output file |
| --- | --- | --- | --- |
| 1 | AI transcription and recorder devices, and meeting-assistant software | Every wearable and pocket recorder (Plaud, Limitless→Meta, Bee→Amazon, Omi, Friend, Sandbar, TicNote, HiDock, Viaim, Soundcore, Pixel Recorder…) and meeting software (Otter, Fireflies, Granola, Fathom, Read.ai, Krisp, Zoom/Teams/Gemini): funding, valuation, revenue, price, how built (models, on-device vs cloud, hardware), privacy posture and failures | `01-transcription-competitors.md` |
| 2 | Agentic phones and AI assistant devices | Rabbit, Humane→HP, OpenAI/io, T Phone AI, Nothing, Brain.ai, Doubao phone, Honor, Samsung/Pixel/Apple AI, Solana Saga/Seeker, Light Phone, Meta glasses: funding, sales, lessons, why they failed or succeeded | `02-agentic-phones-devices.md` |
| 3 | Secure and sovereign phones, and confidential-compute AI | Secure phones (Bittium, Sirin, Katim, Purism, GrapheneOS, Murena, Boeing Black, Samsung Knox/Tactical, Hypori virtual mobile) and confidential AI (Apple PCC, Google Private AI Compute, NVIDIA CC, Opaque, Fortanix, Anjuna, Edgeless, Tinfoil, Confident Security, Phala, Privatemode): funding, customers, architectures | `03-secure-phones-confidential-ai.md` |
| 4 | Redaction and PII/DLP technology, plus a redaction design for Alpha | Competitors (Private AI, Tonic, Presidio, Nightfall, Skyflow, Protecto, Strac, Harmonic, Prompt Security, Lakera, Credal, Veritone Redact…); taxonomy of sensitive data per vertical; techniques that preserve business value (typed pseudonyms, reversible vault tokenization, generalization, FPE, policy tiers, local rehydration); failure modes and evaluation | `04-redaction.md` |
| 5 | Regulation, compliance and certification | Recording-consent law, BIPA, HIPAA, FERPA/COPPA, GLBA, FINRA/SEC recordkeeping (off-channel fines), CJIS, ITAR/EAR, CMMC, FedRAMP, NIAP MDF, CSfC, DISA STIG, FIPS 140-3, EU AI Act/GDPR, UK; costs and timelines; what compliance unlocks | `05-regulation-compliance.md` |
| 6 | Vertical deep-dives | Government and civilian, defense and intelligence, finance, healthcare, legal, education, enterprise exec/office, critical infrastructure, international sovereign: pains, buyers, budgets, procurement, incumbents, fit | `06-vertical-markets.md` |
| 7 | Market sizing | TAM, SAM and SOM, top-down and bottom-up per segment, with assumptions shown | `07-tam-sam-som.md` |
| 8 | Capital: investors, funding comps, M&A | Who funded the comparables, relevant VCs (defense, privacy, AI hardware, crypto/elizaOS-adjacent), strategic and corporate VCs, non-dilutive funding (SBIR, AFWERX, DIU, IQT, ARPA-H, NSF, EU), acquirers and valuation comps | `08-investors-funding-ma.md` |
| 9 | Distribution, partners and unit economics | Carriers, MDM/EMM, VARs/GSA/SEWP/Carahsoft, SIs, OEM/ODMs, EHR/CRM and compliance-archive partners, silicon (Qualcomm/Tensor/MediaTek), Cerebras/AWS, GMS licensing, BOM and pricing models | `09-distribution-partners-economics.md` |
| 10 | Always-on assistant: technical feasibility and competitive tech | On-device ASR, diarization and redaction models (Whisper, Parakeet, Moonshine, Gemini Nano, Apple), NPU capability, battery for always-on capture, wake word, audio hardware, multi-party capture, enterprise deployment | `10-always-on-tech-feasibility.md` |
| 11 | Product fit, opportunity ranking, GTM, risks and blind spots | Score segments against the current feature set, pick a beachhead, pricing and packaging, pilots, positioning, a full risk register, and things the user did not ask about | `11-fit-gtm-risks.md` |

## Checklist of topics the request did not name (all assigned above)

- Recording-consent law (all-party-consent states and the EU) as a gating feature (5, 10)
- Biometric voiceprints under BIPA/CUBI when diarizing speakers (5, 10)
- Bystander privacy and a social-acceptability "recording" indicator (Humane/Friend backlash) (1, 2, 11)
- Recordkeeping *obligations*: finance must *retain*, not only redact. Retention can conflict with redaction (4, 5, 6)
- Legal holds and e-discovery for transcripts; privilege waiver when privileged speech reaches a third party's AI (5, 6)
- Export controls on encryption and AI (EAR 5A002, ITAR if defense-modified) (5, 9)
- Supply chain and origin requirements: TAA, NDAA §889, trusted-foundry style and "China-free" BOMs (3, 5, 9)
- Google GMS/MADA licensing versus de-Googled AOSP. Play Integrity breaks banking apps (9, 11)
- Pixel bootloader and verified-boot custom keys (GrapheneOS model) (3, 9)
- Wake-word patents and speech-model licensing (Whisper MIT, Parakeet CC-BY) (10, 11)
- Brand trust: elizaOS/ai16z crypto association as an asset for some investors and a liability with government buyers (8, 11)
- Insurance and liability for redaction false negatives (4, 11)
- Alternative form factors: a companion pendant or desk puck versus a full phone, and BYOD app versus dedicated device (2, 10, 11)
- Channel conflict with Apple and Google bundling free recorders and summaries (1, 2, 11)
- Hiring and certification capacity (FIPS, CC and FedRAMP take 12–24 months) (5, 11)
- Pricing: hardware-plus-subscription versus seat-based versus enclave-inference metering (9, 11)

## Method and quality bar

- Use web search for 2025–2026 data. Cite a source URL for every number. Mark unverified or estimated figures `(est.)`. Give the date of every funding round.
- Keep facts separate from inference. Flag contradictions between sources.
- Tables are preferred for comparables: company, product, price, funding (total/last round/date/lead), valuation, architecture, privacy posture, status.
- Each file ends with "Implications for Alpha Phone" and "Open questions".
