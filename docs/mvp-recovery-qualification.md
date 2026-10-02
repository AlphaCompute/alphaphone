# MVP recovery qualification — October 2

Product commit: `deada57cdd0d45b1553467b48b478bf0f461d66e`.

## Behavior

| Flow | Recovery behavior | Boundary |
| --- | --- | --- |
| New Calendar event | Persist an identity before insertion; recover the exact provider marker or browser receipt; never repeat an uncertain insertion. | Missing, stripped, changed or ambiguous provider markers stay unknown. Native journal admits at most 1,000 retained operations without eviction. |
| New reminder | Persist the reviewed UUID and fields before scheduling; read back the same record after response loss. | A saved record does not establish actual notification delivery. Pending history is bounded; unresolved entries are never silently evicted. |
| Voice-note deletion | Persist the reviewed snapshot, delete the exact Notes revision, then trash its owned recording after readback. Recovery controls survive reload and removal of the row. | Notes and audio remain separate stores; unrelated association writers are outside this transaction. |
| Explicit recording restoration | Serialize app-owned recovery; native UUID receipts retire old deletions so late requests cannot undo the restore. | Native receipts are capped at 128 per recording without eviction. Legacy restoration requires absent ownership/history, retained audio bytes and unexpired retention. |
| Calendar edit completion | Refresh after the queued React form-close update; preserve later navigation and replacement drafts. | Read-only refresh does not authorize a new provider write. |

The native creation ledger stores metadata rather than event text. Notes recovery snapshots use an exact encrypted 1 MiB CAS slot. The storage fixture verifies valid multilingual JSON at the byte boundary and rejection one byte over while preserving existing data. Audio expiry removes recording bytes and transcript while preserving replay metadata. Agent Calendar execution continues to use its existing separate action journal; this change does not claim provider-marker recovery for that journal.

## Local evidence

- Final current-product composition: repository verification and 67 rendered flows pass; all 3,701 source hashes unchanged. Native Java compilation passes for both plugins, recovery helpers and instrumentation sources.
- Preceding broad composition: 147 rendered flows pass with all 3,697 source hashes unchanged.
- Initial combined campaign: 136 pass and one Calendar edit failure, reproduced three times. The old completion guard checked state before React committed it and skipped refresh. The corrected flow and deterministic delayed navigation/new-draft cases pass.
- Native audio follow-on: 16 owning flows pass; legacy compatibility follow-on: 21 owning flows pass. The final 67-flow campaign includes both changes and the newly committed Calendar focus-workflow regressions.

Evidence: `test-results/mvp-recovery-integration/`, `test-results/calendar-save-completion-fix/`, `test-results/notes-audio-native-fence/`, `test-results/notes-audio-legacy-restore/`, and `test-results/pending-action-native-capacity-review/`. Native source compilation is not APK or device acceptance.

## Hosted failures and next candidate

Exact candidate `bccd6b2ac1f1d63dd9770fdaa6d1a03399c5430d` failed these gates:

- [Browser37057417139](https://github.com/AlphaCompute/alphaphone/actions/runs/37057417139): an export assertion included internal scheduler state, and a Contacts fault injected failures into unrelated workflow persistence. Reproduced fixes preserve exact export/store assertions; equivalent concurrent product fixes were retained.
- [Foundation37057417095](https://github.com/AlphaCompute/alphaphone/actions/runs/37057417095): both APK distributions built; native smoke stopped at WebView preparation. The missing `/dev/block/by-name/vdc` prevents data-backed scratch mapping, causing a roughly 45 MiB super fallback. The staged workaround derives and authenticates the backing device, creates only a missing alias, rejects preexisting scratch, and requires a 512 MiB data-backed mapping. It never formats a guessed block device or bypasses provider integrity/isolation checks.
- [Resident37057417188](https://github.com/AlphaCompute/alphaphone/actions/runs/37057417188): build passes; native fails the unchanged 10 GiB pre-phase gate. The fresh native job did not inherit build-job capacity provisioning. The staged repair provisions only fixed unused language installations before SDK/archive/AVD creation. Prior exact build logs show 28G after this language-only cleanup; subsequent native capacity still requires live proof.

The independent recovery UI job authenticates same-run APKs and source, owns a fresh secondary user per test, requires exact user-bound unlocked display state, and runs all three opt-in recovery methods for standalone and launcher. It rejects skips and preserves ambiguous cleanup state. Controlled guards, Python syntax, workflow lint and patch composition pass; actual hosted supervisor/native execution is outstanding. A transient user-switch readiness or setup screen may still stop this strict campaign and must be diagnosed from retained evidence.

Alias guard/preparation simulations pass 31 tests after a clean rerun; the ENOSPC-interrupted attempt remains retained. Filesystem cleanup preserved original assets, sources, APKs, logs and screenshots, replacing only verified identical copies in inactive fixtures with links.

## Remaining acceptance

Fresh exact-candidate APK/native qualification, live Cloud/Gmail/agent/voice, visible Pixel-class UI, physical speech and alarms, signed AOSP boot/update/rollback and device/user acceptance remain open. No local emulator was booted because local capacity remains below the campaign gate. The overall MVP goal remains active.
