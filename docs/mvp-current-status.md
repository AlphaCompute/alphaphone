# Current MVP status

The MVP is not complete. This index separates implemented capabilities from
remaining acceptance work. Source ownership is defined in
[architecture.md](architecture.md); browser capabilities and their limits are
listed in [browser-dev-parity.md](browser-dev-parity.md) and
[mvp-browser-review.md](mvp-browser-review.md).

## Product boundaries

- The primary agent runs on Android. Browser development uses a private local
  host. Cloud and remote pairing are optional paths, not local-startup prerequisites.
- Local orchestration does not imply local inference. The configured text model
  uses hosted Cerebras; Whisper/Kokoro speech has separate host and Android paths.
- A powered-off phone cannot run its resident agent. Acceptance of missed-occurrence
  recovery in place of powered-off execution remains an explicit product decision.
  Optional remote execution needs separate qualification.
- Notes, Calendar, Reminders, Browser/password-provider integration, notifications,
  assistance, workflows, digests, Files and capture remain in scope. Gmail remains
  an integration gap. Phone, SMS, Contacts and Wallet are deferred by MVP policy;
  development fixtures do not change that scope.

## Capabilities and remaining acceptance

| Area | Implemented boundary | Remaining acceptance |
| --- | --- | --- |
| Local startup and ownership | Native bridge, reproducible payload preparation, owner enrollment and private browser-host transport. Shared launcher preserves existing tokens and runtime-written configuration. | Current native IPC/process lifecycle, reboot, owner isolation and installed variant identity on the intended image. See [local setup](local-agent-development.md). |
| Chat and retained context | Typed conversations, selected-source context, reviewed actions, cancellation and durable receipts. | Broad model quality, missing-detail clarification, target-device performance and complete physical user journeys. |
| Speech and recording (J02) | Editable transcript review; separate Send, summary save and reminder draft. Owned playback rejects stale completions. Resident Browser reading retains native reviewed text and uses bounded local synthesis chunks. | Physical microphone/audio quality, Bluetooth/echo, language support, interruption and latency. Host synthesis does not qualify Android playback or native permission behavior. |
| Notes, Calendar and Reminders | Durable editing, selected reads, reviewed actions and recovery. Native Calendar and Reminders delegate to shared upstream plugins while retaining product storage and provider identity. | Current installed-data upgrade, timezone/recurrence, ambiguous writes, real provider and physical-device behavior. Browser notification delivery is not alarm qualification. |
| Browser persistence | Calendar, hosted-result notices, owner-bound workflow drafts and workflow notification receipts use the upstream transactional document store. Revision-bound recovery preserves exact older bytes. | Remaining domains and their coupled readers/writers are listed in [browser-storage.md](browser-storage.md). Their localStorage/Web Locks consistency risk remains open. |
| Clock | Reviewed handoff to Android Clock with truthful opened semantics. | Actual ringing, snooze/dismiss, reboot, timezone and DND behavior; Clock owns final alarm creation. |
| Typed workflows | Bounded generated candidates, separate Use/Save/Run, approved device effects and retained results. | Broad model reliability, unsupported-scope handling and current compiler/runtime release qualification. Arbitrary code and an unrestricted workflow IDE remain outside MVP. |
| Notify and Speak | Native delivery ledger and executor; browser transactional notices and exact receipt recovery without reposting. | Native OS posting/audio and interrupted-delivery acceptance. Uncertain speech must not be replayed or inferred complete. |
| Digests and schedules | Local schedules, retained results, client-scoped acknowledgement and explicit outcome-unknown records after interrupted work. | Real-provider interruption, native lock/battery/Doze, physical power loss and account-source routing. Preserving an unknown outcome does not establish automatic completion after a worker crash. |
| Browser and passwords | Isolated native browsing, reviewed reading, sensitive-source rejection and provider setup/status. Password entry and filling stay with Android/provider. | Real-site password/passkey/autofill and installed isolated-world/consent behavior. Setup UI does not prove filling succeeds. |
| Gmail and accounts | Owner/grant-aware contracts and controlled provider-boundary coverage. | Real authorization, durable results, revoke/recovery and ambiguous sends. External messages require explicit recipient/message authorization. |
| Files, camera, scans and media | Selected import/export, exact-byte media, scan correction and reviewed searchable PDF flows. | Native provider/camera/storage access, real data volumes, OCR quality, languages/fonts and product usability. |
| Poster to Calendar (J01) | Suggestions for explicit English dates, times, same-day ranges and labeled venues; separate Calendar review and Save. Ambiguous fields remain blank and default duration is disclosed. | Relative dates, timezone conversion, recurring/all-day extraction, arbitrary-photo OCR and native provider acceptance. Suggestions never authorize saving. |
| Document analysis (J03) | Selected-content review, separate editable summary-note approval and verified source references. Changed/deleted source files fail closed. Native references use existing selected-document access only. | Live Gmail retrieval, installed permission retention/revocation, cross-process reopening and broad PDF/image task quality. Fingerprint-only sources require reselection. |
| Schedule to travel (J04) and Maps | Selected event location enters Maps once; route choice and origin remain explicit. Stale search/navigation work is cancelled. | Production endpoint/TLS, licensed data coverage, location permissions, offline behavior and physical navigation. See [regional Maps setup](maps-regional-validation.md). |
| Web research to note (J05) | Bounded public-page or pasted-text review, separate question Send and explicit note Save with a source link. | Installed native reading/consent and real-site coverage. CORS-denied content needs user-supplied text; a link is provenance, not an immutable archive. |
| Design and accessibility | Themed bounded dialogs, visible actions, keyboard-scrollable content and large-text checks across core flows. | Complete current-source subviews, error/empty states, Pixel geometry, physical accessibility and user task acceptance. Browser assertions alone are not design approval. |
| Privacy and outbound context | Approval/context binding, native secure storage, contact references and credential redaction contracts. Browser development storage is disclosed as unencrypted. | Broader model/native qualification before default redaction enablement. Inspect the selected runtime's actual configuration; a past host snapshot does not prove present settings or that data stays local. |
| Release | Pinned upstream source, standalone/HOME packaging and source-admitted runtime staging. | Current clean-build and installed-data evidence, signing, licenses, image/hardware qualification, update/rollback, support and pilot acceptance. |

## Qualification

Run `npm run verify` and `npm run android:build`, including standalone and launcher
debug/release outputs. Exercise the owning changed contracts and inspect the
terminal hosted result for the reviewed source. Use the commit's PR and
[GitHub Actions runs](https://github.com/AlphaCompute/alphaphone/actions) for
source-specific results; old pass counts and cancelled runs cannot qualify new code.

APK assembly, emulator bridge/HOME behavior, full AOSP boot, real integrations and
physical-device/user acceptance are independent gates. A source pin rollback does
not establish installed-data or OS rollback compatibility. Browser fixture and
synthetic-provider results must remain distinguishable from real account access
and physical hardware observations.

The [completion plan](mvp-completion-plan.md),
[flow acceptance](flow-verification.md), [Android/AOSP guide](android-and-aosp.md)
and [on-device agent plan](on-device-agent-plan.md) define the remaining work.
No historical result or documentation cleanup waives those requirements.
