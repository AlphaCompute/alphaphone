# Reading privacy and password-provider setup

## Implemented flows

Browser read-aloud now checks source URLs, page labels and text before presenting an excerpt. It rejects recognized credential/vault/verification content, API-key URL parameters, and sources that exceed inspection bounds. Editing while a source loads cannot bypass a later refusal. Editable controls are excluded from extraction, matching the native extractor. Ordinary article review, local playback cancellation, and manual excerpts after unavailable network/CORS reads remain supported. API-key and access/refresh-token labels are also included in the native checks.

This is a conservative heuristic, not proof that arbitrary text is free of secrets. It can reject ordinary articles containing sensitive vocabulary or ambiguous numbers. Native reading still requires HTTPS; browser development can review public HTTP sources. Neither path sends reading text to the agent. No real credentials were used in the tests.

Settings now has one Password manager entry, with the same detail accessible from Browser. The detail distinguishes missing, disabled, publisher-unrecognized and verified Proton installations; current provider selection; and Android autofill availability. Unknown observations stay unknown. Verified Proton setup opens Android's public provider picker, with a missing-handler fallback to Settings. Opening a picker or download page never means installation, selection, unlock or filling succeeded. Resume and explicit refresh read current status. See [provider setup and primary sources](password-provider-setup.md).

No vault content, credential values or unlock state is queried. Android and Proton retain ownership of their confirmation and vault UI. The existing Proton recognized-browser limitation remains: preserve its warnings. Real password saving/filling, website matching, provider unlock/resume and passkeys are separate acceptance work, not implied by onboarding. No default service was forced and no Proton account was created.

## Evidence and corrections

- The first source audit reproduced visible synthetic credential text reaching the browser speech boundary. The corrected reading packet passes 36 rendered flows; the API-key URL follow-on passes 42, including six no-fetch/no-speech URL variants. Native Java compilation and the actual Java URL guard pass separately.
- Independent review caught standalone editable-field extraction and oversized-response fallback gaps. Both were corrected before integration. Earlier failing logs remain retained.
- Password onboarding passes ten rendered flows with a controlled native metadata/handoff boundary. Typecheck, native helper compilation and exact-base patch checks pass. This is not installed-provider or APK execution evidence.
- The combined product composition over `2063d6696de2f6796451411fe197b31940ba0c5a` passes repository verification and 84 rendered flows, with all 3,713 source files unchanged. Committed notification busy controls were preserved through clean three-way merges. A subsequent compatibility-copy change replaces internal verification wording with website-address guidance; its separate final qualification is recorded in the integration evidence.

Evidence directories: `test-results/reading-sensitive-fix/`, `test-results/reading-api-key-url-fix/`, `test-results/password-provider-onboarding/`, and `test-results/mvp-reading-provider-integration/`.

## Existing candidate and native gates

At candidate `52ab225f745c8c49b83e2cda83540e8cdb4eecbc`, PR-triggered Browser run 37064579643 passes all 911 tests. Push run 37064574375 fails a Calendar fixture race: another read overwrites its release callback. An explicit overlapping read reproduces the timeout. The already committed shared-gate fix from `a3b6ff7` passes all 15 Calendar flows across three repetitions on the isolated candidate. This preserves the cancellation assertions and deadline. The passing PR run does not erase the failed push run. Evidence: `test-results/browser-52ab-terminal/`.

Foundation run 37064574379 builds both APK distributions, then stops before native instrumentation because Android requests another overlay reboot. The earlier scratch provisioning repair progressed beyond its old failure. The requested reboot sequence is being repaired separately; this is not native acceptance.

A fresh Android 35 ARM64 Pixel 9 AVD, `alpha_root_52ab_pixel`, is visible through Android Studio Computer Use. It has no candidate APK installed yet. The local recovery supervisor is staged and refuses missing or unverified resident artifacts; it has not executed device actions. Live Cloud/Gmail/voice grants, official Proton acceptance, physical speech/alarms, signed AOSP boot/update/rollback and user/device acceptance remain open. The MVP is not complete.

## Ownership

The renderer, Settings design, chosen provider and publisher pin belong to Alpha. Generic Android provider metadata/handoffs and credential-sensitive browser-reading rules are reusable platform capabilities; a future upstream extraction must preserve these explicit contracts and the shared native/browser fixture corpus. Neither provider-specific setup nor password values belong in model prompts or hardcoded agent workflows. This change does not edit `vendor/eliza` or activate the imported app baseline.
