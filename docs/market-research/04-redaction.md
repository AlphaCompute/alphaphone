# 04 — Redaction and PII/DLP technology, and a redaction design for Alpha Phone

Research date: 2026-09-30. Workstream 4 of the [manifest](00-manifest.md). This is market research and design proposal, not engineering acceptance. Per the repository baseline, Alpha Phone has **no redaction pipeline today**: "redaction" is named as a shared upstream contract in ADR-02 (`docs/architecture.md`), and E5 in `docs/implementation-plan.md` requires "secret redaction before remote transport" and "no passwords/OTP/token values in transcripts, screenshots, model input or logs". Everything in Part C below is proposed, not built.

Conventions: every number carries a source URL. `(est.)` marks analyst estimates or figures derived here. Funding rounds are dated. Vendor accuracy claims are vendor claims unless an independent source is named, and vendors' benchmarks usually favour the vendor.

**Method note.** This workstream ran 30+ web searches and about 40 page fetches. The session's shared search budget ran out before every gap could be closed, so a few items below are marked "not verified in this session". Those items should be checked before anyone quotes them externally.

---

## Executive summary

1. **Detection is commoditising fast.** In April 2026 OpenAI released an Apache-2.0, 1.5B-parameter (50M active) PII tagger that runs locally ([Help Net Security](https://www.helpnetsecurity.com/2026/04/23/openai-privacy-filter-personally-identifiable-information/)). Fastino/GLiNER2-PII (0.3B, Apache-2.0) beats it on the SPY benchmark ([Fastino](https://fastino.ai/blog/gliner2-pii-open-source-privacy-filtering-with-pii-detection)). Commercial engines (Tonic Textual, Limina/Private AI, John Snow Labs) still lead on domain data: roughly 0.94–0.98 recall against 0.70–0.90 for hyperscaler APIs ([Tonic](https://www.tonic.ai/ai-model-benchmarks/textual-benchmark), [Limina](https://www.getlimina.ai/en/research/pii-benchmark-report), [JSL](https://www.johnsnowlabs.com/clinical-de-identification-benchmarks-2026-john-snow-labs-against-openai-databricks-presidio-and-llm-apis/)).
2. **Open models are brittle outside their training distribution.** OpenAI Privacy Filter scores F1 0.04 on Arabic and 0.03 on Cyrillic, 0.40 on person names, and 0.55 on clinical notes ([arXiv 2608.02616](https://arxiv.org/abs/2608.02616), [JSL](https://www.johnsnowlabs.com/clinical-de-identification-benchmarks-2026-john-snow-labs-against-openai-databricks-presidio-and-llm-apis/)). Human annotators agree on only 47.7% of *contextual* redactions ([RedactionBench, arXiv 2606.18782](https://arxiv.org/abs/2606.18782)).
3. **No single technique is enough.** One systematic study found NER-only redaction still leaked 15.3% of PII, while combining local routing, redaction and rephrasing cut that to 0.6%. Implicit identity (who someone is from context) still leaked 43.6% ([LLM-Redactor, arXiv 2604.12064](https://arxiv.org/html/2604.12064v1)).
4. **The market has moved from "PII redaction" to "AI data security", and incumbents bought in at $180M–$500M per startup during 2025–26.** Examples: Protect AI to Palo Alto Networks for $500M, Aim to Cato for $300–350M, Lakera to Check Point for about $300M, Prompt Security to SentinelOne for a reported $250–300M, CalypsoAI to F5 for about $180M, and Securiti to Veeam for $1.725B (sources in §A.3). All of these are **network, browser or SaaS gateways**. None of them redacts *speech on the capture device* before the audio or transcript leaves it.
5. **Alpha's opening is structural.** Alpha can put the detector, vault and policy engine *on the device that hears the conversation*. It pairs them with an attested enclave (already part of the design) and rehydrates responses locally. The "business value" problem is solved with **typed, role-annotated, session-stable pseudonyms plus local rehydration**, not blanket masking.

---

## Part A — Competitive landscape

### A.1 Commercial redaction, de-identification and DLP vendors

| Company / product | What it does | How it is built | Funding (dated) | Price (public) | Accuracy claims | Deployment / privacy posture | Status |
|---|---|---|---|---|---|---|---|
| **Limina** (formerly **Private AI**), Toronto | Detects, redacts and replaces PII in text, PDFs, documents, transcripts and LLM prompts | Proprietary transformer NER. Claims 50+ entity types in 49+ languages ([Limina](https://www.getlimina.ai/en/blog/wef-pai)) | $8M Series A, **Dec 2022**, led by BDC Capital with M12, Differential and others ([Differential](https://www.differential.vc/news/perfecting-privacy-private-ai)). No later round found. | API with free test keys. Enterprise pricing not public ([Limina](https://www.getlimina.ai/en/blog/wef-pai)) | Vendor benchmark, **Apr 2026**, on ai4privacy-500k: precision 0.940, recall 0.939, F1 0.938, against AWS Comprehend recall 0.698. Claims coverage of all 18 HIPAA identifiers, an Armilla accuracy audit of "99.5%+", and a 99.96% HIPAA Expert Determination ([Limina](https://www.getlimina.ai/en/research/pii-benchmark-report)) | Runs in the customer's own environment, so data does not go to a third-party processor ([Differential](https://www.differential.vc/news/perfecting-privacy-private-ai)) | Independent. The most direct "embeddable privacy layer" competitor and a possible OEM partner. |
| **Tonic.ai — Textual** (plus Structural and Fabricate) | De-identification and synthesis of unstructured text | Proprietary NER models; the unit also does synthetic replacement | About $45M total. $35M Series B in **2021** led by Insight Partners; $8M Series A in **2020** ([Tonic about](https://www.tonic.ai/about); [Tracxn/search summary](https://tracxn.com/d/companies/tonicai/__aH4sk1uBlJJqPKKpDrBUg4A62BmZKPwLerMcy3ZPhMs)) | Textual is billed per word, sublinearly. About $20k–35k/yr for moderate volume (est., per [Vendr](https://www.vendr.com/marketplace/tonicai)) | Vendor benchmark, **Oct 2025**: F1 0.96, P 0.97, R 0.96 aggregate. On call transcripts, F1 0.93 and R 0.94 ([Tonic](https://www.tonic.ai/ai-model-benchmarks/textual-benchmark)) | SaaS or self-hosted. GA on Microsoft Fabric, Mar 2026 ([search summary citing Tonic](https://www.tonic.ai/about)) | Independent, "hundreds of customers" ([Tonic](https://www.tonic.ai/about)). Its call-transcript domain matters for Alpha. |
| **Microsoft Presidio** (OSS) | Analyzer, anonymizer, image and DICOM redactor, structured-data module | Regex, checksums, spaCy/transformer NER and context words, all pluggable. Operators: replace, mask, hash, encrypt ([GitHub](https://github.com/microsoft/presidio)) | Open source, MIT, about 11.1k GitHub stars. Moved to the "Data Privacy Stack" organisation ([GitHub](https://github.com/microsoft/presidio)) | Free | Its own README says there is "no guarantee that Presidio will find all sensitive information" ([GitHub](https://github.com/microsoft/presidio)). Independent results: recall 0.707 and precision 0.761 on TAB ([arXiv 2202.00443](https://arxiv.org/pdf/2202.00443)); F1 0.1385 on PIIBench ([arXiv 2604.15776](https://arxiv.org/pdf/2604.15776)); 0.60–0.85 F1 on clinical text ([JSL](https://www.johnsnowlabs.com/clinical-de-identification-benchmarks-2026-john-snow-labs-against-openai-databricks-presidio-and-llm-apis/)); F1 0.57 in Tonic's benchmark ([Tonic](https://www.tonic.ai/ai-model-benchmarks/textual-benchmark)) | Fully local | The de facto framework. Use it as the *orchestration and operator layer*, not as the detector. |
| **Google Cloud Sensitive Data Protection** (formerly Cloud DLP) | Inspection, de-identification (masking, FPE, date shifting, k-anonymity risk analysis) | Hosted infoType detectors | n/a (Google) | Storage inspection: first 1 GiB free, then $1.00/GiB. Hybrid content inspection: $3.00/GiB. Discovery profiling: $0.03/GB ([Google pricing](https://cloud.google.com/sensitive-data-protection/pricing), per search summary) | F1 0.61, recall 0.64 in Tonic's benchmark ([Tonic](https://www.tonic.ai/ai-model-benchmarks/textual-benchmark)). GCP Healthcare API micro-F1 0.64 on i2b2 ([JSL](https://www.johnsnowlabs.com/clinical-de-identification-benchmarks-2026-john-snow-labs-against-openai-databricks-presidio-and-llm-apis/)) | Cloud only, so data must leave the device | A reference design for transformations such as crypto-deterministic tokens, FPE and bucketing. |
| **AWS Comprehend PII / Comprehend Medical / Macie** | Comprehend detects PII in text. Macie discovers sensitive data in S3. | Hosted models | n/a (AWS) | Comprehend PII: $0.0001 per 100-character unit for the first 10M units ([CloudZero](https://www.cloudzero.com/blog/amazon-comprehend-pricing/)). Macie: $1.00/GB for the first 50 TB/month ([Vantage](https://handbook.vantage.sh/aws/services/macie-pricing/)) | Comprehend: F1 0.88, R 0.90 (Tonic, [link](https://www.tonic.ai/ai-model-benchmarks/textual-benchmark)) but recall 0.698 in Limina's test ([Limina](https://www.getlimina.ai/en/research/pii-benchmark-report)). **The two vendor benchmarks contradict each other.** Comprehend Medical micro-F1 0.96 on i2b2 ([JSL](https://www.johnsnowlabs.com/clinical-de-identification-benchmarks-2026-john-snow-labs-against-openai-databricks-presidio-and-llm-apis/)) | Cloud. Relevant because Alpha's enclave runs on AWS: Comprehend could be a *second-pass* checker inside the same account boundary, though not inside the enclave. | — |
| **Nightfall AI** | Cloud and SaaS DLP. Watches prompts to ChatGPT, Claude, Copilot and others. "Nyx" autonomous DLP agent launched **30 Jul 2025** | LLM plus computer-vision classifiers, plus data lineage ([VentureBeat](https://venturebeat.com/ai/nightfall-launches-nyx-an-ai-that-automates-data-loss-prevention-at-enterprise-scale)) | $40M Series B, **10 Aug 2022**, led by WestBridge; about $60–65M total ([Nightfall](https://www.nightfall.ai/blog/nightfall-ai-raises-40-million-series-b-to-expand-cloud-data-protection-platform); [TechCrunch](https://techcrunch.com/2022/08/10/nightfall-raises-cash-for-its-ai-that-detects-sensitive-data-across-apps/)) | Not public | CEO claims "90, 95%" accuracy against 10–20% for legacy DLP, and false alerts cut from about 80% to 5% ([VentureBeat](https://venturebeat.com/ai/nightfall-launches-nyx-an-ai-that-automates-data-loss-prevention-at-enterprise-scale)) | SaaS | Independent. Serves "many hundreds" of enterprises. |
| **Skyflow** — Data Privacy Vault / LLM Privacy Vault | Isolates sensitive data in a vault. Detokenises for authorised uses, including restoring LLM outputs. | Tokenization plus "polymorphic encryption", with a global network of regional vaults ([Skyflow](https://www.skyflow.com/product/llm-privacy-vault); [Finovate](https://finovate.com/data-privacy-vault-skyflow-secures-30-million-in-new-funding/)) | $45M Series B, **19 Oct 2021** ([BusinessWire](https://www.businesswire.com/news/home/20211019005320/en/Data-Privacy-API-Company-Skyflow-Raises-$45M-Series-B-Funding-to-Help-Fintech-and-Healthtech-Companies-Ship-Faster)). $30M Series B extension, **23 Apr 2024**, led by Khosla. $100M total equity ([Finovate](https://finovate.com/data-privacy-vault-skyflow-secures-30-million-in-new-funding/)) | Not public | Not a detection-accuracy vendor. Claims about 1B records and more than 2B API calls per quarter ([Finovate](https://finovate.com/data-privacy-vault-skyflow-secures-30-million-in-new-funding/)) | Cloud vault, with data-residency regions | The **closest architectural analogue** to Alpha's proposed vault, except Skyflow's vault is in the cloud and Alpha's would be on the device. |
| **Protecto** | "AI data control plane". Masks PII and PHI with format- and context-preserving tokens for LLMs, agents and MCP | Its own NER plus tokenization and context-based access control ([Protecto](https://www.protecto.ai/)) | Funding not found in this session | Not public | Vendor claims "99.9%" PII/PHI detection ([Protecto](https://www.protecto.ai/)). Its benchmark shows higher precision than Comprehend and Presidio, with recall "largely comparable" ([Protecto PDF](https://protecto.ai/wp-content/uploads/2024/07/6646f1564c513545cbf9d2f9_Quantitative-Benchmark-Study-PII-Identification-1.pdf)) | SaaS or VPC. Sells "Sovereign AI for banks" ([Protecto](https://www.protecto.ai/industry/sovereign-ai-for-banks/)) | Independent |
| **Strac** | DSPM plus DLP across SaaS, GenAI, endpoints and MCP. Redacts PII, PHI and PCI inline. | Proprietary ML detectors | About $4M seed (YC, FUSE) ([Crunchbase via search](https://www.crunchbase.com/organization/strac-e784)). About 12 employees as of Jun 2026 ([Tracxn via search](https://tracxn.com/d/companies/strac/__-umEOvBgD8FHLYGr3Z585mqFCHoR96-FS2u1-AJp-AM)) | Custom quote scoped by surfaces and seats ([Strac](https://www.strac.io/pricing)) | — | SaaS | Small |
| **Harmonic Security** | Governs "shadow AI". Classifies what employees paste into GenAI tools. | Pre-trained specialised small language models ([VentureBeat](https://venturebeat.com/business/harmonic-security-raises-17-5-million-series-a-to-accelerate-zero-touch-data-protection-to-market)). Browser extension plus endpoint deployment through Intune, JAMF and others ([Harmonic](https://www.harmonic.security/)) | $17.5M Series A, **2 Oct 2024**, led by Next47; more than $26M total ([VentureBeat](https://venturebeat.com/business/harmonic-security-raises-17-5-million-series-a-to-accelerate-zero-touch-data-protection-to-market)). A 2025–26 round was not verified. | Not public | No public accuracy numbers | Endpoint and browser | Independent; a likely acquisition target. |
| **Credal** | Governed gateway for enterprise agents and MCP. Permission-aware context, audit, human approvals | Connectors (1,000+) and permission sync ([Credal](https://www.credal.ai/)) | $4.8M seed, **Oct 2023**, led by Spark Capital ([SaaS News](https://www.thesaasnews.com/news/credal-ai-raises-4-8-million-in-seed-round/)). Crunchbase lists a Series A with an undisclosed amount ([Crunchbase](https://www.crunchbase.com/organization/credal-ai)). | Not public | Claims "−87% context per query" ([Credal](https://www.credal.ai/)) | SaaS | Shows that *minimising context* is a DLP control in its own right. |
| **Liminal** (Liminal AI, GenAI data security) | Secure GenAI workspace for regulated industries, with sensitive-data protection | Model-agnostic gateway | Additional $5M seed ([Pulse 2.0](https://pulse2.com/liminal-gen-ai-data-security-company-raises-5-million-in-additional-funding/); date not confirmed). Tracxn and CB Insights list a Seed II of $4M on **13 Nov 2025** ([Tracxn](https://tracxn.com/d/companies/liminal/__nqdi5JHfSJTo3oqZEGAMkSCZsmWM2hQZyj3yQKHz9BM)). **Caution:** an unrelated market-intelligence "Liminal" raised an $8.5M Series A in Apr 2025 ([liminal.co](https://liminal.co/articles/series-a-funding-liminal-intelligence-platform/)), and the two are often mixed up. | Not public | — | SaaS | Small |
| **Veritone Redact** | Redaction of video, audio and documents for law-enforcement evidence and FOIA | Face, plate and object detection, plus transcription and keyword-based audio redaction | Veritone is public (NASDAQ: VERI) | From $100 per hour of media, falling with volume ([Police Magazine](https://www.policemag.com/articles/artificial-intelligence-and-faster-digital-evidence-redaction)). About $9,522/yr for 100 hours (about $95/hr) ([GetApp/search summary](https://www.getapp.com/legal-law-software/a/veritone-redact/)). Manual redaction costs $250–500/hr ([Police Magazine](https://www.policemag.com/articles/artificial-intelligence-and-faster-digital-evidence-redaction)) | — | Cloud (AWS/Azure Gov) | A public-sector audio-redaction benchmark for pricing |
| **CaseGuard Studio** | Redaction of documents, images, video and audio, with transcription and translation | Desktop and on-prem AI | Private; funding not found | $279, $299 and $379 per user per month (Doc, Media and Ultimate suites) ([Capterra via search](https://www.capterra.com/p/10030197/CaseGuard)) | — | Runs locally, which is a selling point for police and courts | — |
| **Pimloc — Secure Redact** (UK) | Irreversible anonymisation of faces, plates, on-screen text and audio entities | Vision and speech models. Audio redaction added **Apr 2025** ([Wikipedia](https://en.wikipedia.org/wiki/Pimloc)) | About $1.8M seed, **Oct 2020**; about $7.5M extension, **Jan 2022**; $5M, **Jul 2025** ([Wikipedia](https://en.wikipedia.org/wiki/Pimloc)) | Not public | — | Cloud | Pilot with Sussex Police ([Wikipedia](https://en.wikipedia.org/wiki/Pimloc)) |
| **John Snow Labs — Healthcare NLP de-identification** | Clinical de-identification (PHI) | Domain NER plus rules | Private | Licensed | Vendor benchmark, **27 Aug 2026**: PHI F1 0.96 on expert-annotated notes and micro-F1 0.98 on i2b2 2014. Prompted frontier LLMs score 0.86–0.91 ([JSL](https://www.johnsnowlabs.com/clinical-de-identification-benchmarks-2026-john-snow-labs-against-openai-databricks-presidio-and-llm-apis/)) | On-prem | The accuracy bar for any clinical use of Alpha |
| **Pangiam** | *Not a redaction vendor.* Face biometrics and vision for travel and security screening. Reportedly acquired by BigBear.ai (all-stock, announced late 2023). **Not verified in this session.** | — | — | — | — | — | Relevant only for the biometric taxonomy (§B). Listed because the brief named it. |

**Synthetic-data vendors** matter for *training and evaluating* Alpha's detectors, not for runtime redaction:

| Company | Status | Funding / price | Source |
|---|---|---|---|
| **Gretel** | Acquired by **NVIDIA, reported 19 Mar 2025**. The price was "nine figures", said to exceed Gretel's last valuation of $320M. Gretel had raised more than $67M from Anthos, Greylock and Moonshots, and had about 80 staff. | — | [TechCrunch](https://techcrunch.com/2025/03/19/nvidia-reportedly-acquires-synthetic-data-startup-gretel/), [SiliconANGLE](https://siliconangle.com/2025/03/19/nvidia-reportedly-acquires-gretel-320m-strengthen-ai-training-tools/) |
| **Hazy** | SAS acquired Hazy's *principal software assets* on **12 Nov 2024** for an undisclosed sum, folding them into SAS Data Maker | — | [SAS](https://www.sas.com/en_us/news/press-releases/2024/november/hazy-syntheticdata.html) |
| **MOSTLY AI** | $25M Series B, **11 Jan 2022**, led by Molten Ventures. Open-source synthetic-data SDK with differential-privacy options released **23 Jan 2025**. The site is now branded "MOSTLY AI powered by Syntho", and the nature of that relationship could not be confirmed. | $25M Series B | [MOSTLY AI](https://mostly.ai/news/mostly-ai-raises-25m-to-bring-synthetic-data-to-every-enterprise), [BigDATAwire](https://www.hpcwire.com/bigdatawire/this-just-in/mostly-ai-unveils-open-source-toolkit-for-synthetic-data-generation/) |

### A.2 Open-source detection models and datasets

| Model / dataset | Size / licence | Coverage | Reported accuracy | Caveats | Source |
|---|---|---|---|---|---|
| **OpenAI Privacy Filter** (released **22 Apr 2026**) | 1.5B total parameters, about 50M active (sparse MoE, 128 experts, top-4). Bidirectional token classifier derived from gpt-oss. Apache-2.0. 128k context. | 8 labels: private person, email, phone, address, URL, date, account number, secret | F1 96.0% (P 94.04, R 98.04) on PII-Masking-300k. F1 97.43% on the corrected set. | Fixed labels, not zero-shot. OpenAI itself says it "may miss uncommon identifiers or ambiguous references". Independent results: F1 0.855 on AI4Privacy but 0.464 on SPY-medical, 0.04 on Arabic and 0.03 on Cyrillic; names 0.40, addresses 0.49; precision 0.31–0.54 across domains. Clinical F1 0.55. Covers only 8 of the 18 HIPAA identifiers. | [Help Net Security](https://www.helpnetsecurity.com/2026/04/23/openai-privacy-filter-personally-identifiable-information/), [Grepture](https://grepture.com/blog/openai-privacy-filter-pii-redaction), [arXiv 2608.02616](https://arxiv.org/abs/2608.02616), [JSL](https://www.johnsnowlabs.com/clinical-de-identification-benchmarks-2026-john-snow-labs-against-openai-databricks-presidio-and-llm-apis/), [Limina](https://www.getlimina.ai/en/research/pii-benchmark-report) |
| **GLiNER2-PII** (Fastino; Zaratiana et al., May 2026) | 0.3B, multilingual, Apache-2.0 | 42 entity types at character-span resolution | SPY average F1 **0.471**, against 0.391 for NVIDIA GLiNER-PII, 0.384 for urchade, 0.373 for OpenAI PF and 0.368 for knowledgator. Recall 0.722 on legal and 0.681 on medical text. | SPY is a hard benchmark, so absolute scores are low for every system | [arXiv 2605.09973](https://arxiv.org/abs/2605.09973), [Fastino](https://fastino.ai/blog/gliner2-pii-open-source-privacy-filtering-with-pii-detection) |
| **knowledgator gliner-pii** (edge, small, base, large) | Apache-2.0. ONNX base is 330 MB at FP16 and 197 MB at UINT8. | 60+ types, zero-shot labels | Base F1 80.99 (P 79.28 / R 82.78). Edge F1 75.50 (R 72.34). Large F1 83.25. | The Rust runtime is about 4× faster than Python on CPU | [HF card](https://huggingface.co/knowledgator/gliner-pii-base-v1.0) |
| **NVIDIA GLiNER-PII** | Open | 55+ types, including PHI | F1 about 0.81 | — | [Grepture](https://grepture.com/blog/best-open-source-models-pii-redaction) |
| **Piiranha-v1** | mDeBERTa-v3-base, about 0.3B, **CC-BY-NC-ND-4.0 (non-commercial)** | 17 types in 6 languages, 256-token context | Token accuracy 99.44%, P 98.48%, R 98.27% | The non-commercial licence rules it out for Alpha | [HF card](https://huggingface.co/iiiorg/piiranha-v1-detect-personal-information) |
| **DeBERTa fine-tuned on ai4privacy-300k** | — | 54 classes | F1 0.9757 | In-distribution synthetic data | [Grepture](https://grepture.com/blog/best-open-source-models-pii-redaction) |
| **StarPII** | — | 6 classes aimed at code (keys, passwords, IPs) | — | Useful for the "secrets" class | [Grepture](https://grepture.com/blog/best-open-source-models-pii-redaction) |
| **ai4privacy datasets** | pii-masking-400k (407k rows; EN, FR, DE). open-pii-masking-500k (580k rows; 8 languages including Hindi and Telugu). A financial PFI-400k set also exists. | — | — | Synthetic, so scores on it overstate real-world performance | [HF 400k](https://huggingface.co/datasets/ai4privacy/pii-masking-400k), [HF 500k](https://huggingface.co/datasets/ai4privacy/open-pii-masking-500k-ai4privacy), [PFI](https://huggingface.co/datasets/ai4privacy/pii-masking-financial-pfi-400k) |
| **Benchmarks to adopt** | TAB (ECHR court cases) [arXiv 2202.00443](https://arxiv.org/pdf/2202.00443); PIIBench [arXiv 2604.15776](https://arxiv.org/pdf/2604.15776); SPY [arXiv 2605.09973](https://arxiv.org/abs/2605.09973); RedactionBench (35 models, R-Score) [arXiv 2606.18782](https://arxiv.org/abs/2606.18782); out-of-distribution stress test [arXiv 2609.03464](https://arxiv.org/abs/2609.03464); i2b2 2014 (clinical) | | | | |

**Takeaway.** Every open model is trained on written, well-formatted, mostly synthetic English text. Alpha's input is *spoken* text after ASR: no capitals, spelled-out numbers, disfluencies and mis-heard names. That shift is exactly what the out-of-distribution stress test shows breaks all three detector families (encoder NER, rule-based and LLM), each in a different way ([arXiv 2609.03464](https://arxiv.org/abs/2609.03464)). Alpha will have to fine-tune on its own spoken-domain corpus. §C.7 describes how.

### A.3 Voice and audio redaction (speech APIs)

| Vendor | Text redaction | Audio redaction | Entities / languages | Price | Source |
|---|---|---|---|---|---|
| **Deepgram** | Yes. Tags like `[CREDIT_CARD_1]` and `[NAME_1]`, with **consistent indices for repeated values**. Groups: `pci`, `pii`, `phi`, `numbers`, `aggressive_numbers`. | Not described in the docs | 50+ entity types. **Entity redaction is English-only.** Number redaction works in all languages for pre-recorded audio and in 12 languages for Nova streaming. The Flux streaming model only replaces digits with `*`. | Add-on at $0.0020/min pay-as-you-go and $0.0017/min on Growth | [Deepgram docs](https://developers.deepgram.com/docs/redaction), [pricing](https://deepgram.com/pricing) |
| **AssemblyAI** | Yes. Modes are `hash` (####) and `entity_name` ([PERSON_NAME]). | Yes: beep (default) or silence. Output is MP3 or WAV. URLs expire after 24h. Files up to 1 GB. | 50+ policies, including money_amount, occupation, organization, medical_condition and political_affiliation. 50 languages. **Caveat:** only the `text` field is redacted, so other features such as summaries or entities "may still include PII". | PII audio redaction $0.05/hr; text redaction $0.12/hr for realtime | [AssemblyAI docs](https://www.assemblyai.com/docs/pii-redaction), [pricing](https://www.assemblyai.com/pricing) |
| **Speechmatics** | No native PII redaction. Offers "word replacement" to mask terms, plus entity output (14 classes including credit cards, phone numbers and currency). | No | Smart number formatting in 13+ languages | — | [Speechmatics docs](https://docs.speechmatics.com/speech-to-text/formatting) |
| **Azure AI Language — conversation PII** | Yes, redacts conversation transcripts and can return audio timing offsets | Via offsets | — | — | [Microsoft Learn](https://learn.microsoft.com/en-us/azure/ai-services/language-service/personally-identifiable-information/how-to/redact-conversation-pii) |
| **Pimloc, Veritone, CaseGuard** | See §A.1 | Yes (bleep) | — | See §A.1 | — |

**Lessons for Alpha.** (1) Deepgram's *stable indexed tags* ([NAME_1] reused) validate the typed-consistent-pseudonym approach. (2) AssemblyAI's caveat that redaction covers only the transcript and not derived artefacts is a classic leak path. Alpha must redact at the *egress boundary*, not per feature. (3) Every one of these vendors needs the **raw audio in its cloud** before it can redact. That is the gap Alpha fills. (4) Patents already exist in this space, for example US 12229313 ("analyzing speech data to remove sensitive data") and US 12189817 ("personal information redaction and voice de-identification") ([USPTO 12229313](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12229313), [USPTO 12189817](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12189817)). A freedom-to-operate review is required.

### A.4 The M&A wave in AI data security, 2024–2026

| Date (announced) | Target | Acquirer | Price | Target funding | What was bought | Source |
|---|---|---|---|---|---|---|
| 12 Nov 2024 | Hazy (software assets) | SAS | Undisclosed | — | Synthetic data | [SAS](https://www.sas.com/en_us/news/press-releases/2024/november/hazy-syntheticdata.html) |
| 19 Mar 2025 | Gretel | NVIDIA | "Nine figures", reported above the $320M last valuation | More than $67M | Synthetic and privacy-preserving data | [TechCrunch](https://techcrunch.com/2025/03/19/nvidia-reportedly-acquires-synthetic-data-startup-gretel/) |
| Mar 2025 | LeakSignal | F5 | Undisclosed | — | Real-time data classification for AI traffic | [Wikipedia: F5](https://en.wikipedia.org/wiki/F5,_Inc.) |
| Jul 2025 | Protect AI | Palo Alto Networks | $500M | — | AI model and supply-chain security | [Wikipedia: PANW](https://en.wikipedia.org/wiki/Palo_Alto_Networks) |
| 5 Aug 2025 (closed 5 Sep 2025) | Prompt Security | SentinelOne | Reported at $250–300M. **Contradiction:** SEC filings show about $133.6M cash, plus 1,555,099 shares and 415,109 assumed options. Total about $160–170M (est.) at a share price of about $17–20 (est.). | $5M seed (Jan 2024) plus $18M Series A (Nov 2024), about $23M | GenAI usage control, including **sanitising sensitive data from prompts** | [SiliconANGLE](https://siliconangle.com/2025/08/05/sentinelone-acquires-ai-security-startup-prompt-security/), [SEC 8-K](https://www.sec.gov/Archives/edgar/data/1583708/000110465925088079/tm2525181d1_8k.htm), [SEC 10-Q](https://www.sec.gov/Archives/edgar/data/1583708/000158370825000159/s-20251031.htm), [Wikipedia](https://en.wikipedia.org/wiki/Prompt_Security) |
| 3 Sep 2025 | Aim Security | Cato Networks | $300–350M in cash and shares (reported) | About $28M (Canaan, YL Ventures) | Shadow-AI governance and AI agents inside SASE. Cato had raised $359M at a $4.8B valuation in Jun 2025. | [Calcalist](https://www.calcalistech.com/ctechnews/article/7pzhe3mrd), [SiliconANGLE](https://siliconangle.com/2025/09/03/cato-networks-acquires-aim-security-expand-ai-security-capabilities/) |
| Sep 2025 (closed 22 Oct 2025) | Lakera | Check Point | About $300M (reported) | — | Prompt-injection and data-leak runtime guard (Lakera Guard) and red-teaming | [SecurityWeek](https://www.securityweek.com/check-point-to-acquire-ai-security-firm-lakera/), [Calcalist](https://www.calcalistech.com/ctechnews/article/rj5bc1vige), [MarketScreener](https://www.marketscreener.com/news/check-point-software-technologies-ltd-completed-the-acquisition-of-lakera-ai-ag-ce7d5dd2dc80f22d) |
| Sep 2025 | Pangea | CrowdStrike | Price not verified in this session | — | AI guardrails, including redaction APIs | [SecurityWeek](https://www.securityweek.com/check-point-to-acquire-ai-security-firm-lakera/) (reported alongside Lakera) |
| Sep 2025 (closed 29 Sep 2025) | CalypsoAI | F5 | About $180M | — | Runtime AI guardrails | [Wikipedia: F5](https://en.wikipedia.org/wiki/F5,_Inc.) |
| Oct 2025 | Securiti AI | Veeam | $1.725B in cash and stock | — | DSPM plus AI data governance | [Wikipedia: Veeam](https://en.wikipedia.org/wiki/Veeam) |
| Jan 2026 | Seraphic Security | CrowdStrike | $420M | — | Browser runtime security, the enforcement point for GenAI data egress | [Wikipedia: CrowdStrike](https://en.wikipedia.org/wiki/CrowdStrike) |
| Feb 2026 | Koi Security | Palo Alto Networks | About $400M | — | Extension and agent supply-chain security | [Wikipedia: PANW](https://en.wikipedia.org/wiki/Palo_Alto_Networks) |
| Apr 2026 | Portkey | Palo Alto Networks | Agreement announced; price not stated | — | AI gateway | [Wikipedia: PANW](https://en.wikipedia.org/wiki/Palo_Alto_Networks) |

**Pattern.** Platform security vendors (SASE, EDR, firewall, backup) each bought a GenAI data-control startup in a single 90-day window, August to October 2025. Prices ran about $180–500M for companies that had raised $20–70M: more than 10× capital raised for Prompt Security, per [SiliconANGLE](https://siliconangle.com/2025/08/05/sentinelone-acquires-ai-security-startup-prompt-security/). The acquired products sit at the **network, browser or API layer** and inspect text *after* a human types it. **None of them sit at the microphone.** This suggests two things:

- A buyer universe exists for "AI data control at the edge": PANW, CrowdStrike, Check Point, SentinelOne, Cato, Zscaler, F5, Veeam and NVIDIA.
- Endpoint-native, speech-first redaction is still unclaimed.

This is inference, not evidence of acquirer demand for a phone.

---

## Part B — Taxonomy of what must not leave the device

Alpha needs two orthogonal axes:

- **Axis 1, identifiability:** can this identify a person? (PII, PHI, biometrics and similar.)
- **Axis 2, confidentiality:** is this information the organisation must not disclose, even with no person in it? Examples are deal terms, MNPI, privilege, CUI and source code.

Most DLP products model Axis 1 well and Axis 2 poorly. Alpha's buyers (finance, legal, government and executives) care about Axis 2 *more*.

### B.1 Regulated personal data (Axis 1)

| Class | Definition / examples | Legal anchor | Detection difficulty in speech |
|---|---|---|---|
| **PHI — HIPAA Safe Harbor's 18 identifiers** | (1) names; (2) geographic subdivisions smaller than a state, where the first 3 ZIP digits may be kept only if that 3-digit area has more than 20,000 people; (3) all date elements except year, and ages over 89 (aggregate to "90 or older"); (4) phone; (5) fax; (6) email; (7) SSN; (8) medical record number; (9) health-plan beneficiary number; (10) account number; (11) certificate or licence number; (12) vehicle identifiers; (13) device identifiers and serials; (14) URLs; (15) IP addresses; (16) biometric identifiers, **including voiceprints**; (17) full-face photos; (18) any other unique identifying number or code. There must also be no "actual knowledge" that the remainder could identify the person. The Expert Determination route is the alternative. | [45 CFR 164.514(b)](https://www.law.cornell.edu/cfr/text/45/164.514) | Dates and ages are spoken relatively ("last Tuesday", "she's ninety-one"). MRNs are spoken digit by digit. Note that **the raw audio is itself PHI**, because the voice is identifier (16). |
| **PCI — cardholder data** | PAN, expiry, CVV and cardholder name. PAN checksums with Luhn. | PCI DSS (see workstream 5) | Spoken in groups ("four one one one…"). Streaming ASR splits the digits across partial results. Deepgram's `pci` group is a reference. |
| **PII / SPI** | Direct identifiers (name, SSN, passport, driver's licence). Sensitive PI under CPRA/GDPR Art. 9: health, sex life and orientation, religion, politics, union membership, racial or ethnic origin, precise geolocation, immigration status. | GDPR Art. 9; CPRA (workstream 5) | Many SPI mentions are *attributes*, not entities ("he's in recovery"), so NER misses them and classifiers are needed. |
| **Student records** | Education records "directly related to a student" and maintained by the institution. Directory information (name, address, date of birth, major, dates of attendance…) can be released unless the family opts out. | [20 U.S.C. 1232g](https://www.law.cornell.edu/uscode/text/20/1232g) | Meetings where a teacher or counsellor discusses a named student. |
| **Children** | Any data about minors, especially under 13 (COPPA) | Workstream 5 | Age inference from voice is a biometric-adjacent risk, so do not do it. |
| **Biometrics and voiceprints** | Speaker embeddings used for diarization or identification | HIPAA identifier (16) ([45 CFR 164.514](https://www.law.cornell.edu/cfr/text/45/164.514)); BIPA and CUBI (workstream 5) | *Alpha's own diarization creates this class.* The embeddings must never leave the device. Prefer session-ephemeral clustering to persistent enrolment of third parties. |
| **Location** | Addresses, precise coordinates, "I'm at the Marriott on 5th" | HIPAA (2); CPRA precise geolocation | Also hidden in phone metadata. Strip EXIF and GPS from anything that leaves the device. |
| **Third-party and bystander speech** | Voices and content from people who did not consent (café neighbours, the other party on speakerphone) | All-party-consent states (workstream 5) | Detected by diarization plus a "non-participant" classifier (far-field, low SNR, off-topic). The default is **drop, don't redact**. |

### B.2 Confidential business information (Axis 2): "should not leave the device"

| Class | Examples | Anchor | Why NER fails |
|---|---|---|---|
| **MNPI / insider information** | Unannounced earnings, M&A, guidance, a regulator's decision, an unsigned financing | Trading while "aware of" MNPI breaches Rule 10b5-1 ([17 CFR 240.10b5-1](https://www.law.cornell.edu/cfr/text/17/240.10b5-1)) | MNPI is a *proposition* ("we're going to miss Q3 by 8%"), not an entity. Materiality depends on context. |
| **Deal code names and wall-crossed projects** | "Project Falcon", target names, bidder lists, valuation ranges, draft SPA terms | Firm information-barrier policies (workstream 6) | Code names are ordinary words ("Falcon"), so only an org-supplied **gazetteer** catches them reliably. |
| **Attorney–client privilege and work product** | Legal advice, litigation strategy, counsel's mental impressions | Privilege can be waived by disclosure to third parties (workstream 5) | This is a whole-conversation property that depends on who is present and why. It needs **meeting-level classification**. |
| **CUI / ITAR / EAR / classified** | CUI has 20 organisational index groupings (Critical Infrastructure, Defense, Export Control, Financial, Intelligence, Law Enforcement, Legal, Nuclear, Privacy, Proprietary Business Information, Tax and others). ITAR technical data. **Classified information must never be captured at all.** | [NARA CUI Registry](https://www.archives.gov/cui/registry/category-list); workstream 5 | Spoken banner markings ("this is CUI", "we're at SECRET now") are strong cues. Technical data is hard to recognise without domain classifiers. |
| **Trade secrets and strategy** | Pricing strategy, roadmap, unreleased product names, formulas, customer lists, board discussions | DTSA (workstream 5) | Semantic |
| **Source code and system details** | Code snippets, architecture, hostnames, internal URLs, vulnerability details | — | Partly pattern-detectable (URLs, hosts), partly semantic |
| **Credentials and secrets** | Passwords, OTPs, API keys, recovery codes, door codes, safe combinations, Wi-Fi keys | Alpha's own E5 requirement: "no passwords/OTP/token values in transcripts… model input or logs" (`docs/implementation-plan.md`) | Spoken OTPs are short digit strings, so aggressive number policies are needed near words like "code", "password" or "PIN". |
| **HR and personnel** | Performance issues, terminations, compensation, investigations, medical leave | Employment law | Semantic; mixes Axis 1 and Axis 2 |
| **Personal financial information** | Account balances, portfolio holdings, salaries | GLBA (workstream 5) | Amounts can be generalised (see §C.1) |
| **Customer confidential data** | Information held under an NDA with a client | Contract | Gazetteer of client names plus classifier |

**Design implication.** Axis 1 is mostly *span-level*: find a string and transform it. Axis 2 is mostly *segment- or meeting-level*: decide whether a whole passage or meeting may leave the device at all, and in what abstracted form. A credible Alpha pipeline needs both a span detector and a **segment classifier**, joined by one policy engine.

---

## Part C — Redacting without destroying business value

### C.1 Technique evaluation

Throughout this section, "utility" means whether a cloud LLM can still do the task: summarise, draft a follow-up, extract action items, compare to last week, or answer "what did the CFO commit to?"

| Technique | How it works | Utility retained | Privacy strength | Pros | Cons / failure modes | Fit for Alpha |
|---|---|---|---|---|---|---|
| **Masking / removal** (`[REDACTED]`, `####`, beep) | Replace the span with a blank or generic tag | Low. Coreference is destroyed ("[REDACTED] told [REDACTED]"). | Medium | Simple and auditable | Kills summaries. The LLM hallucinates to fill gaps. Judges prefer unredacted prompts 75–80% of the time ([LLM-Redactor](https://arxiv.org/html/2604.12064v1)). | Only for secrets, PAN and SSN, where the value has no business meaning |
| **Typed consistent pseudonyms** (PERSON_1 stays PERSON_1 for the session) | A deterministic mapping per session or tenant, with the type in the token | High for reasoning. The LLM can track who said what. | Medium. Context can still re-identify. | Preserves coreference. Deepgram already emits indexed tags ([docs](https://developers.deepgram.com/docs/redaction)). | Cross-session linkability if the mapping is global. Gender and number agreement (PERSON_1 … "she"). | **Core technique.** Add *role annotations* (below). |
| **Role-annotated pseudonyms** (Alpha proposal) | `PERSON_2 {role: counterparty CFO}`, `ORG_1 {type: target company, sector: industrial software}` | Very high. The LLM gets the *business meaning* without the identity. | Medium–low. The role can be identifying ("CEO of ORG_1"). | Most of the value in a summary is roles and relations, not names. | The role must itself be generalised to k-anonymity ("a public-company CFO", not "the CFO of Acme"). | **Core technique**, with a role-generalisation policy |
| **Reversible tokenization with an on-device vault, plus local rehydration** | Tokens go to the cloud. The mapping stays in a Keystore-protected vault on the phone. The cloud's output is detokenised locally before display. | Very high end to end. The user sees real names in the answer. | Depends on the token scheme. Random tokens are strong; deterministic keyed tokens are strong if the key never leaves. | Skyflow's model ([Skyflow](https://www.skyflow.com/product/llm-privacy-vault)) moved on-device, which removes the cloud vault as a target. | LLM mangles tokens ("PERSON_1's" becomes "Person 1", or it invents a PERSON_7). Tokens copied into tool calls such as sending email need detokenisation *under policy* and approvals. | **Core technique.** Alpha already has Keystore AES-GCM storage and a receipts model. |
| **Generalisation / k-anonymity** | Date to month or quarter. Amount to a range or order of magnitude. Age to a band. City to region. Name to role. | Medium–high, task-dependent. Summaries survive; precise calculations do not. | High against quasi-identifier linkage | Directly implements HIPAA rules (3-digit ZIP only if more than 20,000 people; ages 90+) ([45 CFR 164.514](https://www.law.cornell.edu/cfr/text/45/164.514)). 87% of the US population was likely unique on {5-digit ZIP, gender, DOB} ([Sweeney](https://dataprivacylab.org/projects/identifiability/paper1.pdf)). | k-anonymity is defined over *tables*. For a single transcript it is a heuristic (est.). Arithmetic tasks break: "a range of $100–500M" can't be summed. | Use for **amounts, dates, ages and locations**. Keep the exact value in the vault for local rehydration. |
| **Format-preserving encryption (FPE)** | Encrypt a 16-digit PAN to another 16-digit string | Low semantic value to an LLM; high for downstream systems | Strong with a good key and domain | Preserves validators and database schemas | NIST's SP 800-38G Rev.1 draft (Feb 2025) **withdraws FF3** and raises FF1's minimum domain from 100 to **1,000,000** ([NIST](https://csrc.nist.gov/pubs/sp/800/38/g/r1/2pd)). Short fields such as 4-digit PINs or 3-digit CVVs can't be FPE'd safely. | Niche. Use only when an Alpha workflow must hand a PAN-shaped value to a system that validates format. Not for LLM egress. |
| **Semantic abstraction / summarisation before egress** | A local model rewrites the passage ("Discussed a possible acquisition of a mid-size industrial software firm at a premium") | Medium. Good for gist tasks, bad for exact recall. | Higher than span redaction, because it removes implicit identity cues | Handles Axis-2 content that NER cannot. Local rephrasing (option C) plus redaction lowers leakage ([LLM-Redactor](https://arxiv.org/html/2604.12064v1)). | About 1.8 s latency per request with a local LLM ([LLM-Redactor](https://arxiv.org/html/2604.12064v1)). Risk of *distortion*: the summary may drop the key fact. Unverifiable. | Use for **MNPI, privileged and strategy segments** when the tier is "abstract-then-send" |
| **Differential privacy (DP)** | Add calibrated noise | Very low for a single transcript. DP protects populations, not a single record. | Formal, but only for aggregates | Good for *fleet analytics and telemetry* (e.g., which entity types are most often flagged) and for synthetic training data (MOSTLY AI's SDK includes DP ([BigDATAwire](https://www.hpcwire.com/bigdatawire/this-just-in/mostly-ai-unveils-open-source-toolkit-for-synthetic-data-generation/))) | Word-level DP noise on prompts wrecks utility (option H in [LLM-Redactor](https://arxiv.org/html/2604.12064v1)) | **Only for telemetry and model-improvement data**, never for the user's live content |
| **Policy tiers** | Each segment is *local-only*, *redact-then-send*, *abstract-then-send* or *send* | Maximises utility per segment | As strong as the classifier | Matches how compliance teams already think | Mis-tiering is the main failure mode | **Core** |
| **Per-meeting classification labels** | Meeting-level labels such as "Deal-Restricted: Falcon", "PHI", "Privileged" or "CUI//SP-PRVCY", from calendar metadata, attendees, spoken markings and a classifier | High, because the label sets a default tier | High | Aligns with MIP/sensitivity labels. Calendar is already an Alpha tool. | Meetings drift ("…and one more thing about Falcon"), so labels must be able to **escalate mid-meeting**, never silently downgrade | **Core** |
| **Contextual integrity** (flows judged by context norms: sender, recipient, purpose) | Policy asks whether a flow of type X from context A to recipient B for purpose C is appropriate | High | High, conceptually | Explains *why* the same name is fine in a calendar invite but not in a cloud prompt | Hard to formalise, and annotators disagree: 47.7% agreement on contextual redactions ([RedactionBench](https://arxiv.org/abs/2606.18782)) | Use as the **design frame** for the policy language (destination and purpose are first-class) |
| **User and admin policies** | Admins set the floor, users can tighten but not loosen. Signed and delivered through MDM. | — | — | Enterprise-sellable | Complexity, and policy-authoring UX | **Core** |
| **Audit logs** | Record what left the device, under which policy, detector and confidence, without logging raw values | — | Supports accountability | Needed for HIPAA, FINRA and CUI audits. Alpha already has receipts. | The logs themselves must not leak, so store hashes and types, not values | **Core** |
| **Confidence thresholds with human review** | Low-confidence spans are held or tier-escalated, and the user gets a "privacy preview" before sending | High | High | Catches the long tail | Friction. In an always-on product there is no human in the loop for background tasks, so the *default for uncertainty must be conservative* (local-only). | **Core**, with asymmetric defaults |
| **Local-model / cloud-model routing** | The local model answers sensitive queries. The cloud gets sanitised context only when needed. | Medium–high | Highest in practice | Routing locally alone cut PII leakage to 6.3%; combined with redaction and rephrasing, to 0.6% ([LLM-Redactor](https://arxiv.org/html/2604.12064v1)) | Needs a capable on-device LLM, and offline LLM is *deferred* in Alpha's baseline (manifest). Apple's on-device model is about 3B parameters at 2 bits/weight ([Apple](https://machinelearning.apple.com/research/apple-foundation-models-2025-updates)), which shows it is feasible. | **Core, phase 2** |
| **Attested TEE inference** (Alpha's existing Nitro enclave) | The cloud side cannot read plaintext, even for the operator | Full | Strong *against the operator*, but not against the model or its outputs (logs, tool calls) | Already part of Alpha's design | A TEE does not stop the LLM from writing a name into an email draft, or MNPI from reaching a third-party tool | **Complement.** It protects the channel; redaction protects against the *destination*. |

**Recommended composition** (strongest to weakest, applied per segment):

1. Local-only for "must not leave".
2. Abstract-then-send for Axis-2 sensitive segments.
3. Redact-then-send, using typed role-annotated pseudonyms, generalised numbers and the on-device vault, for Axis-1 sensitive segments.
4. Send, inside the attested enclave, for non-sensitive segments.
5. Rehydrate locally in every case.

### C.2 Failure modes and mitigations

| Failure mode | Example | Why it happens | Mitigation in Alpha |
|---|---|---|---|
| **Re-identification from context** | "PERSON_1, our CEO, who just got back from Davos" | The role plus an event is unique. Implicit identity leaked 43.6% even with combined defences ([LLM-Redactor](https://arxiv.org/html/2604.12064v1)). | Generalise roles to a population of at least k (est. k ≥ 10) *within the tenant's known world*. Run an **adversarial "guess-who" probe** with a local LLM before egress. If it names the person with confidence, escalate the tier. |
| **Quasi-identifiers** | ZIP + DOB + sex; "the only female partner in the Denver office" | 87% of US people were likely unique on {ZIP5, gender, DOB} ([Sweeney](https://dataprivacylab.org/projects/identifiability/paper1.pdf)) | Count quasi-identifiers per segment. Generalise dates, locations and ages by default. |
| **ASR errors defeat NER** | "Project Falcon" transcribed as "project faulk in". "Nguyen" as "win". | Detectors see only the 1-best text | (a) Run detection over the **N-best / lattice**, not just 1-best. (b) **Phonetic fuzzy matching** (Double Metaphone / phoneme edit distance) against the gazetteer of contacts, calendar attendees and deal code names. (c) Bias the ASR with the gazetteer (contextual biasing), which also improves accuracy. |
| **Numbers spoken aloud** | "four one one one, one one one one…"; "call me at five five five…"; "we'll pay one-twenty a share" | Inverse text normalisation may run after, or differently from, detection. Streaming splits digits across partial results. | Detect on *both* the spoken and the normalised forms. Keep a **streaming look-ahead buffer** (est. 1.5–3 s) so a partial digit run is never released. Apply "aggressive numbers" near trigger words such as card, account, code, PIN or SSN (compare Deepgram's `aggressive_numbers` ([docs](https://developers.deepgram.com/docs/redaction))). |
| **Cross-lingual and code-switching** | Spanglish, Hindi-English, Arabic names in English speech | OpenAI PF scores F1 0.04 on Arabic and 0.03 on Cyrillic ([arXiv 2608.02616](https://arxiv.org/abs/2608.02616)). Deepgram entity redaction is English-only ([docs](https://developers.deepgram.com/docs/redaction)). | Use a multilingual detector (GLiNER2-PII-class). Add per-locale regex packs. **Fail closed**: if language ID confidence is low or the language is unsupported, tier escalates to local-only. |
| **Indirect references** | "my boss's wife", "the guy from the Tuesday deal", "her oncologist" | No named entity at all. Coreference across turns. | A relation-aware classifier flags "person described by relation". Resolve against the local knowledge graph (contacts, calendar). Treat as PERSON with role "relation of user". Include it in the "guess-who" probe. |
| **Derived-artefact leaks** | A summary, title, calendar event, filename or search query built from unredacted text | AssemblyAI warns other features "may still include PII" ([docs](https://www.assemblyai.com/docs/pii-redaction)) | **Single egress chokepoint.** Every network-bound payload (prompt, tool argument, filename, telemetry, crash log) passes the same policy engine. |
| **Token mangling and hallucination on rehydration** | The LLM outputs "Person One" or invents PERSON_9 | LLM tokenisation, paraphrase | Use robust token formats (e.g., `⟦P1⟧` plus a checksum). Match fuzzily on rehydrate. Flag unknown tokens. Never auto-send a rehydrated message without an approval receipt. |
| **Over-redaction** (precision failure) | "Apple" the company redacted as a fruit or person. Public figures redacted. | Recall-tuned detectors. Precision is 0.31–0.54 for OpenAI PF out of domain ([arXiv 2608.02616](https://arxiv.org/abs/2608.02616)). | A public-entity allowlist (listed companies, public officials acting in their public role) *per policy*. Measure the utility loss. |
| **Voice as identifier** | Uploading audio for cloud ASR sends a voiceprint | Voice is a HIPAA identifier and a BIPA biometric ([45 CFR 164.514](https://www.law.cornell.edu/cfr/text/45/164.514)) | **Never send raw audio off the device** by default. On-device ASR is already an MVP requirement (manifest). |
| **Adversarial / prompt-injection exfiltration** | A web page or email tells the agent to "include the user's account number" | Agentic tool use | The policy engine also applies to *tool calls*. Vault detokenisation requires user approval for any external send. |

### C.3 Evaluation: metrics and benchmarks

**Primary metric: entity-level leakage rate (recall's complement, measured at egress).**

- **Exact leak rate:** the share of gold sensitive values that appear verbatim in *any* egress payload.
- **Partial leak rate:** a match on 4+ characters (the LLM-Redactor definition ([arXiv 2604.12064](https://arxiv.org/html/2604.12064v1))), plus *phonetic* matches for speech.
- **Implicit identity leak:** can an adversarial LLM, given the egress payload plus public web data, name the person or deal? Report top-1 and top-5.
- **Axis-2 leak:** the share of segments labelled MNPI, privileged or CUI whose *propositional content* can be recovered from the payload (LLM-judge entailment).

**Secondary metrics.**

- Recall per class. For regulated classes (PAN, SSN, MRN, secrets) the targets are ≥ 0.99 (est.) plus a regex or checksum backstop; for names, ≥ 0.95 (est.).
- Precision, which matters for utility.
- **R-Score**, a character-level measure ([RedactionBench](https://arxiv.org/abs/2606.18782)).
- **Task-utility retention**: LLM-judge or human score of the output on the redacted versus unredacted transcript, for each task (summary, action items, email draft).
- Latency (p50 and p95) and energy per hour of audio.

**Weighting.** Use recall-weighted F-scores (F2 or F2.5), which Presidio's evaluator also uses ([arXiv 2202.00443](https://arxiv.org/pdf/2202.00443)). Report worst-class recall, not micro-average. A system with 0.98 average recall that misses 30% of spoken card numbers is a failure.

**Datasets.**

- Public: ai4privacy-500k (synthetic), TAB (legal), i2b2 2014 (clinical), SPY, PIIBench, RedactionBench, and the out-of-distribution stress test ([arXiv 2609.03464](https://arxiv.org/abs/2609.03464)).
- **Alpha must build its own spoken-domain set.** Record synthetic finance, clinical and government role-play meetings with actors, run them through Alpha's actual on-device ASR, and gold-label on the ASR output. Also make TTS-rendered versions of the ai4privacy text, then re-transcribe them, to generate ASR-noise variants cheaply (est.).

**Benchmark caution.** Vendor benchmarks disagree. AWS Comprehend recall is 0.90 in Tonic's study ([Tonic](https://www.tonic.ai/ai-model-benchmarks/textual-benchmark)) and 0.698 in Limina's ([Limina](https://www.getlimina.ai/en/research/pii-benchmark-report)). OpenAI PF is 0.97 F1 on its own benchmark and 0.55 on clinical notes ([JSL](https://www.johnsnowlabs.com/clinical-de-identification-benchmarks-2026-john-snow-labs-against-openai-databricks-presidio-and-llm-apis/)). Only in-domain, ASR-noised evaluation is decision-grade.

### C.4 Latency and compute on a phone NPU

| Stage | Model class | Size | Est. latency on a 2025–26 flagship NPU (Tensor G5 / Snapdragon 8 Elite) | Duty cycle for always-on |
|---|---|---|---|---|
| Regex, checksum and gazetteer (phonetic) | Deterministic | Under 1 MB | Under 1 ms per segment (est.) | Negligible |
| Span NER | GLiNER2-PII-class encoder, about 0.3B, INT8 | About 200–300 MB (knowledgator base is 197 MB as UINT8 ONNX ([HF](https://huggingface.co/knowledgator/gliner-pii-base-v1.0))) | About 15–60 ms per 256–512-token window (est.). LLM-Redactor measured about 18 ms per request for NER on a workstation ([arXiv 2604.12064](https://arxiv.org/html/2604.12064v1)). | Speech runs at about 150 words/min, roughly 200 tokens/min (est.). Running NER once every 5–10 s of speech is under 1% of the NPU (est.). |
| Segment classifier (MNPI, privilege, CUI, strategy) | A small encoder, or a 1–3B local LLM in classification mode | 0.1–3B | Encoder about 10–30 ms (est.). LLM about 0.3–1 s per segment (est.). | Run the classifier at meeting and segment granularity (every 30–60 s), not per token (est.). |
| Abstraction / rephrase | 1–3B on-device LLM (Apple ships about 3B at 2 bits/weight ([Apple](https://machinelearning.apple.com/research/apple-foundation-models-2025-updates))) | 1–2 GB | About 1–2 s per request (LLM-Redactor measured about 1.8 s ([arXiv 2604.12064](https://arxiv.org/html/2604.12064v1))) | On demand only, at egress time |
| "Guess-who" re-identification probe | The same local LLM | — | About 0.5–1.5 s (est.) | Only for payloads that contain PERSON or ORG tokens |

**Conclusion.** Redaction compute is small next to always-on ASR, which workstream 10 covers. The latency that matters is **egress latency**: the time between the user asking and the cloud call leaving the device. Target a p95 under 300 ms for the redact-then-send path and under 2 s when abstraction is needed (est.). Because transcripts are processed continuously in the background, most detection is *already done* when the user asks. The policy engine only has to assemble the payload.

### C.5 Interaction with retention and recordkeeping

- **Redaction is not deletion, and minimisation for the AI is not minimisation of the record.** Broker-dealers must keep "all communications received and… sent" relating to the business for three years, the first two easily accessible, with audit-trail or WORM storage ([17 CFR 240.17a-4](https://www.law.cornell.edu/cfr/text/17/240.17a-4)). The SEC fined 26 firms $392.75M in one sweep on 14 Aug 2024 over off-channel communications ([SEC](https://www.sec.gov/newsroom/press-releases/2024-98)). If Alpha transcripts are business communications of a regulated person, **the unredacted record may have to be retained and produced**. A redacted AI copy does not satisfy that duty. See workstreams 5 and 6.
- **Proposed "split record" model:**
  1. The *system of record*: the full-fidelity transcript, and optionally the audio, encrypted with the customer-held key and journalled to the customer's archive (Smarsh, Global Relay and similar; workstream 9) under the retention schedule and legal hold.
  2. The *AI working copy*: the sanitised derivative plus vault references, with short retention.
  3. The *vault*: holds the mapping between them, with the same retention as the working copy and destroyed on expiry, which makes the working copy effectively anonymous (est.; legal review needed).
- **Legal hold overrides deletion** for all three.
- **HIPAA's minimum-necessary rule and GDPR data minimisation** favour short retention of raw audio: delete audio after transcription unless a retention duty applies. Under GDPR, pseudonymised data is still personal data *while the vault exists*. Only destroying the key moves toward anonymisation (workstream 5).
- **Privilege**: sending privileged content to a third-party model provider may raise waiver arguments. Attested enclave processing plus local-only tiering for "Privileged" meetings is the defensible posture (workstream 5).
- **Audit logs are records too.** Keep them value-free (types, hashes, policy IDs) so they can be retained long-term without becoming a sensitive store themselves.

### C.6 Reference architecture for Alpha

```
┌─────────────────────────────── PHONE (trusted zone; Android Keystore / StrongBox) ───────────────────────────────┐
│                                                                                                                  │
│  [0] Capture & consent gate ──► [1] On-device ASR ──► [2] Normalizer ──► [3] Detection ensemble ──► [4] Classifier│
│      mic lifecycle, all-party       word timestamps,      spoken+ITN        regex/checksum,             meeting &   │
│      consent state, bystander       confidences,          dual forms,       phonetic gazetteer,         segment     │
│      drop, "recording" indicator    N-best / lattice      look-ahead buf    NER (GLiNER2-class),        labels,     │
│                                                                              secrets, coref/relations    tiers       │
│                                                                                     │                         │    │
│                                                                                     ▼                         ▼    │
│  [7] Rehydrator ◄── response ──┐                     [5] Policy engine (signed admin policy ∧ user policy)       │
│      token→value (policy-gated)│                         (entity type × label × destination × purpose) → action   │
│      approvals & receipts      │                         keep | pseudonymize(role) | generalize | tokenize |      │
│      unknown-token alarm       │                         abstract(local LLM) | local-only | drop | block          │
│           ▲                    │                                    │                    │                        │
│           │                    │                                    ▼                    ▼                        │
│  [6] On-device vault ◄─────────┼──────────────── token map   [5b] Re-ID probe      [8] Audit log (hash-chained,   │
│      AES-GCM, Keystore-wrapped │                  (session/       (local LLM         value-free) + [9] Split record│
│      session & tenant scopes,  │                   tenant keyed    "guess who")       → customer archive (full)   │
│      TTL, crypto-erase         │                   HMAC)                │                                         │
│                                │                                        ▼ sanitized payload + token schema         │
└────────────────────────────────┼──────────────────────────── [10] Egress chokepoint (only network path) ──────────┘
                                 │                                        │  verifies enclave attestation (PCRs)
                                 │                                        ▼
                         ┌───────┴──────────── AWS Nitro Enclave (attested; Cerebras inference) ─────────────┐
                         │  [11] second-pass detector (defense in depth) → agent/LLM → output filter         │
                         │       tool calls carry tokens only; external sends require phone-side approval     │
                         └────────────────────────────────────────────────────────────────────────────────────┘
```

**Component notes.**

- **[0] Capture and consent.** Recording state is tied to consent policy (all-party-consent jurisdictions come from workstream 5). A non-participant or bystander classifier *drops* third-party speech rather than redacting it. Hearing a classification marking ("this is SECRET", "TS", "SCI") triggers an **immediate stop plus quarantine** of the buffer. Alpha is not accredited for classified information, and must never hold it rather than redact it.
- **[1] ASR.** On-device ASR is an unmet MVP requirement (manifest). The redaction design *depends on it*: cloud ASR would send voiceprints and raw content before any redaction could happen. Contextual biasing uses the gazetteer.
- **[3] Detection ensemble.** High-recall union:
  - Regex and checksums: Luhn for PAN, ABA routing checksum, IBAN mod-97, SSN area rules.
  - Entropy-based secret detection.
  - Phonetic gazetteer: contacts, calendar attendees, the org directory, **admin-supplied deal code names and client lists**.
  - A fine-tuned multilingual NER encoder.
  - A relation and coreference module for indirect references.

  Each detection carries a type, span, confidence and *source*.
- **[4] Classifier.** Meeting labels come from priors (calendar title and attendees, the org's restricted list, where the user is), plus spoken markings and a segment classifier for MNPI, privilege, PHI context, CUI, strategy and HR. Labels can only **escalate** during a meeting. De-escalation needs explicit user action with a receipt.
- **[5] Policy engine.** A declarative, signed policy in a Cedar- or OPA-like language (est.), delivered by MDM. The default posture is **fail closed on uncertainty**. Example rule: `if label∈{Deal-Restricted} and destination=cloud-llm then segment.action = abstract; entity ORG[gazetteer:deal] → tokenize(role="target company", sector=generalize)`.
- **[6] Vault.** Mapping tables are scoped *per session* by default. A *per-tenant* scope, using keyed HMAC for stable pseudonyms across meetings, is opt-in for workflows like "compare to last week". Keys are Keystore-wrapped (Alpha already uses Keystore AES-GCM with no backup). Crypto-erase happens when the TTL expires.
- **[7] Rehydration.** This happens only on the phone. Output is scanned for unknown or mangled tokens. Any external action with rehydrated values (sending an email, adding a calendar attendee) goes through Alpha's existing **approvals and receipts** flow.
- **[10] Egress chokepoint.** This is the *only* network path for content: prompts, tool arguments, telemetry and crash logs all pass through it. It verifies the enclave's attestation before sending anything. The redaction policy version is bound to the attestation receipt, giving an auditable "what left, to which measured image, under which policy".
- **[11] Enclave second pass.** A server-side detector inside the attested enclave catches phone misses. It **cannot** repair a leak, because plaintext has already reached the enclave, but it keeps the value out of logs, tools and third-party calls. It also produces a "near-miss" signal that feeds back (value-free) to improve on-device recall.

### C.7 Worked examples: before and after

All names and facts below are **fictional**.

#### Example 1 — Finance: M&A deal team call

*Meeting label:* **Deal-Restricted: Project Falcon**, from calendar title plus gazetteer hit. *Tier:* abstract-or-redact-then-send. Numbers are generalised; the target is tokenised with a role.

**Raw on-device ASR (1-best):**
> dana: ok so on falcon, harlow industrial board meets on the 14th. we're at forty two a share which is a 31 percent premium, about 2.3 billion equity value. mark from blackrow capital said they'd go to forty five if we drop the earnout. my card for the dinner is four one one one one one one one one one one one one one one one. also tell priya's husband nothing, he trades.

**Egress payload to enclave (sanitised):**
> PERSON_1 {role: deal lead, internal}: On PROJECT_A {type: pending acquisition, label: MNPI}, TARGET_ORG_1 {type: public company, sector: industrial} board meets on DATE_1 {generalized: mid-month, next month}. Offer is at PRICE_1 per share {generalized: $40–50}, a premium of PCT_1 {generalized: 25–35%}, equity value AMOUNT_1 {generalized: $2–3B}. PERSON_2 {role: counterparty representative} of BIDDER_ORG_1 {type: private equity firm} indicated a higher price PRICE_2 {generalized: $40–50, > PRICE_1} conditional on removing the earn-out. [PAYMENT_CARD removed — policy: drop]. Instruction: do not share deal information with PERSON_3 {role: relative of a colleague; flagged: potential tipping risk}.

**Cloud LLM output (tokens):**
> Action items: (1) Prepare response to BIDDER_ORG_1's conditional offer at PRICE_2 before TARGET_ORG_1's board date DATE_1. (2) Model the earn-out removal vs the PRICE_2−PRICE_1 increase. (3) Compliance: PERSON_3 wall-crossing concern — notify compliance.

**Rehydrated on the phone:**
> (1) Prepare response to Blackrow Capital's conditional offer at $45 before Harlow Industrial's board date (the 14th). (2) Model the earn-out removal vs the $3/share increase. (3) Compliance: Priya's husband — possible tipping risk; notify compliance.

*Notes.* PRICE_2 − PRICE_1 is computed **locally** during rehydration, because the vault holds the exact values. This is how precise arithmetic survives generalisation. The card number is dropped, not tokenised, because it has no business value. The "tipping" instruction is preserved as a *role*, and it creates a compliance task rather than leaking the name.

#### Example 2 — Clinical: primary-care visit (clinician's device)

*Label:* **PHI**. *Tier:* redact-then-send with HIPAA Safe Harbor generalisation. The raw audio never leaves the device.

**Raw ASR:**
> dr okafor: so mrs. elena ruiz, date of birth march third nineteen thirty four, you're ninety one, MRN 00482215. your A1C came back at nine point two, up from seven eight in june. we'll start ozempic point two five. you still live on 14 birch lane in marfa? your daughter carmen can pick up at the walgreens on highland.

**Egress payload:**
> CLINICIAN_1: Patient PATIENT_1 {sex: F, age: 90+}, MRN [removed]. HbA1c 9.2%, up from 7.8% DATE_1 {generalized: ~3 months prior}. Plan: start semaglutide 0.25 mg. Confirmed residence LOCATION_1 {generalized: state=TX; ZIP3=000 (pop<20k rule)}. Caregiver PERSON_2 {role: adult daughter} to pick up at PHARMACY_1 {type: retail pharmacy}.

**Cloud output → rehydrated:**
> SOAP note draft… "Pt Elena Ruiz (DOB 03/03/1934)… A1c 9.2% (↑ from 7.8% in June)… Rx semaglutide 0.25 mg weekly… daughter Carmen to collect at Walgreens, Highland Ave."

*Notes.* The clinical values (A1c, drug, dose) are **kept**. They are the business value and are not identifiers under Safe Harbor. Age 91 becomes "90+", and a ZIP area under 20,000 people becomes 000, per [45 CFR 164.514](https://www.law.cornell.edu/cfr/text/45/164.514). The clinician still gets a note with the real details because rehydration is local. If the practice has a BAA with the enclave operator, policy could relax to "send inside the enclave". The default stays conservative.

#### Example 3 — Government: civilian agency program briefing

*Label:* **CUI//SP-PRVCY** plus **CUI//PROCURE**. The speaker announced CUI, and procurement terms were detected. *Tier:* abstract-then-send for procurement segments, local-only for any segment containing names from a personnel action. The classification-marking guard is armed.

**Raw ASR:**
> director hayes: this briefing is CUI. the source selection for the border sensor recompete — Vantrel's bid came in at 118 million, eighteen under Korvex. the SSEB chair is lt col amanda price. separately, the IG case on contractor employee james whitfield, SSN ending 4471, is going to referral. and — hold on, the next part is at the secret level, stop the recording.

**Egress payload:**
> Briefing marked CUI. [Segment S1 — PROCUREMENT, action=abstract]: "An ongoing source selection for a sensor-program recompete; two offerors; the apparent low bid is modestly below the incumbent's." [Segment S2 — personnel/IG matter, action=local-only: not sent]. [Segment S3 — classification marking spoken → capture stopped; buffer since marker quarantined and purged; user notified.]

**Cloud output:**
> Summary: CUI program briefing covering status of a source selection (two offerors). One item held locally (personnel). Recording halted at classification boundary.

**Local enrichment (on device only):** the local model can answer "what was Vantrel's bid?" from the local transcript, *if* the CUI policy allows local storage on this device class. Otherwise even the local transcript of S1 and S2 follows the agency's retention rules.

*Notes.* Source-selection information is procurement-sensitive. Only an abstraction leaves the device. The IG matter never leaves. The SECRET marker triggers **stop-and-purge**, not redaction, because a phone outside an accredited system cannot lawfully hold classified information (workstream 5).

### C.8 What could be patentable or differentiating

Patentability requires counsel and a prior-art search. Speech-redaction patents already exist ([US 12229313](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12229313), [US 12189817](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12189817)). Candidates, strongest first:

1. **Attestation-bound redaction policy and rehydration.** The phone releases a sanitised payload only to an enclave whose PCR measurement matches. The policy version, detector version and payload hash are bound into a signed receipt. Optionally, rehydration of tool-call outputs is gated on the same attestation. This combines Alpha's existing enclave with redaction in a way that network DLP vendors structurally cannot.
2. **Lattice- and phonetic-aware redaction for streaming speech.** Sensitive-entity detection runs over ASR N-best and lattice hypotheses and a phoneme-level gazetteer (deal code names, contacts), with a look-ahead buffer that holds partial digit runs across streaming boundaries.
3. **Role-annotated, generalised pseudonyms with local exact-value arithmetic.** The cloud reasons over typed, generalised tokens (PRICE_1 in $40–50). The phone computes exact derived quantities (PRICE_2 − PRICE_1) at rehydration. Utility is kept without sending the exact value.
4. **Escalate-only meeting classification.** Labels come from calendar, gazetteer, spoken markings and a classifier, and dynamically raise the egress tier mid-meeting. A spoken classification marking triggers stop-and-purge.
5. **Pre-egress re-identification probe.** A local LLM tries to identify the tokenised people and deals from the payload plus cached public context, and escalates the tier if it succeeds.
6. **Canary tokens for leak detection.** Unique honey-values are planted in the vault and watched for in outputs and third-party systems. (Est.: the novelty is probably low.)
7. **Split-record retention.** A full archive under customer key, a sanitised AI copy, and a vault TTL with crypto-erase, together reconciling FINRA and SEC retention with AI minimisation.

**Differentiation without patents.** The combination itself is the moat: on-device ASR plus on-device redaction plus attested enclave plus approvals and receipts on one owned device. Competitors hold one piece each. Speech APIs redact *after* receiving audio (§A.3). Network DLP sees only typed text (§A.4). Confidential-AI vendors protect the channel but not the destination (workstream 3).

---

## Implications for Alpha Phone

1. **Make redaction a first-class product pillar, not a hidden compliance feature.** The pitch is that sensitive details never leave the phone while the assistant still knows who and what the conversation was about. That is a sentence no competitor in §A can say truthfully, because each needs the data in its cloud first.
2. **On-device ASR is the gating dependency.** Until STT runs on the phone (currently on a paired host, per the manifest), the product cannot claim pre-egress redaction of speech. Sequence it: on-device ASR, then on-device detector, then policy engine and vault.
3. **Build rather than buy the detector core. Consider licensing Limina or Tonic for regulated verticals.** Start from an Apache-2.0 multilingual encoder (GLiNER2-PII-class, 0.3B) plus regex and checksums plus a phonetic gazetteer, then fine-tune on Alpha's own ASR-noised corpus. Do **not** ship Piiranha, whose licence is CC-BY-NC-ND. Treat OpenAI Privacy Filter as a baseline or second opinion only: it covers 8 of 18 HIPAA identifiers and is weak outside English. For clinical deployments, benchmark against John Snow Labs or Limina, or license from them.
4. **Typed, role-annotated, session-stable pseudonyms with on-device vault rehydration should be the default transformation.** Generalise numbers, dates and locations, compute exact derived values locally, and use masking only for secrets, PAN and SSN.
5. **Axis-2 confidentiality (MNPI, privilege, CUI, deal code names) is the premium differentiator** for finance, legal and government buyers. Ship an admin-managed gazetteer and restricted list, meeting labels that can only escalate, and "abstract-then-send" or local-only tiers.
6. **Classified information is out of scope by design.** Implement stop-and-purge on spoken markings, and say plainly in government sales that Alpha is not a classified device (workstreams 3 and 5).
7. **The split-record model is required for finance.** Redaction must coexist with 17a-4 retention and archives. Partnering with a compliance archive (workstream 9) turns a conflict into a feature.
8. **Publish leakage numbers, not F1.** Adopt worst-class recall, exact, partial and implicit leak rates, and task-utility retention on an Alpha spoken-meeting benchmark. Consider an external audit similar to Limina's Armilla audit. This also supports insurance and liability positioning for redaction false negatives (workstream 11).
9. **Exit and partner optionality.** The August–October 2025 M&A wave (SentinelOne, Cato, Check Point, F5, PANW, CrowdStrike, Veeam) shows that incumbents pay about $180–500M for GenAI data-control capability. An on-device speech-redaction SDK is plausibly separable IP of interest to these buyers and to handset OEMs (est.; workstream 8).
10. **Upstream contract.** ADR-02 places redaction upstream in elizaOS. The policy engine and egress chokepoint belong in the shared agent, with product-specific policy supplied explicitly. Any change must go through reviewed upstream commits or `patches/eliza`, per repository rules.

## Open questions

1. What NPU latency and battery cost does a 0.3B INT8 NER encoder plus a 1–3B classifier have on the target Pixel-class device during always-on capture? Every figure in §C.4 is an estimate and needs device measurement (workstream 10).
2. Which ASR runs on the device, and does it expose N-best, lattices and contextual biasing? Lattice-aware redaction depends on this.
3. Who supplies the confidential gazetteer (deal code names, client lists, restricted lists), and how is it distributed to the device without becoming a sensitive target itself? Options include MDM, encrypted with the tenant key, and a hashed or Bloom-filter form.
4. Session scope or tenant scope for pseudonym stability? This trades cross-meeting utility against linkability, and may need to vary by vertical.
5. Legal position: is a sanitised, vault-backed working copy "de-identified" (HIPAA) or "anonymised" (GDPR) once the vault expires? Does sending privileged content to an attested enclave preserve privilege? (Workstream 5 plus outside counsel.)
6. For regulated finance users, must the *sanitised AI copy* and the *agent's outputs* also be retained as books and records under 17a-4? (Workstreams 5 and 6.)
7. How should implicit-identity leakage (43.6% even with combined defences, per LLM-Redactor) be quantified and bounded on Alpha's own data? Is the "guess-who" probe reliable enough to gate egress?
8. What leakage rate is commercially acceptable per vertical, and can it be insured? (Workstream 11.)
9. Freedom to operate: do existing speech-redaction patents (US 12229313, US 12189817 and others) read on lattice-aware or phonetic gazetteer redaction?
10. Should Alpha license a commercial detector (Limina or Tonic) for HIPAA-grade coverage and Expert Determination support, or build its own? What are the OEM terms and the per-device cost? (Not public; requires vendor contact.)
11. Unverified items to close: the Pangea/CrowdStrike price, the Pangiam/BigBear.ai details, Protecto's funding, Harmonic's 2025–26 funding, the MOSTLY AI and Syntho relationship, and the reconciled total consideration for Prompt Security (reported $250–300M against about $160–170M (est.) from SEC filings).
