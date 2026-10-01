# Prototype implementation and verification

The visual authority is https://alpha-phone-prototype.pages.dev/ (snapshot SHA-256 `fd1ee08878c9ae8e8e0d112cc42e3b687326f290b1f86ddaca0f737cdb79afff`). The previous generic renderer was rejected by the user. The production entrypoint now mounts the original reference template, visual state modules, typography and assets through the product-owned renderer under `apps/app/src/prototype`.

## Presentation boundary

The preview's outer device frame and right-hand demo controls are not part of the Android product. The phone template is extracted from the same source tree and scaled from its 412 dp design width. Its height follows the usable viewport, including keyboard changes. Android draws its actual status and navigation bars; the reference's simulated status icons and camera cutout are hidden on Android. Browser visual fixtures retain reference system-bar drawings.

`?fixture=1&start=<preset>&theme=light|dark` is available only in the Vite development browser, never in Android. It retains the reference's seeded presentation states for comparison. It is not evidence of real transactions or integrations. Production installs authenticated-agent, native-action and durable-data adapters instead of the prototype's canned assistant.

## Real behavior integrated

- Per-view agent context, sensitive Wallet exclusion, real development Eliza transport, explicit one-time proposal approval, exact action descriptions and receipts.
- Notes editor, checklist conversion, local persistence, delete and undo. Existing text notes are imported on first use; malformed storage is not silently overwritten. Cross-window storage conflicts reject a stale write.
- Android native action adapters replace prototype sends, calls, camera, website opening and calendar handoffs. A handoff does not imply the external action completed.
- Calendar's existing form offers a Reminders calendar. One-time reminders use the native scheduler; notification taps open the exact Calendar detail. Recurrence remains unavailable.
- Voice recognition uses the installed Android recognizer. Debug recording/transcription uses the existing explicit record, stop, transcribe and review flow.

## Verification boundaries

Run `npm run verify` and `npm run android:build` for both distribution variants. `scripts/prototype-capture.mjs` captures the 60 named app entries plus shell states in both themes, with fonts, network failures, bounds and hashes in its manifest. Captures alone do not establish pixel equality or action correctness. Remote reference captures currently report a failing Google Fonts request; the local port bundles its fonts and does not depend on that request.

The initial local browser check created a real note through New note, edited Title/Note, returned to Notes, reloaded the page and reopened Notes with the note intact. The initial Android build visibly rendered the reference Home layout on the Pixel 9 AVD (the installed phone profile closest to the requested Pixel 10). Its first inspection caught duplicate status bars, prompting the native-bar correction. Later verification must record whether that correction and the full flows passed.

Outstanding acceptance includes the complete comparison matrix, revised Android flow suite, chosen-document previews, all native handoff returns, real account connectors, owned Chromium embedding/agent control, persistent workflow execution, physical device acceptance and full AOSP image boot. Sample visual data and successful fixture screens must not be presented as completion of those integrations.

The first prototype Android run exposed a test adaptation error: the prompt fixture contained newlines while the reference composer is a single-line input, whose native value normalization removes them. The assertion compared against the unnormalized multiline string before sending. The test prompt was changed to equivalent single-line prose; this first run is not a passing agent result.
