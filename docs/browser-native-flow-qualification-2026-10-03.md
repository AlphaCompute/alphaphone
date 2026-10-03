# Browser speech and native flow qualification — October 3

## Changes and verified scope

This composition combines resident candidate `e4d5bf1bd921c450b8cdb3c06a23a9e5f65105f7` with committed product `5d719c09c358db878c0c3b325d3fcdfe8c7221b1`. All resident patches and the pinned vendor revision remain unchanged.

The newest browser transcription change imported connection modules before browser plugin factories registered. Exact-source reproduction failed with `DeviceApps plugin is not implemented on web`, and the existing connected hosted-results journey also failed. Deferring the connection dependency until speech operations preserves registration order. Cancellation owns the operation before the deferred import and prevents subsequent dispatch when cancelled. Host authentication, PCM limits, owner/session binding and manual transcript review remain intact.

The native browser sensitive-reading test now navigates six synthetic API-key URL variants through the actual child WebView and requires the exact production URL refusal, no review dialog/token, no additional main-document request and no synthetic speech request. Only fixed synthetic HTTPS routes are served from memory; the original native lifecycle callbacks still establish committed navigation. The original ordinary review, immutable excerpt, playback and replay-refusal control remains. Main-frame counters do not establish zero subresource attempts.

Foundation CI now requires sensitive-reading and share/cancel methods alongside isolated reading and navigation for both distributions. These opt-in methods previously skipped. The share fixture opens Android's chooser and cancels without choosing a recipient. Exact terminal-method counts, no-skip requirements, pinned provider/APK identities and the existing 600-second instrumentation deadline remain unchanged. Installed execution is still pending.

The standalone bookmark restart runner now requires the exact requested method and complete instrumentation result. It retains bounded partial output on transport failure and defers cleanup when prior instrumentation termination is unknown. This hardening does not provide device ownership, authenticated installation or prior-APK restoration; do not use that runner on the shared Pixel or treat it as CI acceptance.

## Combined local evidence

- `npm run verify`: 160 checks passed, plus typecheck and production build.
- `npm run android:build`: standalone and launcher debug/release-unsigned builds, instrumentation APKs, lint and APK verification passed.
- 66 owning rendered flows passed, covering startup, hosted results, recording/manual transcription, Notes durability, video edits and workflow notice history.
- Four additional PCM/host-bridge review/cancel/disconnect flows passed. The real speech-provider case was explicitly skipped.
- The actual built production web payload starts without page errors and exposes working DeviceApps, system and hosted-results browser factories. Development-only controls are correctly absent from production.
- All 3,761 captured source identities remained unchanged through qualification. Documentation is updated afterward.

Evidence: `test-results/candidate-followup-composition/`, `test-results/browser-speech-import-fix/`, `test-results/native-api-key-reading-flow/`, `test-results/native-sensitive-reading-ci-v2/` and `test-results/bookmark-runner-result-fix-v2/`.

Earlier failed setup attempts remain retained: the default browser-test port was already occupied; the recording fixture initially omitted its required synthetic token-file configuration; the production smoke initially expected a development-only control. Corrected runs use an owned port, synthetic credentials with an unused loopback origin, and the source-defined production profile. No real account credentials or provider requests were used.

## Hosted and device gates

Both exact-e4d Browser runs (`37093234545`, `37093237042`) were cancelled by the 20-minute job limit. Check annotations explicitly report that limit; logs reached the final case numbers without failed-test rows but did not produce passing summaries. The next job limit is 30 minutes; individual test deadlines, shard count and worker count are unchanged. Cancellation is not a pass.

The e4d Foundation and resident campaigns remain independent running work at this checkpoint. Do not infer their native results from local APK builds. The installed Pixel remains the previously verified e4d standalone APK; this new composition has not been installed. Visible upgrade/note readback is pending because Computer Use reports the Mac locked.

Real Cloud/Gmail/voice authorization, packaged resident recovery, official password-provider save/fill/unlock, physical alarms/speech/latency, signed AOSP boot/update/rollback and device/user acceptance remain open. The MVP is not complete.
