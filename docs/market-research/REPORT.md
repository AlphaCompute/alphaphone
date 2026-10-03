# Alpha Phone — market, competitive, opportunity and technical research

Version 2, 2026-10-02. This version supersedes the 2026-09-30 report. There are 15 workstreams, about 140,000 words. The scope and blind-spot checklist are in the [manifest](00-manifest.md); every section has its tables, citations and open questions. This file is the consolidated view.

**Decisions reflected in this version**

- Alpha **forks AOSP** for its own signed image. Banking apps, Play Integrity and GMS are **not** requirements.
- Hosted inference **stays on Qwen** (`qwen-3.8-27b` via Cerebras). Buyer concerns about the model's origin are answered with Qwen-specific controls (§7.8 of [15](15-open-gap-technical-plan.md)), not by changing models.
- Since 2026-10-01 the **agent runs on the phone** (Android-resident), not in Nitro Enclaves. Only model requests leave the device ([decisions](../decisions.md)).
- Public and in-product wording follows the **claims ladder** below ([decisions](../decisions.md) item 7).

> **Evidence quality.** Sections 01–11 were fact-checked on 2026-10-02. Each one ends with a "Verification log" that lists corrections, "(verified 2026-10-02)" items and "(could not verify)" items. The 200-search budget ran out again during that pass, so some items still rely on direct page fetches or remain unverified. Nothing in sections 12–15 has been built or measured yet. This report is not legal or investment advice.

## Sections

| # | Section | Headline |
| --- | --- | --- |
| 01 | [Transcription devices and meeting AI](01-transcription-competitors.md) | Plaud leads with 2M+ devices and a >$1B valuation (its CEO told the WSJ). Every recorder is cloud-first. Otter's wiretap/BIPA claims survived dismissal on 2026-08-13 and Granola was sued 2026-07-30. IT departments are banning note-takers. |
| 02 | [Agentic phones and AI devices](02-agentic-phones-devices.md) | HP bought Humane for $116M. Rabbit is a cautionary tale. Doubao was blocked by apps it drove. Only privileged system apps can call AppFunctions, so Alpha's own image can and a launcher cannot. |
| 03 | [Secure phones and confidential AI](03-secure-phones-confidential-ai.md) | Secure-phone hardware is a shrinking niche. The PCC pattern is attestation, a transparency log, relays and audits. Cerebras has no attestation offering. |
| 04 | [Redaction technology and design](04-redaction.md) | No one redacts at the microphone. Use typed, role-annotated pseudonyms and an on-device vault. The AI-security M&A wave ran about $160–500M per deal. |
| 05 | [Regulation and compliance](05-regulation-compliance.md) | Consent litigation is the top risk. California SB 690 (signed 2026-09-30) does **not** help recorders. Finance must retain originals and redact copies. |
| 06 | [Vertical deep-dives](06-vertical-markets.md) | Wealth advisors rank #1. Government prices chat at about $1, so its opening is edge transcription. |
| 07 | [TAM/SAM/SOM](07-tam-sam-som.md) | $29.3B TAM, $2.18B SAM and $85M ARR at year 5 (base case). Inputs re-checked; arithmetic unchanged. |
| 08 | [Investors, funding, M&A](08-investors-funding-ma.md) | 84 investors, M&A comps and non-dilutive programs. **Parent company and token facts were corrected against SEC EDGAR.** |
| 09 | [Distribution, partners, economics](09-distribution-partners-economics.md) | Qwen on Cerebras costs $0.99/$1.49 per M tokens (verified), about $13/user/month. Reasoning tokens are a cost risk. Archivers are the finance channel. |
| 10 | [Always-on feasibility](10-always-on-tech-feasibility.md) | Parakeet runs near cloud accuracy. Pixel 10 has 3 mics and a 4,970 mAh battery. Canary is non-commercial, so it is excluded. |
| 11 | [Fit, GTM, risks, blind spots](11-fit-gtm-risks.md) | Beachhead: SEC-registered advisers. 42-item risk register, rescored for the AOSP fork. |
| 12 | [**AOSP always-on listening**](12-aosp-always-on-listening.md) | A privileged, no-network `sense` package. Use the HOTWORD source for non-intrusive concurrency. Stock AOSP has three indicator-bypass paths to close. Pixel 10 builds via adevtool. 36–55 engineer-weeks. |
| 13 | [**Redaction integration**](13-redaction-integration.md) | Upstream detectors, pseudonyms, secret-swap and audio redaction exist but are unwired. Exact egress points are mapped. 12 work packages, 7 upstream patches. |
| 14 | [**SOC 2 technical plan**](14-soc2-technical-plan.md) | Security, Availability and Confidentiality first. 20 repo gaps found. Type 1 around 2027-01-15, Type 2 around June 2027. Year-one cost $110–170k likely. |
| 15 | [**Open-gap technical plan**](15-open-gap-technical-plan.md) | Four pillars behind one egress gate, two Qwen lanes (fast and confidential), a claims ladder and a nine-month path to "audited". |

## Executive summary

1. **The gap is real, and it is an integration gap.** No shipping product combines four things behind one enforced egress gate with a per-request receipt:
   - on-device transcription;
   - pre-egress redaction;
   - built-in, per-participant consent;
   - verifiable cloud processing.

   Courts are treating vendor-cloud audio as possible eavesdropping (Otter, Granola, Fireflies BIPA). IT departments are banning outside note-takers ([01](01-transcription-competitors.md), [05](05-regulation-compliance.md)). Every component exists somewhere; the composition is the product ([15](15-open-gap-technical-plan.md)).

2. **Forking AOSP turns policy into enforcement.** A launcher can only ask for privacy properties; the image can make them true ([12](12-aosp-always-on-listening.md), [15](15-open-gap-technical-plan.md)):
   - The capture package holds the microphone in an SELinux domain with **no network access**.
   - ASR and redaction run in an isolated child process.
   - **Only redacted text** crosses a signature-protected interface to the agent app.
   - The SystemUI "Listening" chip is driven by what audioserver is actually capturing and cannot be hidden.

   Stock AOSP has three ways to record without an indicator: exempt ambient-audio roles, the HOTWORD source without `ro.hotword.detection_service_required`, and HotwordDetectionService attribution. The fork must close all three.

   - **Background capture:** `persistent` gets past the background-start rules.
   - **Concurrency:** the `HOTWORD` source never steals the microphone from calls or other apps.
   - **Power:** the main processor cannot sleep while capturing, about 5–10% of battery per day (est.).
   - **Hardware:** Pixel 10 builds via GrapheneOS adevtool even though Google stopped publishing device trees.
   - **Effort:** about 36–55 engineer-weeks.
   - **ADR change needed:** ADR-04's non-privileged rule must be superseded for the listener package. The legal right to redistribute Pixel vendor blobs needs review.

3. **The redaction tooling largely exists upstream and is unwired** ([13](13-redaction-integration.md)).
   - **Reusable modules** in `vendor/eliza/packages/core/src/security/`:
     - `pii-detectors.ts` (24 kinds, checksum-validated);
     - `pii-pseudonymizer.ts`;
     - `secret-swap.ts`;
     - `guarded-stream.ts` (streamed rehydration);
     - `confidential-inference.ts` (audit gate).
   - **Audio redaction** with re-transcription verification is in `packages/core/src/audio-redaction*.ts`.
   - **Corrections to earlier research:**
     - Pseudonyms are realistic fake names, not typed tokens.
     - The audit record does not cover redaction.
     - The core PII modules have no unit tests.
     - Upstream redaction is off by default and runs only at the agent's model boundary.
   - **Quickest real win:** the resident agent sends unredacted prompts straight to Cerebras. Enabling `ELIZA_SECRET_SWAP_ENABLED` and `ELIZA_PII_SWAP_ENABLED` in `AlphaLocalAgentPlugin.configureEnvironment` protects the only routine cloud path today.
   - **Full plan:**
     - a renderer and native detection layer, with a GLiNER-PII ONNX model behind upstream's `PiiEntityRecognizer`;
     - a Java gate that refuses any request body without a matching redaction receipt;
     - a Keystore vault;
     - four policy tiers;
     - a signed, hash-chained receipt schema;
     - a spoken-meeting eval set.

     Estimated effort: about 12 engineer-weeks for a standard-tier gate, and 22–26 for the full confidential tier.

4. **Confidentiality claim: corrected and now enforced in code.** The agent is on the phone, so the routine cloud plaintext path is model inference: Cerebras running Qwen, protected by a no-retention commitment that is contractual, not attested. The claims ladder ([15](15-open-gap-technical-plan.md) §9) is now the single source of truth.

   | Rung | Earned by | Permitted wording |
   | --- | --- | --- |
   | **L0 (today)** | — | "The assistant runs on your phone. Model requests send prompts and selected context over TLS to Cerebras (US) running Qwen. Alibaba does not receive your data. No-retention is contractual." Never say sealed, attested, enclave-protected or "never leaves". |
   | L1 | Physical-device ASR evidence | "Conversations are transcribed on the phone; audio is not uploaded." |
   | L2 | Published leak-rate report | "Identifiers are replaced before anything leaves; measured leak rate X%." |
   | L3 | Consent evidence (OS-enforced only after image boot on a device) | "Announced, per-participant consent with a signed record." |
   | L4 | Confidential lane live | "Your phone verifies the server hardware and the exact Qwen weights hash before sending." |
   | L5 | Transparency log, reproducible builds, multi-party release, external audit | "Independently verifiable and audited." |
   | L6 | Customer-held keys | "Your organization holds the keys and can veto releases." |

   **Implemented on 2026-10-02:**
   - Mock-mode copy that claimed "Sealed · Attested", "Attestation passed · Keys never left the device" and "stays in the enclave" now describes planned redaction features.
   - The real-mode adapter shows "Not active" for redaction.
   - A new browser test, `test/browser/confidentiality-claims.spec.ts`, fails if any real or mock screen asserts sealing, attestation or data locality. A negative control proved it catches the old copy.

5. **Qwen stays, and its origin is answered rather than hidden** ([15](15-open-gap-technical-plan.md) §7.8):
   - A self-hosted **confidential lane** runs Alpha's pinned Qwen weights on confidential H100/H200. The phone verifies the CPU+GPU attestation, including the weights hash, encrypts end to end (HPKE) and sends through an OHTTP relay. Alibaba is never a data recipient.
   - Redaction applies on every lane.
   - Provenance is documented in a model BOM with independent re-hashes.
   - The model has no egress or autonomous tools.
   - Admission tests are published per release.

   **Stated limits:** testing cannot prove the absence of a backdoor, and some defense and IC buyers will refuse PRC-origin models as a matter of policy. The FY2026 NDAA's DeepSeek removal is a precedent ([11](11-fit-gtm-risks.md)).

   **Costs (est.):**

   | Option | Cost per user | Notes |
   | --- | --- | --- |
   | Cerebras Qwen | about $13.22/month | Verified list price. Reasoning-heavy output can push it to $15.90 ([09](09-distribution-partners-economics.md)). |
   | Self-hosted on Phala H200 | about $11.70 | Parity at about 400 active users. The throughput estimate must be measured. |

   Confidential GPUs are slower per user, so background summaries go first.

6. **Beachhead unchanged: SEC/FINRA-regulated advisers** (RIAs, MFOs, PE/VC IR teams), then law firms and deal teams, executives and HR investigations, then behavioral and home health ([06](06-vertical-markets.md), [11](11-fit-gtm-risks.md)).
   - **Verification caveat:** SEC Chair Atkins has de-emphasized recordkeeping cases, so "fear of fines" is a weaker lever than in 2021–24. FINRA enforcement continues. Lead with a clean archive, privilege protection and IT approval rather than fines.
   - **Competitor funding:** Jump raised an $80M Series B in February 2026 and serves 27,000 advisors.

7. **SOC 2 is the first market-access gate** ([14](14-soc2-technical-plan.md)).
   - **Scope:** start with Security, Availability and Confidentiality. Add Privacy once the recording beta precedes the observation window. Add Processing Integrity only after redaction has a published accuracy target.
   - **Subservice organizations:** Cerebras (it has a SOC 2 Type 2), AWS, Cloudflare and GitHub are carved out.
   - **High-severity repo gaps:**
     - no branch protection on `main`;
     - no second reviewer and unsigned commits;
     - no Dependabot, CodeQL or SBOM;
     - unsigned release APKs;
     - a missing enclave signer;
     - a temporary `trycloudflare.com` tunnel;
     - admin accounts on personal Gmail;
     - no policies or registers.
   - **Signing-key custody:** app, platform, AVB, OTA and enclave keys are the Alpha-specific control area.
   - **Timeline and cost (est.):** Type 1 as of about 2027-01-15, a 3-month Type 2 window to about 2027-04-16, and the report around June 2027. Year one costs $110–170k plus a fractional security lead and **a second engineer, who is also the only way to get independent code review**.

8. **Distribution: software first, then Alpha's image** ([09](09-distribution-partners-economics.md)).
   - With banking apps out of scope, **Play Integrity is no longer a blocker** for the custom image.
   - **The remaining blocker is enterprise MDM.** Intune's AOSP device list still contains only the HMD Terra M, so a managed fleet of Alpha-image phones needs Android Enterprise work or partner validation.
   - **Sequence:**
     1. Design partners on Alpha-image Pixels plus the app.
     2. Finance channels through archivers and AWS Marketplace.
     3. Carahsoft and a DIU CSO.
     4. Sovereign deals.
   - **Margins (est.):** 54–81% at $59–129/user/month.

9. **Market size:** base-case TAM $29.3B, SAM $2.18B, SOM $85M ARR by 2031 ([07](07-tam-sam-som.md)). Every SOM case depends on L1–L3 shipping by 2027.

10. **Corporate and capital (corrected against SEC EDGAR, [08](08-investors-funding-ma.md)).** Verify internally before external use.
    - **The parent:** Alpha Compute Corp (NASDAQ: ALP), formerly AlphaTON Capital (until April 2026) and Portage Biotech (until September 2025).
      - Market cap is about **$7.0M** (2026-10-02), not $2.29M.
      - A 1:50 reverse split on 2026-09-09 was followed by regained compliance on 2026-09-25.
      - The FY2026 20-F/A carries a **going-concern** paragraph.
      - The filings do not mention Alpha Phone or elizaOS.
    - **The token:**
      - The class action is *Doe v. Walters*, 1:26-cv-03238 (S.D.N.Y., filed 2026-04-22). Its settlement terms are known only from public statements.
      - Peak market cap was about $2.39B (2025-01-02).
      - The AI16Z→ELIZAOS migration in November 2025 was 1:6.
      - a16z demanded the project stop using its branding in January 2025.
    - **Recommendation unchanged:** a US Delaware entity with majority-US ownership (for SBIR, which is confirmed to require it, and for FOCI), a security- or defense-led seed, redaction as a separable SDK, and full disclosure in the data room.

## Consolidated opportunity ranking

| Rank | Market | Why | Gate |
| --- | --- | --- | --- |
| 1 | Independent RIAs, MFOs, PE/VC IR | Proven budget ($75–200/advisor), cloud-only incumbents, archiver channel | L1+L2, archive connector, SOC 2 Type 1 |
| 2 | Small/mid law firms, M&A and deal teams | Fear of privilege waiver. Harvey (BigLaw) and Legora ($5.55B) leave the rest open | + legal hold, counsel memo |
| 3 | Executives, boardrooms, HR investigations | Clean-room meetings, trade secrets | + Alpha-image device tier, travel mode |
| 4 | Privacy-first prosumers | Can buy now | Separate brand from regulated sales |
| 5 | Behavioral and home health | Highly sensitive, in-person, weaker incumbents | + BAA chain (Cerebras BAA not confirmed), EHR |
| 6 | Defense and government edge | Non-dilutive funding, DIU | US entity. Qwen origin is a hard policy question for some buyers |
| 7 | Sovereign | Large deals | Confidential lane (L4+), local hosting |

## Consolidated plan (next 9 months, est.)

| Window | Product and platform | Trust and compliance | GTM and capital |
| --- | --- | --- | --- |
| Oct–Nov 2026 | Pixel 10 Alpha image bring-up (adevtool, `avb_custom_key`). Parakeet on-device ASR measured on a physical device (**L1**). Enable upstream PII/secret swap on the resident agent | Claims ladder enforced (done). Branch protection, second reviewer, Dependabot/CodeQL, SBOM. Signing-key custody plan | US entity. 10 design partners. Cerebras DPA and BAA |
| Dec 2026–Jan 2027 | `sense` package (no-network SELinux domain, HOTWORD capture, SystemUI chip). Redaction gate, vault and receipts. Spoken-meeting eval (**L2**) | SOC 2 Type 1 (about 2027-01-15). Consent ledger and jurisdiction packs (**L3**) | Paid pilots. Archiver connector. Seed |
| Feb–Apr 2027 | Confidential Qwen lane on Tinfoil or Phala. Phone-side attestation and HPKE/OHTTP (**L4**) | Type 2 window. Transparency log, reproducible builds, 3-of-5 release policy | Legal and deal-team expansion. DIU CSO/SBIR via the US entity |
| May–Jun 2027 | DSP/NPU/pKVM spikes. Signed OTA with 7-day dogfood | External audit (**L5**). Type 2 report. Customer-held keys pilot (**L6**) | Behavioral health pilots. Sovereign scoping |

## Top risks

1. Overclaiming confidentiality. This is now mitigated by the claims ladder and the automated test; every new screen and every sales deck must stay within the earned rung.
2. On-device ASR, redaction and the Alpha image are not yet built or measured. Every revenue case depends on them.
3. A redaction false negative. The mitigation is fail-closed tiers, leak-rate gating and redaction in front of every lane.
4. Consent and BIPA litigation. Use an all-party default, anonymous per-session diarization, no voiceprints and no training on customer data.
5. Qwen origin for defense, IC and some federal or finance buyers. The answer is the confidential lane and model BOM; some buyers will still refuse.
6. Platform risks:
   - Pixel vendor-blob redistribution rights;
   - Google's twice-yearly AOSP cadence and slow kernel source releases;
   - MDM support for a custom image;
   - battery cost of always-on capture.
7. Parent company going concern and the token history in diligence.
8. Team capacity: about 11–13 FTE for the full plan against a very small team today. SOC 2 itself requires a second engineer.

## Not asked about, but material

- Retention collides with redaction, which a split record solves. The redaction receipt can be sold to the CCO and CISO as compliance evidence.
- Live captions for deaf and hard-of-hearing employees are an easy-approval ADA wedge.
- Travel and border mode, and duress wipe.
- Works councils, and the EU ban on workplace emotion inference.
- EAR 5A002/ENC export classification.
- NVIDIA Canary and Piiranha are non-commercial, and Piper is GPL, so all three are excluded.
- Two existing US patents (12229313, 12189817) require a freedom-to-operate review.
- Trademark clearance for "Alpha".
- elizaOS is MIT-licensed, so the moat is evals, certifications and integrations.
- Vendor-death insurance: customer-held keys, export and local fallback.
- Publish AppFunctions so other assistants call into Alpha.
