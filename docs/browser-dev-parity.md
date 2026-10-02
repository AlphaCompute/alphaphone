# Browser development parity

Requested October 2, 2026. This plan supersedes native-only behavior for browser development; it does not change Android permissions, product identity, or production acceptance gates.

## Execution design

Use the same renderer and plugin method contracts on both platforms. Register web implementations before any consumer registers a Capacitor plugin. Keep browser state in a separate namespace. Use actual browser APIs for media, storage, downloads, location and speech; use a durable local device model for OS functions a web page cannot control. No missing-platform banners or dead-end Android-only messages. Failures such as denied camera permission or failed storage writes still need actionable recovery and must not become fabricated successes. Simulated calls, payments and device settings never cause external effects.

## Complete capability inventory and implementation order

| Stage | Surface / source | Browser equivalent | Required validation | Status |
|---|---|---|---|---|
| 1 | AlphaBrowser / browser-adapter | Sandboxed frame per tab, navigation/back/forward/reload/stop, bookmarks, share/download, external-tab escape for sites forbidding frames | Navigation lifecycle, overlay isolation, bookmark reload, unsafe URL rejection, frame-blocking escape | Partial; read-aloud pending |
| 2 | AlphaCalendar / calendar-adapter / workflow-authoring | Durable local calendars, range queries, create/edit/delete with revision checks, selected-source and agent contracts | Reload, stale edits, civil dates, agent read/write authorization | Port tested; full assistant journey pending |
| 2 | DailyApps reminders / clock | Durable schedules, completion/snooze/recurrence receipts, foreground due checks and notification shade; clock controls over local alarms | Reload, due delivery, duplicate decisions, recurrence/DST, cancel | Port and recurrence tested; lifecycle qualification pending |
| 3 | AlphaFiles / DailyApps selection / mail attachments | Browser folder picker where supported; file-input import and managed local folder tree elsewhere; preview, rename, move, share, download and exact bytes | Picker cancel, reload, binary/text/PDF, folder mutations, stale selections | Implemented and tested; picker/Inbox integration QA pending |
| 3 | Camera / AlphaPhotos | Existing camera work retained; MediaRecorder video; image edits, albums, favorites, trash, restore, bulk share; file import when camera absent | Real encoding, release tracks, persistence, edit copy, storage failure, album revision, video playback | Partial existing work |
| 4 | AlphaDevice / ElizaSystem / DeviceApps | Browser device profile and editable local Wi-Fi/Bluetooth/mobile/sound/display/battery settings; app launch routes; viewport/text scaling | Every settings control changes durable state; reload; no native-only text | Partial; visual settings effects pending |
| 4 | AlphaNotifications / AlphaHostedResults | Local notification center, reminder/workflow notices, optional browser notifications, synthetic external-app events through dev controls | Open/dismiss/clear revisions, permission denial, restore, history policy | Local events, settings and history implemented; hosted-result work pending |
| 5 | VoiceRecorder / local/cloud/paired voice / note audio | Browser microphone/MediaRecorder, speech synthesis and recognition when available, deterministic text input fallback, durable voice-note playback | Stop/cancel/barge-in, permission fallback, transcripts, no leaked tracks | Capture and playback tested; remaining speech routes pending |
| 5 | Maps native-location / transport | Existing map renderer plus browser geolocation; manual location for development, browser fetch transport | Permission/no-location, route and search, cancellation | Audit existing implementation |
| 6 | Agent / DevelopmentAgent / AlphaConnection / action journal | Existing local dev host; durable local nonsecret journals and development selections; preserve real authentication boundaries | Actual local runtime request, reconnect, approve/cancel/replay, no credentials collected | Audit existing implementation |
| 6 | Inbox / Gmail / attachments / hosted workflows | Existing real host APIs plus opt-in local development account/data provider for UI development without credentials | Draft/edit/attachment/read/search/triage, local-only send receipts, workflow lifecycle | Local views restored; complete action qualification pending |
| 7 | Phone / SMS / Contacts / Wallet (MVP deferred) | Dev-only local simulators through existing views; explicit dev profile in tools, no carrier calls/messages/payments | All navigation and state transitions, reload, zero external side effects | Navigation tested; full action matrix pending |
| 7 | HOME / assistant / boot / lock / shade / hardware / background | Browser device controls dispatch equivalent lifecycle, HOME/Back/lock/assist/notification events; durable state across reload | Keyboard and touch paths, cold reload, overlays, pause/resume | Controls and reload tested; media lifecycle matrix pending |
| 8 | Verification | Root verify, complete browser suite plus new parity scenarios, both Android distribution variants | Record exact commands/results; separate APK, emulator HOME, AOSP image, device acceptance | Pending |

## Browser constraints and research

An iframe is not a privileged Android WebView. The same-origin policy prevents reading arbitrary remote page content, and sites may prohibit embedding with X-Frame-Options/CSP. Preserve those protections and provide a normal external-tab action, not a proxy that strips them. Use isolated frames with no native bridge. See [MDN iframe](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe) and [X-Frame-Options](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Frame-Options).

Directory pickers require user activation, permission and supporting browsers. Provide an import/local-tree fallback; do not silently claim a local copy rewrote the original OS file. See [MDN directory picker](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker).

A closed browser cannot guarantee Android background execution, carrier roles, secure hardware, system accessibility, or full AOSP boot. Model their application-facing events locally and retain native qualification separately. Test doubles are evidence for UI/contracts, not physical device behavior.

## Working ledger

Initial checkout already contained uncommitted camera-adapter changes, browser-camera.ts and browser-camera.spec.ts. Preserve and extend them. No upstream submodule or pristine baseline changes are permitted.

## Implementation checkpoint (October 2)

Implemented in `apps/app/src/browser` and the existing adapters:

- Shared Capacitor registration identity with web providers selected before consumers. Native plugin names and Android dispatch are retained.
- Isolated embedded browser tabs, browser-managed external links, navigation controls, bookmark persistence, clipboard/share and Files routing.
- Local calendar CRUD with cross-tab locking and stale-write/delete checks; persisted reminders, completion/snooze, local clock alarms and notification shade.
- IndexedDB file import, local folder creation, rename/move/delete, exact-byte read/download, and selection capability lifetime.
- Browser device profile and editable local network/sound/display/battery controls; browser geolocation driver.
- Camera persistence and atomic photo-edit recovery from concurrent work retained; added local albums, bulk sharing and MediaRecorder video path. Video capture currently uses the camera stream without microphone audio and needs dedicated qualification.
- Browser microphone recording, transcript entry, speech synthesis and IndexedDB voice-note playback. Transcript entry is a deliberate local fallback, not automatic speech recognition.
- Explicit `?mode=dev` / **Dev device** control restores product-owned local Phone, Messages, Contacts, Inbox, Wallet and Workflows interactions. State is stored under `alpha.dev.app.*`. Wallet adds predefined development tokens instead of collecting card numbers. This profile is gated to Vite development and excluded from Android selection.

Focused tests currently establish calendar persistence/conflict rejection, reminder idempotency, frame isolation/bookmark persistence, deferred-app navigation without external requests, exact-byte file persistence/move/rename/conflict checks, settings persistence, plus camera capture/denial/pending-permission cleanup and the separately added photo-editor recovery suite.

### Required remaining work; do not mark the goal complete

1. Calendar `executeAgent`/`cancelAgent` and reminder `operateReminder`/receipt contracts, including browser source capability advertisement. Match the existing validated operation types, explicit review, durable operation binding and stale-object checks. Direct-port review/cancel/replay tests now pass; complete the actual assistant proposal journey before declaring agent parity.
2. Recurrence now uses the saved IANA zone in the production reminder port, with DST gap/overlap, lead-time, weekday/weekly, overdue, half-hour and quarter-hour coverage. Retain browser timezone-switch and notification lifecycle coverage as a completion gate.
3. Directory-handle import, managed local trees, PDF inline pagination, binary-safe reads, attachment byte/hash contracts and atomic mutations are implemented. Complete rendered picker cancellation/revocation and Inbox attachment integration checks; OS directory imports are explicitly local copies.
4. Qualify video with microphone audio, duration/size limits, hidden-page cleanup, camera switching, playback, reload and quota failures. Confirm zoom/flash equivalents affect captured output as well as preview. Complete scan-mode and camera-missing import equivalents.
5. Add automatic browser speech recognition only when its processing route is clear, with transcript-entry fallback. Exercise microphone denial, cancellation while permission is pending, durable voice-note save/playback, interrupted playback, and transcript cancellation.
6. Local notification settings, channel/access controls, dev event injection, shared app sources, revision-bound actions and redacted history are implemented. Hosted-result inbox/lifecycle equivalents remain pending. Browser event delivery does not prove closed-browser or native background execution.
7. Exercise all local simulation controls, including Inbox attachments/drafts/send/triage, workflow edit/run/cancel/reload, calls/SMS/contact CRUD and wallet state changes. A navigation-only test is insufficient. Keep external network effects absent and credential fields out of local simulators.
8. HOME/Back/lock/assistant/role/background controls and full source reload are implemented and exercised. Continue microphone/camera cleanup and background-delivery checks across these controls; a simulated background event does not prove a closed browser can execute work.
9. Finish rendered browser navigation tests (current surface test exercises the port), source/surface read-aloud equivalent, safe cross-origin fallback, all settings controls, normal browser and dev-profile smoke matrices.
10. Refresh root verification, full browser suite and both APK variants after the final source changes. Emulator HOME-role, AOSP image boot and physical device/user acceptance remain separate evidence.

Additional primary browser references: [media capture permissions](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), [Web Speech](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API), [speech processing routes](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API), [service-worker notifications](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification), and [storage quotas/eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria). Browser persistence is origin-local and subject to browser storage policy; application transaction success is not a disk/hardware durability guarantee.

### Verified checkpoint evidence

- `npm run verify`: 52/52 tests, typecheck and production build passed.
- `ALPHA_BROWSER_TEST_PORT=5333 npm run test:browser` in an isolated source snapshot: **104/104 passed**. Snapshot disables live reload to prevent other chats editing this checkout from invalidating a running test. All 95 `apps/app/src` file hashes matched the checkout after the run.
- `npm run android:build`: passed and verified standalone/launcher debug and unsigned-release APKs. This is APK packaging evidence, not emulator HOME-role, AOSP boot or device acceptance.
- Actual Browser UI: clicked Browser, entered an HTTPS address, loaded an isolated fixture page and visually inspected the rendered phone. Screenshot: `test-results/dev-parity-ui/browser.png`.
- Logs and source comparison: `test-results/browser-dev-parity/`. Source snapshot browser report remains at the temporary validation path recorded during execution.

The two earlier browser attempts were invalidated by live source reloads and are not the acceptance result. Their reproducible fixture changes were repaired before the isolated run. The remaining-work list above still applies; passing the current suite does not establish complete parity.

### Second implementation checkpoint

- Calendar agent reviews now bind source/event revisions, support cancellation and persist exact-operation receipts atomically with event changes. Reminder agent operations use the existing approval boundary and persist bound receipts atomically with reminder changes. Resident browser capabilities advertise the implemented ports.
- Recurrence uses saved civil dates and IANA zones. Tests cover the spring gap, earlier autumn overlap, Lord Howe's half-hour transition, Kathmandu's offset, weekly/weekdays and overdue occurrence counts.
- Browser device controls expose HOME, Back, power/lock/unlock, restart, assistant, notifications, background/resume and persisted simulated roles. Vite source updates force full document reload because adapter installation mutates the prototype; storage survives that reload.
- Files now validate and mutate within a single IndexedDB transaction, including concurrent tabs. Directory import copies into a local managed tree (it does not modify the selected OS directory). Duplicate names/partial imports are rejected atomically. Selection capabilities carry revisions. Binary files are opened/downloaded rather than decoded as text.
- PDFs render locally through Mozilla PDF.js with bounded canvas dimensions and released preview URLs. Implementation follows the primary [PDF.js examples](https://mozilla.github.io/pdf.js/examples/). This is a real PDF renderer, with no document upload.

The original remaining-work ledger is still the completion gate. Items 1, 2, 3 and 8 have advanced but require the current test results and deeper end-to-end coverage before closure. In particular, filesystem imports are local copies; attachment integration, voice/camera lifecycle, simulated-app workflows, notification history and read-aloud still require follow-through.

Files follow-through: folder import, transaction races, stale selections, binary handling, PDF UI pagination, mail attachment byte/hash review, and imported-HTML isolation are implemented and covered. PDFs were visually inspected in the product Files view. The unused first recurrence helper was removed; additional timezone tests now exercise the production `reminder-recurrence.ts` implementation.

### Second checkpoint validation evidence

- `npm run verify`: **74/74 tests**, typecheck and production build passed.
- Frozen source/test snapshot browser suite: **126/126 passed**. All **100 renderer files** matched the checkout after completion. A concurrently edited Notes layout test changed after freezing; the saved manifest identifies the exact tested test inventory.
- `npm run android:build`: standalone and launcher debug/unsigned-release APKs, instrumentation packaging, lint and APK verification passed. This is not emulator HOME-role, AOSP image boot or physical device acceptance.
- Files focused suite: **5/5 passed**, including actual PDF text pixels and rendered page navigation, attachment bytes/hash checks, transaction races and HTML origin isolation. Screenshot: `test-results/dev-parity-ui/pdf.png`.
- Full-reload fixture: **4 consecutive passes** with a polling watcher for deterministic temporary-directory events. The real Vite websocket/reload path runs and saved browser state survives.
- Evidence: `test-results/browser-dev-parity/checkpoint-2/`, including renderer and full source/script/test manifests and the final comparison.

Earlier attempts exposed and repaired the Files status mismatch, PDF worker loading and reload-fixture timing/path handling. Other attempts were invalidated by disk exhaustion or mismatched concurrently updated audio source/tests; those are not the accepted result. The final frozen snapshot contains consistent source and tests. The broader capability ledger remains open; these checks do not establish complete 1:1 parity.

### Notification implementation checkpoint (historical checkpoint 3)

`browser/notifications.ts` now owns the browser notification center; `browser/apps.ts` shares identities with DeviceApps launch. Policy reads establish a durable revision before a first write. Settings expose the actual app/channel/access and selected-app controls, with no Android-only warning panel. Device controls can post local development events from available apps; selecting a row opens that app. Raw notification titles/text stay in memory, and metadata history is opt-in, capped at 100 events and 24 hours.

Policy changes purge prior observations/history. Clear-history establishes an event generation boundary, so queued prior observations cannot repopulate it. Actions reject stale revisions; locked views redact content and reject opening; non-clearable events survive Clear all. Failed storage writes do not publish an event. Shared app identities also repair the Mail-to-Inbox launch route. HTML dialogs now own shell Back, and an open history view refreshes after clearing instead of disappearing.

Eight focused browser scenarios cover first-use settings, stale policy/actions, previews, retention/reload, lock redaction, source taps, channel/access suppression, transaction failure, queued-event boundaries, source registry agreement, rendered settings/history and Back. Rendered shade was visually inspected at `test-results/dev-parity-ui/notifications.png`. Full checkpoint verification follows below; the broader parity goal remains open.

Notification checkpoint verification: `npm run verify` passed **74/74 tests**, typecheck and production build; the frozen browser suite passed **139/139**; `npm run android:build` passed standalone/launcher debug and unsigned-release APK verification. Evidence and exact source/script/test manifest: `test-results/browser-dev-parity/checkpoint-3/`. The temporary snapshot needed the newly added OCR license directory before its dev server could start; that setup error was repaired before the accepted run.

The next notification parity gate is a durable synthetic device-event source, separate from ephemeral app observations and redacted history. Android's `getActiveNotifications()` can rediscover current system events after app reload or policy changes; the present browser observation map cannot. Implement that source, bind observation revisions to each policy generation, preserve opt-in/redaction, and test reload, policy re-selection, replacement, dismissal and pending taps. Do not treat the current memory-only source as complete cold-start parity. Hosted-result inbox/background lifecycle remains separately outstanding.

Post-run comparison recorded concurrent edits to browser note documents, scan review, OCR assets and OCR tests. The frozen browser result proves the saved checkpoint, not those later edits. Notification implementation files remained unchanged. Refresh the complete current-source matrix before claiming full goal completion.


### Durable notification source (checkpoint 4)

The synthetic device queue now persists independently of collection policy and redacted metadata history. Reloading or reselecting a source rediscovers its current events, matching Android active-notification semantics. The queue stores only explicitly authored development events in this browser; it does not capture host application notifications. Source payloads are excluded from settings status and metadata history. The queue retains at most 100 active events; history remains opt-in, bounded to 100 events and 24 hours.

Source-scoped IDs support replacement without collisions between apps. Ongoing, secret and keep-after-opening flags survive reload. Observation tokens bind source revision, policy generation and the current foreground session; reload, lock and lifecycle transitions retire pending taps. Opening/dismissing persists atomically before navigation, so failed writes leave the event and history intact. Clear history preserves the device queue while retiring old observations. The development editor can inspect, replace and cancel source events, including ongoing events.

All 14 focused browser tests pass, including cross-tab replacement/dismissal, reload and policy rediscovery, source cancellation, lock transitions, storage rollback and rendered editor interaction. This supersedes the memory-only source gate in checkpoint 3. Full matrix validation is in progress. Hosted-result inbox/background lifecycle remains separately outstanding.

### Next capability: hosted result delivery

The source audit found that `DigestInbox` already persists results before acknowledgement, retains 100 outputs, verifies immutable replay and retries pending notices through `afterCommit`. Browser UI currently constructs it without that callback. `AlphaHostedResults` has no browser registration, `checkTap` exits outside Android, and the panel advertises unavailable browser notifications. Native delivery adds reservation/cancellation generations, session binding, polling preference and a redacted notice ledger. Reuse the existing authenticated workflow client and digest store; do not duplicate credentials in browser notification storage.

Implementation sequence:
1. Add a browser hosted-result notice service with exact scope/origin/owner/agent/run/workflow/version validation, retained-result verification, bounded durable notice ledger, idempotent publication and durable pending/consume tokens. Persist before showing a notice or dispatching its tap; keep result text out of notification metadata.
2. Attach the existing `DigestInbox.afterCommit` callback to publication in the browser. Register a live binding only after connection verification, invalidate it on cancellation/disconnect/account replacement, and revalidate account and retained history before rendering a tap. Preserve pending taps for their original account without switching accounts or rerunning workflows.
3. Connect hosted notices to the same browser notification shade, with open/dismiss/clear and reload restoration. Expose notification and polling controls in the scheduled-digests panel using browser-appropriate labels, removing native-only fallback copy.
4. Implement browser-lifetime polling using the verified client, cancellation generations and the existing 15-second foreground refresh. Preserve the polling preference, avoid duplicate flights, pause simulated power/background activity as appropriate and refresh on resume. Closed-browser delivery is not an execution claim; scheduling remains owned by the connected agent.
5. Verify rendered result delivery, reload/tap recovery, account switches, stale tokens, interrupted writes, rejected/late setup, lost acknowledgements, duplicate delivery, retention eviction, two-tab consistency, pause/resume and disconnect cancellation. Keep existing Android binding tests passing. Run root verification, full browser suite and both APK distribution builds for the completed capability.

## October 2 — integrated browser parity checkpoint

A fixed source snapshot now passes **82 repository tests**, typecheck, production web build and the **complete 156-case Chromium browser suite**. This integrates the previously local Files/PDF/folder-import and attachment ports, device controls and full-reload behavior, notification policy/history and durable synthetic device queue, recurrence consolidation, and the recent Camera OCR/PDF/link/event-draft work. File mutations are checked for stale selections and concurrent updates; imported HTML remains sandboxed; notifications are checked for reload, policy, lock and revision boundaries. PDF and notification screens were visually inspected.

The integration review also fixed two gaps: PDF.js font/decoder/package licenses now ship byte-for-byte with their assets, and reviewed attachment previews release their dialog/object URL on shell Back, pagehide and visibility loss. A new Back test failed before the cleanup fix and passed afterward; a replaced dialog's late close cannot retire the current preview. Evidence is retained under `test-results/parity-sync/` and the fixed candidate's `test-results/` directory.

This is browser/host evidence, with synthetic device and provider fixtures where documented. No Android build ran in this pass. Concurrent hosted-result delivery edits were excluded from the snapshot and remain local pending qualification; the active report's hosted-result delivery sequence remains unfinished. Full browser parity, live-provider acceptance, device/background behavior, document boundaries and the remaining design/MVP ledger are not closed by this checkpoint.
