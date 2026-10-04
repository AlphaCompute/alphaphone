# Alpha Phone — working PRD

Version: 0.2, 2026-10-01. Derived from the supplied interactive prototype, explicit two-repository request, and the reviewed upstream Alpha issues. Product sign-off is still needed for final scope and hardware. See `sources.md` for provenance. The current MVP scope in `mvp-scope-and-gap-report.md` supersedes the original foundation priorities below; `mvp-browser-review.md` indexes browser implementation and remaining acceptance.

## Outcome

A personal agent phone with a distinct Alpha Compute interface: a compact daily overview, installed apps and built-in experiences, and an assistant reachable without losing context. Alpha Phone owns its UI and package identity. Eliza provides agent execution, transport, native capabilities and OS tooling.

The prototype uses white/black surfaces, electric blue `#0000FF`, Fraunces display text, Public Sans body text and compact line icons. Its 412 × 915dp device framing is a design reference, not a hardware support declaration. Preserve source prototype separately from real application code. Never ship mock balances, contacts, messages, attestations or connectivity labels as live state.

## Users and primary journeys

1. Wake/unlock through the actual OS; see current time and genuine actionable information, then open an installed app.
2. Invoke Alpha by touch/text or a permitted voice entrypoint; expand from compact input to overlay/full conversation without losing the current task.
3. Pair the device to the correct Alpha agent; recover after network loss, process death and missed background results without duplicate effects.
4. Connect selected accounts with official authorization and understandable per-capability controls; inspect activity and revoke access.
5. Use a native phone capability or approve a task; see whether it is pending, completed, denied or uncertain with attributable evidence.

## Scope and requirements

| ID | Requirement | Priority / acceptance |
| --- | --- | --- |
| AP-01 | Distinct branded home, app grid and assistant entry; independent package/storage identity | P0; branded shell and connection-aware composer are implemented; provider acceptance remains separately tracked |
| AP-02 | Standalone and HOME APKs from one source; offline shell; stock settings/recovery accessible | P0; inspect final APKs, install both modes, open apps, return HOME repeatedly |
| AP-03 | Existing Eliza sign-in/pairing with approved Alpha routing adapter, owner-scoped credentials | P0; real-device wrong-owner/origin, expired/reused token and callback tests |
| AP-04 | Cloud-only execution, honest offline state and reconnect/history restoration | P0; no local model payloads, no duplicate messages or writes after reconnect; no inference-available claim without health evidence |
| AP-05 | Pill, input, overlay and full assistant modes; keyboard and navigation continuity | P0; draft/scroll state survives resize and Back/Home; no keyboard obstruction |
| AP-06 | Voice entry and cancellation with explicit mic state and typing fallback | P0; device audio tests; hardware-side-key remapping gated by platform support |
| AP-07 | Daily overview with real agenda, attention items and briefs | P1; no placeholder results; loading/empty/stale/error states; authority and timestamps visible |
| AP-08 | Phone, messages and contacts | Deferred by the current MVP profile. Source retained, app entry/action paths disabled; emergency facilities remain system-owned. |
| AP-09 | Inbox and calendar | P1; reuse Google Workspace/personal-assistant contracts; per-account isolation, consent, write confirmation, exact-once results and revoke |
| AP-10 | Browser, camera, photos, maps, notes and files | P1; explicit Android permissions, cancellation and unsupported states; native handoff before custom replacements |
| AP-11 | Workflow library and run history | P1; inspect, start, pause and cancel with bounded permissions and real receipts; not hard-coded prototype playback |
| AP-12 | Settings: accounts, privacy, connection, voice, theme, text, notifications | P0 foundations / P1 integrations; actual capabilities and Android controls; no simulated switches |
| AP-13 | Wallet and security/attestation surfaces | Deferred pending provider, key custody, device security, transaction approval and operational decisions; no “attestation passed” without verified evidence |
| AP-14 | Signed AOSP image and update/rollback path for one selected phone SKU | Release gate; exact source/blob/kernel/signer lock, hardware checklist, recovery test |
| AP-15 | Accessibility and resilience | P0; readable contrast, large font, TalkBack, touch/keyboard, offline, killed process, rotation and repeated HOME navigation |

The source prototype has 14 app views. Their existence does not authorize claiming every integration in the initial release. The first production vertical slice is shell → pair → agent message → background/resume recovery → native app handoff. Subsequent built-in experiences should be prioritized by real user tasks.

## Explicit limits and decisions

- Cloud-only follows current Alpha issue scope; the prototype's on-device model and security statements are visual fixtures. Revisit only through a recorded product decision.
- Pixel 10 versus Pixel 11 Pro is unresolved. No Pixel 10 source lock was found in the pinned OS tree. Pixel 11 Pro's source lock is not real-device qualification.
- Android status shade, lock screen, secure wallet gestures, default phone/SMS handling and system-wide assistant invocation are OS/role work, not CSS inside a launcher.
- No new identity provider; use upstream pairing. No real account credentials in the prototype. No payment processing or custody in this bootstrap.
- Required decisions: selected hardware/Android release; managed agent endpoint and routing authority; allowed native roles; initial providers; voice privacy; wallet scope; support and rollout owners.

## Current implemented versus accepted

Implemented source now includes the independent ten-view renderer; Cloud/remote/local-development connection adapters; context-aware conversations and reviewed actions; native speech/recording routes; encrypted native Notes and browser-local Notes; Calendar/reminder/Clock adapters; isolated native browser controls; selected files/media and Maps; Gmail drafts and provider adapters; workflow authoring/approvals/durable results; hosted digest controls; and settings/permission readback. The browser review adds fitted desktop presentation, persistent theme, local text import/download, explicit manual recording, modal keyboard/Back handling and reproducible browser/adapter regression checks.

Implementation is not full acceptance. Current limits are summarized in [product status](mvp-current-status.md); detailed historical native/runtime evidence remains in the [archived acceptance ledger](https://github.com/AlphaCompute/alphaphone/blob/5b43638417d3adff649964c8188582ccc22b8390/docs/current-acceptance-ledger.md). Live Cloud/Gmail authorization, signed enclave deployment, two remotely hosted loops while the phone is off, real password-provider integration, speech correctness/latency, maintained native browser qualification, signed image/device delivery and target-user acceptance remain open. Browser checks do not close those gates. Android builds are intentionally excluded from the October 1 browser work at the user's request.

On-device STT/TTS remains required; the earlier cloud-only language describes LLM execution and must not be used to waive local speech. Pixel 10 or a similar phone is the current engineering target; final device-image qualification remains separate. Telegram/Discord and offline LLM fallback retain the scope questions documented in the current MVP report.
