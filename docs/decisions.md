# Architecture and product decisions

October 1 architecture change: the user has selected an **Android-resident agent instead of Nitro/TEE hosting**. The [on-device agent plan](on-device-agent-plan.md) supersedes cloud-only and enclave-primary requirements below. Agent execution and model inference are separate: the implemented path uses hosted Cerebras text inference and local orchestration; fully offline language-model operation remains unqualified. Historical evidence is retained. Powered-off-phone execution needs explicit scope reconciliation (open decision A-09).

## Accepted foundation decisions

1. Keep Alpha Phone and senior-care independent: separate repository, application ID, renderer, assets and release stream.
2. Use a pinned Eliza source submodule while upstream consumer exports stabilize. Avoid publishing every workspace package before testing the actual dependency closure.
3. Package the pinned Eliza runtime with the Capacitor shell and use native authenticated IPC for the resident agent. Browser development runs the real agent on a private local host. Cloud and remote pairing are optional implemented adapters. Connected chat reports the actual protocol outcome; offline and unavailable connections must not simulate a successful send. See [current status](mvp-current-status.md) for the remaining integration and device acceptance.
4. Use standalone and launcher product flavors with the same Alpha identity. Switching flavor replaces the installed Alpha app. Senior-care has a different identity and can coexist.
5. Make AOSP installation additive, nonprivileged and certificate/hash verified. Device provisioning chooses default HOME. Keep system recovery paths available.
6. Preserve the prototype's brand and layout direction while labeling data and agent capabilities honestly. Do not port mocked transfers, account linking or generated success messages.
7. October 2 confidentiality claim: hosted text inference stays on Qwen (`qwen-3.8-27b`) via Cerebras; `scripts/agent-model.mjs` holds the script default. Product, demo and sales wording follows the claims ladder in [the open-gap plan](market-research/15-open-gap-technical-plan.md). Today only rung L0 is earned: the agent runs on the phone; model requests carry prompts and selected context over TLS to Cerebras (US) running Qwen; no-retention is contractual, not technical. Never say sealed, attested, enclave-protected or "never leaves the device" until the named evidence exists. `test/browser/confidentiality-claims.spec.ts` enforces this for real and mock screens.
8. October 2 platform scope: Alpha forks AOSP for its own signed image. Banking apps, Play Integrity and GMS are not requirements. Always-on listening follows [the AOSP listening spec](market-research/12-aosp-always-on-listening.md) and needs a new ADR superseding item 5's nonprivileged rule for the listener package only.

## October 7 owner product decisions

Decided by the product owner on 2026-10-07 unless marked as an engineering disposition. Entries use stable `P-` identifiers, separate from the numbered foundation decisions above, so later foundation entries do not renumber them. These record product policy; they are not evidence that any feature is implemented or accepted. Each acceptance gate in [current status](mvp-current-status.md) still applies.

- **P-01** Voice send (product owner): voice does not auto-send, for now. The flow stays record → transcribe → review → the user sends. Consequence: the DoD's six-second hands-free round trip cannot be met with a manual send. Open follow-up A-10 must either measure end-of-speech to first audible response excluding the user's review/send time, or revisit the target. This entry does not choose between them.
- **P-02** Email scope (product owner): Gmail/Email is in MVP scope. Telegram and Discord stay deferred unless the owner states otherwise. This resolves the messaging part of A-07; other providers and exact read/write scopes remain open there.
- **P-03** Cross-app notification mirroring (delegated by the product owner to engineering judgment; engineering disposition): keep the implemented feature. It must stay strictly opt-in and off by default, outside onboarding, limited to user-selected apps, with previews hidden while the device is locked, and clearly disclosed. It is not an MVP acceptance gate. Re-evaluate it before any Play Store distribution because of notification-listener policy.
- **P-04** Browser sign-ins (product owner): browser tabs keep sign-ins in a persistent browser profile, with an explicit private-tab option that stays ephemeral. This supersedes the earlier per-tab ephemeral profile design. The persistent profile must remain separate from the privileged Capacitor host profile.
- **P-05** Password manager (product owner): an integrated password manager is in scope. It belongs in elizaOS upstream as a reusable component that Alpha consumes. Proton Pass remains an optional alternative provider. This supersedes "credential handling remains in the third-party provider" as the only path; provider-owned vault and unlock UI still applies when Proton Pass is chosen.
- **P-06** Note deletion (product owner): deleted notes go to Trash, and Trash empties automatically after 3 days. Implemented for text, checklist, link and voice notes, including approved agent deletions: a voice note's recording is trashed, restored and erased with its Trash entry, and the native 30-day audio sweep remains only a backstop. Undo, Restore, Delete forever and Empty Trash (both confirmed) are available. See [browser storage](browser-storage.md#notes-trash).
- **P-07** Voice route: Eliza Cloud is the current product default for chat voice, Notes transcription and read-aloud, bound to the signed-in account. Recording alone does not upload audio; transcription and playback name the selected service. The earlier local browser Whisper engine remains an optional implementation, not the default or an automatic fallback.
- **P-08** OCR languages (product owner): OCR covers English only for now.

## Open decisions

| ID | Decision needed | Proposed accountable role | Blocks / evidence required |
| --- | --- | --- | --- |
| A-01 | Exact phone SKU, Android version and distribution | Mobile/release | Full OS image; supported device tree, proprietary artifacts, clean build and hardware matrix |
| A-02 | Approved managed Alpha endpoint and owner/agent pairing | Runtime/security | Connected chat; correct-account, wrong-origin, revoke/reconnect tests |
| A-03 | MVP views and native default roles | Product/mobile | Prioritized real modules; permission and emergency/system access matrix |
| A-04 | Voice provider, processing location, mic and retention policy | Voice/privacy | Real voice; interruption, denied permission and sensitive-data evidence |
| A-05 | Background notification and reconnect policy | Mobile/runtime | Missed events exactly once across suspend/restart and account changes |
| A-06 | Signing, update authority and support/rollback owner | Release/security | Signed distribution and OTA; protected keys, recovery drill and explicit operator |
| A-07 | Initial account providers and read/write scopes (Gmail/Email in scope and Telegram/Discord deferred per P-02) | Integrations/product | Real overview/inbox/calendar data; official consent, revoke and stale-cache handling |
| A-08 | Wallet deferral or separately funded scope | Product/security | No wallet work until custody/provider/hardware and transaction approval are specified |
| A-09 | Powered-off scheduling: accept resident missed-occurrence/restart recovery in place of the DoD's hosted loops while the phone is off, or deliver hosted loops that run with the phone powered off | Product/runtime | DoD scheduled-loop criterion; either a written acceptance amendment with restart/missed-occurrence evidence, or two hosted loops completing while the phone is off and delivering once on reconnect |
| A-10 | Voice latency method under manual send (follow-up to P-01): measure end-of-speech to first audible response excluding the user's review/send time, or revisit the six-second target | Product/voice | Simple-query latency acceptance; agreed measurement boundaries, percentile and sample count |

All open entries require a named owner, chosen approach, evidence and date. Hardware names in upstream issues or the prototype are not a supported-device commitment. Refer to `implementation-plan.md` for dependencies and acceptance tests.
