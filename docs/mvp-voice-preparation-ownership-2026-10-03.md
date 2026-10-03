# Voice preparation belongs to the initiating screen and account

## Reproduced gap

A composer microphone request can await local speech readiness while the user navigates or changes accounts. The real local-voice implementation rejects when its binding becomes invalid. The renderer previously checked ownership only after a successful readiness response. Its rejection handler fell through into the Cloud choice and reopened Notes under the new screen/account.

The rendered negative control uses the real renderer and local-voice implementation, with a deferred browser speech port and synthetic Cloud identity. At source `527b01c`, both navigation and owner-change cases fail; the unchanged-context case passes. No real provider, microphone or credentials are used. Initial fixture runs with a missing synthetic credential field and a mismatched control label are retained separately and are not acceptance evidence.

## Repair

Composer preparation captures agent session, Cloud session/credential/environment, connection mode and initiating view. Every readiness outcome must still own that context before navigating or offering a fallback. Navigation, chooser changes, hidden/pagehide events and unmount retire outstanding probes. Leaving and returning to the same screen cannot revive an old request. Same-context readiness failure still exposes the existing explicit voice choice; recording and upload require their normal separate actions.

## Qualification

Evidence is retained in `test-results/voice-preparation-ownership/` in the shared product workspace. `baseline.log` records the rendered negative controls; `after.log` records the repaired four-case suite and existing eight voice-save/dictation cases. `adapter.log` records the existing real-adapter/native-boundary flow. All 12 rendered cases pass. The composed source also passes `npm run verify` (224 checks, TypeScript and production build), retained in `verify.log`. New Android builds and native/live-provider qualification remain pending; these browser fixtures do not prove physical speech, live Cloud voice or a release image.
