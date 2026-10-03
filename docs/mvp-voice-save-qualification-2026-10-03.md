# Voice save ownership and remaining acceptance — October 3, 2026

## Reproduced problem and repair

At published base9236f86, a voice-note or dictation save could finish after its recording session had been discarded and replaced. The old successful save then closed/cancelled the new microphone session; an old failed response replaced the newer transcript screen with a stale error. Four rendered negative controls reproduced these outcomes using synthetic audio through actual browser MediaRecorder and audio retention, with the real Notes store write committed once and only its response held.

The adapter now checks recording generation after Notes persistence resolves before publishing an error, closing the screen, or scheduling editor focus. Dictation uses the same owned busy lifecycle as new voice notes. A pending commit disables the reviewed transcript and guards its change handler, so edits cannot silently disappear behind a successful save. Failure restores editing with the same transcript. Discard and a deliberately opened new session remain available. A prior authorized write that already committed remains persisted exactly once; the fix does not claim that cancelling the UI rolls back storage.

Ten rendered flows pass: late success/failure for new recordings and dictation; same-session success/failure with transcript locking and reload persistence; and two existing real browser microphone-level flows. TypeScript and existing voice-controller checks pass. Frozen source packet: `e754abb9fad5a267cdb9414d666a524161b814385792a40e078c3835a0a68765`. Baseline/fixed logs, source hashes and traces are retained in `test-results/voice-save-ownership-9236/`.

Final composed qualification passes218 repository checks, TypeScript/production build, both Android distribution builds, lint and all six APK inspections. All3,896 source identities remain unchanged during required checks; evidence is in `test-results/voice-crash-final-9236/`.

This verifies renderer ownership and browser recording/storage boundaries. It does not establish physical speech recognition quality, native audio routing, latency, battery or live Cloud voice acceptance.

## Resident worker diagnostics

The prior hosted native failure identifies SIGSYS before model RPC. Published candidate9236 adds exact child PID/UID/start-time diagnostics and bounded own-app ApplicationExitInfo projection. Because Android may not attribute a non-zygote child to that API, the CI runner also has an optional failure-only crash-buffer projection. It first rechecks the disposable hosted emulator, exact secondary user and real UID, then reads at most512KiB under a shared10-second budget. It retains only numeric fields from one matching debuggerd PID/UID/time/signal/code/syscall record. Raw crash logs, command text and descriptions are never written. Unavailable/ambiguous evidence remains unavailable and cannot turn the primary workflow failure into success.

Five owning command-bound/privacy/attribution/cancellation tests pass. Actual SIGTERM exposed an integration bug where optional capture could replace the original failure and skip cleanup; the narrow optional-only exception guard now preserves the primary failure, reaches owned cleanup and removes the diagnostic subprocess. Original instrumentation remains interruptible. The existing supervisor CI step invokes these tests before native execution. The optional observer is diagnostic only: no seccomp, SELinux, target SDK, model-request or cleanup gate is weakened. Actual syscall attribution still requires the next hosted native result.

## Requirements reconciliation

The browser plan now records that known sensitive URL and normalized visible credential/OTP/recovery patterns are already rejected by browser/native reading code and fixtures. It retains release-device testing and explicitly avoids claiming universal detection of arbitrary secrets. Real Proton sign-in/save/fill/lock, provider updates, iframe/tab/process boundaries, release identity and passkeys remain open. Dynamic remote enabled-view discovery is a separate generic protocol gap; local deferred-view execution rejection is already enforced.

A fresh read-only Cloud browser check confirms the intended account is signed in and Account/Dashboard pages load. The service still requires a Dedicated agent for signed-in chat. No agent was provisioned, billing accepted, key viewed, permission granted or message sent. Browser login is not phone delegation, Gmail consent or live agent/voice proof. Native Computer Use still reports the Mac locked; its existing unlock request remains pending.

See `docs/mvp-completion-plan.md` for all remaining requirements. The full MVP is not complete.
