# 05 — Regulation, compliance and certification landscape

Research date: 2026-09-30. Workstream #5 of the [manifest](00-manifest.md). Owner: product/strategy.

> **Not legal advice.** This is market and product research written by a non-lawyer research function. It summarizes public sources to scope product requirements and certification budgets. Every consent, biometric, privilege, export-control and sector-specific conclusion must be confirmed by qualified counsel in the relevant jurisdiction before Alpha Phone ships a recording, transcription or redaction feature or signs a regulated customer.

## How to read this document

- **Product baseline** comes from the manifest: an Android phone UI (app and HOME-launcher flavors), an owner-paired elizaOS agent, cloud inference inside **AWS Nitro Enclaves** with attested KMS key release, Cerebras-hosted `qwen-3.8-27b`, ASR/TTS on a paired host (on-device ASR not yet met), **no redaction pipeline yet**, and no physical-device qualification of the signed image. The planned "always-on office assistant" that records, transcribes and redacts speech is **not built**. Everything below is about what regulation would require of it.
- **Citations.** Every rule and number has a URL. Sources are marked by how they were checked:
  - no marker: fetched or returned by search in this session (2026-09-30);
  - **[kb]**: a canonical primary-source URL that was **not re-fetched** in this session. The shared session web-search budget ran out after 24 searches, so these rest on the analyst's background knowledge and the canonical source. Verify them before relying on them.
- **(est.)** marks an analyst estimate, such as a certification cost or timeline, or a figure that no primary source states.
- Where sources contradict each other, the conflict is flagged inline.

---

## 0. Executive summary

1. **The recording product's biggest risk is litigation, not certification.** In *In re Otter.AI Privacy Litigation* (N.D. Cal., No. 25-cv-06911-EKL), the court's **Aug 13, 2026** order let the federal Wiretap Act, CIPA §631 and **both Illinois BIPA voiceprint claims** proceed. The court reasoned that training on conversations can defeat the one-party "party exception", and that speaker-identification profiles are plausibly voiceprints ([order PDF](https://www.courthousenews.com/wp-content/uploads/2026/08/otter-ai-privacy-class-action.pdf)). *Ambriz v. Google* adopted a **"capability test"**: a vendor that merely *can* use call data for its own purposes may be a third-party eavesdropper ([ZwillGen](https://www.zwillgen.com/privacy/federal-judge-allows-google-customer-service-ai-class-action-to-proceed/); [order](https://www.courthousenews.com/wp-content/uploads/2025/02/ambriz-v-google-order-denying-motion-dismiss.pdf)). Alpha's attested enclave can be turned into a legal asset. If Alpha can **prove** it has no capability to reuse the audio (no training, attested code, customer-held keys), it has a defense that Otter and Google do not.
2. **The minimum viable compliance feature set for any recording SKU** is a visible recording indicator, an audible or spoken announcement, all-party consent capture and logging, no training on customer data, speaker diarization that does **not** persist voiceprints unless there is written BIPA consent, retention and deletion controls, legal hold, and an immutable audit log. These features are cheap to build and unlock almost every US commercial buyer.
3. **Retention and redaction conflict.** Finance (SEC 17a-4, FINRA 4511, MiFID II Art. 16(7)) requires firms to *keep* original business communications, tamper-evident, for 3–7 years. Healthcare, legal and privacy regimes push to *minimize*. Alpha needs a dual-record architecture: an **immutable, access-controlled original in the customer's archive** plus **redacted derivatives** for AI and everyday use, with policy set per tenant. It must never redact destructively in regulated tenants.
4. **Cheapest, fastest unlocks, in order:** (a) the consent and retention feature set plus a published biometric policy; (b) SOC 2 Type II on the enclave cloud; (c) a HIPAA BAA program; (d) a 17a-4-compatible export to Smarsh/Global Relay-class archives; (e) GDPR DPA plus EU data residency; (f) EAR encryption self-classification. Together these open enterprise, healthcare, wealth management, law firms and the EU for roughly **$250k–$600k and 9–15 months (est.)**.
5. **Government and defense is a multi-year, multi-million-dollar path.** It needs FedRAMP (20x Moderate is now real: first authorizations came on Mar 6, 2026 ([fedramp.gov/20x](https://www.fedramp.gov/20x/))), FIPS 140-3 validated crypto (206 modules sit in the CMVP process list as of 2026-09-30 ([CMVP](https://csrc.nist.gov/projects/cryptographic-module-validation-program/modules-in-process/modules-in-process-list))), a NIAP MDF evaluation of the device, a DISA STIG, and possibly CSfC. A custom AOSP build forfeits the NIAP and STIG status that stock Pixel and Samsung devices already have. **Also note that `qwen-3.8-27b` is a Chinese-origin model**, which is likely disqualifying for many US federal, state and defense buyers regardless of where it is hosted (see §7.10).
6. **The EU AI Act prohibits emotion recognition in the workplace** (Art. 5(1)(f), applicable since Feb 2, 2025, with a medical/safety exception only) ([AI Act Art. 5](https://artificialintelligenceact.eu/article/5/)). An office assistant must not infer mood, stress or sentiment of workers in the EU. Annex III high-risk obligations, which include some employment uses, have been pushed to **Dec 2, 2027** by the Digital Omnibus ([timeline](https://artificialintelligenceact.eu/implementation-timeline/)).

---

## 1. Recording consent and workplace monitoring

### 1.1 United States: federal baseline

| Rule | Requirement | Source |
| --- | --- | --- |
| Federal Wiretap Act (ECPA Title I), 18 U.S.C. §2511(2)(d) | One-party consent: interception is lawful if the interceptor is a party or one party consents, **unless** it is done "for the purpose of committing any criminal or tortious act". The Otter order applied this "crime-tort" carve-out to alleged training on conversations. | [18 U.S.C. §2511](https://www.law.cornell.edu/uscode/text/18/2511) [kb]; [Otter order p.10–11](https://www.courthousenews.com/wp-content/uploads/2026/08/otter-ai-privacy-class-action.pdf) |
| ECPA civil remedy, 18 U.S.C. §2520 | Greater of actual damages or statutory damages of $100/day or $10,000, plus punitive damages and fees | [18 U.S.C. §2520](https://www.law.cornell.edu/uscode/text/18/2520) [kb] |
| Stored Communications Act | Governs stored transcripts and recordings held by a provider, which matters for Alpha's cloud | [18 U.S.C. §2701 et seq.](https://www.law.cornell.edu/uscode/text/18/part-I/chapter-121) [kb] |

### 1.2 All-party-consent states

Eleven states require all-party consent as of 2026: **California, Delaware, Florida, Illinois, Maryland, Massachusetts, Montana, Nevada, New Hampshire, Pennsylvania and Washington**. Four more (**Connecticut, Michigan, Oregon, Vermont**) are mixed or unsettled. Connecticut requires all-party consent for electronic recordings but only one party for in-person conversations; Oregon is the reverse. Compliance-minded call centers treat all 15 as all-party ([Vibe state list](https://vibe.us/blog/one-party-two-party-consent-states/); [Wikipedia: telephone call recording laws](https://en.wikipedia.org/wiki/Telephone_call_recording_laws)).

| State | Scope notes relevant to an office assistant | Source |
| --- | --- | --- |
| California | Penal Code §631 covers wiretapping and third-party eavesdropping (the "capability test" battleground). §632 covers recording *confidential* communications without all-party consent. §637.2 gives a private right of action at **$5,000 per violation** | [Cal. Penal Code §631–637.2](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PEN&sectionNum=637.2) [kb] |
| Illinois | Eavesdropping Act, 720 ILCS 5/14: all-party consent for *private* conversations. Also has BIPA (see §2) | [720 ILCS 5/14-2](https://www.ilga.gov/legislation/ilcs/fulltext.asp?DocName=072000050K14-2) [kb] |
| Florida | Fla. Stat. §934.03: all-party consent where there is an expectation of privacy; unlawful recording is a felony | [Fla. Stat. 934.03](http://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0900-0999/0934/Sections/0934.03.html) [kb] |
| Washington | RCW 9.73.030: all-party consent for private conversations. Consent is deemed given where an announcement is recorded | [RCW 9.73.030](https://app.leg.wa.gov/rcw/default.aspx?cite=9.73.030) [kb] |
| Pennsylvania, Maryland, Massachusetts | Strict all-party regimes. Massachusetts covers *secret* recording of any oral communication, with no expectation-of-privacy limit | [Wikipedia list](https://en.wikipedia.org/wiki/Telephone_call_recording_laws) |
| Cross-border calls | When parties are in different states, the stricter law is often applied. California courts apply CIPA to calls with Californians | [Vibe](https://vibe.us/blog/one-party-two-party-consent-states/) |

**Product implication:** a phone that records in-room meetings cannot know which state's law applies to each person in the room. The only defensible default is **all-party notice and consent everywhere**, with the consent logged.

### 1.3 Wiretap litigation against AI note-takers and AI call and chat tools

| Case | Court / date | Theory | Status (as of 2026-09-30) | Source |
| --- | --- | --- | --- | --- |
| *In re Otter.AI Privacy Litigation* (lead: *Brewer v. Otter.ai*) | N.D. Cal. 5:25-cv-06911-EKL; filed Aug 15, 2025; MTD order **Aug 13, 2026** (Judge Eumi K. Lee) | Notetaker joins meetings as a "silent participant". Alleged training on recordings; voiceprint "speaker identification profiles" | **Survived:** ECPA, CIPA §631 (all 3 CA plaintiffs), BIPA §15(b) and the second BIPA claim, unjust enrichment, UCL, and intrusion for the plaintiff whose call was with a medical provider. **Dismissed with leave:** CFAA, CDAFA, WA Privacy Act, two intrusion claims, and §632 for two plaintiffs whose "confidential" allegations were conclusory | [Order](https://www.courthousenews.com/wp-content/uploads/2026/08/otter-ai-privacy-class-action.pdf); [RecordingLaw summary](https://www.recordinglaw.com/news/otter-ai-wiretap-lawsuit-explained/); [complaint](https://www.fisherphillips.com/a/web/x27EBgcvus2uFdfXMJiyCk/aAQ5CP/brewer-v-otterai.pdf) |
| *Cruz v. Fireflies.AI Corp.* | Illinois federal court, No. 3:25-cv-03399 (sources differ on the district); filed Dec 18, 2025 | BIPA: speaker recognition creates voiceprints of non-user participants; no public retention policy | Voluntarily dismissed without prejudice in Mar 2026 | [Sheppard Mullin](https://www.sheppard.com/insights/blogs/illinois-bipa-suit-targets-ai-note-takers-practical-lessons-for-meeting-transcription); [complaint](https://commlawgroup.com/wp-content/uploads/2025/12/Fireflies.ai-Complaint-1.pdf); [RecordingLaw](https://www.recordinglaw.com/news/otter-ai-wiretap-lawsuit-explained/) |
| *Ambriz v. Google LLC* | N.D. Cal. 3:23-cv-05437; MTD denied **Feb 10, 2025** | CIPA §631/§637.5: Google Cloud Contact Center AI is a third party under the **capability test** | In discovery; no class certification yet | [Order](https://www.courthousenews.com/wp-content/uploads/2025/02/ambriz-v-google-order-denying-motion-dismiss.pdf); [AI Lawsuit Tracker](https://ailawsuittracker.com/cases/ambriz-v-google-llc-3-23-cv-05437/); [Goodwin](https://www.goodwinlaw.com/en/insights/publications/2025/02/alerts-practices-dpc-ftec-ai-voice-products-subject-to-california-invasion-of-privacy-claims) |
| *Basich v. Microsoft* (Teams Live Transcription) | Filed Aug 5, 2026 (reported) | BIPA: live transcription speaker attribution extracts voiceprints | Early stage; single secondary source, so verify | [Basil AI article](https://basilai.app/articles/2026-08-12-microsoft-teams-live-transcription-voiceprints-basich-bipa-lawsuit.html); [No Boiler](https://noboiler.com/blog/microsoft-teams-voiceprint) |
| CIPA trend cases (ConverseNow, Invoca and others) | 2024–2026 | AI ordering and call-analytics vendors as third-party eavesdroppers | Built on Ambriz | [Debevoise](https://www.debevoisedatablog.com/2025/06/04/cipa-litigation-trends-regarding-tracking-technology-and-ai/); [AI Lawsuit Tracker](https://ailawsuittracker.com/cases/ambriz-v-google-llc-3-23-cv-05437/) |

**Doctrine that shapes the design:**

- **Party exception versus third-party eavesdropper.** Vendors are "parties" only if they act as a mere extension of the user, like a tape recorder. Using data for their own purposes, or under Ambriz merely *being able to*, makes them third parties ([ZwillGen](https://www.zwillgen.com/privacy/federal-judge-allows-google-customer-service-ai-class-action-to-proceed/)).
- **Training on customer audio** is the hook. It supplies the "tortious purpose" under ECPA ([Otter order](https://www.courthousenews.com/wp-content/uploads/2026/08/otter-ai-privacy-class-action.pdf)) and the "capability" under CIPA. Commentators recommend off-by-default training, narrow retention, all-party notice, easy refusal for non-account participants, and audit logs of consent and vendor access ([Captain Compliance](https://captaincompliance.com/education/old-wiretapping-laws-new-ai-tools-what-brewer-v-otter-ai-and-ambriz-v-google-mean-for-ai-transcription-services/); [Fisher Phillips](https://www.fisherphillips.com/en/insights/insights/new-lawsuit-highlights-concerns-about-ai-notetakers)).
- **Pending legislative relief:** California SB 690 (2025) would exempt "commercial business purposes" from CIPA. It passed the Senate in 2025 but was held in the Assembly; its 2026 status is unverified [kb] ([bill page](https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202520260SB690)). **Do not plan around it.**

**Alpha opportunity (inference):** an attested Nitro Enclave whose measured image provably has no persistent write path for plaintext audio, no training export and customer-scoped KMS keys is the strongest technical rebuttal to the capability test that any vendor could offer. It should be documented as a **"no-capability attestation"** with the PCR values published. Whether courts accept this is untested.

### 1.4 Workplace-monitoring laws (US)

| Law | Requirement | Product must implement | Source |
| --- | --- | --- | --- |
| New York Civil Rights Law §52-c (eff. May 7, 2022) | Prior written or electronic notice at hire to employees whose phone, email or internet use is monitored; employee acknowledgment; conspicuous posting | Admin-side notice template, employee acknowledgment capture, and posting export. Note that §52-c text targets phone, email and internet; in-room audio also triggers eavesdropping law | [NY Senate §52-C*2](https://www.nysenate.gov/legislation/laws/CVR/52-C*2); [Harris Beach](https://www.harrisbeachmurtha.com/insights/big-brother-hold-on-new-york-employers-must-advise-employees-and-prospective-employees-if-electronic-activities-will-be-monitored/) |
| Connecticut Gen. Stat. §31-48d | Prior written notice of electronic monitoring | Same | [CGA §31-48d](https://www.cga.ct.gov/current/pub/chap_557.htm#sec_31-48d) [kb] |
| Delaware 19 Del. C. §705 | Notice of monitoring of phone, email and internet | Same | [Del. Code §705](https://delcode.delaware.gov/title19/c007/sc01/index.html) [kb] |
| California CCPA/CPRA (employees in scope since Jan 1, 2023); CPPA ADMT and risk-assessment regulations (finalized 2025) | Notice at collection; risk assessments; automated decision-making technology (ADMT) rights for significant employment decisions | Privacy notice, DSAR tooling, and a ban on using transcripts for automated employment decisions without an ADMT workflow | [CPPA regulations](https://cppa.ca.gov/regulations/) [kb] |
| Illinois HB 3773 (Human Rights Act AI amendment, eff. Jan 1, 2026) | Notice of AI use in employment decisions; no discriminatory effect | Do not market transcripts for performance evaluation without controls | [ILGA HB3773](https://www.ilga.gov/legislation/BillStatus.asp?DocNum=3773&GAID=17&DocTypeID=HB&SessionID=112) [kb] |
| NLRA §7 (US) | Surveillance of protected concerted activity can be an unfair labor practice. The 2022 GC memo was rescinded in 2025 [kb] | Office mode must not be deployable for covert monitoring of employee discussions | [NLRB](https://www.nlrb.gov/guidance/memos-research/general-counsel-memos) [kb] |

### 1.5 EU and UK recording and monitoring

| Regime | Requirement | Source |
| --- | --- | --- |
| GDPR Arts. 5, 6, 13, 35, 88 | A lawful basis is required. Consent is rarely valid for employees because of the power imbalance, so legitimate interest plus a DPIA is typical. Transparency notice. A **DPIA is effectively mandatory** for systematic monitoring of employees. Art. 88 lets member states add employment rules. Fines up to €20M or 4% of turnover (Art. 83) | [GDPR text (EUR-Lex)](https://eur-lex.europa.eu/eli/reg/2016/679/oj) [kb] |
| ePrivacy Directive 2002/58/EC Art. 5 | Confidentiality of communications; interception needs consent of the users concerned (member-state implementation varies) | [EUR-Lex 2002/58](https://eur-lex.europa.eu/eli/dir/2002/58/oj) [kb] |
| Germany: StGB §201 | **Criminal offense** to record the non-public spoken word without authorization (up to 3 years' imprisonment) | [StGB §201](https://www.gesetze-im-internet.de/stgb/__201.html) [kb] |
| Germany: BetrVG §87(1) no. 6 (works councils) | Works-council **co-determination** is required before introducing technical devices *capable of* monitoring employee behavior or performance. An office recorder cannot be rolled out without a works agreement (*Betriebsvereinbarung*) | [BetrVG (English)](https://www.gesetze-im-internet.de/englisch_betrvg/englisch_betrvg.html) [kb: the section was not in the fetched excerpt] |
| France: Code du travail L1222-4, L2312-38 | Employees must be informed and the CSE consulted before monitoring tools are deployed | [Légifrance L2312-38](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000035627426) [kb] |
| Netherlands: WOR Art. 27 | Works council consent right over personnel monitoring systems | [wetten.overheid.nl WOR](https://wetten.overheid.nl/BWBR0002747/) [kb] |
| UK: Investigatory Powers Act 2016 and the Investigatory Powers (Interception by Businesses etc.) Regulations 2018; UK GDPR; DUAA 2025 | Businesses may record their own systems for business purposes with notice. UK GDPR still applies. The Data (Use and Access) Act 2025 received royal assent on **June 19, 2025**; commencement was substantially complete by June 2026 and adds a complaints-handling duty (acknowledge within 30 days) | [legislation.gov.uk SI 2018/356](https://www.legislation.gov.uk/uksi/2018/356/contents/made) [kb]; [Wikipedia: DUAA 2025](https://en.wikipedia.org/wiki/Data_(Use_and_Access)_Act_2025) |
| UK ICO employment monitoring guidance (Oct 2023) | DPIA, transparency, proportionality; covert monitoring only in exceptional cases | [ICO guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/employment/monitoring-workers/) [kb] |

---

## 2. Biometrics: voiceprints and diarization

Diarization (who spoke when) is not per se biometric. **Speaker identification across sessions** ("this is Alice again"), which stores an embedding linked to a named person, is what Otter's order treated as a plausible BIPA voiceprint ([Otter order pp.7–8](https://www.courthousenews.com/wp-content/uploads/2026/08/otter-ai-privacy-class-action.pdf)).

| Law | Scope | Obligations | Remedy | Source |
| --- | --- | --- | --- | --- |
| **Illinois BIPA**, 740 ILCS 14 | "Voiceprint" is a biometric identifier | §15(a) public retention and destruction schedule; §15(b) written notice plus **written release before collection**; §15(c) no sale or profit; §15(d) disclosure consent; §15(e) reasonable security | Private right of action: **$1,000 negligent / $5,000 intentional or reckless** per violation. SB 2979 (P.A. 103-0769, Aug 2, 2024) limits recovery to one per person for repeated same-method collection. The 7th Circuit held this retroactive in *Clay v. Union Pacific* (**Apr 1, 2026**) | [SHB](https://www.shb.com/intelligence/client-alerts/pds/may-2024-bipa-amendment-wolfe-searle); [WilmerHale](https://www.wilmerhale.com/en/insights/blogs/wilmerhale-privacy-and-cybersecurity-law/20260514-seventh-circuit-weighs-in-on-critical-bipa-retroactivity-question); [ABA](https://www.americanbar.org/groups/business_law/resources/business-law-today/2026-may/7th-circuit-holds-bipa-damages-remedy-applies-retroactively/) |
| **Texas CUBI**, Bus. & Com. Code §503.001 | Voiceprint, face geometry and others, captured for a commercial purpose | Informed consent; no sale; destroy within a reasonable time (≤1 year after purpose expires) | AG only; up to $25,000 per violation. **Meta $1.4B (July 30, 2024)**; **Google $1.375B finalized (Oct 31, 2025)**, including Google Assistant voiceprints | [ZwillGen](https://www.zwillgen.com/ftc-state-ag/dont-mess-with-texas-cubi-settlement-marks-state-tough-biometric-privacy-enforcer/); [RecordingLaw TX](https://www.recordinglaw.com/us-laws/data-privacy-laws/texas-data-privacy-laws/biometric-privacy/); [statute](https://statutes.capitol.texas.gov/Docs/BC/htm/BC.503.htm) [kb] |
| **Washington** RCW 19.375 | Biometric identifiers enrolled for commercial purposes | Notice, consent or opt-out mechanism | AG only | [RCW 19.375](https://app.leg.wa.gov/rcw/default.aspx?cite=19.375) [kb] |
| **Washington My Health My Data Act** (RCW 19.373) | "Consumer health data" includes biometric data and health inferences | Separate consent to collect and to share; health-data privacy policy; **private right of action** via the CPA. The first suit, against Amazon, was filed Feb 10, 2025 | Private right of action | [Orrick](https://www.orrick.com/en/Insights/2025/02/First-Lawsuit-Filed-Under-Washingtons-My-Health-My-Data-Act); [Paul Hastings](https://www.paulhastings.com/insights/ph-privacy/biometrics-litigation-update-first-class-action-complaint-filed-under-washingtons-my-health-my-data-act-is-your-company-ready) |
| **Colorado** CPA biometric amendment (HB24-1130, eff. July 1, 2025) | Biometric identifiers, including for employees | Retention policy, consent, employee-specific limits | AG | [CO HB24-1130](https://leg.colorado.gov/bills/hb24-1130) [kb] |
| **GDPR Art. 9** | Biometric data "for the purpose of uniquely identifying a natural person" is special-category data | Needs an Art. 9(2) exception, usually **explicit consent**, which is hard to rely on in employment; DPIA | Fines to 4% | [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj) [kb] |
| **EU AI Act** Art. 5(1)(g) | Biometric categorization inferring race, politics, union membership, religion or sexual orientation is **prohibited** | Never infer these from voice | €35M or 7% | [AI Act Art. 5](https://artificialintelligenceact.eu/article/5/) |

**Design rule for Alpha (inference):**

- By default, diarize **within a session only**, using anonymous labels ("Speaker 1") held in RAM or the enclave and discarded when the session ends.
- Offer **enrolled speaker ID** as an opt-in, only for people who give a written BIPA/CUBI-grade release on their own device. Publish a retention schedule, delete within ≤1 year of the last interaction or on withdrawal, and never share the embeddings.

---

## 3. Healthcare

| Rule | Requirement | What Alpha must implement | Source |
| --- | --- | --- | --- |
| HIPAA Privacy and Security Rules (45 CFR 160, 164) | A vendor that creates, receives, maintains or transmits PHI for a covered entity is a **business associate**. It must sign a **BAA** (§164.504(e)), apply Security Rule safeguards and follow breach notification (≤60 days) | BAA template; risk analysis; encryption; access controls; audit logs; breach runbook; subcontractor BAAs with **AWS** (HIPAA-eligible; Nitro Enclaves' eligibility must be confirmed) and **Cerebras** (a BAA must be verified or obtained) | [HHS BA guidance](https://www.hhs.gov/hipaa/for-professionals/covered-entities/sample-business-associate-agreement-provisions/index.html) [kb] |
| HIPAA penalties (2025 inflation adjustment) | Tier 1 min $145 up to Tier 4 $2,190,294 per violation; calendar-year cap $2,190,294 per provision | Budget for cyber insurance | [HIPAA Journal](https://www.hipaajournal.com/hipaa-violation-fines/); [AccountableHQ](https://www.accountablehq.com/post/hipaa-violation-fines-2025-updated-penalty-tiers-caps-and-requirements) |
| **Proposed Security Rule overhaul** (NPRM Jan 6, 2025; comments closed Mar 7, 2025; 4,000+ comments) | Would require encryption of all ePHI at rest and in transit, MFA, an annual asset inventory and network map, **restoration within 72 hours**, annual audits, vulnerability scans every 6 months, annual penetration tests, and written verification of BA safeguards | Design to the NPRM now. It is a strong sales argument. **Status:** the May 2026 target passed without a final rule, and HHS now projects **July 2027** | [HIPAA Journal](https://www.hipaajournal.com/new-hipaa-regulations/); [Alston & Bird](https://www.alston.com/en/insights/publications/2025/11/hipaa-security-rule-overhaul); [Top Floor Security](https://topfloorsecurity.com/insights/new-hipaa-security-rule-status/) |
| 42 CFR Part 2 (substance use disorder records) | Compliance date **Feb 16, 2026** for the 2024 final rule | Tenant flag for Part 2 programs; stricter redisclosure rules | [HIPAA Journal](https://www.hipaajournal.com/new-hipaa-regulations/) |
| Reproductive health privacy rule (2024) | **Vacated** nationally in June 2025 (*Purl v. HHS*, N.D. Tex.) | No product requirement, but state laws (CA, WA and others) still restrict this data | [HIPAA Journal](https://www.hipaajournal.com/new-hipaa-regulations/) |
| HITECH / HHS "recognized security practices" (P.L. 116-321) | OCR must consider 12 months of recognized security practices (NIST CSF, 405(d) HICP) when it sets penalties | Map controls to the NIST CSF and HICP | [P.L. 116-321](https://www.congress.gov/bill/116th-congress/house-bill/7898) [kb] |
| **WA My Health My Data**; Nevada SB 370; Connecticut health data amendments | Non-HIPAA consumer health data: consent, a sale ban (WA requires signed authorization), geofencing bans near clinics | Applies when Alpha is sold direct to consumers or clinicians outside a BAA. Consent flows plus a health-data privacy policy | [Orrick](https://www.orrick.com/en/Insights/2025/02/First-Lawsuit-Filed-Under-Washingtons-My-Health-My-Data-Act); [RecordingLaw WA](https://www.recordinglaw.com/us-laws/data-privacy-laws/washington-data-privacy-laws/) |
| **FDA SaMD boundary for scribes** | Section 520(o) of the FD&C Act (21st Century Cures) excludes administrative and EHR documentation software from the "device" definition. FDA's **Clinical Decision Support Software final guidance** (revised **Jan 6, 2026**, loosening the prior single-recommendation posture) keeps non-device status only where the clinician can independently review the basis of any recommendation | Pure transcription or summarization is **not a device**. Suggesting diagnoses, flagging care gaps or proposing orders moves toward CDS/SaMD. Keep the scribe documentation-only, or plan a 510(k)/De Novo route | [FDA CDS guidance PDF](https://www.fda.gov/media/191560/download); [KevinMD](https://kevinmd.com/2026/01/fda-loosens-ai-oversight-what-clinicians-need-to-know-about-the-2026-guidance.html); [Frier Levitt](https://www.frierlevitt.com/articles/fda-clinical-decision-support-software-guidance/) |
| ONC HTI-1 decision-support interventions (DSI) transparency | Applies to certified health IT developers that integrate "predictive DSIs" | Relevant only for an EHR partnership | [HealthIT.gov HTI-1](https://www.healthit.gov/topic/laws-regulation-and-policy/health-data-technology-and-interoperability-certification-program) [kb] |

**Source conflict:** the FDA CDS guidance is described as dated **Jan 6, 2026** in one search result and "Final Guidance March 11, 2026" in the FDA PDF title in another. Use the FDA PDF as authoritative.

**Healthcare certifications that buyers ask for:** HIPAA attestation (self), SOC 2 Type II plus a HIPAA mapping, **HITRUST** e1/i1/r2. Estimated costs are $40–80k (e1), $80–200k (i1) and $150–500k (r2), with 4–12 months (est.) ([HITRUST](https://hitrustalliance.net/) [kb]).

---

## 4. Finance

### 4.1 Recordkeeping and supervision

| Rule | Requirement | Retention | What Alpha must implement | Source |
| --- | --- | --- | --- | --- |
| **SEC Rule 17a-4** (broker-dealers) | Preserve business-related communications. The 2022 amendments allow **either WORM or an audit-trail alternative** that can re-create an original record after modification or deletion. The designated-third-party undertaking was replaced by a "designated executive officer" or third party | Communications: 3 years (first 2 easily accessible) under 17a-4(b)(4); other records 6 years [kb on periods] | Never destructively redact the original in BD tenants. Export originals plus metadata to a 17a-4-compliant archive (Smarsh, Global Relay, Theta Lake, Proofpoint), or have Alpha's own store meet the audit-trail standard | [Federal Register 2022-22670](https://www.federalregister.gov/documents/2022/11/03/2022-22670/electronic-recordkeeping-requirements-for-broker-dealers-security-based-swap-dealers-and-major); [ACA](https://www.acaglobal.com/industry-insights/amendments-rule-17a-4-electronic-recordkeeping-requirement/) |
| **Advisers Act Rule 204-2** (RIAs) | Written communications about advice and recommendations | 5 years (first 2 in office) [kb] | Same as above | [17 CFR 275.204-2](https://www.ecfr.gov/current/title-17/chapter-II/part-275/section-275.204-2) [kb] |
| **FINRA Rule 4511** | Make and preserve books and records per FINRA and SEA rules | **6 years** where no other period is specified | Same as above | [Concentric](https://concentric.ai/finra-4511-compliance-with-concentric-ai/); [FINRA 4511](https://www.finra.org/rules-guidance/rulebooks/finra-rules/4511) [kb] |
| **FINRA Rule 3110** | Supervisory system; risk-based review of correspondence; principal approval for some communications | — | Supervisor review queue and lexicon or AI surveillance hooks; exports to surveillance vendors | [FINRA 3110](https://www.finra.org/rules-guidance/rulebooks/finra-rules/3110) [kb] |
| **FINRA 2026 Annual Regulatory Oversight Report** (Dec 9, 2025) | First dedicated GenAI section. "Summarization and information extraction" is the top member use case. AI outputs tied to business must be governed | — | Model and version provenance on every summary; human review; record the prompt, output and source | [Wealthtech Today](https://wealthtechtoday.com/2025/07/29/ai-notetakers-and-compliance-in-wealth-management-what-firms-need-to-know/); [Fellow](https://fellow.ai/blog/how-regulated-firms-govern-meeting-ai/) |
| AI artifacts as records | Recording, transcript, summary and action items each become records if they document regulated activity or are relied on as a business record | Per the underlying rule | Classify each artifact type; apply retention to derivatives consistently | [Global Relay](https://www.globalrelay.com/resources/the-compliance-hub/compliance-insights/ai-meeting-records-explained-which-record-does-your-firm-need-to-keep/) |
| CFTC Reg. 1.31 / 1.35 | Futures commission merchants and swap dealers: records 5 years; **oral communications leading to a trade** 1 year | 1–5 years | Same as above | [17 CFR 1.35](https://www.ecfr.gov/current/title-17/chapter-I/part-1/subject-group-ECFR2d6a5b1c4a8e2d1/section-1.35) [kb] |

### 4.2 The off-channel communications sweep

| Metric | Value | Source |
| --- | --- | --- |
| SEC penalties, Dec 2021 to Jan 2025 | **>$2 billion**, **>100 firms** | [AdvisorHub](https://www.advisorhub.com/sec-enforcement-actions-fall-sharply-in-2025-as-agency-shifts-focus/); [X1 tracker](https://x1wealth.com/resources/off-channel-communications-fines-2026) |
| SEC plus CFTC combined | ">$3 billion" (AdvisorHub) versus "$2.3 billion" (SEC's own later framing of its figure). **Conflict:** the $2.3B figure is sometimes described as including CFTC amounts; totals differ by source | [AdvisorHub](https://www.advisorhub.com/sec-enforcement-actions-fall-sharply-in-2025-as-agency-shifts-focus/); [X1](https://x1wealth.com/resources/off-channel-communications-fines-2026) |
| Last SEC wave | **Jan 13, 2025**: 12 firms, **$63.1M**. One self-reporting firm paid $600k | [Global Relay](https://www.globalrelay.com/resources/thought-leadership/new-year-same-sec-as-12-firms-hit-with-63-million-in-off-channel-communications-fines/); [BCLP](https://www.bclplaw.com/en-US/events-insights-news/sec-off-channel-communications-enforcement-sweep-continues-settlements-by-12-firms-and-assessments-of-over-dollar63-million-in-penalties.html) |
| 2025 posture change | Under Chair Atkins, no new off-channel cases; pending investigations were closed. The SEC called the sweep "misapplied" regulation. Commissioners Peirce and Uyeda had dissented that firms lacked "an achievable path to compliance" | [AdvisorHub](https://www.advisorhub.com/sec-enforcement-actions-fall-sharply-in-2025-as-agency-shifts-focus/); [X1](https://x1wealth.com/resources/off-channel-communications-fines-2026) |
| FINRA continues | Velox Clearing $1.3M (FINRA) plus $500k (SEC), June 2025; $500k fine July 2025; Benjamin F. Edwards **$750k (Jan 30, 2026)** for 3,560+ texts; individual brokers fined and suspended | [MirrorWeb](https://www.mirrorweb.com/blog/how-finra-took-the-sec-baton-with-off-channel-penalties); [Vigilant](https://vigilantllc.com/finra-fines-bd-750k-recordkeeping-supervisory-failures/); [FINRA blog](https://www.finra.org/media-center/blog/sec-off-channel-communications-settlements-sro-collateral-consequences) |

**Implication:** the rules did not change; only the headline enforcement did. An AI phone that creates *new* business-communication records outside the firm's archive is an off-channel risk. Alpha must be **"on-channel by design"**: every agent-mediated message, summary and transcript in a regulated tenant flows to the firm's archive.

### 4.3 MiFID II / UK

| Rule | Requirement | Source |
| --- | --- | --- |
| MiFID II Art. 16(7) and Delegated Reg. 2017/565 Art. 76 | Record telephone and electronic communications relating to transactions, including those on firm-provided or firm-permitted devices. **Face-to-face** conversations must be documented by written minutes or notes (Art. 76(9)). Retain **5 years, up to 7** if the regulator requests. Clients are informed. Records must be tamper-proof and access-logged | [Theta Lake](https://thetalake.com/resources/regulations/mifid-ii/); [ASC](https://www.asctechnologies.com/blog/post/mifid-ii-what-financial-service-providers-need-to-know-about-call-recording-under-the-eu-directive/); [Delegated Reg. 2017/565](https://eur-lex.europa.eu/eli/reg_del/2017/565/oj) [kb for Art. 76(9)] |
| UK FCA SYSC 10A | Onshored MiFID recording rules; 5-year retention (up to 7) | [FCA Handbook SYSC 10A](https://www.handbook.fca.org.uk/handbook/SYSC/10A/) [kb] |

**Opportunity:** a device that automatically produces MiFID-grade *minutes of in-person meetings* is a real compliance feature for EU and UK investment firms, provided originals are retained and the minutes are accurate.

### 4.4 Data security regimes

| Rule | Requirement | Source |
| --- | --- | --- |
| **GLBA Safeguards Rule** (16 CFR 314, FTC; non-bank financial institutions) | Written infosec program, a qualified individual, encryption, MFA, and vendor oversight. **Report breaches of ≥500 customers to the FTC within 30 days** (eff. May 13, 2024) | [FTC](https://www.ftc.gov/business-guidance/blog/2024/05/safeguards-rule-notification-requirement-now-effect); [Covington](https://www.cov.com/en/news-and-insights/insights/2023/11/ftc-finalizes-new-notification-requirement-for-glba-safeguards-rule) |
| GLBA / Interagency Guidelines (banks) | Vendor due diligence under the OCC/FDIC/Fed third-party risk guidance (June 2023) | [OCC Bulletin 2023-17](https://www.occ.gov/news-issuances/bulletins/2023/bulletin-2023-17.html) [kb] |
| **NYDFS 23 NYCRR 500** (amended Nov 2023) | The final phase took effect **Nov 1, 2025**: **universal MFA** for any individual accessing any information system (500.12) and a complete **asset inventory** (500.13). 72-hour incident notice; 24-hour notice of extortion payments; annual certification by **Apr 15**. Penalties up to $75k/day for willful violations (reported) | [Hogan Lovells](https://www.hoganlovells.com/en/publications/nydfs-final-set-of-cybersecurity-requirements-under-amended-part-500-take-effect-november-1-2025); [Greenberg Traurig](https://www.gtlaw.com/en/insights/2025/11/nydfs-final-cybersecurity-rules-mfa-asset-inventory-and-third-party-risk); [Corbado](https://www.corbado.com/blog/nydfs-part-500-mfa-requirements-2025) |
| **PCI DSS v4.0.1** | Mandatory since **Mar 31, 2025**, including the 51 future-dated requirements (such as universal MFA into the cardholder data environment and 12-character passwords). **Sensitive authentication data (CVV, PIN) must not be stored after authorization, including in audio recordings** (Req. 3.3.1) | [Paytia](https://www.paytia.com/resources/blog/pci-dss-4-0-call-centre-guide); [SecurityMetrics](https://www.securitymetrics.com/blog/a-guide-to-new-requirements-in-pci-dss-4-0-1); [PCI SSC](https://www.pcisecuritystandards.org/document_library/) [kb] |
| **MNPI controls** | Exchange Act §15(g) and Advisers Act §204A require written policies to prevent misuse of MNPI; Rule 10b-5 | Information barriers per tenant and deal team; the agent must not carry context across walls; restricted-list awareness; no cross-tenant model memory | [15 U.S.C. §78o(g)](https://www.law.cornell.edu/uscode/text/15/78o) [kb]; [15 U.S.C. §80b-4a](https://www.law.cornell.edu/uscode/text/15/80b-4a) [kb] |

### 4.5 The retention versus redaction tension

| Need | Driver | Resolution pattern (inference) |
| --- | --- | --- |
| Keep the unaltered original, tamper-evident, 3–7 years | 17a-4, 4511, 204-2, MiFID II, CFTC | Customer-controlled immutable archive (or Alpha's store meeting the 17a-4 audit-trail alternative); originals encrypted with **customer-held keys** |
| Remove card data *entirely* | PCI DSS 3.3.1 | **Pre-storage** removal of PAN and CVV from audio and transcript. This is the one place destructive redaction is *required*. A PCI conflict with 17a-4 is typically resolved by never capturing the card data (for example, DTMF-masking patterns) |
| Minimize PHI and personal data | HIPAA minimum necessary; GDPR Art. 5(1)(c) | Redacted derivatives for AI context, search and sharing; role-based rehydration |
| Preserve for litigation | Legal hold (FRCP 37(e)) | Hold overrides both deletion schedules and redaction-then-delete jobs |

---

## 5. Legal: privilege, ethics and e-discovery

| Topic | Rule or case | Implication | Source |
| --- | --- | --- | --- |
| **ABA Formal Opinion 512** (July 29, 2024) | Lawyers using GenAI must meet their duties of competence (1.1), confidentiality (1.6), communication (1.4), supervision (5.1/5.3), candor and reasonable fees (1.5). **Informed client consent** is needed before inputting confidential information into *self-learning* tools that could disclose it; boilerplate engagement-letter consent is not enough | No training on client data; per-matter isolation; vendor terms that forbid reuse; audit logs; the ability to show the lawyer what the tool does with data | [ABA Formal Op. 512 (PDF)](https://www.americanbar.org/content/dam/aba/administrative/professional_responsibility/ethics-opinions/aba-formal-opinion-512.pdf) [kb; the ABA site returned 403] |
| Privilege and third-party AI: ***United States v. Heppner*** (S.D.N.Y., Feb 2026, Rakoff, J.) | Reported holding: a criminal defendant's exchanges with a **consumer** AI chatbot (Anthropic's Claude) were **not protected** by attorney-client privilege or work product. There was no attorney involved, and the provider's terms defeated any expectation of confidentiality | Consumer-grade AI terms can waive privilege. **Enterprise terms, no provider access, and attestation** support a confidentiality argument. Attorney direction (a *Kovel*-style arrangement) matters | [kb, verify: the ruling was not re-fetched in this session] |
| Contrasting view: *Warner v. Gilbarco* (E.D. Mich., 2026) | Reported: a pro se litigant's AI-assisted materials were protected as work product | The case law is unsettled | [kb, verify] |
| Waiver doctrine generally | Disclosure to a third party that is not necessary for legal advice can waive privilege. Cloud-vendor cases generally find no waiver where there are reasonable confidentiality precautions | Alpha should give law firms a "privileged mode" with an enclave-only path, no human access, and per-matter keys | [FRE 502](https://www.law.cornell.edu/rules/fre/rule_502) [kb] |
| **Recording of privileged meetings** | Bystander third parties present, or an AI vendor with *capability*, may break confidentiality | Auto-suppress capture when a "privileged" meeting tag or legal hold is detected, or require explicit attorney-controlled capture | Inference |
| **E-discovery and legal hold** | FRCP 26(b)(1) and 34: transcripts and AI summaries are ESI, so they are discoverable. FRCP 37(e) sanctions apply for failing to preserve. In *NYT v. OpenAI* (S.D.N.Y.), a **May 13, 2025** order required OpenAI to preserve output logs it would otherwise delete. It was later narrowed or lifted in fall 2025 [kb] | Legal hold per custodian, matter or keyword that suspends deletion; defensible export (load files with metadata); chain-of-custody hashing | [FRCP 37](https://www.law.cornell.edu/rules/frcp/rule_37) [kb]; [kb, verify NYT v. OpenAI order dates] |
| Deletion as spoliation | Ephemeral-by-default designs risk sanctions once litigation is reasonably anticipated | The retention engine must be hold-aware | [FRCP 37(e)](https://www.law.cornell.edu/rules/frcp/rule_37) [kb] |

**Source caveat:** because the search budget ran out, the privilege cases (Heppner and Warner) are recorded from the analyst's knowledge and need legal verification.

---

## 6. Education

| Rule | Requirement | What Alpha must implement | Source |
| --- | --- | --- | --- |
| **FERPA** (20 U.S.C. §1232g; 34 CFR 99) | Education records may be disclosed to vendors under the "school official" exception (§99.31(a)(1)(i)(B)) only if the vendor is under direct control, uses data only for the authorized purpose and does not redisclose | Contract terms (DPA); no secondary use or training; deletion on termination; parent and eligible-student access workflows | [34 CFR 99.31](https://www.ecfr.gov/current/title-34/subtitle-A/part-99/subpart-D/section-99.31) [kb] |
| **COPPA 2025 amendments** (published **Apr 22, 2025**; effective **June 23, 2025**; general compliance date **Apr 22, 2026**) | **Separate verifiable parental consent** for third-party disclosures, including for targeted advertising; **written data-retention policy** (no indefinite retention); written infosec program; **biometric identifiers** (including voiceprints) and government IDs added to "personal information"; Safe Harbor transparency | Voice capture of under-13s is personal information. Get school authorization or parental consent; publish a retention policy; do not deploy recording in K-8 classrooms without a specific design | [FTC press release](https://www.ftc.gov/news-events/news/press-releases/2025/01/ftc-finalizes-changes-childrens-privacy-rule-limiting-companies-ability-monetize-kids-data); [Federal Register 2025-05904 (API)](https://www.federalregister.gov/api/v1/documents/2025-05904.json) |
| State student-privacy laws | California SOPIPA (Bus. & Prof. Code §22584), NY Education Law §2-d (with a Parents' Bill of Rights and a DPA), Illinois SOPPA, and 100+ other state laws. The Student Data Privacy Consortium's National DPA is the de facto contract | Sign the NDPA; list subprocessors; no targeted ads or profiling | [SDPC](https://privacy.a4l.org/) [kb]; [NYSED 2-d](https://www.nysed.gov/data-privacy-security) [kb] |
| **CIPA (Children's Internet Protection Act) / E-rate** | E-rate-funded schools must have internet-safety policies and filtering. E-rate funds connectivity, not end-user handsets. The FCC's 2024 Wi-Fi hotspot lending eligibility was **rescinded by the FCC in Sept 2025** [kb] | E-rate is **not** a realistic funding path for Alpha devices. A school deployment would need content filtering on the browser and agent | [FCC E-rate](https://www.fcc.gov/general/e-rate-schools-libraries-usf-program) [kb] |
| EU AI Act Art. 5(1)(f) | No emotion inference in **education institutions** | Disable affect features entirely for education tenants | [AI Act Art. 5](https://artificialintelligenceact.eu/article/5/) |
| EO "Advancing AI Education for American Youth" (published Apr 28, 2025) | Federal promotion of AI literacy; no product obligations | A positive signal for higher-ed pilots | [Federal Register](https://www.federalregister.gov/documents/2025/04/28/2025-07368/advancing-artificial-intelligence-education-for-american-youth) |

**Verdict (inference):** K-12 recording is high-risk and low-value for Alpha. Higher education (faculty and administrator office assistant, FERPA DPA, adults) is feasible.

---

## 7. Government and defense

### 7.1 Cloud authorizations

| Program | What it is | Status and timing | Cost / time (est.) | Unlocks | Source |
| --- | --- | --- | --- | --- | --- |
| **FedRAMP Rev5** (agency authorization) | NIST 800-53 Rev5 baseline via a 3PAO plus agency ATO | **Rev5 certifications end June 11, 2027** as 20x takes over | $1–3M and 12–24 months for Moderate (est.) | Federal civilian SaaS | [fedramp.gov/20x](https://www.fedramp.gov/20x/) |
| **FedRAMP 20x** | Automation-first, Key Security Indicators, continuous validation. Classes A–D | Phase 1 Low pilot: 26 submissions, 13 reviews. Phase 2 Moderate: 14 qualifying; **first authorizations Mar 6, 2026**, six more by Apr 27, 2026. Phase 3 (FY26 Q3–Q4) opens submissions Jul–Sep 2026. Class D (High) pilot planned FY27 Q1–Q2 | $250k–$1M and 3–9 months for Class B/C (est.) | Federal civilian; the realistic first federal cloud step | [fedramp.gov/20x](https://www.fedramp.gov/20x/) |
| **StateRAMP → GovRAMP** | State and local cloud verification that reuses FedRAMP | Renamed GovRAMP in 2025 [kb] | $100–400k and 6–12 months (est.) | State and local agencies (TX, AZ, NC and others require it) | [GovRAMP](https://govramp.org/) [kb] |
| **DoD IL4 / IL5 / IL6** (Cloud Computing SRG) | IL4: CUI (FedRAMP Moderate plus DoD controls). IL5: higher-sensitivity CUI and NSS (FedRAMP High plus physical separation). IL6: SECRET | AWS GovCloud supports IL5 and AWS Secret Region supports IL6 [kb]. Alpha's workload would need its own DISA PA | IL5 PA $2–5M and 18–36 months (est.) | DoD CUI workloads | [DoD Cloud SRG](https://public.cyber.mil/dccs/dccs-documents/) [kb] |
| **CJIS Security Policy** | FBI policy for criminal justice information. v6.0 (Dec 2024) was re-aligned to NIST 800-53; MFA and audit are mandatory [kb] | No certification. State CJIS Systems Agency audits; vendor personnel need fingerprint background checks | $100–300k (est.) | Police, courts, public safety | [FBI CJIS](https://le.fbi.gov/cjis-division-resources/cjis-security-policy-resource-center) [kb; 403] |
| **IRS Publication 1075** | Safeguards for federal tax information (FTI) at state agencies and contractors; 45-day notification before cloud use; US-only access | Agency-driven | $100–300k (est.) | State revenue and benefits agencies | [IRS Pub 1075](https://www.irs.gov/pub/irs-pdf/p1075.pdf) [kb] |

**Nitro Enclaves note:** AWS GovCloud (US) is FedRAMP High and IL5. Whether Nitro Enclaves and the specific KMS attestation flow fall within the authorized boundary for Alpha's regions must be confirmed ([AWS services in scope](https://aws.amazon.com/compliance/services-in-scope/) [kb]).

### 7.2 Defense industrial base

| Rule | Requirement | Dates | Cost (est.) | Source |
| --- | --- | --- | --- | --- |
| **CMMC 2.0**: 32 CFR Part 170 (program rule) | L1: 15 FAR 52.204-21 requirements, annual self-assessment (Wikipedia says "14 practices", but the rule text has 15). L2: 110 NIST SP 800-171 Rev 2 requirements, self-assessment or **C3PAO** triennially. L3: plus 24 selected SP 800-172 requirements, DIBCAC assessment | Program rule effective **Dec 16, 2024** | L2 C3PAO roughly $100–120k per assessment in DoD's regulatory impact analysis, plus remediation of $100k–$1M+ (est.) | [Federal Register 2024-22905](https://www.federalregister.gov/documents/2024/10/15/2024-22905/cybersecurity-maturity-model-certification-cmmc-program); [Wikipedia](https://en.wikipedia.org/wiki/Cybersecurity_Maturity_Model_Certification) |
| **CMMC 48 CFR (DFARS) rule** (DFARS Case 2019-D041) | Puts CMMC level requirements into contracts (252.204-7021/-7025) | Published Sept 10, 2025; **effective Nov 10, 2025** (Phase 1: self-assessments). Phase 2 (C3PAO L2) was scheduled for Nov 10, 2026. **On July 13, 2026 DoD reportedly paused Phase 2** pending a CMMC Reform Task Force review | — | [Federal Register 2025-17359 (API)](https://www.federalregister.gov/api/v1/documents/2025-17359.json); [Wikipedia citing DefenseScoop, July 13, 2026](https://en.wikipedia.org/wiki/Cybersecurity_Maturity_Model_Certification) |
| **DFARS 252.204-7012** | Safeguard covered defense information with NIST SP 800-171; **report cyber incidents within 72 hours**; cloud providers handling CDI must meet **FedRAMP Moderate equivalent** (DoD memo Dec 2023) | In force | — | [DFARS 252.204-7012](https://www.acquisition.gov/dfars/252.204-7012-safeguarding-covered-defense-information-and-cyber-incident-reporting.) [kb] |
| **NIST SP 800-171 Rev 3** (May 2024) / **800-172** | Rev 3 is published, but DoD's class deviation keeps **Rev 2** for CMMC assessments [kb] | — | — | [NIST SP 800-171r3](https://csrc.nist.gov/pubs/sp/800/171/r3/final) [kb] |
| **CUI** (32 CFR 2002; NARA CUI Registry) | Marking, safeguarding and dissemination controls | — | — | [NARA CUI](https://www.archives.gov/cui) [kb] |

**Source conflict:** the Phase 2 pause is sourced through Wikipedia's citation of a DefenseScoop article (July 13, 2026). Verify it against the DoD CIO before relying on it.

### 7.3 Export controls

| Rule | Requirement | What Alpha must do | Source |
| --- | --- | --- | --- |
| **EAR Cat. 5 Part 2**: 5A002 (hardware) and 5D002 (software) | Encryption items above the thresholds are controlled. Most commercial phones and apps qualify for **mass-market** treatment (5A992.c/5D992.c) after self-classification | File an **annual self-classification report** under License Exception **ENC §740.17(b)(1)** (due **Feb 1** for the prior year). A (b)(2)/(b)(3) classification request may be needed for non-mass-market or government-tailored variants (such as a CSfC or custom-crypto build); allow a 30-day BIS review | [15 CFR 740.17](https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-740/section-740.17) [kb; the eCFR fetch was blocked] |
| Open-source encryption | §742.15(b): publicly available encryption source code is not subject to the EAR after an email notice to BIS and NSA (for non-standard crypto) | elizaOS and AOSP components may qualify, but Alpha's proprietary builds do not | [15 CFR 742.15](https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-742/section-742.15) [kb] |
| Embargoed and restricted parties | No exports to E:1/E:2 countries (Cuba, Iran, North Korea, Syria) or Entity List parties | Screen customers and resellers; geofence activation | [15 CFR 744](https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-744) [kb] |
| **ITAR** (22 CFR 120–130) | Applies only if Alpha is *specially designed or modified* for defense articles (USML Cat. XI or XIII) | Keep any defense variant commercial (EAR); avoid ITAR taint by not accepting ITAR technical data into the product design | [22 CFR 121](https://www.ecfr.gov/current/title-22/chapter-I/subchapter-M/part-121) [kb] |
| AI model and compute controls | The AI Diffusion rule (Jan 2025) was rescinded in May 2025 [kb]. The July 2025 EO "Promoting the Export of the American AI Technology Stack" promotes full-stack AI exports | Low near-term burden; watch chip controls if Alpha ever ships on-device NPUs to controlled destinations | [Federal Register 2025-14218](https://www.federalregister.gov/documents/2025/07/28/2025-14218/promoting-the-export-of-the-american-ai-technology-stack) |

### 7.4 Supply chain and origin

| Rule | Requirement | Alpha exposure | Source |
| --- | --- | --- | --- |
| **NDAA FY2019 §889** (FAR 52.204-24/25/26) | Federal agencies may not procure, and contractors may not *use*, covered telecom and video equipment from Huawei, ZTE, Hytera, Hikvision, Dahua and their affiliates | Audit the BOM, including modem, camera and Wi-Fi modules; a Pixel-class device is generally fine. Supplier representation letters | [FAR 52.204-25](https://www.acquisition.gov/far/52.204-25) [kb] |
| **Trade Agreements Act** (FAR 52.225-5) | GSA Schedule and many federal buys need TAA-compliant origin (US or a designated country; **China is not designated**) | Handsets assembled in China are not TAA-compliant. Pixel final assembly has moved partly to Vietnam and India; check the SKU's country of origin | [FAR 52.225-5](https://www.acquisition.gov/far/52.225-5) [kb] |
| FASCSA orders; NDAA FY2023 §5949 (semiconductors, eff. 2027) | Exclusion orders; bans on certain Chinese chips (SMIC, YMTC, CXMT) in federal procurement from Dec 2027 | Silicon provenance | [NDAA FY23 §5949](https://www.congress.gov/bill/117th-congress/house-bill/7776) [kb] |

### 7.5 Device-level certifications

| Certification | What it is | Relevance to Alpha | Cost / time (est.) | Source |
| --- | --- | --- | --- | --- |
| **NIAP Common Criteria: Mobile Device Fundamentals PP** (MDFPP v3.3 plus PP-Modules for Bluetooth, WLAN client, VPN client and MDM agent) | The US scheme for COTS mobile devices in NSS. Required for the CSfC components list and DoD mobile use | Stock **Pixel** and **Samsung Galaxy** (Knox) devices are routinely NIAP-evaluated [kb]. **A custom AOSP image or a HOME-launcher replacement may void the evaluated configuration.** Alpha as an *app* on an evaluated device can use the "App Software PP" instead | MDF device evaluation $500k–$1.5M; App PP $100–300k; 6–12 months (NIAP expects completion in ~180 days) (est.) | [NIAP PPs](https://www.niap-ccevs.org/protectionprofiles) [kb; page rendered empty]; [Common Criteria Portal](https://www.commoncriteriaportal.org/pps/) [kb; 403] |
| **CSfC Mobile Access Capability Package (MACP)** | NSA's two-layer commercial encryption (two independent VPN or TLS tunnels) for classified access with COTS phones | Requires NIAP-evaluated components on the CSfC list, plus a CSfC registration by the customer or integrator | Listing is free, but the NIAP evaluations underneath are costly; 12–24 months (est.) | [NSA CSfC](https://www.nsa.gov/Resources/Commercial-Solutions-for-Classified-Program/) [kb; 403] |
| **DISA STIGs** (Google Android STIG, Samsung Android with Knox STIG, Mobile OS SRG) | DoD configuration baselines; required for DoD deployment | OEM-specific STIGs exist for Pixel and Samsung. A new OS variant needs a vendor-written STIG submitted to DISA against the Mobile OS SRG | $150–400k and 6–12 months (est.) | [DoD Cyber Exchange STIGs](https://public.cyber.mil/stigs/downloads/) [kb] |
| **FIPS 140-3** (CMVP) | Validated crypto modules are required for federal systems (FISMA), CMMC (SC.L2-3.13.11), CJIS and HIPAA best practice | 206 modules are in the CMVP process list (54 in review, 47 in lab comment resolution, 31 in CMVP comment resolution, **27 pending review**) as of 2026-09-30. **FIPS 140-2 certificates moved to historical on Sept 21, 2026.** Fastest path: use already-validated modules (BoringCrypto/BoringSSL on Android, AWS-LC, AWS KMS HSMs) in their approved modes rather than validating Alpha's own | Own module: $80–250k and **12–24 months** including queue (est.). Inheriting: about $10–30k engineering (est.) | [CMVP MIP list](https://csrc.nist.gov/projects/cryptographic-module-validation-program/modules-in-process/modules-in-process-list); [Wikipedia FIPS 140-3](https://en.wikipedia.org/wiki/FIPS_140-3) |
| Common Criteria (international, CCRA) | Same evaluations recognized across 31 nations for cPPs | EU gov buyers now also reference EUCC (the EU CC scheme, applicable from Feb 2025) [kb] | As NIAP | [EUCC Reg. 2024/482](https://eur-lex.europa.eu/eli/reg_impl/2024/482/oj) [kb] |

### 7.6 Federal AI governance

| Instrument | Requirement | Alpha impact | Source |
| --- | --- | --- | --- |
| **EO 14179** "Removing Barriers to American Leadership in AI" (signed Jan 23, 2025; published Jan 31, 2025) | Revoked EO 14110; ordered an AI Action Plan | Less federal AI red tape overall | [Federal Register 2025-02172](https://www.federalregister.gov/documents/2025/01/31/2025-02172/removing-barriers-to-american-leadership-in-artificial-intelligence) |
| **OMB M-25-21** (Apr 3, 2025) | Chief AI Officers (60 days), AI governance boards (90 days), AI strategies (180 days), GenAI policies (270 days). **Minimum risk-management practices for "high-impact AI"** documented within 365 days (pre-deployment testing, impact assessment, human oversight, monitoring) | An office assistant is unlikely to be "high-impact" unless its output is a principal basis for decisions on rights or safety. Buyers will still ask for testing evidence and model cards | [M-25-21 PDF (whitehouse.gov)](https://www.whitehouse.gov/wp-content/uploads/2025/02/M-25-21-Accelerating-Federal-Use-of-AI-through-Innovation-Governance-and-Public-Trust.pdf) |
| **OMB M-25-22** "Driving Efficient Acquisition of AI in Government" (Apr 3, 2025) | Contract terms: **no vendor training on non-public government data** without consent, data portability and anti-lock-in, American-made AI preference, and performance testing | Matches Alpha's no-training design; needs export and portability | [M-25-22 PDF](https://www.whitehouse.gov/wp-content/uploads/2025/02/M-25-22-Driving-Efficient-Acquisition-of-Artificial-Intelligence-in-Government.pdf) [kb] |
| **EO 14319** "Preventing Woke AI in the Federal Government" (July 23, 2025) | "Unbiased AI Principles" (truth-seeking, ideological neutrality) for **federally procured LLMs**. OMB guidance within 120 days. Contract terms include vendor-paid decommissioning for non-compliance | Alpha's LLM choice and system prompts must be documentable to federal buyers. Implementing OMB memo M-26-04 (Dec 2025) [kb] | [Federal Register 2025-14217](https://www.federalregister.gov/documents/2025/07/28/2025-14217/preventing-woke-ai-in-the-federal-government) |
| **EO 14365** "Ensuring a National Policy Framework for AI" (Dec 11, 2025) | DOJ AI Litigation Task Force to challenge state AI laws; Commerce list of "onerous" state laws; BEAD funding conditions; FTC and FCC actions; draft preemption legislation. **Carve-outs:** child safety, data-center infrastructure, and **state procurement** | Wiretap, BIPA and privacy laws are *not* AI-specific and remain. State AI laws (for example Colorado) may be challenged | [Federal Register 2025-23092](https://www.federalregister.gov/documents/2025/12/16/2025-23092/ensuring-a-national-policy-framework-for-artificial-intelligence) |
| **EO 14409** "Promoting Advanced AI Innovation and Security" (June 2, 2026) | Voluntary frontier-model assessment framework; AI-enabled cyber defense of federal and national-security systems; Treasury AI cybersecurity clearinghouse. Expressly **no mandatory licensing** | No direct product obligation; possible sales hook for secure-agent tooling | [Federal Register 2026-11415](https://www.federalregister.gov/documents/2026/06/05/2026-11415/promoting-advanced-artificial-intelligence-innovation-and-security) |

### 7.7 Model-origin risk (the Qwen problem)

The manifest's inference model is **Qwen** (Alibaba, PRC). There is no single statute that bans Qwen for federal use as of this writing. However:

- M-25-22 prefers American AI [kb].
- Multiple federal agencies and states banned DeepSeek in 2025 [kb].
- Defense and intelligence buyers apply supply-chain risk management (SCRM) scrutiny to foreign-origin software (FASCSA) ([FAR 52.204-30](https://www.acquisition.gov/far/52.204-30) [kb]).

**Inference:** for government, defense and many regulated-finance buyers, Alpha needs a **US- or allied-origin model option** (such as Llama-family, Mistral for the EU, or US frontier APIs inside the enclave pattern) before any procurement conversation. This is a product decision, not a certification.

---

## 8. International

### 8.1 EU AI Act (Regulation 2024/1689)

| Obligation | Date | Relevance to Alpha | Source |
| --- | --- | --- | --- |
| Prohibitions (Art. 5), including **emotion recognition in the workplace and education** (5(1)(f)) and sensitive biometric categorization (5(1)(g)). AI literacy (Art. 4) | **Feb 2, 2025** | An office assistant **must not infer emotions** of workers in the EU. The only exception is medical or safety reasons. Penalties up to €35M or 7% of turnover | [Art. 5](https://artificialintelligenceact.eu/article/5/); [timeline](https://artificialintelligenceact.eu/implementation-timeline/) |
| **GPAI model obligations** (Arts. 53–55) and penalties | **Aug 2, 2025**. Models already on the market before then have until **Aug 2, 2027** | These fall on the **model provider** (Alibaba for Qwen), not Alpha, unless Alpha fine-tunes substantially (then Alpha may become a provider). Alpha is a *deployer or downstream provider* | [timeline](https://artificialintelligenceact.eu/implementation-timeline/) |
| Transparency (Art. 50): disclose AI interaction; label synthetic audio and content | Aug 2, 2026 (the Digital Omnibus may have adjusted parts; verify) | The agent must disclose that it is AI when it speaks to third parties (for example on phone calls). TTS output needs marking | [AI Act Art. 50](https://artificialintelligenceact.eu/article/50/) [kb] |
| **High-risk (Annex III)**, including employment uses (recruitment, task allocation, monitoring and evaluation of performance) | **Dec 2, 2027** (delayed by the Digital Omnibus) | If Alpha is used to monitor or evaluate workers, it becomes high-risk: conformity assessment, risk management, logging, human oversight | [timeline](https://artificialintelligenceact.eu/implementation-timeline/) |
| High-risk (Annex I, product safety) | Aug 2, 2028 | Probably not applicable | [timeline](https://artificialintelligenceact.eu/implementation-timeline/) |

**Positioning rule (inference):** in EU marketing and contracts, restrict the intended purpose to **"personal productivity and meeting documentation, not worker monitoring or evaluation"** to stay out of Annex III.

### 8.2 GDPR, the Data Act and adjacent EU rules

| Rule | Requirement | Alpha must implement | Source |
| --- | --- | --- | --- |
| GDPR | Lawful basis; DPIA for recording and monitoring; Art. 28 DPA; Art. 44+ transfers (EU-US Data Privacy Framework certification or SCCs); data subject rights; Art. 9 for biometrics and health | An EU region (AWS Frankfurt or Paris with Nitro); DPA; SCCs and DPF; DSAR tools; record of processing | [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj) [kb] |
| **EU Data Act** (Reg. 2023/2854) | General applicability **Sept 12, 2025** (user access to product and related-service data). **Products placed on the market after Sept 12, 2026** must be designed so that the data is accessible to the user by default. Cloud-switching rules, with switching fees phased out by Jan 2027 [kb] | Alpha, as a connected product plus a related service, must give users (and third parties they designate) access to generated data. Export APIs | [Wikipedia: Data Act](https://en.wikipedia.org/wiki/Data_Act_(European_Union)) |
| NIS2 (Dir. 2022/2555) | Essential and important entities' supply-chain security | Customers will flow down security requirements | [EUR-Lex NIS2](https://eur-lex.europa.eu/eli/dir/2022/2555/oj) [kb] |
| Cyber Resilience Act (Reg. 2024/2847) | Products with digital elements: vulnerability reporting from **Sept 11, 2026**; full obligations and CE marking **Dec 11, 2027** [kb] | SBOM, vulnerability handling, security updates for the device and app | [EUR-Lex CRA](https://eur-lex.europa.eu/eli/reg/2024/2847/oj) [kb] |
| Radio Equipment Directive delegated act (cybersecurity) | Applies from **Aug 1, 2025** to internet-connected radio equipment [kb] | Relevant if Alpha ships its own hardware in the EU | [EUR-Lex 2022/30](https://eur-lex.europa.eu/eli/reg_del/2022/30/oj) [kb] |

### 8.3 UK

UK GDPR plus the DUAA 2025 ([Wikipedia](https://en.wikipedia.org/wiki/Data_(Use_and_Access)_Act_2025)); business interception rules ([SI 2018/356](https://www.legislation.gov.uk/uksi/2018/356/contents/made) [kb]); the FCA's SYSC 10A recording rules ([FCA](https://www.handbook.fca.org.uk/handbook/SYSC/10A/) [kb]); the UK–US "data bridge" ([gov.uk](https://www.gov.uk/government/publications/uk-us-data-bridge-supporting-documents) [kb]). There is no AI statute; regulation is sector-led. UK government buyers use **Cyber Essentials Plus** (roughly £2–5k, est.) and G-Cloud listing ([NCSC Cyber Essentials](https://www.ncsc.gov.uk/cyberessentials/overview) [kb]).

### 8.4 Gulf states: sovereign data rules

| Jurisdiction | Law | Key rules | Source |
| --- | --- | --- | --- |
| Saudi Arabia | Personal Data Protection Law (effective Sept 14, 2023; enforcement Sept 14, 2024) [kb]; NCA Essential Cybersecurity Controls and Cloud Cybersecurity Controls | Transfer restrictions (SDAIA Transfer Regulation); **government data must be hosted in-Kingdom** under the NCA and DGA cloud policy [kb] | [SDAIA PDPL](https://sdaia.gov.sa/en/SDAIA/about/Documents/Personal%20Data%20English%20V2-23April2023-%20Reviewed-.pdf) [kb] |
| UAE | Federal Decree-Law 45/2021 (PDPL); DIFC DP Law 2020; ADGM DP Regs 2021; TDRA and UAE IA standards | Onshore hosting expected for government and critical sectors. Free zones follow GDPR-like rules | [UAE PDPL](https://u.ae/en/about-the-uae/digital-uae/data/data-protection-laws) [kb] |
| Qatar | Law No. 13 of 2016 (PDPPL) | Data residency for government; NCSA cloud policy | [Qatar NCSA](https://assurance.ncsa.gov.qa/) [kb] |

**Inference:** a Gulf sovereign deal requires an **in-country enclave region**. AWS has regions in the UAE (me-central-1) and Bahrain, and a Saudi region was announced for 2026 [kb]. Local partnership is also typical.

### 8.5 India DPDP

The Digital Personal Data Protection Act 2023 and the DPDP Rules 2025 were phased in: the Board and core provisions from **Nov 13, 2025**, further provisions from **Nov 13, 2026**, and the remainder from **May 13, 2027** ([Wikipedia DPDP](https://en.wikipedia.org/wiki/Digital_Personal_Data_Protection_Act,_2023)). Penalties go up to **₹250 crore** per breach type ([DPDP Act Schedule](https://www.meity.gov.in/writereaddata/files/Digital%20Personal%20Data%20Protection%20Act%202023.pdf) [kb]). *Source conflict:* the Wikipedia summary describes "minimum penalties of 50 crore", which does not match the Act's schedule of *maximum* penalties; use the Act. The Act covers digital data only, has no legitimate-interest basis, and allows cross-border transfer except to government-blacklisted countries.

---

## 9. Product features required by regulation

| Feature | Required or strongly implied by | Priority | Build cost (est.) | Notes |
| --- | --- | --- | --- | --- |
| **Visible recording indicator** (persistent on-screen and LED/status, plus the Android mic privacy indicator) | All-party-consent statutes (notice defeats "secret"); GDPR transparency; ICO guidance; social acceptability | P0 | Low | Android 12+ already shows a system mic indicator. Add an app-level banner and lock-screen chip |
| **Announcement tone or spoken disclosure** at start and on join | WA RCW 9.73.030 (a recorded announcement counts as consent); CIPA; EU AI Act Art. 50 (disclose AI) | P0 | Low | Localized, configurable, logged |
| **All-party consent capture and log** (verbal "OK" detection, tap-to-consent, QR link for guests) | CIPA §631/632, the 11–15 all-party states, BIPA §15(b) (written, for voiceprints), GDPR | P0 | Medium | Store the consent event, the person and the hash of the notice text |
| **Opt-out / pause / "off the record"** | CA and FL law; GDPR Art. 21; law-firm privilege | P0 | Low | Hardware-style mute plus a verbal command |
| **No training on customer data** (contract plus technical enforcement) | Otter/Ambriz theories; ABA 512; M-25-22; FERPA; COPPA | P0 | Low (policy) | Attest it with enclave PCRs: the "no-capability" claim |
| **Session-only diarization; opt-in enrolled voiceprints** with written release and retention schedule | BIPA §15(a)(b); CUBI; WA RCW 19.375; GDPR Art. 9; COPPA 2025 | P0 | Medium | Publish a BIPA biometric policy |
| **Retention controls** (per tenant, per artifact type; auto-delete; min and max) | 17a-4, 4511, 204-2, MiFID (minimums); GDPR, COPPA, CUBI (maximums) | P0 | Medium | Separate policy for audio, transcript, summary and embeddings |
| **Legal hold** (custodian, matter, keyword) overriding deletion | FRCP 37(e); SEC and FINRA inquiries | P0 for enterprise | Medium | Must also suspend redact-and-purge jobs |
| **Immutable audit log** (access, export, consent, admin, model version) | HIPAA §164.312(b); 17a-4 audit-trail alternative; NYDFS 500.6; CJIS; SOC 2; MiFID traceability | P0 | Medium | Hash-chained; exportable to SIEM |
| **Dual-record model** (immutable original under customer key plus redacted derivatives) | Finance retention versus privacy minimization | P1 (finance) | High | See §4.5 |
| **Pre-storage PCI redaction** (PAN and CVV removed from audio and text) | PCI DSS 3.3.1 | P1 | Medium | Destructive by design |
| **Archive connectors** (Smarsh, Global Relay, Theta Lake, Proofpoint, Microsoft Purview) | 17a-4, FINRA 3110/4511, MiFID II | P1 (finance) | Medium | The "on-channel by design" story |
| **BAA program** plus a PHI-safe mode | HIPAA | P1 | Low–Medium | Needs AWS and Cerebras BAAs in the chain |
| **Data residency** (US, EU, UK, KSA/UAE regions; pinned enclave regions) | GDPR transfers; Gulf sovereignty; IRS 1075; CJIS; DPDP | P1 | Medium–High | Nitro Enclaves are available per region |
| **Customer-managed keys (BYOK/HYOK)** with attested release | Privilege; CIPA capability defense; FedRAMP SC-12; bank TPRM | P1 | Medium | Natural fit with the KMS attestation |
| **Information barriers / matter walls** | MNPI (§15(g), §204A); ABA 512 conflicts | P1 (finance, legal) | Medium | No cross-wall agent memory |
| **Emotion and sentiment inference disabled** (EU, education) | AI Act Art. 5(1)(f) | P0 for the EU | Low | Hard-disable, not merely hidden |
| **AI disclosure and synthetic-audio marking** | AI Act Art. 50; state bot-disclosure laws (CA B&P §17941) [kb] | P1 | Low | For agent-placed calls and messages |
| **Employee notice and acknowledgment tooling** | NY CRL §52-c; CT and DE; works councils | P1 | Low | Admin console templates |
| **DSAR / export / deletion APIs** | GDPR, CCPA, EU Data Act, DPDP | P1 | Medium | The Data Act requires by-default accessibility for products placed after Sept 12, 2026 |
| **MFA and asset inventory for admin and cloud** | NYDFS 500.12/13; PCI 4.0.1; HIPAA NPRM | P0 | Low | — |
| **FIPS 140-3 validated crypto mode** | FISMA/FedRAMP; CMMC; CJIS | P2 (gov) | Low if inherited | Use BoringCrypto, AWS-LC and KMS |
| **MDM/EMM manageability** (Android Enterprise, managed configurations, work profile) | DISA STIG; NIAP MDF (MDM module); bank TPRM | P1 | Medium | Required for any fleet sale |
| **Configurable breach-notification workflows** | HIPAA (60 days), GLBA (30 days to FTC), NYDFS (72 hours), DFARS 7012 (72 hours), GDPR (72 hours), DPDP | P1 | Low | Runbooks plus tenant contact registry |
| **US-origin model option** | M-25-22 preference; federal and defense SCRM | P1 (gov) | Medium | See §7.7 |

---

## 10. Certification cost and timeline summary

All costs are estimates (est.) for a startup-scale scope. Ranges combine auditor fees and internal effort, excluding engineering of the product features in §9.

| Certification / program | Cost (est.) | Time to first result (est.) | Recurring (est.) | Unlocks |
| --- | --- | --- | --- | --- |
| SOC 2 Type I, then Type II (enclave cloud plus device management) | $40–150k | Type I in 3–4 months; Type II after a 6–12-month window | $30–80k/yr | Almost every US enterprise, mid-market finance, law firms |
| ISO/IEC 27001 (+27701 privacy, +42001 AI management) | $60–200k | 6–12 months | $20–50k/yr | EU, UK, Gulf and APAC enterprise; public tenders |
| HIPAA program plus BAA | $20–80k | 2–4 months | Low | Clinics, health systems (with SOC 2) |
| HITRUST e1 → i1 → r2 | $40–500k | 4–12 months | Meaningful | Large health systems and payers |
| 17a-4 archive integration (partner) | $30–100k eng. plus partner fees | 2–4 months | Partner rev-share | Broker-dealers and RIAs |
| PCI DSS (SAQ scope minimized by never storing card data) | $10–50k | 1–3 months | Low | Only if payments are in scope (currently deferred) |
| EU readiness (DPA, SCCs/DPF, EU region, DPIA templates) | $50–150k | 3–6 months | Low | EU enterprise |
| Encryption export self-classification (ENC) | ≈$5–20k counsel | Weeks | Annual report | Lawful export |
| GovRAMP | $100–400k | 6–12 months | $50–150k/yr | State and local |
| FedRAMP 20x Moderate (Class C) | $250k–$1M | 3–9 months after pipeline acceptance | Continuous monitoring | Federal civilian |
| FedRAMP Rev5 Moderate / High | $1–3M / $2–5M | 12–24 months | $250k+/yr | Federal (until Rev5 sunsets June 2027) |
| CJIS readiness | $100–300k | 3–9 months per state | Per state | Public safety |
| CMMC L2 (Alpha as a DIB supplier handling CUI) | $150k–$1M incl. remediation | 6–18 months | Triennial | Defense primes and subs |
| FIPS 140-3 own module | $80–250k | 12–24 months (the queue dominates) | Revalidation | Federal crypto claims |
| NIAP App Software PP (Alpha as an app on a NIAP-listed Pixel or Samsung) | $100–300k | 6–9 months | Maintenance | DoD and IC app use |
| NIAP MDF (Alpha's own OS image) | $500k–$1.5M | 9–15 months | Each OS release | DoD, CSfC |
| DISA STIG (vendor-written) | $150–400k | 6–12 months | Updates | DoD deployment |
| CSfC component listing | Mostly NIAP costs plus NSA MOA | 12–24 months | — | Classified mobile access |
| DoD IL5 PA | $2–5M | 18–36 months | High | DoD CUI and NSS |
| EU AI Act (deployer/downstream; not high-risk) | $20–60k | 2–4 months | Low | EU (hygiene) |

---

## 11. Prioritized compliance roadmap for Alpha

### Phase 0 (0–3 months, <$100k est.): "Do no harm" before any recording beta

1. Ship P0 features: recording indicator, announcement, all-party consent log, pause, session-only diarization, no training, and retention defaults (for example 30-day audio and 1-year text, configurable).
2. Publish a **privacy notice, a BIPA-compliant biometric policy** with a retention and destruction schedule, and an **AI data-use statement** (no training, no human review without consent).
3. Write the **"no-capability" attestation brief**: PCR measurements, a code-path audit showing no plaintext audio persistence outside customer scope, and KMS policy. Get outside counsel's view of how it maps to Ambriz and Otter.
4. Geofence or disable voiceprint enrollment in Illinois, Texas and Washington until the written-release flow exists. Disable emotion and sentiment features globally (this also keeps the EU clean).
5. File the **EAR encryption self-classification** (by Feb 1 for the prior year's exports) and set up restricted-party screening.
6. Decide the model roadmap: add a **US-origin model option** alongside Qwen.

*Unlocks:* legal defensibility for a US prosumer and SMB beta; a credible answer to "are you the next Otter lawsuit?"

### Phase 1 (3–12 months, $150–500k est.): regulated commercial

7. **SOC 2 Type I, then Type II** covering the enclave cloud, the pairing service and the device fleet.
8. **HIPAA program plus BAA**, with AWS and Cerebras subcontractor BAAs. Keep the scribe documentation-only to stay outside FDA device scope.
9. **Legal hold, audit log and eDiscovery export.** Add a law-firm "privileged mode" (per-matter keys, no provider access) aligned with ABA 512.
10. **Finance "on-channel" pack:** dual-record model, archive connectors (Smarsh or Global Relay first), supervisor review hooks, information barriers, PCI pre-storage redaction.
11. **EU pack:** EU enclave region, DPA/SCCs/DPF, DPIA template, works-council deployment kit (German-language *Betriebsvereinbarung* template), an "intended purpose" clause excluding worker monitoring, and Data Act export APIs.
12. **ISO 27001** (plus 42001 if EU and Gulf buyers ask).

*Unlocks:* health systems and clinics, RIAs and broker-dealers, law firms, EU and UK enterprises, and higher education.

### Phase 2 (12–24 months, $0.5–2M est.): public sector (civilian, state and local)

13. **FedRAMP 20x Moderate** (Class C) on AWS GovCloud with Nitro Enclaves, inheriting AWS's FedRAMP High controls.
14. **FIPS 140-3 mode** by inheriting validated modules (BoringCrypto, AWS-LC, KMS). Validate Alpha's own module only if a customer demands it.
15. **GovRAMP** and **CJIS** readiness (pick two lighthouse states).
16. **NIAP App Software PP** evaluation of Alpha as an app on NIAP-listed Pixel or Samsung devices. This is far cheaper than MDF for a custom OS.
17. Build a **TAA/§889 BOM file** and pick a TAA-compliant handset SKU.

*Unlocks:* federal civilian agencies, state and local, and public safety (non-CJI first).

### Phase 3 (24–48 months, $3–8M est.): defense and national security

18. CMMC L2 (if handling CUI), DFARS 7012 flows, IL4 then IL5 PA.
19. NIAP MDF evaluation plus a DISA STIG for the Alpha OS image (only if the full-OS product is qualified on hardware); CSfC listing via MACP.
20. A sovereign-region deployment model for the Gulf (in-country enclave plus a local partner) and India (DPDP-ready consent manager integration).

*Unlocks:* DoD, the intelligence community (with CSfC), and sovereign international buyers.

---

## Implications for Alpha Phone

1. **Compliance is a product feature, not a paperwork phase.** The features most likely to prevent a class action (consent, indicators, no training, voiceprint restraint, retention and hold) are cheap and should ship *before* any always-on recording beta. Otter's case shows that the cost of getting this wrong is survival-level.
2. **The attested enclave is Alpha's regulatory moat, but only if it is made provable and marketed as such.** Publish measurements, bind KMS release to customer policy, and document the absence of reuse capability. That directly answers the Ambriz capability test, ABA 512's confidentiality concern, M-25-22's no-training clause, and the finance MNPI walls. No mainstream note-taker can make the same claim today.
3. **Redaction must be policy-driven, not a single global switch.** Finance needs retain-original-plus-redacted-derivative. PCI needs destructive pre-storage removal. Healthcare and law need minimization with role-based rehydration. Legal hold overrides all of these. This belongs in the ADR-02 redaction contract now, before any pipeline is built (see [04-redaction.md](04-redaction.md)).
4. **Default to all-party consent everywhere.** A phone cannot know which state's or country's law governs each voice in the room.
5. **Speaker identification is the biometric tripwire.** Keep diarization anonymous and ephemeral by default. Offer named speaker memory only after a written release from each enrolled person.
6. **Do not build worker-monitoring or emotion features.** In the EU, emotion inference at work is prohibited. Monitoring and evaluation pulls Alpha into Annex III (from Dec 2027) and triggers works councils. In the US it is litigation bait.
7. **The custom-OS route is expensive for government.** Stock Pixel and Samsung devices already carry NIAP, STIG and CSfC eligibility. For public sector, **Alpha as an evaluated app on a listed device** is roughly 5–10x cheaper (est.) than certifying Alpha's own AOSP image. The HOME-launcher and AOSP flavors should be treated as a commercial and sovereign play, not a DoD one.
8. **Model origin is a hidden blocker.** Qwen may be acceptable for consumer and some enterprise use but will likely stall federal, defense and some finance deals. A US-origin model option inside the same enclave should be on the roadmap before government pipeline work begins.
9. **Sequence buyers by cost-to-unlock:** US prosumer and SMB (Phase 0), then healthcare, legal, wealth management, EU enterprise and higher education (Phase 1, SOC 2 plus BAA plus EU), then state, local and federal civilian (FedRAMP 20x), then defense (CMMC, IL5, NIAP, CSfC). K-12 is not recommended.
10. **Plan hiring:** a fractional GRC lead and privacy counsel in Phase 0; a full-time compliance engineer and an external auditor relationship in Phase 1; a federal compliance lead with FedRAMP and NIAP experience in Phase 2 (est.).

## Open questions

1. Will courts accept a remote-attestation-backed "no capability" showing as defeating CIPA §631 third-party status? This is untested; outside counsel should be asked for a memo.
2. Does Alpha's diarization or speaker embedding, even if ephemeral, count as a "voiceprint" under BIPA? The Otter order turned on *stored* profiles used for future recognition. Ephemeral in-session clustering has not been ruled on.
3. Nitro Enclaves and KMS attestation inside the FedRAMP High / IL5 boundary in GovCloud: confirm the service-level authorization status and whether Cerebras inference can run inside that boundary. If not, which US-origin model can?
4. Does Cerebras sign HIPAA BAAs and agree to no-retention and no-training terms? Is its hosting in the EU or Gulf available for residency?
5. For finance tenants, will Alpha be the system of record (meeting the 17a-4 audit-trail alternative itself) or always export to a partner archive? This drives both cost and liability.
6. Is the California SB 690 CIPA "commercial purpose" exemption moving in 2026? What is the final disposition of the CMMC Phase 2 pause reported for July 13, 2026?
7. The status of the privilege cases (*United States v. Heppner* and *Warner v. Gilbarco*) and any appellate treatment of AI and privilege needs verification by counsel. These were recorded from background knowledge after the search budget ran out.
8. Did the EU Digital Omnibus change Art. 50 transparency dates or the GPAI grace periods beyond the Annex III and Annex I delays captured here?
9. What exactly will the phone ship as for government pilots: the app flavor on a stock NIAP-listed Pixel, or the HOME-launcher / AOSP add-on? The certification path differs by an order of magnitude.
10. Should the product offer an "attorney-directed capture" mode and a "clinical documentation" mode as separately scoped SKUs, each with a narrower intended purpose that simplifies FDA, privilege and AI Act analysis?
11. Insurance: availability and price of tech E&O and cyber cover that includes wiretap and BIPA class-action defense. Several carriers have added biometric exclusions [kb], so check before launch.
12. Verification backlog. The following figures are marked [kb] and need primary-source confirmation: CA §637.2 damages; retention periods under 17a-4(b)(4), 204-2 and CFTC 1.35; FAR clause specifics; NIAP MDF version; CJIS v6.0 details; DPDP maximum penalty; OMB M-25-22 and M-26-04 contents; the FCC hotspot rescission; the NYT v. OpenAI preservation order.
