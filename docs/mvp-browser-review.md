# Browser implementation review

The product renderer lives in `apps/app`; shared platform code comes from the
reviewed `vendor/eliza` pin. The primary agent runs on Android, with a local host
for browser development. Hosted inference is separate from local orchestration.
See [architecture](architecture.md), [MVP scope](mvp-scope-and-gap-report.md) and
[current requirement status](mvp-current-status.md) for product boundaries.

This inventory describes available behavior and remaining qualification. It is
not a claim that every feature or the current main revision has passed acceptance.

## Photos image-overlay contrast — 2026-10-06

Photos duration labels and favorite badges now have a translucent dark backing,
and unselected batch-selection rings use the same backing in both the live
adapter and fixture. Play and Pause controls also have sufficient backing over
bright frames. Viewer header/footer gradients remain dark beneath their controls,
including compact layouts where the image fills the entire viewer.

All 12 owning Chromium cases passed: four light/dark contrast and compact-player
journeys plus eight existing batch and pagination/recovery cases. The tests
measure rendered foreground/background contrast composited over a white image
(at least 4.5:1), exercise Play/Pause/Back and preserve the existing batch-storage
checks. Type checking and five documentation checks passed. The dark thumbnail capture and compact white-frame viewer were visually
inspected. Evidence in the verification checkout:
`artifacts/final-failure-review/photo-badges.log` and `photo-results/`.
This is browser rendering evidence, not native video decoding or device acceptance.


## Notes audio persistence and failure rechecks — 2026-10-06

The Notes audio journey now waits for its edited title, transcript and audio
reference to reach the durable Notes document before reloading. The earlier
hosted failure on PR 317 showed the original “Voice note” title after a reload
that raced asynchronous autosave. Waiting for the actual saved record strengthens
the test's persistence boundary; it does not change the app or weaken interrupted
save checks. The complete recording/review/save/reload/play/restore journey passed
in Chromium, Firefox and WebKit. Quota and concurrent-edit failure cases also
passed in all three engines (nine total cases). The audio journey is now included
in the standard cross-browser storage inventory, rather than only Chromium.
Evidence in the clean verification checkout:
`artifacts/final-failure-review/notes.log` and `notes-cross.log`.

All 32 failures collected so far from the frozen `31fc1fb0` Chromium campaign
passed a serial recheck at `f633e490` (2.7 minutes), including the Calendar modal
assertions fixed by PR 343. The original campaign remains running and retains
its failed traces; this recheck neither makes that run green nor proves there
will be no later failures. Evidence: `artifacts/final-failure-review/recheck.log`
and `failed-cases.json`. The hosted `31fc1fb0` browser failure was limited to the
three month-picker assertions. The cancelled current-main browser run was retried
once at `f633e490`; its terminal outcome remains a separate gate.

## Reminder save refresh ordering — 2026-10-06

After a confirmed reminder edit, the editor now stays visible until refreshed
records and the mutation lock settle. It then closes only if the same editor,
owner and draft still own the operation. A newer draft or navigation is preserved.
This extracts the consumer fix from PR 317 without adopting its runtime upgrade.
The delayed-refresh regression proves the edited record is committed while the
form remains present, then checks completion against the refreshed occurrence.

All 51 owning reminder/Calendar Chromium cases passed in a single-worker run
(5.2 minutes), plus five focused cases covering the regression and Calendar
preferences in the modal month picker. The latter now uses Close/Escape and
checks opener focus return instead of operating the covered background control.
Type checking and five documentation checks passed.

The earlier 51-case run had 32 passes, 19 failures and three runner errors across
7.1 hours, including unusually long delays and browser-launch failures. Preserve
that failed evidence; the subsequent 51-case run is the successful qualification,
not an erasure or reinterpretation of the earlier result. Evidence in the clean
verification checkout: `artifacts/settings-review/reminder-refresh-browser.log`,
`reminder-serial.log`, `reminder-focused.log`, `reminder-refresh-types.log` and
`reminder-refresh-docs.log`. The separate full Chromium campaign remains on its
unchanged source and cannot qualify this later fix.

## Integrated browser checkpoint — 2026-10-06

`npm run verify` finished successfully at
`79cd5c734f4db3d92fe4421b4255a17185b7f796`: all 674 tests passed, zero
failures or skips, with type checking, production build and the 245-file
flag-off bundle audit. The run took 1,112.7 seconds. Its log is
`artifacts/settings-review/core-subview-integrated-verify.log` in the clean
verification checkout. This result includes the five-view accessibility and
Camera contrast changes; it predates the Photos deletion/map-label follow-up
and the reminder refresh-order change. Those have separate owning evidence.

The full 1,976-case Chromium campaign at
`31fc1fb0918de0107dbf1673a7fec2f63d1c4eec` is still running. Its source is
frozen in the primary checkout. Logs and retained traces live in
`artifacts/final-browser-31fc/`. It has already exposed obsolete Calendar
month-picker assertions, which attempted to operate the covered button rather
than the modal's Close control. Its unusually long timeout and browser-launch
failures remain failures requiring explicit rechecks; they are not passing
acceptance evidence. Do not substitute this in-progress run for a terminal
whole-suite result.

## Photos deletion review and illustrated-map labels — 2026-10-05

Photos' permanent-deletion review previously appeared as a sheet without modal
semantics or keyboard ownership. It now has a named dialog, initial Cancel focus,
contained Tab/Shift+Tab navigation, Escape/Back cancellation and focus return.
The covered album controls are inert and the assistant dock is hidden. Its
bounded scroll area keeps actions reachable on a 420px-high viewport. The
existing prepared-deletion identity and explicit confirmation remain unchanged.

All 14 owning Chromium checks passed: the four new light/dark and compact/full
height deletion journeys, plus the existing capture, album-management and batch
mutation/recovery cases. Only fresh test-created images were deleted. The compact
dark review was visually inspected. Type checking passed. Evidence:
`artifacts/design-final-review/photo-review.log` and `types.log`.

The illustrated map's small labels were faint in both themes. They now use a
higher-contrast foreground and an opaque terrain-colored backing so intersecting
roads cannot change their text background. Six root/route/navigation checks
passed in light and dark themes, measuring at least 4.5:1 from rendered colors;
both root captures were inspected. This qualifies the app-owned illustration,
not external map tiles, licensed provider data or physical navigation. Evidence:
`artifacts/design-final-review/maps.log`.

The manual review also inspected Photos album/search, Calendar invitation,
Browser article and failed-workflow captures. These observations do not establish
complete contrast or screen-reader acceptance; the unresolved automated findings
and external requirements in the current status matrix remain open.

## Cold Kokoro requalification — 2026-10-05

The former worker startup retirement failure is resolved in the currently pinned
upstream `95924e90`, which includes `4f28daecf2f`. Cold initialization is owned by
the requesting lifecycle; it no longer has an independent worker-retirement timer.
The existing synthesis/transport bounds and cancellation remain enforced. No new
runtime patch or timeout increase was needed for this requalification.

The new `npm run agent:test-cold-kokoro` check verifies the admitted source and
installed assets, starts three fresh workers without initialization/status probes,
and checks actual WAV output. They passed in 2,517, 2,119 and 1,579 milliseconds.
Cancellation during cold initialization followed by successful synthesis in a new
worker also passed. These are fresh-process results, not an evicted OS disk cache
or device latency qualification.

After restarting the real development host, the opt-in browser regression made
its first TTS request without a speech-status probe and verified actual playback
and completion (5.5 seconds including runner startup). Agent startup is awaited
separately. Two initial runner attempts arrived before agent/UI startup and failed
before sending any speech request; the final check waits for those prerequisites.
Hashed before/after snapshots preserve the owner, agent and 18 conversation IDs.
Eight speech startup, worker lifecycle and bridge contract tests passed. Evidence:
`artifacts/kokoro-cold-review/` and `test-results/cold-kokoro/result.json`.
This is host/browser evidence; no Android build or device acceptance was run.

## Local speech restart checkpoint — 2026-10-05

The browser dev launcher now reads owner-only `local-speech.json` defaults from
its private agent profile, so restarting without the original shell environment
retains the installed Whisper/Kokoro assets. Explicit environment overrides still
win. Unsupported settings, credentials, symlinks and shared-access files fail
closed; existing asset admission and cold-start warmup remain in place.

Qualified on consumer base `15f9338f` with upstream `95924e90`: all 631 repository
tests, type checking, production build and bundle audit passed. A plain `npm run
dev` cold process start reported Whisper and Kokoro ready. The actual browser
capture/transcription/synthesis journey passed in 15.3 seconds, including playback
completion, stop and disconnect. The owner, agent and 18 conversation IDs were
unchanged across that test. This is host/browser evidence; no Android build or
physical-device acceptance was performed for this change. See
[local development](local-agent-development.md) for persistent settings.

The current-main restart at `978694b04a3196ed4e2bfe4afcc67c3aa5a3f890`
again reported both providers ready and passed the real capture/transcription/
playback, Stop and disconnect journey in 13.4 seconds including runner startup.
Hashed snapshots retained the owner, agent and all 18 conversation identifiers.
Evidence is in `artifacts/calendar-form-review/latest-preview-speech.log`,
`latest-preview-before.json` and `latest-preview-after.json`. This is total journey
time, not first-audio latency or physical-device acceptance.

## Covered subviews and review focus — 2026-10-05

Inbox message/composer and Workflow detail/run/builder screens now remove their
covered layers from keyboard and accessibility navigation. Opening a subview
focuses its first control; closing returns to its surviving opener. Inbox email
sharing, attachment and provider-operation reviews own focus, support Escape,
and hide the covered assistant dock. The inline modal helper restores focus after
the renderer releases its own inert flags, preventing attachment exit from
stranding focus on the page body. This uses the existing review actions; it does
not add provider writes or automatic retries.

All 77 owning Chromium cases passed, including both themes, compact attachment
reviews, sharing/provider review focus, retained Inbox edits, account switches,
workflow authoring/focus behavior, and Calendar/Clock/Files dialog dismissal.
Type checking and five documentation checks passed. An earlier four-case
attachment campaign failed the new return-focus assertion; the deferred restore
fix passed those cases and the final batch. The three older owner-fence assertions
were corrected to inspect the active new-account receipt instead of the covered
mailbox button; stale-operation/no-dispatch assertions remain unchanged.
Evidence is `artifacts/kokoro-cold-review/subview-final.log`, `subview-types.log`
and `subview-docs.log`. The dark 150-percent-text attachment screenshot was
visually inspected with exit controls visible and the assistant dock hidden.

The earlier integrated checkpoint at `1d73a298925702a179d497e49b32c86399799cb1`
completed `npm run verify`: 674 tests passed, no failures or skips, type checking,
production build and 245-file flag-off bundle audit passed. It predates this
subview change and PRs 337–338. Evidence:
`artifacts/settings-review/accessibility-integrated-verify.log` in the clean
verification checkout.

The follow-up axe-core 4.14.0 scan covers 86 light/dark reference states: zero
automated violations, with color-contrast results still incomplete in 56 states
(previously 64). This is not complete contrast or accessibility acceptance.
Remaining covered-control candidates include Calendar event/forms, Browser tabs,
Photos viewer, Notes editor/recording and Files folder/preview. They require the
same keyboard/accessibility inspection rather than interpreting incomplete
contrast results as success. Camera/photo backgrounds and truncated text also
need visual contrast review. Evidence: `artifacts/kokoro-cold-review/subviews-audit.json`.

## Remaining core subviews and Camera contrast — 2026-10-05

Calendar event/forms, Browser tabs/library, Photos album/viewer/edit, Notes
editor/voice/link/recording and Files folder/preview now retire their covered
controls from keyboard and accessibility navigation. Entering a layer focuses
its first control. Returning restores its opener; an asynchronous Files refresh
can replace the original button, so focus is captured before replacement and
restored only to a unique equivalent control in the original surviving layer.
The template renderer now forwards focus-capture events. Calendar Clock and
month dialogs retain their separate modal ownership; Notes storage status stays
outside the covered list.

Camera zoom and scan overlays now use darker backgrounds. Computed foreground
and background colors, composited over pure white camera pixels, meet 4.5:1 for
the four zoom controls and two scan actions. The stable scan capture was visually
inspected. This does not assess arbitrary text in photographed documents.

All 36 owning Chromium checks passed, including light/dark layers, nested Files
focus return, Inbox/Workflow regressions and Camera contrast. Earlier iterations
exposed the asynchronous opener replacement and a missing renderer event mapping;
both are fixed in the final run. Another 28 affected-flow checks passed for
photo editing/albums, Camera pixels/video, Calendar month/Clock dialogs and Notes
storage-status layouts. Type checking and five documentation checks passed.
Evidence is `artifacts/subview-completion/final-owning.log`, `final-flows.log`,
`final-types.log` and `final-docs.log`. A wider pre-final campaign passed
107 cases with one Files focus failure, subsequently covered by the final run.
The 86-state axe scan after layer isolation reported zero automated violations
and 40 states with incomplete contrast results. That scan predates the final
Camera opacity and focus-capture changes. Photos/Notes/Browser/Camera captures
were inspected; images, gradients and overlapping/truncated text still require
manual review. No complete accessibility or physical-device acceptance is claimed.

The merged checkpoint `364522d95f36ac85e9a651a435d6984c0875e6fb`
completed `npm run verify`: 674 tests, zero failures or skips, type checking,
production build and 245-file production audit passed. This includes PRs 337–339,
but predates the five-view/Camera changes above. Evidence is
`artifacts/settings-review/subview-integrated-verify.log` in the clean verification
checkout. Android builds remain excluded from this browser development campaign.

## Surface inventory

### Integrated source checkpoint — 2026-10-05

Merged consumer `4145e3a930a736d97da463fc89237bb02ad4bbbb`, with upstream
`95924e90a75ec2b14f5835fa5f07d81115ccdb15`, passed `npm run verify`: 666 tests,
zero failures or skips, type checking, production build and the 245-file production
bundle audit. This combines Calendar creation, inline edits and modal editor
retention with account-bound Inbox unsaved recovery. Their owning browser campaigns
are recorded below; the completed older browser campaign is detailed below.
That campaign exposed outdated native fixtures without draft compare-and-exchange
and old single-line composer selectors. Updating the fixtures to retain exact
expected-value conflicts and select the visible textbox passed all 144 affected
Chromium cases, type checking and five documentation checks. These corrections
do not change production storage or relax draft admission. Evidence is
`artifacts/calendar-form-review/native-fixture-retention-final.log` in the primary
checkout. The broad run on the earlier frozen source remains a separate result.

On the same runtime pin, a fresh plain development restart passed actual browser
capture, Whisper transcription and Kokoro playback, completion, Stop and disconnect
in 13.6 seconds including runner startup. Hashed snapshots retained the same owner,
agent and 18 conversation identifiers. This is not a synthesis latency measurement.

A separate isolated real-Cerebras redaction campaign passed all six synthetic
contact/credential formats, streamed restoration and distinct-process restart.
All ten captured provider-bound request checks excluded the raw synthetic contact
and credential strings. The normal development profile was not changed. Approved
device actions, wider categories/models and Android remain separate qualification;
this bounded pass does not enable redaction by default on the development host.

Evidence is retained in the qualification checkout under
`artifacts/pr317-browser/`: `calendar-inbox-full-verify.log`,
`kokoro-current-browser.log`, hashed `kokoro-current-before.json` and
`kokoro-current-after.json`, and `current-redaction-qualification.log`.
The redaction summary is `test-results/local-redaction/result.json`.
No Android build was run for this integrated checkpoint.

Additional terminal browser evidence on October 5:

| Source and lane | Result | Scope |
| --- | --- | --- |
| `4d8d09097c4c89ce3f336950903e798f45f0051c`, Firefox and WebKit storage | 726 passed, zero failed (13.4 minutes) | Both configured cross-engine storage suites, including retained drafts and recovery; not every app journey in those engines |
| `af098a113b5173db9ba2edc9c924e3989a99f82f`, production surface | 11 passed, zero failed (13.7 seconds) | Flag-off build, real/empty entry points, absent developer surfaces and CSP behavior |

Logs are `artifacts/calendar-form-review/integrated-storage.log` and
`integrated-production.log` in the primary checkout. The broad Chromium campaign
on `4145e3a9` finished with 1,831 passed, 74 failed and 14 skipped (44.1 minutes).
Its failures use the older native draft fixtures, composer selectors and text
expectations corrected by PRs 328, 331 and 334. This is a failed campaign, not a
green integration result. Its Calendar guest failure used an ambiguous status
selector after editor-draft retention; selected-file and image-question expectations
still described the old input's discarded newlines. The corrected exact save-status
and multiline assertions passed all nine owning cases, including local OCR and
cancelled recognition (`artifacts/settings-review/remaining-browser.log` in the
`alpha-live-settings-review` checkout). No product behavior was weakened to satisfy
these assertions. These later focused passes do not relabel the earlier campaign
as green.

The normal-app selected-file review also now asserts preserved paragraph breaks
between the question, source name and edited excerpt. Both light/dark cases passed
while asserting zero sends from the review step
(`artifacts/calendar-form-review/selected-file-multiline.log`). The old assertion
expected the removed single-line input's newline stripping.

Subsequent repository verification passed at `978694b0` (671 tests) and
`b021874ffe1085e2ad1f850cbd1d772ee6215043` (674 tests), both with zero failures
or skips, type checking, production build and the 245-file bundle audit. Logs are
`artifacts/settings-review/latest-main-verify.log` and `final-integrated-verify.log`
in the `alpha-live-settings-review` checkout. A fresh full Chromium campaign on
`b021874f` remains in progress. These checkpoints predate the accessibility
follow-up below and do not qualify that later source.

| Surface | Implementation | Remaining acceptance |
| --- | --- | --- |
| Home and settings | Product-owned preview, themes, assistant dock, agenda, device development controls | Native boot, lock, HOME role and actual system controls |
| Connection and assistant | Resident/native IPC, local development host, optional Cloud/remote sessions, conversation history, reviewed proposals and receipts | Real owner/provider authorization, revoke, process recovery and complete task journeys |
| Voice | Recording review, manual transcript fallback, explicit local/agent routes, owned playback and cancellation | Transcript quality, six-second latency target, physical microphone/speaker/Bluetooth and lifecycle |
| Inbox | Account-bound Gmail adapter and operation journal; disclosed local draft/attachment simulator | Real provider grants, approved read/send journeys, account isolation and uncertain-outcome recovery |
| Calendar | Persistent events, zoned/all-day dates, recurring series and overrides, preferences, local guest/meeting UI, alerts, backup and reviewed reset | Transactional storage below; live-agent series, real invitations/conferencing and provider sync |
| Reminders and Clock | Shared native reminder engine, browser reminders, Done/Snooze/repeats, foreground alarm ownership and native Clock handoff | Physical audibility, Doze/OEM delivery, reboot, DND and hardware time-zone changes |
| Browser | Development iframe, bookmarks, navigation, reviewed reading; isolated native browser surface | Cross-origin access limits, real password-provider/passkey/autofill behavior and release WebView lifecycle |
| Camera and Scan | Capture/import, local OCR, reviewed text/links/calendar suggestions, multipage drafts, perspective correction, page-edge suggestions and searchable PDF | Physical camera/torch/permissions, OCR language/photo quality, edge quality and interrupted capture |
| Photos | IndexedDB library, stable pagination, albums, batch actions, edit-as-copy and video editing | Physical capture, external providers, catalog scale and interrupted saves; clearing site data removes browser media |
| Notes and Files | Browser-local text/audio/documents, reviewed selected content, exact-byte import/export; native secure Notes and SAF | Native provider differences, interrupted writes, cross-app attachments and physical audio; no Notes sync is promised |
| Workflows and digests | Authoring, approval, cancellation, receipts/results, schedules and reviewed upstream worker/runtime | Current-source resident scheduling, interruption/restart, result delivery and real account sources; a powered-off phone cannot execute locally |
| Notifications | Owner-bound notices, receipt recovery and Calendar/reminder integration | Current-source native background/channel behavior and physical delivery |
| Phone/SMS/Contacts and Wallet | Disabled shipping routes; explicit development simulation | Scope disposition before enabling production routes; simulations do not establish telecom, payment or external-message acceptance |

## Browser storage

### Connected host disclosure

The live-browser review found that connected agent memory was still labeled
"Not connected" and browser About omitted agent location. Privacy and Developer
now distinguish an absent connection from unreported memory usage. Browser About
shows the current agent and execution location; browser Models describes speech
on the development computer. For the resident browser connection, Privacy states
that prompts and selected context go to the development host and its configured
inference provider. Unreported provider/model and redaction details remain unknown;
this does not enable swaps or claim that requests stay local.

The authenticated browser-host fixture and all ten existing per-connection privacy
cases passed, along with type checking. The settled host Privacy screenshot was
inspected at 412 × 915. Evidence is in the `alpha-live-settings-review` checkout
under `artifacts/settings-review/`. The host regression is included in the existing
CI browser-agent profile step, whose transport is synthetic and cannot contact a
real inference provider. Physical/native acceptance remains separate.

The [storage ownership map](browser-storage.md) defines each canonical domain,
its recovery boundary, independent preference contracts and native
Clock handoff history. Shared IndexedDB
transactions bind changes to receipts and revisions. Initialization must use the
same serialization boundary as edits and preserve an existing revision.

Recovery retains exact older bytes, refuses observed changes from retired stores,
and requires a reviewed revision before reset. Tombstones prevent old data from
returning. Cancellation and account/navigation retirement still apply after every
asynchronous read. Clearing delivery records does not cancel schedules or undo
external effects; reconcile uncertain operations before creating replacements.
Browser data remains local and unencrypted. Qualification of one domain does not
establish the safety of another domain or of the real agent's runtime database.

## Design and accessibility

Keep Alpha's product identity, light/dark tokens, display/text typography, phone
geometry and icons independent of the upstream app UI. The supplied references
remain requirements data, including deferred states; they do not authorize
activating disabled routes.

On October 5, 102 rendered reference-state captures from consumer `4145e3a9`
were inspected as five contact sheets. Coverage includes light and dark Inbox,
Calendar, Browser, Camera, Photos, Maps, Notes, Files, Workflows, Settings and
shell/conversation states. The captures retain consistent Alpha typography,
accent, navigation and phone composition; no additional gross layout break was
identified in this visual pass. Full-size captures remain under the qualification
checkout's `test-results/browser/design-*` directories; contact sheets are in the
primary checkout's `artifacts/calendar-form-review/design-audit-1.png` through
`design-audit-5.png`.

These are labeled mock reference states, not a complete live-product design
approval. In particular, their sample accounts, model/privacy summaries, booking
forms, route maps and workflow results are simulated. The boot capture is a
transition frame and proves neither native startup nor a completed boot animation.
Contact-sheet inspection does not measure contrast, touch targets or focus order.
The production-surface lane, live empty/error states, compact/large-text owning
tests and real journeys must supply their own evidence. Physical accessibility
and user task acceptance remain open.

The root-state audit found that the previous suite explicitly accepted missing
landmarks and alert roles as known gaps. Those exceptions have been removed:
active app views and the notification shade now have named regions; browser
storage access denial has an alert in the active surface; Calendar's empty
timeline accepts keyboard focus and scrolling; Browser has a visible new-tab
heading and a named page region. Calendar names its empty visible schedule explicitly,
without claiming that hidden calendars contain no events.
Files already had truthful empty copy, so its assertion now checks that copy.
The storage alert checks API access, not available quota, every record schema or
the success of future writes; domain recovery remains necessary.

The 97 root-state/keyboard cases and five existing empty-runtime/large-text cases
passed (102 total), with type checking. A final Browser region correction passed
all eight Browser root cases; the final visible-schedule copy passed four Calendar/
Reminders empty-state cases. Axe-core 4.14.0 audited ten fresh-profile app roots in
both themes with WCAG 2 A/AA and 2.1 AA rules. After correcting the Calendar scroll
region and Browser's formerly unnamed-role viewport, no automated violations or
unresolved checks remain in those 20 root states. Normal Calendar, Browser and
blocked-storage Calendar screenshots were visually inspected at 412 × 915.
This is not a full subview, screen-reader, physical-device or user acceptance audit.
Evidence in the `alpha-album-documents` checkout is under
`artifacts/pr317-browser/`: `root-accessibility-browser.log`,
`root-accessibility-types.log`, `root-accessibility-audit-after.json`,
`browser-region-followup.log`, `browser-region-axe.json` and `accessibility-*.png`.

Review compact portrait/landscape layouts, large text, keyboard focus, scrolling,
visible save/cancel controls and assistant-toolbar clearance. Calendar draft
controls have a named focusable Event details region and 52 CSS-pixel minimum
control height; rendered targets must remain at least 44 pixels in the fitted
preview. Save and Back must stay reachable while fields scroll. Preserve empty,
loading, unavailable, failed and uncertain-write states as distinct outcomes.

## Qualification and evidence

Run `npm run verify` and the owning Playwright cases for changed browser paths.
The suite can select Chromium, Firefox or WebKit with `--project`; use explicit
fixture profiles and inspect relevant screenshots. Preserve terminal failures and
source identities alongside results in `test-results/`. A passing focused run
does not replace full current-source hosted qualification.

APK assembly, emulator bridge/HOME tests, full AOSP image boots, real provider
integrations, physical-device behavior and user acceptance are separate gates.
Both standalone and launcher distributions require qualification. Do not infer
physical capture, speech quality, external delivery or provider consent from
synthetic browser fixtures.

Current operating guides and requirements:

- [Browser development capabilities](browser-dev-parity.md) and [native method inventory](browser-native-method-inventory.md)
- [Local agent setup](local-agent-development.md) and [resident execution plan](on-device-agent-plan.md)
- [Calendar/reminder contracts](calendar-reminder-contract.md) and [regional Maps setup](maps-regional-validation.md)
- [Local OCR](local-ocr.md), [browser autofill](browser-autofill-integration.md) and [Notes documents](notes-document-flows.md)
- [MVP completion plan](mvp-completion-plan.md), [scope and gaps](mvp-scope-and-gap-report.md) and [pilot acceptance](pilot-acceptance-runbook.md)

Production provider/TLS/data-license/coverage checks, release signing and rollback,
four physical units and user acceptance remain explicit gates. Offline-LLM and
Telegram/Discord scope conflicts require product disposition. Historical build
counts, source migrations and failed-attempt narratives are available in Git
history rather than serving as current setup instructions.

## Browser calendar backup restore

Calendar recovery accepts a selected Alpha calendar backup (domain bytes or a
recognized document envelope), validates the complete event set and previews the
count and titles before a separate replacement confirmation. It restores local
event copies with new identities and revisions, preserving recurrence, exclusions
and edited occurrences. Alerts are off; invitations are not sent. Preferences and
creation/action receipts are not imported. This avoids treating historical effect
records as new instructions. The current calendar can be downloaded first.

Replacement uses the captured document revision and older-copy bytes; newer edits
or legacy writes invalidate approval. Closing or retiring the dialog aborts a queued
write. The exact legacy copy remains available. Strict restore still rejects a
partly damaged file by default. An explicit recovery checkbox can preview valid
independent events and recurring-series groups, including the skipped count and
record positions, before the same separate replacement confirmation. Duplicate
identities are ambiguous and skipped. A damaged linked exception skips its whole
series group so it cannot silently return as an original occurrence. Recovery
connects both explicit series references and generated occurrence identities:
missing, malformed or inconsistent references cannot detach an exception and
revive its parent occurrence. Inconsistent links exclude every connected series;
cyclic references terminate and are rejected. Strict import also rejects a
generated occurrence identity whose present parent disagrees with its reference. Malformed
JSON, oversized input and a file with no recoverable group remain rejected.
Changing the selected file or recovery mode clears the prior confirmation.
Keep the original backup: recovery does not reconstruct missing or invalid data.
This is Alpha browser backup recovery, not ICS/provider import or native Calendar
restoration.

Partial-recovery qualification: 18 backup validation cases and 24 restore browser
cases across Chromium, Firefox and WebKit passed, along with type checking. The
rendered confirmation preview was inspected. Logs are in the primary checkout at
`artifacts/calendar-form-review/partial-backup-unit.log`,
`partial-backup-browser.log` and `partial-backup-typecheck.log`.
No Android build or native Calendar restoration was performed.

The damaged-reference follow-up reproduced the old defect (parent series restored,
broken exception skipped) and passed 21 backup unit tests and all 27 restore cases
across Chromium, Firefox and WebKit, plus type checking. Evidence is
`artifacts/calendar-form-review/series-links-unit.log`, `series-links-browser.log`
and `series-links-types.log` in the primary checkout.

Calendar restore qualification: all 36 owning restore/recovery checks passed across
Chromium, Firefox and WebKit, including reviewed replacement, invalid files, stale
approval, queued cancellation and access from a healthy calendar. The 26 parser
and domain-document unit checks passed, including strict guest-response admission.
`npm run verify` passed all 644 tests, type checking, the production build and the
bundle audit before the final strict-response guard. That guard then passed the
owning unit/browser suites and type checking; the expensive unrelated runner
suite was not repeated. These results do not qualify native/device behavior or
unrelated MVP acceptance.

## Assistant draft restart recovery

Both assistant composers support bounded multiline review and IME-safe sending.
Unsent text is saved to the selected owner/agent/conversation, with offline text kept
separate. Restored drafts have no retained selected-source authority and never send
automatically. Revision conflicts show both copies; failed writes retain editable
text. Browser damaged-record recovery backs up stored bytes and current text before
confirmed reset. Android also offers backup and confirmed reset for readable records with invalid
draft schemas. Reset compares the exact captured secure-slot bytes; backup uses the
existing reviewed Android document picker with exact-byte readback. Decryption or
native read failures leave the record untouched. Physical restart/IME, encrypted-store
execution and document-provider acceptance remain open. Calendar and Reminder form recovery is tracked separately below.

Assistant draft qualification: consumer `ba3eed32` passed `npm run verify` (657
tests, type checking, production build and bundle audit), 11 production-surface
browser tests and 13 selected-source summary tests. A subsequent conversation-choice
fix passed type checking and all 81 owning draft/storage/conversation browser checks
across Chromium, Firefox and WebKit. It pins the current tab's observed choice,
including an empty choice, so another tab's saved restart preference cannot move an
unsent draft before its first send. These remain local results, not hosted CI or
native/device qualification.

Native assistant draft recovery qualification: consumer `5f4534ee` passed
`npm run verify` (657 tests, type checking, production build and a 245-file
flag-off bundle audit). All 57 affected browser checks passed across Chromium,
Firefox and WebKit. Native adapter tests used explicit bridge-contract doubles;
these results do not prove encrypted Android storage or file-provider execution.

## Unsaved Calendar and Reminder creation forms

New event and reminder forms now retain their editable fields and original creation
identities in the transactional draft store. Browser app and development profiles
use separate bindings; Android selects the existing encrypted slot adapter. Recovery
is explicit through **Resume unsaved calendar form** and never saves an item.
Civil dates are stored independently of relative day offsets, including when an
open form crosses midnight. Changing time zones prompts a review of the restored
time. Separate-creation consent is not restored. Existing pending-write journals
and provider revision checks remain authoritative for uncertain outcomes.

Competing tabs require Restore or Replace, and creating a new form requires review
before replacing a retained one. Discard requires confirmation and refuses stale
receipts, without creating or deleting events. Confirmed saves clear only the matching retained
form. Storage failure leaves current text available and exposes recovery.

Creation forms and inline existing-event/reminder edit forms retain drafts in separate
slots. The separate recurring/all-day Calendar editor also retains per-event drafts,
with explicit recovery when the event is reopened for editing.
Inbox now also retains unsaved edits separately from explicitly saved drafts. Android execution and physical
process-death acceptance remain separate from browser qualification.

Runtime update PR #317 remains unqualified at `e2f62059`: hosted test-mocks
instrumentation ran 191 tests per variant, with one standalone video-playback
failure and two launcher failures (video playback and returning from the system
share chooser). These are actual assertion failures, distinct from the cancelled
browser/distribution jobs. The preserved hosted evidence was inspected without
running another Android build. Browser development remains on upstream `95924e90`.

Creation-form qualification: three record-contract tests and type checking pass.
The 92-case creation/save campaign passed across Chromium, Firefox and WebKit;
after the discard addition, all 39 form-specific cases passed across those engines.
Cases cover date rollover, cross-tab conflict, uncertain event/reminder outcomes,
explicit replacement/discard, oversized edits and damaged-form recovery without
changing saved events. The restored form was inspected at 412 × 915. The primary-checkout repository run finished with 658 of 660 tests passing: an
untracked ownership audit links to removed patches, and its previously staged Android
payload does not match the current source pin. Those historical failures remain distinguished from the clean-worktree integrated
result: consumer `baa41362` passed all 663 tests, type checking, production build
and the 245-file flag-off bundle audit. The ownership links were repaired in
PR #325; the old staged Android payload was preserved. No Android build or native
execution is claimed.

## Unsaved inline Calendar and Reminder edits

Existing-item edits retain the original Calendar expected fields/revision or exact
Reminder target separately from editable values. Restoring never creates a new item
or restores an in-memory mutation attempt. Provider revision checks and the pending
action journal still govern Save. Civil dates and the original reminder schedule
rebase together, so a title-only change after midnight does not reschedule it.
Confirmed saves clear only the matching retained form. Explicit discard cannot
erase a newer draft from another tab and leaves saved items unchanged.

Inline-editor qualification: all 63 creation/edit draft cases passed across
Chromium, Firefox and WebKit, plus 42 existing Calendar save and Reminder
edit/timing cases in Chromium. The full 663-test integrated result above includes
this implementation. Native encrypted storage and process-death remain unqualified.

## Recurring and all-day Calendar editor recovery

The separate browser editor retains per-event text, selected dates/time zone,
all-day presentation, recurrence, alerts, attendees and local meeting preference.
Reopening the event offers explicit Restore or Discard; it does not apply old edits
automatically. Retained edits keep their original event revision, so restoring an
older version cannot overwrite a newer event. Cross-tab writes require explicit
conflict review. Oversized edits remain visible, and a confirmed event save whose
draft cleanup fails disables another save and reports the cleanup failure.

The final typecheck passed. All 26 final recovery/accessibility browser cases passed
across Chromium, Firefox and WebKit, following 14 initial editor/recurrence/
accessibility regressions and 21 recovery cases before the compact-layout adjustment.
The corrected 360 × 360 restored editor was visually inspected. The earlier full
663-test result predates this modal change; its combined root verification is
deferred to the next implementation batch. No Android build was run. Inbox recovery is tracked below.

## Unsent Inbox edit recovery

Unsent edits now have a separate recovery copy bound to the exact Cloud
environment, owner, organization and Gmail connection. It retains partial
recipient input, editable text, reviewed attachment bytes and the original saved
draft revision. Resume is explicit and never prepares or sends provider mail.
A newer saved draft refuses a stale replacement; competing windows require
Restore or Replace. Failed recovery cleanup after an explicit local save is
reported without claiming the copy was removed. Damaged recovery storage can
be reset without deleting the explicitly saved draft. Browser and native
storage use the existing transactional document and encrypted-slot adapters.

Inbox qualification: all 33 browser checks passed, including the owning adapter,
account-switch/read-cancellation regressions and recovery cases across Chromium,
Firefox and WebKit. Three record validation tests and type checking also passed.
Combined root verification with the Calendar modal changes is pending. Physical-device
process recreation, native encrypted-store execution and real Gmail authorization
and provider outcomes remain unqualified by these browser fixtures.

### Subview accessibility follow-up — October 5

An axe-core 4.14.0 scan of 86 light/dark reference app states found low-contrast
Calendar event details and adjacent-month dates, faint document-preview labels,
and dimmed paused-workflow descriptions. Workflow step icons also used labels on
plain spans without an image role. Event details now retain more foreground
contrast, adjacent-month dates use the muted text token, preview labels use a
readable gray, paused descriptions retain full opacity, and step icons have the
appropriate role. The fixture document preview is not a claim about imported PDF
accessibility or real document content.

All 22 reference-state rendering tests passed, along with type checking. The
repeated 86-state audit reported zero automated violations. It still returned
contrast items requiring manual review in 64 states, primarily because overlays,
images and partial overlaps prevent automatic background determination; these are
not passing contrast measurements. Calendar month and document preview captures
were inspected. Source and evidence are in the `alpha-album-documents` checkout,
under `artifacts/pr317-browser/subview-*` and
`test-results/root-accessibility-followup/design-*`. Broad screen-reader,
keyboard traversal of overlapping subviews and physical accessibility remain open.

The full Chromium campaign at `b021874ffe1085e2ad1f850cbd1d772ee6215043`
finished with 1,909 passed, 15 skipped and zero failures (31.6 minutes). The log is
`artifacts/calendar-form-review/current-main-chromium.log` in the primary checkout.
Its host-only skipped cases require separate profiles, and it predates PR 335 and
this subview follow-up. It must not be used as full-suite evidence for later code.

### Calendar month-picker focus ownership

The month dropdown previously covered day controls without removing them from
keyboard or screen-reader navigation. It now has a named modal dialog, its own
month navigation and close control, contained Tab/Shift+Tab focus, Escape/Back
handling and focus return. Covered phone controls become inert, and the assistant
dock stops painting over the picker. Picking a date, closing, or returning Home
releases ownership; the retired picker cannot consume Back in another app.
The calendar grid and controls scroll inside the bounded compact-height dialog.

All 103 owning Chromium root-state, Calendar draft and picker checks passed, plus
type checking. The final dock-visibility correction passed all four picker cases
(light/dark at 915px and 420px heights); its compact dark screenshot was inspected.
Evidence in the primary checkout is `artifacts/calendar-form-review/month-focus-*`
and the `test-results/browser/calendar-month-focus-*` captures. Other overlapping
subviews and native screen-reader/device behavior retain separate acceptance.
