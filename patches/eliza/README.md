# patches/eliza

Explicit, tested upstream patches for `vendor/eliza` (elizaOS/eliza), per `AGENTS.md`.
`vendor/eliza` stays at the pin in `upstream.lock.json` and is never edited; the submodule
moves only when a reviewed upstream commit lands.

## Convention

- `NNNN-<topic>.patch`: a `git diff --full-index` taken from one recorded upstream commit, in a
  separate authoring clone or worktree (never `vendor/eliza`). One series number names one patch.
- The historical series 0001-0036 was retired on 2026-10-03/04 when Alpha moved to merged
  upstream (`db6888a4`, `55c2944f`; see git history and `docs/app-upstream-ownership.md`).
  Numbering continues from 0037.
- Each patch must pass `git apply --check` against a clean checkout of its recorded base.

A patch has exactly one of two manifests:

- **Applied to Alpha's build**, `<topic>-source.json`: the pin (`baseCommit`), the patch
  `sha256`, the authenticated upstream `basePaths` it applies to, `addedPaths`, the `changed`
  files and the SHA-256 of **every** file in the patched output. Written by
  `node scripts/export-eliza-patch.mjs NNNN-<topic> <authoring-clone> "<status>"` from staged
  changes (`git add -A`) at the pin.
- **Reference only** (for example server-side Eliza Cloud changes), `<topic>-source-base.json`:
  the base commit, the patch sha256, files changed, the contract and the exact verification
  commands with their results. These are applied and tested only in isolated upstream worktrees.

## Applied patches

`npm run upstream:prepare-client` (run by `dev`, `build`, `typecheck`, `test` and the Android
build) calls `scripts/prepare-eliza-patches.mjs`. It reads every `<topic>-source.json`, refuses a
manifest whose pin, patch hash, paths or series number do not check out, reads the base through
the same pin and clean-checkout admission as native staging, applies the patches in series order
in a temporary directory, verifies the full output inventory and atomically replaces the
ignored `.eliza/patched`. A pin change refuses the patch until it is requalified; changed,
missing or unexpected cached files are repaired; Gradle `build` state inside module directories
is ignored. `test/eliza-patch-preparation.test.mjs` covers these rules.

Gradle includes patched Android modules from `.eliza/patched`; the renderer imports patched
TypeScript from the same directory.

Applied patches that change server-side sources built into the resident agent or the workflow
worker (`plugins/plugin-assistant`, `plugins/plugin-workflow`, `packages/contracts`) reach them
through `scripts/eliza-patch-overlay.mjs`. `npm run agent:build-workflow-worker` and
`npm run agent:stage-android` overlay exactly those files from the authenticated
`.eliza/patched` onto the prepared runtime source for the duration of the worker or agent-bundle
build, then restore the original bytes and re-run the pinned-source admission. Every overlaid
path is journalled under `artifacts/` first; an interrupted build leaves the journal and refuses
the next build until `node scripts/eliza-patch-overlay.mjs --restore`. The worker artifact and
the staged agent record their overlay (`<output>.patch-overlay.json`,
`artifacts/staged-agent-runtime.patch-overlay.json`), and staging refuses a worker built with a
different patch set. Native-only patches (such as 0038) are not overlaid.

New patches are written in a separate authoring clone or worktree at the pin (never
`vendor/eliza`), exported with `node scripts/export-eliza-patch.mjs`, and must apply in series
order on top of every lower-numbered applied patch already on `main`. Series numbers for the
current round are reserved by work package (planning reservations, not patches that exist): 0039-0044 calendar, reminders and clock; 0045-0049 assistant
device actions; 0050-0054 workflow digests; 0055-0059 Gmail inbox and Cloud (reference
patches); 0060-0064 browser and password manager; 0065-0066 voice; 0067-0069 Maps; 0070-0072
settings and diagnostics; 0073-0074 media; 0075-0076 shell and launcher; 0077-0078 connection
and onboarding. A row is added to the table below when a patch lands. When the change lands upstream, update the pin, delete the
patch and its manifest, and point consumers back at `vendor/eliza`.

| Patch | Upstream scope | Status |
| --- | --- | --- |
| `0038-password-manager.patch` (`password-manager-source.json`) | Adds `plugins/plugin-native-passwords` (vault client, Android Autofill provider, fill/save activities, JVM and instrumentation tests) and extends `plugin-native-secure-store` (`PasswordVaultStore.KeyPolicy`, named multi-binding entries, unrecoverable-vault reset, `PasswordFacets`, `PasswordVaultFrame`, tests); registers the new package in `packages/scripts/native-capacitor-scaffold.json`. | Candidate for elizaOS `develop`; not submitted upstream. |
| `0039-calendar-source-identity.patch` (`calendar-source-identity-source-base.json`, historical reference) | `plugins/plugin-native-calendar`: restores the read-package `CalendarSourceIdentity` call in `CalendarPlugin.executeNext`, so the historical pin compiled at `45242af`. The current `0d40aa6` pin includes this fix; it is no longer applied. | Historical reference; current Calendar output is included in the 0041 manifest. |
| `0040-reminders-lifecycle.patch` (`reminders-lifecycle-source.json`) | `plugins/plugin-native-reminders`: stable `scheduleReminder` refusal codes, once-per-boot re-post of posted reminders, a high-importance due channel with migration, and undated to-dos (refused by `reminderDecision` and reviewed operations). Also carries the re-post, due-channel and to-do work planned as 0042-0044, because those edit the same files. | Candidate for elizaOS `develop`; not submitted upstream. |
| `0041-calendar-direct-save-options.patch` (`calendar-direct-save-options-source.json`) | `plugins/plugin-native-calendar`: additive all-day, explicit IANA zone and simple RRULE direct save with provider readback and its own creation journal, plus an `ACTION_INSERT` handoff. | Candidate for elizaOS `develop`; not submitted upstream. |
| `0045-contracts-device-reviews.patch` (`contracts-device-reviews-source.json`) | `packages/contracts`: device-action review contracts (calendar availability, Notes search, folder and notification selections). | Candidate for elizaOS `develop`; not submitted upstream. |
| `0046-assistant-device-reviews.patch` (`assistant-device-reviews-source.json`) | `plugins/plugin-assistant`: device-action reviews on top of 0045, and the device-actions e2e grant list. Reaches the resident agent through `scripts/eliza-patch-overlay.mjs`. | Candidate for elizaOS `develop`; requires 0045; not submitted upstream. |
| `0048-contracts-runtime-capabilities.patch` (`contracts-runtime-capabilities-source.json`) | `packages/contracts`: `RuntimeCapabilities` types and validators (including `webUiUrl`), no metering semantics. | Candidate for elizaOS `develop`; not submitted upstream. |
| `0049-notifications-mirror.patch` (`notifications-mirror-source.json`) | `plugins/plugin-native-notifications`: reusable notification mirroring (`NotificationMirrorConfig`). Not consumed by the Alpha Android build until the Gradle include lands. | Candidate for elizaOS `develop`; not submitted upstream. |
| `0050-workflow-native-digest-loops.patch` (`workflow-native-digest-loops-source.json`) | `plugins/plugin-workflow`: native-source morning and evening digest loops, 7-day source expiry, renewal and pause. Also carries the work planned as 0051-0054 (same files). Reaches the workflow worker and resident agent through `scripts/eliza-patch-overlay.mjs`. | Candidate for elizaOS `develop`; not submitted upstream. |
| `0065-browser-speech.patch` (`browser-speech-source.json`) | `packages/voice`: `@elizaos/voice/browser-speech` (Whisper tiny.en worker, recognizer, protocol) and `@elizaos/voice/browser-capture` (MediaRecorder sessions with host microphone admission). | Candidate for elizaOS `develop`; not submitted upstream. |
| `0066-local-speech-deterministic-synthesis.patch` (`local-speech-deterministic-synthesis-source.json`) | `packages/app`: deterministic Piper VITS synthesis in the Android local-speech engine (noise 0, noise_w 0, length 1). | Candidate for elizaOS `develop`; not submitted upstream. |
| `0067-maps-navigation.patch` (`maps-navigation-source.json`) | `plugins/plugin-maps`: navigation guidance (step maneuvers and route progress, origin search with saved-place matches, explicit reroute, opening hours, heading, pins, position marker and follow camera, gateway-reported provider id and bounds). Also carries the work planned as 0068-0069. | Candidate for elizaOS `develop`; not submitted upstream. |
| `0070-notes-trash-policy.patch` (`notes-trash-policy-source.json`) | `plugins/plugin-notes/src/client`: generic Notes Trash retention policy with host-supplied retention, limits and kinds. | Candidate for elizaOS `develop`; not submitted upstream. |
| `0071-notes-trash-maintenance.patch` (`notes-trash-maintenance-source.json`) | `plugins/plugin-notes/src/client`: storage-agnostic Trash maintenance pass behind host read, edit, lock and purge inputs. | Candidate for elizaOS `develop`; applies after 0070; not submitted upstream. |
| `0072-notes-trash-schedule.patch` (`notes-trash-schedule-source.json`) | `plugins/plugin-notes/src/client`: foreground, resume and interval triggers for Trash maintenance. | Candidate for elizaOS `develop`; not submitted upstream. |
| `0073-owned-media-edits.patch` (`owned-media-edits-source.json`) | Adds `plugins/plugin-native-media` (owned photo edits, filters and readback behind `OwnedMediaConfig`). Not consumed by Alpha's Gradle build yet. | Candidate for elizaOS `develop`; not submitted upstream. |
| `0074-owned-media-captures.patch` (`owned-media-captures-source.json`) | `plugins/plugin-native-media`: owned capture keep and owned-media selections on top of 0073. Not consumed by Alpha's Gradle build yet. | Candidate for elizaOS `develop`; not submitted upstream. |

## Reference patches

These have a `-source-base.json` manifest and are never materialized into client source. Most
change only Eliza Cloud server code (`packages/cloud`), which the phone does not build. The
client-side reference patches below are upstream candidates whose Alpha consumer still uses its
own host code, so applying them would change nothing Alpha builds yet; each is applied and tested
only in an isolated upstream worktree at its recorded base.

| Patch | Base | Scope | Status |
| --- | --- | --- | --- |
| `0037-gmail-inbox-read-state.patch` (`gmail-inbox-read-state-source-base.json`) | `5513606c` | Cloud managed Gmail `mark-read`/`mark-unread` (below). | Not upstreamed or deployed. |
| `0055-gmail-message-links.patch` (`gmail-message-links-source-base.json`) | `5513606c`, after 0037 | Cloud Gmail message links (linear-time anchor scan). | Not upstreamed or deployed. |
| `0056-gmail-text-charset.patch` (`gmail-text-charset-source-base.json`) | after 0055 | Cloud Gmail text part charset decoding. | Not upstreamed or deployed. |
| `0057-gmail-search-attachments-trash.patch` (`gmail-search-attachments-trash-source-base.json`) | after 0056 | Cloud Gmail search, attachments and Trash. | Not upstreamed or deployed. |
| `0058-gmail-drafts-list.patch` (`gmail-drafts-list-source-base.json`) | after 0057 | Cloud Gmail drafts list and editing (drops the text/html alternative of edited drafts). | Not upstreamed or deployed. |
| `0059-gmail-attachments-forward-opaque.patch` (`gmail-attachments-forward-opaque-source-base.json`) | after 0058 | Cloud Gmail opaque attachment forwarding bound to message and history id. | Not upstreamed or deployed. |
| `0060-password-transfer.patch` (`password-transfer-source-base.json`) | `45242af`, after 0038 | `plugins/plugin-native-passwords` password import/export transfer. | Not applied; not submitted upstream. |
| `0062-browser-surface-web-policy.patch` (`browser-surface-web-policy-source-base.json`) | `45242af`, after 0060 | Browser surface web feature policy. | Not applied; not submitted upstream. |
| `0063-browser-surface-session-policy.patch` (`browser-surface-session-policy-source-base.json`) | after 0062 | Browser surface persistent and private session policy. | Not applied; not submitted upstream. |
| `0064-browser-surface-link-autofill-policy.patch` (`browser-surface-link-autofill-policy-source-base.json`) | after 0063 | Browser surface link and autofill policy. | Not applied; not submitted upstream. |
| `0075-system-launcher-defaults.patch` (`system-launcher-defaults-source-base.json`) | `45242af` | DeviceApps launcher defaults. | Not applied; not submitted upstream. |
| `0076-system-launcher-plugin-api.patch` (`system-launcher-plugin-api-source-base.json`) | after 0075 | DeviceApps plugin API. | Not applied; not submitted upstream. |
| `0077-action-journal-android.patch` (`action-journal-android-source-base.json`) | `45242af` | Adds `plugins/plugin-native-action-journal` (Android). | Not applied; not submitted upstream. |
| `0078-action-journal-client.patch` (`action-journal-client-source-base.json`) | `45242af` (independent of 0077) | Action journal client. | Not applied; not submitted upstream. |

`0037-gmail-inbox-read-state.patch` (`gmail-inbox-read-state-source-base.json`, base `5513606ca720e256f609de302b52088d2a5f509f`) adds the
reviewed managed Gmail inbox-v1 kinds `mark-read` and `mark-unread`, `capabilities.readState`,
and additive migration `0535_managed_gmail_read_state_operations` (widens
`managed_gmail_operation_receipts_kind_check`). It has not been upstreamed or deployed to
Eliza Cloud. Until it is, servers omit `readState`, and the client treats that as false.

### Apply and test (0037)

```sh
BASE=5513606ca720e256f609de302b52088d2a5f509f
git -C vendor/eliza worktree add --detach /tmp/eliza-0037 "$BASE"
cd /tmp/eliza-0037
git apply --check /path/to/patches/eliza/0037-gmail-inbox-read-state.patch
git apply /path/to/patches/eliza/0037-gmail-inbox-read-state.patch
bun install --frozen-lockfile   # or provide lockfile-pinned pglite/drizzle-orm/hono
cd packages/cloud/shared
bun test src/lib/services/agent-google-connector/inbox-provider.http.integration.test.ts
node ../scripts/shared/check-migration-prefix-order.ts
cd - && git -C /path/to/vendor/eliza worktree remove --force /tmp/eliza-0037
```

The tests use synthetic tokens, a closed in-process fetch transport and PGlite. They make no
Google network calls.
