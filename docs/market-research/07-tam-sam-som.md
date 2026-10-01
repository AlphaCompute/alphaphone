# 07 — TAM, SAM and SOM

Research date: 2026-09-30. Workstream 7 of the [manifest](00-manifest.md). This is market research, not engineering acceptance. Product capability assumptions follow the manifest baseline: the full AOSP image is not qualified on a physical device, on-device STT/TTS is not yet met, the redaction pipeline does not exist yet, and there are no FedRAMP, NIAP, CSfC or FIPS certifications.

**Conventions**
- Every sourced input carries a URL. Numbers that are **derived** (computed from sourced inputs) are marked `(der.)`. Numbers that are **assumptions or estimates** are marked `(est.)`.
- Market-research-firm figures ("syndicated reports") are not audited and often disagree by 2–10x. They are used here only to bracket the size of the space. The bottom-up model drives the headline numbers.
- "ARPU" means annual revenue per user, including hardware amortized over 3 years where a device is sold. It is not gross hardware revenue in the year of sale.
- Year 1 of the SOM curve is 2027. Year 5 is 2031.

---

## Investor summary (headline table)

| Layer | Definition | Conservative | **Base** | Aggressive | Basis |
| --- | --- | --- | --- | --- | --- |
| **TAM (global)** | All regulated or confidentiality-bound knowledge workers in healthcare, finance, legal, government/defense, education and executive offices, at device-plus-subscription ARPU | $16.2B/yr | **$29.3B/yr** | $46.6B/yr | US bottom-up × 2.5 global spend multiplier (der./est.) |
| TAM (US) | Same population, US only | $6.5B/yr | **$11.7B/yr** | $18.6B/yr | 12.4M US workers (der. from BLS/FINRA) × ARPU scenarios (est.) |
| **SAM** | Segments Alpha's architecture can serve by 2028–29 without FedRAMP High/IL5/NIAP/CSfC: independent practices, independent advisors, small/mid law, executives, pilot-grade government; US plus selected English-speaking markets; filtered for Android/dedicated-device acceptance | $0.48B/yr (553k users) | **$2.18B/yr (1.41M users)** | $7.5B/yr (3.28M users) | Segment filters × reach factor × ARPU (all der./est.) |
| **SOM (year 5, 2031)** | Realistic paid seats after a 5-year adoption curve | 15k seats, **$13M ARR** | **55k seats, $85M ARR** | 160k seats, $367M ARR | 2.7% / 3.9% / 4.9% of SAM users (est.) |
| Theoretical horizontal ceiling (not TAM) | All 71.3M US management/professional workers at a $30/mo Copilot-like price | — | $25.7B/yr (US) | — | [BLS CPS table 9](https://www.bls.gov/cps/cpsaat09.htm), [Microsoft 365 Copilot pricing](https://www.microsoft.com/en-us/microsoft-365-copilot/pricing) (der.) |
| Top-down cross-check | The closest adjacencies in 2025: meeting assistants ($1.2–3.8B), AI speech-to-text ($3.3–3.9B), ambient scribes ($0.6–2.3B), ultra-secure phones ($4.1–4.9B), AI-specific data security ($8.7B GenAI cybersecurity) | — | ~$18–23B combined (der.) | — | See top-down table, section 1 |

**Reading the table.** The TAM is large because regulated knowledge work is large. The SAM is roughly 7% of the global TAM in the base case, because certification gates keep out most government and large-enterprise buyers for 2–3 years, and because an Android-first dedicated device is a hard sell to iPhone-carrying professionals. The base SOM ($85M ARR in 2031) is roughly 14% of what the whole ambient-scribe category earned in 2025 ($600M, [Menlo Ventures](https://menlovc.com/perspective/2025-the-state-of-ai-in-healthcare/)). It is about a third of Plaud's 2025 revenue ($250M, [KrASIA](https://kr-asia.com/tencents-rumored-plaud-deal-points-to-looming-ai-hardware-contest)). That makes it ambitious but not unprecedented.

**Best beachheads (section 5):** (1) independent wealth advisors and RIAs: $425M/yr beachhead market, $3–26M ARR by year 3; (2) behavioral health and private clinics: $623M/yr, $2–23M ARR by year 3; (3) defense and government pilots: $548M/yr, $1–13M by year 3 plus non-dilutive funding. All three figures are derived or estimated.

---

## 1. Top-down market estimates

### 1.1 Summary of analyst estimates

Where a firm's attribution came only from a search-result snippet and was not verified on the page, it is marked "(attribution unverified)".

| Category | Firm (publication) | Base-year size | Forecast | CAGR | Source |
| --- | --- | --- | --- | --- | --- |
| **Speech & voice recognition** | MarketsandMarkets (2025) | $9.66B (2025) | $23.11B (2030) | 19.1% | [M&M press release](https://www.marketsandmarkets.com/PressReleases/speech-voice-recognition.asp) |
| Speech & voice recognition, US | MarketsandMarkets | $3.13B (2025) | $7.70B (2030) | 19.7% | [M&M US](https://www.marketsandmarkets.com/Market-Reports/geography/speech-voice-recognition-market/us) |
| AI speech-to-text tools | Precedence Research | $3.30B (2025) | $16.42B (2035) | 17.41% | [Precedence](https://www.precedenceresearch.com/ai-speech-to-text-tool-market) |
| AI speech-to-text tools | Market Research Future | $3.86B (2025) | $36.91B (2035) | 25.32% | [MRFR](https://www.marketresearchfuture.com/reports/ai-speech-to-text-tool-market-12209) |
| AI speech-to-text tools | Technavio | +$8.29B increment 2024–29 | — | 28.8% | [Technavio](https://www.technavio.com/report/ai-speech-to-text-tool-market-industry-analysis) |
| Speech-to-text API | Allied Market Research | $5B (2024) | $21B (2034) | 15.2% | [PR Newswire](https://www.prnewswire.com/news-releases/speech-to-text-api-market-to-reach-5-billion-by-2024-in-the-short-term-and-21-billion-by-2034-globally-at-15-2-cagr-allied-market-research-302452178.html) |
| **AI meeting assistants** | Precedence Research | ~$1.20B (2025) (attribution unverified) | $6.28B (2035) | ~18% | [Precedence](https://www.precedenceresearch.com/ai-in-meeting-assistants-market) |
| AI meeting assistants | Grand View Research | not retrieved (page returned 403) | 2033 | 25.8% (2026–33) | [GVR](https://www.grandviewresearch.com/industry-analysis/ai-meeting-assistant-market-report) |
| AI meeting assistants | Research&Markets / TBRC / Dataintelo / MRI | $3.14–3.8B (2025) (attribution unverified) | 2030–34 | 19–25% | [R&M](https://www.researchandmarkets.com/reports/6226248/ai-powered-meeting-assistants-market-report), [TBRC](https://www.thebusinessresearchcompany.com/report/artificial-intelligence-ai-powered-meeting-assistants-global-market-report), [Dataintelo](https://dataintelo.com/report/ai-meeting-assistants-market) |
| Horizontal AI copilots (enterprise spend) | Menlo Ventures (Dec 2025) | $8.4B (2025), of which general-purpose copilots $7.2B | — | — | [Menlo Enterprise 2025](https://menlovc.com/perspective/2025-the-state-of-generative-ai-in-the-enterprise/) |
| **AI voice recorders (hardware)** | No credible syndicated report. Best proxy is the leader's revenue: Plaud | Plaud revenue ~$250M (2025, expected); ~$56M (2024) | Target $500M sales (2026) | ~3x YoY (2025) | [KrASIA](https://kr-asia.com/tencents-rumored-plaud-deal-points-to-looming-ai-hardware-contest), [Sacra](https://sacra.com/c/plaud/) |
| AI voice recorders | Plaud (company, via TechCrunch, June 2026) | >2M devices shipped; software ARR >$100M; ~50% of owners pay | — | — | [TechCrunch](https://techcrunch.com/2026/06/16/plaud-says-its-software-business-topped-100m-in-arr-after-shipping-over-2m-ai-notetakers/) |
| Voice recorders (all, incl. legacy) | ReportPrime | $1.09B (2025) | 2032 | — | [ReportPrime](https://www.reportprime.com/voice-recorder-r1486) |
| **GenAI smartphones** (units) | IDC (Jul 2024) | 234.2M (2024, 19% share) | >370M (2025, 30%), 912M (2028, >70%) | 78.4% (2024–28) | [IDC](https://my.idc.com/getdoc.jsp?containerId=prUS52478124), [RCR](https://www.rcrwireless.com/20240801/featured/idc-predicts-912-million-gen-ai-smartphone-shipments-by-2028) |
| GenAI smartphones (units) | Counterpoint (Mar 2025; Jun 2026) | >400M (2025, ~1/3 share) | 45% share (2026), 52% (2027) | — | [Counterpoint 2025](https://counterpointresearch.com/en/insights/genai-smartphone-shipments-to-exceed-400-million-in-2025-capturing-onethird-of-global-market), [Counterpoint 2026](https://counterpointresearch.com/en/insights/genai-smartphone-share-to-rise-to-45-percent-of-global-shipments-in-2026) |
| Total smartphones | IDC (2025) | ~+1% growth in 2025 | — | — | [IDC](https://my.idc.com/getdoc.jsp?containerId=prUS53767725) |
| **Ultra-secure smartphones** | IMARC | $4.91B (2025) | $24.04B (2034) | 17.68% | [IMARC](https://www.imarcgroup.com/ultra-secure-smartphone-market) |
| Ultra-secure smartphones | Second firm (SkyQuest/MRFR; attribution unverified) | $4.06B (2025) | $13.41B (2033) | 16.1% | [SkyQuest](https://www.skyquestt.com/report/ultra-secure-smartphone-market) |
| Encrypted phones | Verified Market Reports | $1.39B (2025) | $8.57B (2034) | 22.4% | [VMR](https://www.verifiedmarketreports.com/product/encrypted-phone-market-size-and-forecast/) |
| **Rugged phones** | Coherent / Technavio / others (attribution unverified) | $3.5–5.8B (2025) | 2030–32 | 4.5–11.1% | [Coherent](https://www.coherentmarketinsights.com/industry-reports/rugged-phones-market), [Technavio](https://www.technavio.com/report/rugged-smartphone-market-analysis) |
| **Enterprise mobility management** | Grand View Research | $19.0B (2024) | $69.1B (2030) | 24.1% | [GVR press release](https://www.grandviewresearch.com/press-release/global-enterprise-mobility-management-emm-market) |
| Enterprise mobility management | Mordor Intelligence | $33.9B (2025) | $94.47B (2031) | 18.62% | [Mordor](https://www.mordorintelligence.com/industry-reports/enterprise-mobility-management-market) |
| **Confidential computing** | Grand View Research | $5.5B (2023) | $153.8B (2030) | 61.1% | [GVR](https://www.grandviewresearch.com/industry-analysis/confidential-computing-market-report) |
| Confidential computing | Everest Group (2021 forecast) | — | $54B (2026) best case; ~$12B worst case | 90–95% best case; 40–45% worst | [Everest](https://www.everestgrp.com/in-the-news/confidential-computing-signals-new-security-model-in-the-news.html) |
| Confidential computing | Precedence Research | — | $1,281B (2034), an outlier | — | [Precedence](https://www.precedenceresearch.com/confidential-computing-market) |
| **Data loss prevention** | IMARC | $3.1B (2025) | 2034 | 18.1% | [IMARC](https://www.imarcgroup.com/data-loss-prevention-market) |
| Data loss prevention | Straits Research | $3.33B (2025) | 2034 | 22.09% | [Straits](https://straitsresearch.com/report/data-loss-prevention-market) |
| Data loss prevention | 360iResearch | $6.39B (2025) | 2032 | — | [360i](https://www.360iresearch.com/library/intelligence/data-loss-prevention) |
| **AI-specific data security (GenAI cyber)** | MarketsandMarkets | $8.65B (2025) | $35.5B (2031) | 26.5% | [M&M](https://www.marketsandmarkets.com/Market-Reports/generative-ai-cybersecurity-market-164202814.html) |
| AI security (all) | Via Lakera blog (firm attribution unverified) | $24.3B (2024), $30.1B (2025) | $133.8B (2030) | 21.9% | [Lakera](https://www.lakera.ai/blog/ai-security-trends) |
| AI cybersecurity spend | Gartner (Jan 2026, via secondary) | $51B (2026) | — | — | [Digital Applied compilation](https://www.digitalapplied.com/blog/ai-spending-forecasts-2026-gartner-idc-stanford-compiled) |
| Shadow-AI risk (qualitative driver) | Gartner | >40% of enterprises will have shadow-AI incidents by 2030 | — | — | [Petri](https://petri.com/shadow-ai-enterprise-threat-2030/) |
| **Ambient clinical documentation** | Menlo Ventures (Oct 2025) | $600M (2025), 2.4x YoY. Shares: Microsoft/Nuance 33%, Abridge 30%, Ambience 13%, Suki 10% | — | — | [Menlo Healthcare 2025](https://menlovc.com/perspective/2025-the-state-of-ai-in-healthcare/), [Becker's](https://www.beckershospitalreview.com/healthcare-information-technology/ai/ambient-ai-scribes-by-market-share/) |
| Ambient scribe | Astute Analytica | $1.2B (2025) | 2035 | — | [Astute](https://www.astuteanalytica.com/industry-report/ai-clinical-documentation-ambient-scribe-market) |
| Ambient scribe | Growth Market Reports | $1.75B (2025) | $12.04B (2034) | — | [GMR](https://growthmarketreports.com/report/ambient-ai-scribe-market) |
| Ambient clinical intelligence | DataM Intelligence | $2.34B (2025) | — | — | [DataM](https://www.datamintelligence.com/research-report/ambient-clinical-intelligence-voice-ai-for-ehr-market) |
| Healthcare AI spend (all) | Menlo Ventures | $1.4B (2025), ~3x YoY | — | — | [GlobeNewswire](https://www.globenewswire.com/news-release/2025/10/21/3170253/0/en/Healthcare-Adopts-AI-2-2x-Faster-than-Other-Industries-Driving-Record-1-4B-in-AI-Spending.html) |
| **Compliance archiving** | IMARC (enterprise information archiving) | $9.9B (2025); BFSI 28.74% share | $33.15B (2034) | 14.37% | [IMARC](https://www.imarcgroup.com/enterprise-information-archiving-market) |
| Customer communications archiving | Dataintelo | $6.8B (2025); North America $2.61B | 2034 | — | [Dataintelo](https://dataintelo.com/report/customer-communications-archiving-market) |
| Screen/voice recording compliance, FS | Marketintelo | $4.2B (2025) | $10.3B (2034) | 11.8% | [Marketintelo](https://marketintelo.com/report/screen-recording-compliance-for-financial-services-market) |
| **Court reporting (US)** | P&S Intelligence | $552.9M (2025) | 2032 | — | [P&S](https://www.psmarketresearch.com/market-analysis/us-court-reporting-services-market) |
| Legal transcription (US) | Market Research Future | $652.8M (2025) | 2034 | — | [MRFR](https://www.marketresearchfuture.com/reports/us-legal-transcription-market-14931) |
| Legal transcription (US) | Ditto Transcripts (a vendor blog) | $2.62B (2025) | — | — | [Ditto](https://www.dittotranscripts.com/blog/the-u-s-legal-transcription-market-in-2025/) |
| Court reporting & deposition (global) | Worldwide Market Reports | $4.32B (2025) | — | — | [WMR](https://www.worldwidemarketreports.com/market-insights/court-reporting-deposition-services-market-1017552) |
| Legal vertical AI spend | Menlo Ventures | $650M (2025) | — | — | [Menlo Enterprise 2025](https://menlovc.com/perspective/2025-the-state-of-generative-ai-in-the-enterprise/) |
| **AI agents** | MarketsandMarkets | $7.84B (2025) | $52.62B (2030) | 46.3% | [M&M](https://www.marketsandmarkets.com/PressReleases/ai-agents.asp) |
| AI agents | Grand View Research | — | $50.31B (2030) | 45.8% | [Yahoo/GVR](https://finance.yahoo.com/news/ai-agents-market-size-hit-143500811.html) |
| Agent software (broad definition) | Gartner (via secondary) | $86.4B (2025) | $206.5B (2026), $376.3B (2027) | — | [Digital Applied](https://www.digitalapplied.com/blog/ai-spending-forecasts-2026-gartner-idc-stanford-compiled) |
| Enterprise GenAI spend | Menlo Ventures | $37B (2025), 3.2x YoY; apps $19B | — | — | [Menlo Enterprise 2025](https://menlovc.com/perspective/2025-the-state-of-generative-ai-in-the-enterprise/) |
| **Sovereign AI / sovereign cloud** | Gartner (Feb 2026) | Sovereign cloud IaaS $80B (2026) | — | — | [Gartner](https://www.gartner.com/en/newsroom/press-releases/2026-02-09-gartner-says-worldwide-sovereign-cloud-iaas-spending-will-total-us-dollars-80-billion-in-2026) |
| Sovereign AI infrastructure | Next Move Strategy Consulting | $61.4B (2025), $78.6B (2026) | $726.6B (2035) | 28.03% | [NextMSC](https://www.nextmsc.com/report/sovereign-ai-infrastructure-market-ic4315) |
| AI infrastructure (all) | IDC (Apr 2026) | $318B (2025) | $487B (2026) | — | [IDC blog](https://www.idc.com/resource-center/blog/ai-infrastructure-spending-caps-historic-year-at-90-billion-in-q4-2025-2029-spending-to-eclipse-1-trillion/) |
| AI spending (all) | Gartner | $1.5T (2025) | $2.5T (2026) | — | [Gartner 2025](https://www.gartner.com/en/newsroom/press-releases/2025-09-17-gartner-says-worldwide-ai-spending-will-total-1-point-5-trillion-in-2025), [Gartner 2026](https://www.gartner.com/en/newsroom/press-releases/2026-1-15-gartner-says-worldwide-ai-spending-will-total-2-point-5-trillion-dollars-in-2026) |

### 1.2 Where the firms disagree, and why it matters

| Topic | Spread | Likely cause | What to use |
| --- | --- | --- | --- |
| AI meeting assistants | $1.2B vs $3.8B (2025), about 3x | Precedence counts standalone assistants. Others include bundled conferencing AI (Zoom, Teams). Menlo's $7.2B for general copilots overlaps. | Use ~$3B for 2025, with note-taking as a *feature* inside $8.4B of horizontal copilot spend. |
| AI speech-to-text | $3.3B–$3.9B (tools) vs $9.7B (all speech recognition) vs $19B (Fortune, all recognition incl. voice assistants, reported via [Zight](https://zight.com/blog/ai-transcription-trends-what-to-expect-in-2025/)) | Scope: API-only, tools, or everything including consumer voice assistants and biometrics | Use M&M's $9.66B as the "speech" envelope and ~$3.5B as the "transcription tool" slice. |
| Ambient scribe | $0.6B (Menlo, bottom-up vendor revenue) vs $1.2–2.34B (syndicated) | Menlo counts recognized vendor revenue. Syndicated reports include services and adjacent documentation products. | Trust Menlo's $600M. Syndicated figures overstate it by 2–4x. |
| Confidential computing | $12B–$54B by 2026 (Everest) vs $18.1B in 2026 (GVR) vs $1.28T by 2034 (Precedence) | Some firms count all hardware with TEE capability (every modern CPU/GPU) as "confidential computing" | Treat it as an *enabler*, not a market Alpha sells into. Do not add it to TAM. |
| EMM | $19B (2024, GVR) vs $33.9B (2025, Mordor) | Mordor includes more services and identity | Alpha is a *managed endpoint*, not an EMM vendor. It must integrate with EMM (see 09). Excluded from TAM. |
| GenAI phones | IDC >370M vs Counterpoint >400M units (2025) | Definition of "GenAI-capable" (NPU TOPS threshold, on-device model size) | Both agree that GenAI capability becomes table stakes (>50% share by 2027–28). Alpha cannot differentiate on "AI phone" alone. |
| Legal transcription (US) | $0.65B (MRFR) vs $2.62B (Ditto vendor blog) | Vendor blog is promotional. Court reporting is counted separately. | Use ~$0.6B transcription + ~$0.55–0.9B court reporting. |

### 1.3 Top-down "serviceable adjacency" roll-up (der.)

These are the slices of the categories above that an office assistant with on-device transcription and redaction competes for directly. Shares are estimates.

| Category | 2025 size used | Share Alpha's product competes for (est.) | Adjacency $ (der.) |
| --- | --- | --- | --- |
| AI meeting assistants | $3.0B (mid of range) | 60% (in-person and phone capture plus summaries) | $1.8B |
| AI speech-to-text tools | $3.5B | 25% (professional dictation, not APIs) | $0.9B |
| Ambient scribe | $0.6B | 100% | $0.6B |
| AI voice recorders (Plaud as ~⅔ of the category, est.) | ~$0.4B | 100% | $0.4B |
| Ultra-secure smartphones | $4.5B | 30% (government/enterprise units that want an assistant) | $1.35B |
| GenAI cybersecurity / AI DLP | $8.65B | 5% (endpoint redaction before AI egress) | $0.43B |
| FS communications recording and archiving | $4.2B | 10% (capturing in-person and mobile advisor conversations) | $0.42B |
| Legal transcription and court reporting (US) | $1.2B | 10% (attorney-side notes, not certified transcripts) | $0.12B |
| **Total** | | | **≈ $6.0B (2025)** |

Growing at the blended ~20–25% CAGR that the firms report, this adjacency reaches roughly **$15–18B by 2030** (der.). That brackets the bottom-up US TAM ($11.7B base) and is below the global TAM ($29B base), which assumes full monetization of every regulated seat.

---

## 2. Bottom-up model

### 2.1 Population inputs (US)

| # | Segment | Sub-population | US count | Source | Notes |
| --- | --- | --- | --- | --- | --- |
| H1 | Healthcare | Physicians and surgeons | 862,800 (2025) | [BLS OOH](https://www.bls.gov/ooh/healthcare/physicians-and-surgeons.htm) | |
| H2 | Healthcare | Nurse practitioners | 336,300 (2025) | [BLS OOH](https://www.bls.gov/ooh/healthcare/nurse-anesthetists-nurse-midwives-and-nurse-practitioners.htm) | |
| H3 | Healthcare | Physician assistants | 168,900 (2025) | [BLS OOH](https://www.bls.gov/ooh/healthcare/physician-assistants.htm) | |
| H4 | Healthcare / BH | Substance abuse, behavioral and mental-health counselors | 533,400 (2025) | [BLS OOH](https://www.bls.gov/ooh/community-and-social-service/substance-abuse-behavioral-disorder-and-mental-health-counselors.htm) | Growing 18% to 2035 |
| H5 | Healthcare / BH | Clinical and counseling psychologists | 81,300 (2025) | [BLS OOH](https://www.bls.gov/ooh/life-physical-and-social-science/psychologists.htm) | |
| | **Healthcare total** | | **1,982,700 (der.)** | | |
| F1 | Finance | FINRA-registered securities representatives | ~625,000 (Mar 2026); 3,250+ firms | [Wikipedia (FINRA)](https://en.wikipedia.org/wiki/Financial_Industry_Regulatory_Authority) | FINRA's own 2025 Industry Snapshot PDF could not be retrieved. Treat as secondary. |
| F1a | Finance (cross-check) | Personal financial advisors | 299,400 (2025) | [BLS OOH](https://www.bls.gov/ooh/business-and-financial/personal-financial-advisors.htm) | Overlaps F1. Not added. |
| F1b | Finance (cross-check) | Securities, commodities and financial services sales agents | 531,000 (2025) | [BLS OOH](https://www.bls.gov/ooh/sales/securities-commodities-and-financial-services-sales-agents.htm) | Overlaps F1. Not added. |
| | **Finance total** | | **625,000** | | Excludes insurance underwriters (125,600, [BLS](https://www.bls.gov/ooh/business-and-financial/insurance-underwriters.htm)) and bank staff. Conservative. |
| L1 | Legal | Lawyers | 863,700 (2025) | [BLS OOH](https://www.bls.gov/ooh/legal/lawyers.htm) | |
| L2 | Legal | Paralegals and legal assistants | 404,900 (2025) | [BLS OOH](https://www.bls.gov/ooh/legal/paralegals-and-legal-assistants.htm) | |
| | **Legal total** | | **1,268,600 (der.)** | | |
| G1 | Government | Federal civilian employees (ex-USPS) | ~2.4M (Nov 2024) → **2.2M used (est.)** after 2025 reductions | [Pew Research](https://www.pewresearch.org/short-reads/2025/01/07/what-the-data-says-about-federal-workers/) | The ~8% haircut for 2025 workforce cuts is an estimate |
| G2 | Defense | Active-duty military | 1,294,191 (Jun 2024) | [Wikipedia (DoD)](https://en.wikipedia.org/wiki/United_States_Department_of_Defense) | Only **30% counted (est.)** as office/staff knowledge workers → 388,300 (der.) |
| G3 | Defense (cross-check) | DoD civilians | 789,594 (Jun 2024) | [Wikipedia (DoD)](https://en.wikipedia.org/wiki/United_States_Department_of_Defense) | Inside G1. Not added. |
| G4 | Cleared (cross-check) | Top Secret clearance holders | ~1.25M (2019) | [Wikipedia (Classified information)](https://en.wikipedia.org/wiki/Classified_information_in_the_United_States) | Overlaps G1/G2 plus contractors. Not added. The total cleared population (~4M) is widely cited from ODNI reports but could not be retrieved (est.). |
| | **Government/defense total** | | **2,588,300 (der./est.)** | | Excludes state and local government (~20M workers, est.) |
| E1 | Education | Public K-12 teachers | 3.8M (2020–21) | [NCES](https://nces.ed.gov/programs/coe/indicator/clr/public-school-teachers) | Stale year. Private-school teachers excluded. |
| E2 | Education | Postsecondary teachers | ~1.4M (2025) | [BLS OOH](https://www.bls.gov/ooh/education-training-and-library/postsecondary-teachers.htm) | |
| | **Education total** | | **5,200,000 (der.)** | | |
| X1 | Executive | Chief executives | 291,600 (2025) | [BLS OOH](https://www.bls.gov/ooh/management/top-executives.htm) | General and operations managers (3.6M) excluded |
| X2 | Executive | Executive secretaries and executive admin assistants | 489,300 (2025) | [BLS OOH](https://www.bls.gov/ooh/office-and-administrative-support/secretaries-and-administrative-assistants.htm) | |
| | **Executive total** | | **780,900 (der.)** | | |
| | **US regulated/confidential knowledge workers** | | **12,445,500 (der.)** | | Of all 163.5M employed, 71.3M are management/professional ([BLS CPS](https://www.bls.gov/cps/cpsaat09.htm)) |

### 2.2 ARPU scenarios (all est.)

Pricing anchors (sourced): Otter Business $19.99–30/user/mo ([Otter](https://otter.ai/pricing)); Microsoft 365 Copilot Business add-on $18–25.20/user/mo ([Microsoft](https://www.microsoft.com/en-us/microsoft-365-copilot/pricing)); Jump advisor "Meet" $100/advisor/mo plus $50 add-ons ([Jump](https://jump.ai/pricing)); Freed clinician scribe $39–119/mo ([Freed](https://www.getfreed.ai/pricing)); Librem 5 USA secure phone $1,999 plus $99/mo service ([Purism](https://puri.sm/products/librem-5-usa/)); Plaud hardware from $179 with ~50% paid-subscription attach ([TechCrunch](https://techcrunch.com/2026/06/16/plaud-says-its-software-business-topped-100m-in-arr-after-shipping-over-2m-ai-notetakers/)).

| Software ARPU ($/user/month) | Conservative | Base | Aggressive | Rationale |
| --- | --- | --- | --- | --- |
| Healthcare | $50 | $100 | $150 | Freed $39–119. Enterprise scribes are priced higher. |
| Finance | $50 | $100 | $150 | Jump $100–200 with add-ons |
| Legal | $40 | $80 | $120 | Between generic notetakers and vertical tools |
| Government/defense | $30 | $60 | $100 | Seat pricing through a reseller, below vertical SaaS |
| Education | $8 | $15 | $25 | Education budgets. No device. |
| Executive | $50 | $100 | $150 | Executive-assistant substitute value |

| Hardened device (all segments except education) | Conservative | Base | Aggressive |
| --- | --- | --- | --- |
| Device ASP | $1,000 | $1,500 | $2,500 |
| Amortized per year (3-year refresh) | $333 | $500 | $833 |

Resulting blended ARPU per year (der.): conservative $693–933, base $1,220–1,700, aggressive $2,033–2,633 for device segments. Education is $96 / $180 / $300.

### 2.3 TAM (der.)

**US TAM** = population × (software ARPU × 12) + non-education population × amortized device.

| Segment | Population | Cons. software $M | Base software $M | Aggr. software $M |
| --- | --- | --- | --- | --- |
| Healthcare | 1,982,700 | 1,190 | 2,379 | 3,569 |
| Finance | 625,000 | 375 | 750 | 1,125 |
| Legal | 1,268,600 | 609 | 1,218 | 1,827 |
| Government/defense | 2,588,300 | 932 | 1,864 | 3,106 |
| Education | 5,200,000 | 499 | 936 | 1,560 |
| Executive | 780,900 | 469 | 937 | 1,406 |
| **Software subtotal** | 12,445,500 | **4,073** | **8,084** | **12,592** |
| Device layer (7,245,500 non-edu users × amortized ASP) | | 2,415 | 3,623 | 6,038 |
| **US TAM** | | **$6.5B** | **$11.7B** | **$18.6B** |
| **Global TAM** (× 2.5, est.) | | **$16.2B** | **$29.3B** | **$46.6B** |

Global multiplier rationale (est.): the global headcount of regulated professionals is roughly 4–6x the US count. ARPU outside the US is lower, and in many countries these buyers purchase through government or sovereign channels. A spend-weighted multiplier of 2.5x is consistent with the US share (~33–40%) of global enterprise software spend that analysts commonly cite. This is an estimate. The global headcount of physicians, lawyers and advisors could not be verified within this workstream (see Open questions).

### 2.4 SAM: what Alpha can serve by 2028–29 (der./est.)

SAM applies two filters to the TAM population.

1. **Segment filter**: the share of each segment that buys without certifications Alpha will not have in 2–3 years (FedRAMP High, DoD IL5, NIAP MDF, CSfC and Epic-grade EHR integration). This favors independent and small practices, independent advisors, small and mid-size law firms and executive offices.
2. **Architecture reach factor**: the share that will adopt an Android/AOSP dedicated device, or a second device, given that many US professionals carry iPhones. Conservative 0.35, base 0.5, aggressive 0.7. The aggressive case assumes a credible iOS companion or pendant path.

| Segment filter (est.) | Cons. | Base | Aggr. | Why |
| --- | --- | --- | --- | --- |
| Healthcare | 30% | 40% | 50% | Independent practices and behavioral health. HIPAA through a BAA is feasible, since AWS Nitro Enclaves run on HIPAA-eligible AWS. Large health systems are locked to Nuance/Abridge and Epic. |
| Finance | 30% | 40% | 50% | Independent broker-dealers and RIAs. Needs archive integration (Smarsh/Global Relay) to meet retention rules. Wirehouses need long security reviews. |
| Legal | 30% | 40% | 50% | Solo, small and mid firms. There is no certification gate, but privilege concerns require the enclave and redaction story. |
| Government/defense | 2% | 5% | 10% | Unclassified pilots, SBIR/DIU prototypes, state and local government. Programs of record need certifications Alpha won't have. |
| Education | 1% | 2% | 5% | Mostly unattractive at $8–25/mo. Higher-ed research and administration only. |
| Executive | 40% | 50% | 60% | Buyer is the individual or chief of staff. Fastest procurement. |
| International SAM multiplier | 1.0 | 1.3 | 1.6 | UK, Canada, ANZ, Gulf sovereign pilots, and English-first EU buyers |

| SAM result | Conservative | Base | Aggressive |
| --- | --- | --- | --- |
| US SAM users | 552,700 | 1,087,200 | 2,047,900 |
| US SAM $ | $480M | $1,677M | $4,699M |
| + international | ×1.0 | ×1.3 | ×1.6 |
| **SAM users (total)** | **552,700** | **1,413,300** | **3,276,600** |
| **SAM $ (total)** | **$0.48B** | **$2.18B** | **$7.52B** |
| Blended ARPU | $869 | $1,543 | $2,295 |

Base SAM by segment (US, der.):

| Segment | Users | ARPU | $M | % of US SAM |
| --- | --- | --- | --- | --- |
| Healthcare | 396,500 | $1,700 | 674 | 40% |
| Legal | 253,700 | $1,460 | 370 | 22% |
| Executive | 195,200 | $1,700 | 332 | 20% |
| Finance | 125,000 | $1,700 | 213 | 13% |
| Government/defense | 64,700 | $1,220 | 79 | 5% |
| Education | 52,000 | $180 | 9 | 1% |
| **Total** | **1,087,200** | **$1,543** | **1,677** | 100% |

### 2.5 SOM: realistic 3–5-year share (est.)

The adoption curve counts paid seats at year end. Year 1 (2027) assumes that on-device STT, the redaction pipeline, and a qualified signed device image are all delivered. None of these exist today (see the manifest).

| Paid seats | 2027 (Y1) | 2028 (Y2) | 2029 (Y3) | 2030 (Y4) | 2031 (Y5) | Y5 share of SAM users | Y5 ARR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Conservative | 300 | 1,500 | 4,000 | 8,000 | 15,000 | 2.7% | **$13.0M** |
| **Base** | 1,000 | 5,000 | 15,000 | 32,000 | 55,000 | 3.9% | **$84.8M** |
| Aggressive | 2,000 | 12,000 | 40,000 | 90,000 | 160,000 | 4.9% | **$367M** |

ARR at year 3 (der.): conservative $3.5M, base $23M, aggressive $92M.

**Sanity checks (sourced comparables):**
- In 2025, Nuance/Microsoft held ~33% of a $600M scribe market (~$200M) and Abridge held ~30% (~$180M) ([Menlo](https://menlovc.com/perspective/2025-the-state-of-ai-in-healthcare/)). The base SOM of $85M in 2031 would be a mid-tier vertical AI vendor today.
- Plaud went from ~$56M (2024) to ~$250M (2025) revenue with consumer-priced hardware and >2M units ([KrASIA](https://kr-asia.com/tencents-rumored-plaud-deal-points-to-looming-ai-hardware-contest), [TechCrunch](https://techcrunch.com/2026/06/16/plaud-says-its-software-business-topped-100m-in-arr-after-shipping-over-2m-ai-notetakers/)). Alpha's aggressive case of 160k seats is under 10% of Plaud's installed base at 10x+ Plaud's ARPU. That is plausible only with channel partners (see 09).
- Revenue recognition: the ARPU figures amortize the device. With hardware recognized at sale, year-of-sale revenue for new seats is higher. For example, base Y5 new seats (23k) × $1,500 = $34.5M of hardware revenue (der.), at hardware margins.

---

## 3. Sensitivity analysis (base case)

Base SAM is $2.18B and base Y5 SOM is $84.8M. Each driver is varied alone.

| Driver | Low setting | SAM $B | Y5 SOM $M | High setting | SAM $B | Y5 SOM $M | SOM swing |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Y5 paid seats (execution/adoption) | 30k | 2.18 | 46.3 | 100k | 2.18 | 154.3 | **±$108M (largest)** |
| Software ARPU | ×0.5 | 1.43 | 55.5 | ×1.5 | 2.93 | 114.2 | ±$59M |
| Device model | BYOD app ($0 device) | 1.51 | 58.7 | $2,500 hardened | 2.63 | 102.3 | ±$44M |
| Device ASP (hardened only) | $1,000 | 1.96 | 76.1 | $2,500 | 2.63 | 102.3 | ±$26M |
| Segment filters | conservative | 1.62 | 86.7 | aggressive | 2.80 | 80.9 | ~$6M (mix effect only) |
| Architecture reach (Android acceptance) | 0.35 | 1.53 | 84.8* | 0.7 | 3.05 | 84.8* | SAM ±$0.8B |
| International multiplier | 1.0 | 1.68 | 84.8* | 1.6 | 2.68 | 84.8* | SAM ±$0.5B |

\*SOM is held at 55k seats. In practice, lower reach or less international access would *also* reduce attainable seats, so these drivers act through the seat count.

**Tornado ranking.** For SOM, the order is: (1) seats won, which reflects distribution, trust and certification; (2) software ARPU; (3) whether a hardened device is sold at all; (4) device ASP. For SAM, the order is: (1) architecture reach (iOS/BYOD acceptance); (2) software ARPU; (3) segment filters; (4) international reach.

**Combined downside** (BYOD, ARPU ×0.5, reach 0.35, 30k seats), der.: SAM ≈ $0.53B, SOM ≈ $16M ARR. **Combined upside** (hardened $2,500, ARPU ×1.5, reach 0.7, 100k seats), der.: SAM ≈ $4.7B, SOM ≈ $239M ARR.

---

## 4. Segment attractiveness snapshot (der./est.)

| Segment | US population | Base US TAM $M | Base US SAM $M | Certification gate for 2–3 yrs | Willingness to pay (anchor) | Attractiveness |
| --- | --- | --- | --- | --- | --- | --- |
| Healthcare (incl. behavioral health) | 1.98M | 3,370 | 674 | HIPAA BAA (feasible); EHR integration (hard) | High ($39–119, [Freed](https://www.getfreed.ai/pricing)) | High, but crowded |
| Finance (advisors) | 0.63M | 1,062 | 213 | Recordkeeping/archive integration (feasible) | High ($100–200, [Jump](https://jump.ai/pricing)) | **Highest per-seat fit** |
| Legal | 1.27M | 1,852 | 370 | None formal; privilege and ethics | Medium | Medium-high |
| Executive | 0.78M | 1,327 | 332 | None | High | High, but not a regulated wedge |
| Government/defense | 2.59M | 3,158 | 79 | FedRAMP, NIAP, CSfC, IL5 (not feasible in 2–3 yrs) | High but slow | Low near term; high long term |
| Education | 5.20M | 936 | 9 | FERPA/COPPA | Low | Low |

---

## 5. Beachhead sizing

### 5.1 Beachhead A — independent wealth advisors and RIAs

| Input | Value | Source / status |
| --- | --- | --- |
| FINRA-registered reps | ~625,000 | [Wikipedia (FINRA)](https://en.wikipedia.org/wiki/Financial_Industry_Regulatory_Authority) |
| Personal financial advisors (BLS, cross-check) | 299,400 | [BLS](https://www.bls.gov/ooh/business-and-financial/personal-financial-advisors.htm) |
| SEC-registered RIA firms (2019, dated) | ~12,993 firms; 88% have <50 employees | [Wikipedia (RIA)](https://en.wikipedia.org/wiki/Registered_investment_adviser) |
| Independent channel share | 40% → **250,000 reachable advisors/reps** | (est.) |
| ARPU | $100/mo software ([Jump](https://jump.ai/pricing)) + $500/yr device = **$1,700/yr** | (est.) |
| **Beachhead market** | **$425M/yr** | (der.) |
| Year-3 capture, cons./base/aggr. | 1% / 2% / 4% = 2,500 / 5,000 / 10,000 seats | (est.) |
| **Year-3 ARR** | **$3.0M** ($1,200 software only) / **$8.5M** / **$26.3M** ($2,633) | (der.) |

**Why this beachhead.** Advisors already pay $100+/mo for AI meeting notes. The regulator requires that business communications be *retained*, and in-person and mobile conversations are the gap in that coverage. A device that captures, redacts client PII before cloud inference, and exports to the compliance archive fits the buyer's need. **Caveat:** retention obligations conflict with "redact everything." The product must keep an unredacted archive copy under the firm's control (see 04 and 05).

### 5.2 Beachhead B — behavioral health and private clinics

| Input | Value | Source / status |
| --- | --- | --- |
| Behavioral-health counselors | 533,400 | [BLS](https://www.bls.gov/ooh/community-and-social-service/substance-abuse-behavioral-disorder-and-mental-health-counselors.htm) |
| Clinical/counseling psychologists | 81,300 | [BLS](https://www.bls.gov/ooh/life-physical-and-social-science/psychologists.htm) |
| Private-practice share of BH | 50% → 307,400 | (est.) |
| Physicians + NPs + PAs | 1,368,000 | [BLS](https://www.bls.gov/ooh/healthcare/physicians-and-surgeons.htm), [NP](https://www.bls.gov/ooh/healthcare/nurse-anesthetists-nurse-midwives-and-nurse-practitioners.htm), [PA](https://www.bls.gov/ooh/healthcare/physician-assistants.htm) |
| Independent-practice share not locked into a health-system scribe | 25% → 342,000 | (est.) |
| **Reachable clinicians** | **~649,000** | (der.) |
| ARPU | $80/mo software, device optional = **$960/yr** (Freed $39–119 anchor) | (est.) |
| **Beachhead market** | **$623M/yr** | (der.) |
| Year-3 capture, cons./base/aggr. | 0.5% / 1.5% / 3% = 3,200 / 9,700 / 19,500 seats | (est.) |
| **Year-3 ARR** | **$2.3M** ($60/mo) / **$9.3M** / **$23.4M** ($100/mo) | (der.) |

**Why this beachhead.** Therapy sessions are among the most sensitive conversations there are, and some behavioral-health records carry protection beyond HIPAA. That makes the pitch of on-device transcription plus attested enclave inference plus redaction the sharpest here. Clinicians in private practice buy for themselves. The ambient-scribe category is proven at $600M ([Menlo](https://menlovc.com/perspective/2025-the-state-of-ai-in-healthcare/)). **Caveat:** it is crowded with cheap software-only scribes, so the device must justify itself, or Alpha should sell a BYOD app tier.

### 5.3 Beachhead C — defense and government pilots

| Input | Value | Source / status |
| --- | --- | --- |
| Active-duty + DoD civilians | 1,294,191 + 789,594 = 2,083,785 | [Wikipedia (DoD)](https://en.wikipedia.org/wiki/United_States_Department_of_Defense) (der.) |
| Staff and office users with CUI/meeting-capture needs | 10% → **~208,000** | (est.) |
| ARPU (hardened) | $2,500 device / 3 + $150/mo = **$2,633/yr** | (est.; the device anchor is the $1,999 Librem 5 USA, [Purism](https://puri.sm/products/librem-5-usa/)) |
| **Beachhead market** | **$548M/yr** | (der.) |
| Year-3 pilot seats, cons./base/aggr. | 500 / 2,000 / 5,000 | (est.) |
| **Year-3 revenue** | **$1.3M / $5.3M / $13.2M**, plus SBIR/DIU/AFWERX non-dilutive funding (see 08) | (der.) |
| Market context | Ultra-secure phones $4.1–4.9B (2025), government = 46.6% of end-user demand | [IMARC](https://www.imarcgroup.com/ultra-secure-smartphone-market) |

**Why this beachhead.** It carries the highest strategic value and is the best reference customer for sovereign buyers abroad. The attested-enclave architecture fits zero-trust doctrine. **Caveat:** production scale needs NIAP MDF, CSfC and IL5/FedRAMP, each of which takes 12–24 months (see 05). The crypto association of elizaOS is a trust liability here (see 11). Treat this as a funded pilot track, not the revenue engine.

### 5.4 Runner-up — executives and small/mid law firms

The reachable population is 780,900 executives and executive assistants ([BLS](https://www.bls.gov/ooh/management/top-executives.htm), [BLS](https://www.bls.gov/ooh/office-and-administrative-support/secretaries-and-administrative-assistants.htm)) plus 40% (est.) of 1.27M legal professionals, about 1.29M in total (der.). At $1,700/yr, that is **~$2.2B/yr** (der.). It is the fastest to buy, but it lacks a regulatory forcing function. It works well as a premium tier layered on beachheads A and B.

| Beachhead | Market $/yr (der.) | Y3 ARR base (der.) | Speed to revenue | Differentiation from redaction/enclave | Recommended order |
| --- | --- | --- | --- | --- | --- |
| A. Advisors/RIAs | $425M | $8.5M | Fast (6–9 mo sales) | High (PII + retention) | **1** |
| B. Behavioral health / private clinics | $623M | $9.3M | Fast | Very high | **2** (in parallel with A, BYOD tier) |
| C. Defense/government pilots | $548M | $5.3M | Slow (pilots now, scale after certification) | Very high | **3** (non-dilutive track) |
| Executive/legal | ~$2.2B | n/a | Fastest | Medium | Premium tier |

---

## Implications for Alpha Phone

1. **The honest headline is a ~$2B SAM, not a $30B TAM.** Investors will discount a TAM built on every regulated knowledge worker. Lead with the base SAM ($2.2B) and a credible SOM path ($23M ARR in year 3, $85M in year 5). Show the TAM only as the long-run ceiling, reached once certifications and an iOS/BYOD path exist.
2. **Adoption, not market size, is the binding constraint.** The sensitivity analysis shows seats won dominate every outcome. That makes channel partners the lever: compliance archives for advisors, EHR and practice-management vendors for clinics, and resellers/primes for government (see 09).
3. **Sell software first and the device second.** Dropping the device cuts base SOM by about 30% ($85M → $59M), but it likely *raises* achievable seats a great deal given iPhone-heavy professional users. A BYOD app tier plus a hardened-device tier for high-assurance buyers is the most robust plan.
4. **ARPU of $80–150/mo is defensible only with vertical compliance features.** These include archive export for FINRA/SEC, a HIPAA BAA, and a privilege-preserving mode for legal work. Generic notetakers anchor at $8–30/mo (Otter, Copilot).
5. **Redaction is the differentiator but also a retention risk.** In finance, the SAM depends on *retaining* communications while redacting before model inference. The architecture must support that dual path.
6. **"GenAI phone" is not a moat.** IDC and Counterpoint expect GenAI capability in >50% of shipments by 2027–28. Differentiation must come from attestation, redaction and compliance.
7. **Government is strategic, not near-term revenue.** Size it as a $5M-class pilot business by year 3, funded with non-dilutive capital, and let it build credibility with international sovereign buyers.
8. **Every SOM case depends on shipping prerequisites that are not yet met**: on-device STT, the redaction pipeline, a qualified signed device image, and a deployed enclave candidate. A one-year slip moves each column of the adoption curve one year to the right.

## Open questions

1. **Global headcount inputs.** The number of physicians (WHO), lawyers (CCBE/IBA) and licensed advisors outside the US could not be retrieved in this pass. The 2.5x global spend multiplier is an estimate and should be replaced with sourced counts.
2. **FINRA primary source.** Confirm the ~625k registered reps and the split between the independent BD/RIA channel and the wirehouse channel from FINRA's 2025 Industry Snapshot and the IAA/NRS *Evolution Revolution* 2025 report. Neither document could be retrieved.
3. **DoD mobile device counts.** The DoD Mobility Unclassified and Classified capability device counts, and the total cleared population (~4M per ODNI, est.), were not verified. They would allow a device-based rather than personnel-based government model.
4. **Android acceptance (reach factor).** What share of target professionals would carry an Android device or a second device? Primary research is needed: a survey of 50–100 advisors and clinicians.
5. **Willingness to pay for a device.** Would advisors or clinicians pay $1,000–2,500 for a hardened device, or only accept a firm-provided or free device with a subscription?
6. **Meeting-assistant market attribution.** Several syndicated figures ($3.14–3.8B) could not be tied to a specific firm on the page, and the Grand View page returned 403. Verify before quoting any single number in an investor deck.
7. **Retention versus redaction.** How do FINRA/SEC recordkeeping and HIPAA's minimum-necessary rule interact with a redact-before-inference pipeline? This changes whether finance is in the SAM at all (see 04 and 05).
8. **International sovereign demand.** Could Gulf, EU or UK government pilots be larger and faster than US DoD, given the $80B sovereign cloud IaaS spend in 2026 ([Gartner](https://www.gartner.com/en/newsroom/press-releases/2026-02-09-gartner-says-worldwide-sovereign-cloud-iaas-spending-will-total-us-dollars-80-billion-in-2026))? The SAM international multiplier (1.3x) may understate this.
9. **Competitive price compression.** Apple, Google and Microsoft bundle free or cheap transcription. How much of the $80–150/mo vertical ARPU survives by 2029?
