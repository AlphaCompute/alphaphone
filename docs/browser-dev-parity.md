# Browser development parity

Requested October 2, 2026. This plan supersedes native-only behavior for browser development; it does not change Android permissions, product identity, or production acceptance gates.

## Execution design

Use the same renderer and plugin method contracts on both platforms. Register web implementations before any consumer registers a Capacitor plugin. Keep browser state in a separate namespace. Use actual browser APIs for media, storage, downloads, location and speech; use a durable local device model for OS functions a web page cannot control. No missing-platform banners or dead-end Android-only messages. Failures such as denied camera permission or failed storage writes still need actionable recovery and must not become fabricated successes. Simulated calls, payments and device settings never cause external effects.

## Complete capability inventory and implementation order

| Stage | Surface / source | Browser equivalent | Required validation | Status |
|---|---|---|---|---|
| 1 | AlphaBrowser / browser-adapter | Sandboxed frame per tab, navigation/back/forward/reload/stop, bookmarks, share/download, external-tab escape for sites forbidding frames | Navigation lifecycle, overlay isolation, bookmark reload, unsafe URL rejection, frame-blocking escape | Pending |
| 2 | AlphaCalendar / calendar-adapter / workflow-authoring | Durable local calendars, range queries, create/edit/delete with revision checks, selected-source and agent contracts | Reload, stale edits, civil dates, agent read/write authorization | Pending |
| 2 | DailyApps reminders / clock | Durable schedules, completion/snooze/recurrence receipts, foreground due checks and notification shade; clock controls over local alarms | Reload, due delivery, duplicate decisions, recurrence/DST, cancel | Pending |
| 3 | AlphaFiles / DailyApps selection / mail attachments | Browser folder picker where supported; file-input import and managed local folder tree elsewhere; preview, rename, move, share, download and exact bytes | Picker cancel, reload, binary/text/PDF, folder mutations, stale selections | Pending |
| 3 | Camera / AlphaPhotos | Existing camera work retained; MediaRecorder video; image edits, albums, favorites, trash, restore, bulk share; file import when camera absent | Real encoding, release tracks, persistence, edit copy, storage failure, album revision, video playback | Partial existing work |
| 4 | AlphaDevice / ElizaSystem / DeviceApps | Browser device profile and editable local Wi-Fi/Bluetooth/mobile/sound/display/battery settings; app launch routes; viewport/text scaling | Every settings control changes durable state; reload; no native-only text | Pending |
| 4 | AlphaNotifications / AlphaHostedResults | Local notification center, reminder/workflow notices, optional browser notifications, synthetic external-app events through dev controls | Open/dismiss/clear revisions, permission denial, restore, history policy | Pending |
| 5 | VoiceRecorder / local/cloud/paired voice / note audio | Browser microphone/MediaRecorder, speech synthesis and recognition when available, deterministic text input fallback, durable voice-note playback | Stop/cancel/barge-in, permission fallback, transcripts, no leaked tracks | Pending |
| 5 | Maps native-location / transport | Existing map renderer plus browser geolocation; manual location for development, browser fetch transport | Permission/no-location, route and search, cancellation | Audit existing implementation |
| 6 | Agent / DevelopmentAgent / AlphaConnection / action journal | Existing local dev host; durable local nonsecret journals and development selections; preserve real authentication boundaries | Actual local runtime request, reconnect, approve/cancel/replay, no credentials collected | Audit existing implementation |
| 6 | Inbox / Gmail / attachments / hosted workflows | Existing real host APIs plus opt-in local development account/data provider for UI development without credentials | Draft/edit/attachment/read/search/triage, local-only send receipts, workflow lifecycle | Pending |
| 7 | Phone / SMS / Contacts / Wallet (MVP deferred) | Dev-only local simulators through existing views; explicit dev profile in tools, no carrier calls/messages/payments | All navigation and state transitions, reload, zero external side effects | Pending |
| 7 | HOME / assistant / boot / lock / shade / hardware / background | Browser device controls dispatch equivalent lifecycle, HOME/Back/lock/assist/notification events; durable state across reload | Keyboard and touch paths, cold reload, overlays, pause/resume | Pending |
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

1. Calendar `executeAgent`/`cancelAgent` and reminder `operateReminder`/receipt contracts, including browser source capability advertisement. Match the existing validated operation types, explicit review, durable operation binding and stale-object checks. Current UI CRUD alone does not establish agent parity.
2. Recurrence must use the stored IANA zone across browser timezone changes and DST. Current browser recurrence follows the local JavaScript timezone and needs replacement before parity acceptance.
3. Add real directory-handle import when supported; managed browser files already provide the fallback. Add PDF inline preview, binary-safe metadata-only reads, attachment byte/hash contracts, and atomic folder mutation tests.
4. Qualify video with microphone audio, duration/size limits, hidden-page cleanup, camera switching, playback, reload and quota failures. Confirm zoom/flash equivalents affect captured output as well as preview. Complete scan-mode and camera-missing import equivalents.
5. Add automatic browser speech recognition only when its processing route is clear, with transcript-entry fallback. Exercise microphone denial, cancellation while permission is pending, durable voice-note save/playback, interrupted playback, and transcript cancellation.
6. Replace notification settings no-op hooks with usable local dialogs; implement local cross-app event injection/history and hosted-result inbox/lifecycle equivalents. Current reminder shade is functional; it does not prove background browser delivery.
7. Exercise all local simulation controls, including Inbox attachments/drafts/send/triage, workflow edit/run/cancel/reload, calls/SMS/contact CRUD and wallet state changes. A navigation-only test is insufficient. Keep external network effects absent and credential fields out of local simulators.
8. Browser HOME/Back/lock/assistant/role/background event controls and full hot-reload safety. Prototype adapter installation mutates class methods; hot reload during a suite caused duplicate React roots, so qualification must use stable source until a full-reload strategy is implemented.
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
