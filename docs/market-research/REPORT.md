# Alpha Phone — market, competitive and opportunity research

Research date: 2026-09-30. There are about 94,000 words across 11 workstreams. The scope and the checklist of topics the original request did not name are in the [manifest](00-manifest.md). This file gives the consolidated findings and recommendations; the linked sections hold the evidence, tables and citations.

> **Evidence quality.** Eleven research agents ran in parallel and shared a 200-search web budget, which ran out partway through. Later workstreams relied on direct page fetches of primary sources. Figures that could not be re-checked are marked `(unverified)`, `[R]` or `[kb]`, and estimates are marked `(est.)`. Verify any figure before using it externally, especially funding rounds, legal-case details, and the corporate and token facts in section 8. This is not legal or investment advice.

## Sections

| # | Section | Headline |
| --- | --- | --- |
| 01 | [Transcription devices and meeting AI](01-transcription-competitors.md) | Plaud leads (2M+ devices, ~$250M run-rate, ~bootstrapped). All recorders are cloud-first. Otter, Fireflies and Granola face wiretap and BIPA suits, and IT departments are banning note-takers. |
| 02 | [Agentic phones and AI devices](02-agentic-phones-devices.md) | Humane sold to HP for $116M after raising ~$230M. Rabbit's r1 had ~5K daily users. Banking and payment apps blocked the Doubao phone. Only 12% of buyers upgrade for AI. |
| 03 | [Secure phones and confidential AI](03-secure-phones-confidential-ai.md) | Secure-phone hardware is a shrinking niche, and DoD is moving to BYOD plus Hypori. Apple PCC and Google Private AI Compute set the pattern. **Alpha's inference leaves the enclave.** |
| 04 | [Redaction technology and design](04-redaction.md) | No one redacts at the microphone. Typed role-annotated pseudonyms plus an on-device vault preserve value. NER alone leaks 15%. The M&A wave ran $160M–$500M per deal. |
| 05 | [Regulation and compliance](05-regulation-compliance.md) | Consent litigation is the top risk. Finance must retain originals and redact copies. The roadmap runs from <$100k to $3–8M. |
| 06 | [Vertical deep-dives](06-vertical-markets.md) | Wealth advisors rank #1. Government sells chat at $1, so the government opening is edge transcription. The Qwen model's Chinese origin blocks defense. |
| 07 | [TAM / SAM / SOM](07-tam-sam-som.md) | $29.3B TAM, $2.18B SAM and $85M ARR by year 5 (base case). |
| 08 | [Investors, funding and M&A](08-investors-funding-ma.md) | 84-investor list, M&A comps and non-dilutive funding. **The parent-company and token situation is a diligence issue.** |
| 09 | [Distribution, partners and unit economics](09-distribution-partners-economics.md) | Sell software on stock Pixels via MDM first. Gross margin is 54–81% at $59–129/user/month. The archivers are the finance channel. |
| 10 | [Always-on technical feasibility](10-always-on-tech-feasibility.md) | Parakeet ASR is near cloud accuracy. Always-on capture needs a privileged image. pKVM audio isolation is the differentiator. |
| 11 | [Fit, GTM, risks and blind spots](11-fit-gtm-risks.md) | Beachhead is SEC-registered advisers. 42-risk register, 30 blind spots and a 12-month roadmap. |

## Executive summary

1. **There is a real, open gap in the market.** Every shipping transcription product, from Plaud and a dozen $159–199 recorders to Otter, Fireflies, Granola, Zoom and Teams, sends raw audio to a vendor cloud before anything is redacted ([01](01-transcription-competitors.md), [04](04-redaction.md)). Courts now treat that as possible third-party eavesdropping: the Otter wiretap, CIPA and BIPA claims survived dismissal on 2026-08-13 ([05](05-regulation-compliance.md)). Enterprises are banning outside note-takers. No product combines on-device ASR, pre-egress redaction, built-in consent and verifiable cloud processing. That combination is Alpha's category: **a confidential AI scribe and agent for regulated conversations.**

2. **Consumer "agent phones" are the wrong fight.** Humane, Rabbit, Friend and the Limitless and Bee acquisitions show that devices meant to replace the phone fail. Big platforms bundle AI for free (Gemini on 800M devices, Apple Intelligence, Galaxy AI), and only 12% of buyers upgrade for AI ([02](02-agentic-phones-devices.md)). Agents that drive other apps' screens get blocked (Doubao). Sell a **governed, auditable agent for regulated work**, not a phone that replaces apps.

3. **Beachhead: SEC/FINRA-regulated advisers**, meaning independent RIAs, multi-family offices and PE/VC IR teams. This group had the strongest consensus across [06](06-vertical-markets.md), [07](07-tam-sam-som.md), [09](09-distribution-partners-economics.md) and [11](11-fit-gtm-risks.md):
   - **Need:** off-channel enforcement has cost firms more than $2–3B since 2021, and FINRA enforcement continues.
   - **Budget:** Jump raised $105M and serves 27K+ advisors at $75–200 per advisor per month, but it is cloud-only.
   - **Low certification bar:** SOC 2 is enough.
   - **Ready channel:** the compliance archivers (Smarsh, Global Relay, Theta Lake, LeapXpert).
   - Beachhead size is about $425M/yr, with a base-case year-3 ARR of $8.5M ([07](07-tam-sam-som.md)).

   **Follow-on markets:** law firms and M&A/PE deal teams (privilege and MNPI), executives, boardrooms and HR investigations, then behavioral and home health (BAA, EHR). **Government and defense are an R&D and non-dilutive lane, not a near-term sales target.**

4. **Redacting without losing business value is solvable, and the design is specified in [04](04-redaction.md):**
   - Use **short-lived typed pseudonyms with roles** (`PERSON_2 {role: counterparty CFO}`) that stay consistent within a session.
   - **Generalize** quasi-identifiers: amounts become ranges, dates become relative, ages become bands.
   - Keep an **on-device vault**. Exact arithmetic runs locally, and the cloud answer is re-hydrated with real names on the phone.
   - Apply **four policy tiers**: local-only, summarize-then-send, redact-then-send, and send.
   - Stop and purge the buffer when a classification marking is spoken.
   - For finance, keep a **split record**: a tamper-evident original goes to the firm's archive under a customer-held key, and the model sees only the redacted copy. Legal hold overrides deletion.

   Context-based re-identification remains the hard residual. Even with local rephrasing, 43.6% leaked in the one systematic study, so publish **leakage rates on a spoken-meeting eval set** rather than NER F1 scores. The pinned elizaOS upstream already contains PII detectors, typed pseudonyms, secret-swap and fail-closed audio redaction that the Alpha app does not call yet ([11](11-fit-gtm-risks.md)). Wiring that in is the single highest-leverage engineering move.

5. **The confidentiality claim must be fixed before it is marketed** ([03](03-secure-phones-confidential-ai.md), [10](10-always-on-tech-feasibility.md), [11](11-fit-gtm-risks.md)):
   - The agent runs in AWS Nitro Enclaves, but Nitro has no GPU. Every model call leaves the enclave as plaintext to Cerebras, which is covered only by a privacy policy.
   - The temporary Cloudflare quick tunnel and the paired voice host are also plaintext paths.

   **Say today:** "attested agent runtime with a no-retention inference partner." To earn "data never leaves the trust boundary," Alpha needs:
   - on-device ASR and redaction, so that only redacted text egresses
   - the phone verifying the enclave's attestation and encrypting end to end
   - confidential-GPU inference: self-hosted H100/Blackwell CC, Privatemode, or Tinfoil (<7% overhead)
   - a public transparency log of image measurements and reproducible builds
   - multi-party control of the KMS and signing policy
   - an external audit

   Attestation proves only which code booted. Physical attacks such as TEE.fail and DDRop (2025–2026) are out of scope for Intel, AMD and NVIDIA.

6. **Replace or add a model for regulated buyers.** Cerebras `qwen-3.8-27b` is an Alibaba-origin model, which is likely disqualifying for defense, IC and federal buyers and a question for finance ([05](05-regulation-compliance.md), [06](06-vertical-markets.md)). Offer a US or EU open-weight option.

7. **Technical feasibility is good, but platform policy is the constraint** ([10](10-always-on-tech-feasibility.md)):
   - **Models:**
     - ASR: Parakeet TDT v2 at 6.05% WER is within ~0.2 points of the best cloud ASR.
     - Streaming: Moonshine or Zipformer.
     - Diarization: Sortformer plus pyannote.
     - PII detection: GLiNER-PII.
     - TTS: Kokoro.
     - Runtime: all via sherpa-onnx/LiteRT.
   - **Current state:** the shipped tiny.en model on a paired host is two generations behind.
   - **Background capture:** Android 14/15 blocks starting the mic in the background. Always-on requires a privileged image or the assistant role, so the launcher add-on cannot do it.
   - **Differentiator:** run VAD, ASR, diarization and redaction inside a **pKVM protected VM**, so that only redacted text exits the VM.
   - **Battery:** an estimated 5–15% per day, to be measured on a Pixel 10 in month 1.
   - **Build or buy:** build on open weights, with Argmax Pro SDK (~$1/device/month) as the buy option.

8. **Distribution: software on stock hardware first** ([09](09-distribution-partners-economics.md)):
   - **Why stock:** a custom AOSP image fails Play Integrity, which breaks banking and Wallet. It forfeits NIAP and DISA status. It is not on Intune's AOSP list. A custom phone costs $3–8M up front and breaks even at about 30–80K units.
   - **Enterprise path:** Intune or Workspace ONE can push Alpha as the HOME launcher on corporate-owned Pixels (est., needs validation).
   - **Price tiers:** $99–149/user/month software, $229/month managed-device tier, and $150–750K/yr sovereign licenses.
   - **Channels:**
     - Finance: archivers plus AWS Marketplace.
     - Government: Carahsoft plus a DIU CSO/OTA.
     - Healthcare: Epic and GPOs later.
   - **Signed Alpha image:** keep it for sovereign or air-gapped anchor customers of 20K+ units, using NDAA/TAA-clean ODMs only.

9. **Economics work at regulated price points, but not for consumers** ([09](09-distribution-partners-economics.md)):
   - **Inference:** about $13 per user per month for typical use on Cerebras (est.).
   - **Tier margins:**
     - Prosumer at $30/month: about 1%.
     - Business at $59/month: 54%.
     - Finance or health at $129/month: 77–81%.
     - Sovereign license: 51% in year 1, then 71%.
   - **Open architecture question:** whether each owner needs a dedicated enclave ($97–147/month).

10. **Market size:** $29.3B global TAM, $2.18B SAM and $85M ARR by 2031 in the base case (range $13M–$367M). Pitch the SAM and SOM, not the TAM ([07](07-tam-sam-som.md)). The biggest drivers are seats won, price per user and Android acceptance among professionals. Every SOM case assumes on-device ASR, redaction and a qualified device ship by 2027, and none of those exists today.

11. **Corporate and capital issues come before investor outreach** ([08](08-investors-funding-ma.md), unverified; confirm internally):
    - The web-visible issuer appears to be a Nasdaq microcap with very little cash.
    - The elizaOS token is reported as wound down after litigation.
    - A BVI parent would likely fail SBIR's US-ownership test and trigger FOCI review.

    **Recommendation:**
    - Form a **US Delaware entity with majority-US ownership** that licenses IP from the parent and elizaOS.
    - Raise a **$4–8M seed (est.) led by security or defense investors**, with one silicon or telecom corporate VC and no crypto lead.
    - Package redaction as a separable SDK, which also makes it an acquisition asset.
    - Disclose the parent and token history in the data room upfront.
    - Keep the elizaOS/crypto brand away from government and regulated sales.

## Opportunity ranking (consolidated)

| Rank | Market | Why | Gate to sell |
| --- | --- | --- | --- |
| 1 | Independent RIAs, MFOs and PE/VC IR teams | Fine-driven urgency, proven budget ($75–200/advisor), cloud-only incumbents, archiver channel | On-device ASR, redaction, archive connector, SOC 2 Type 1 |
| 2 | Law firms (small and mid-size), M&A and deal teams | Privilege waiver fear. Harvey serves BigLaw, which leaves the rest open | + legal hold, ABA 512 posture, counsel memo |
| 3 | Executives, boardrooms, HR investigations | "Clean-room meeting mode," trade-secret leaks (Samsung) | + managed-device tier, travel mode |
| 4 | Crypto-native and privacy-first high-net-worth buyers | Can buy today and brand-aligned. Kept on a separate brand | Consumer polish; keep separate from regulated brand |
| 5 | Behavioral and home health | Highly sensitive content, in-person and offline sessions, weaker incumbents | + BAA chain (AWS, Cerebras), EHR integration |
| 6 | Defense and government edge (SOCOM disconnected transcription, detective interviews) | Non-dilutive money, DIU fast path | US model, US entity, app on NIAP-listed Samsung or Pixel, then FedRAMP 20x |
| 7 | Sovereign (Gulf, EU) | Large deals, local-model requirement | Anchor customer, local hosting, 12–36-month cycles |
| — | Deprioritize: physician scribing (Abridge at $5.3B, Epic and DAX bundled), K-12, IC, consumer agent phone | | |

## Consolidated 12-month plan

| Quarter | Product | Trust and compliance | GTM and capital |
| --- | --- | --- | --- |
| Q4 2026 | Parakeet on-device ASR on a physical Pixel 10 (measure WER, latency and battery). Wire in the upstream redaction. Single egress gate | Correct the confidentiality wording. Consent, indicator and retention features. Published biometric policy. US-model option. Freedom-to-operate review of the redaction patents | Form a US entity. 10 design partners (RIAs and MFOs). Cerebras enterprise terms (ZDR, BAA) |
| Q1 2027 | Vault and rehydration, split archive record, anonymous diarization. Android Enterprise managed-app and launcher deployment | SOC 2 Type 1. Enclave attestation verified by the phone, replacing the quick tunnel | Paid pilots. Theta Lake and Smarsh connector. AWS Marketplace. Seed raise |
| Q2 2027 | pKVM-isolated audio pipeline on a privileged image. Always-on mode with an unhideable indicator | Confidential-GPU inference tier. Transparency log. External security audit | Legal and deal-team expansion. SBIR/AFWERX or a DIU CSO via the US entity |
| Q3 2027 | Managed-device "clean-room" tier. Legal hold and e-discovery export | SOC 2 Type 2. BAA chain. EU pack (works council, no emotion inference) | Behavioral health pilots. Carahsoft. Scope FedRAMP 20x Moderate |

## Top risks (see the 42-item register in [11](11-fit-gtm-risks.md))

1. The confidentiality overclaim is found in diligence or a security review. Fix the wording now and fix the architecture in Q1–Q2.
2. On-device ASR, redaction and a physical device have not shipped. Every revenue case depends on them.
3. A redaction false negative leaks MNPI, PHI or a card number. Keep the model tier conservative, route anything uncertain to local-only, and measure leakage.
4. Recording-consent and BIPA class actions. Default to all-party consent, visible indicators, no stored voiceprints, and no training on customer data.
5. Apple and Google give private transcription away for free. Win on compliance, archiving, admin control and verifiability, not on summaries.
6. Corporate, token and brand history with regulated buyers and investors. Use a separate entity and brand, and disclose upfront.
7. Focus: 14 prototype modules and a sibling product against a single wedge. Scope the MVP to scribe plus agent actions for one buyer.

## Things the original request did not ask about (details in [00](00-manifest.md) and [11](11-fit-gtm-risks.md))

- Retention duties in finance and legal conflict with redaction. The answer is a split record.
- The redaction manifest can be sold as compliance *evidence* to the CISO and CCO.
- Live captions for deaf and hard-of-hearing employees are an ADA wedge that is easy to approve.
- Travel and border mode (55K device searches by CBP in FY2025). Duress wipe.
- EU works councils, and the ban on workplace emotion recognition since 2025-02-02.
- Export classification (EAR 5A002/ENC). NDAA §889 and TAA for any hardware.
- Trademark clearance for "Alpha". elizaOS is MIT-licensed, so the moat is evals, certifications and integrations rather than code.
- Vendor-death and acquisition risk (Limitless, Humane). Offer customer-held keys, export and a local fallback.
- Publish Android AppFunctions so other assistants call Alpha rather than block it.
