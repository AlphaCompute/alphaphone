# Workflow notification tap qualification — October 3, 2026

## Behavior

Approved workflow Notify steps now carry a route derived from the verified operation/session binding: device scope, origin, owner, agent, workflow, execution and version. The native bridge stores that route in an encrypted bounded ledger before posting. Each notification has an immutable PendingIntent with a distinct opaque token. Opening a tap performs authenticated reads and verifies the exact execution/version under the still-current owner; it never runs or approves a workflow.

Cold Activity and warm intent capture retain failed persistence attempts. Native lifecycle and bridge access to the in-memory retry queue run on the main handler. An older unconfirmed tap cannot prevent capture of a newer confirmed tap. The renderer rejects stale account, view, editor and authoring state after asynchronous reads; it rechecks the durable native receipt before showing the result. Consumption requires the exact currently pending token and cancels only that notice.

## Actual Android evidence

The candidate combines published base `e1af74d86621e69bac48cadeacc0ab860a87cbad`, reviewed notification packet `54245b7764362f87b1d0941e015521d935577db9a0e0eea97e05adf319783520` and readiness fixture correction `069f3ed25ff1f6f961ef6f99bfb4a26cda12e2da8f589ca14847cb15f8644d59`. The connection merge preserves the already-qualified development reminder-v2 capability.

Both standalone and launcher distributions pass the actual Android method `WorkflowNoticeTapInstrumentedTest#twoOpaqueNoticesRetainColdWarmAndFailedCaptureRoutes` on a fresh task-owned Pixel 9/API35 ARM64 emulator. Each run posts two actual OS notices, verifies distinct PendingIntents/tokens, follows the original cold and warm sends, exercises failed encrypted capture and unconfirmed receipt recovery, reconstructs the ledger and verifies consumed-token replay remains empty. A strict parser verifies exactly one named start/completion, zero skips and a successful terminal instrumentation result per variant.

The campaign uses a separate fresh AVD, not the existing emulator or any physical device. Each variant has a disposable secondary user. Both users are removed, the original user is restored, and product/test package global absence is verified. The stock WebView remains `124.0.6367.219` with SHA-256 `00d21d27275b1417d01873cc0d5d86166618f3fde2829de0e8b12dc03d090413`. No WebView replacement or lock bypass is used.

Evidence: `test-results/workflow-taps-final/native-03/`, with runner and independent cleanup diagnosis in `test-results/workflow-tap-native-campaign/`. APK manifest SHA-256: `a9a7da606500b823fca423375a20291f159a8cd3d7acd5826be3295c7b0b3b8c`. Source manifest SHA-256: `36f6ec372f9b54d5dadefdf1e6b5747ea85daf32e8f5907515035efc9ea1e373`.

| Variant | Artifact | SHA-256 |
| --- | --- | --- |
| standalone | standalone-debug.apk | `d88b9ef34a226d045c079a8c7b14e8ef52026a1b6e57b0e49da2adc3e87caffb` |
| standalone | standalone-androidTest.apk | `3397201163d7bd6fa40609fea57043457f9def72bf03931e6e3f1e17305cd54b` |
| launcher | launcher-debug.apk | `156318a078c6757e1cd79e3a0531d9e4bf3137ed5adef72738eb9747f63a1898` |
| launcher | launcher-androidTest.apk | `27c6a8a4cf7cfe6c68f85c423922d9bfc59cb8c2f09318ac757578eeef5bb995` |

## Other qualification and retained failures

All 218 repository checks, TypeScript/production build, both Android builds, lint and six APK inspections pass. All 3,884 source identities remain unchanged during required checks. Twenty-seven rendered flows pass, including authenticated identity/version refusal, queue changes during reads, builder races, development reminder negotiation and workflow presentation approval. The subsequent rebuild changes only the native test readiness helper; product/browser source remains identical.

The first native attempt failed because the fixture evaluated the WebView before the PendingIntent-launched Activity resumed. Android recorded accepted `START`, `BAL_ALLOW_PERMISSION`, result zero; 51 milliseconds later the premature assertion ended instrumentation. The correction observes readiness under a bounded deadline without a second send, explicit launch or background-launch-policy exception. That failed run remains in `test-results/workflow-taps-combined/native-01/`.

The second attempt passed standalone but exposed a test cleanup race: `am get-current-user` reported the destination while UserController still had the old current user. The runner now waits for the exact current user and cleared target transition before removal. Android's automatic package removal is reconciled through verified global absence instead of assuming an uninstall error means failure or success. Failed outputs and cleanup reconciliation remain in `test-results/workflow-taps-final/native-02/`; the final two-variant campaign passes cleanup without errors.

## Publication and hosted browser follow-up

After adding mandatory CI coverage and the test-only readiness observation correction, the final candidate again passes 218 repository checks, TypeScript/production build and both Android builds with all 3,885 retained source files unchanged. Native/app/instrumentation source is identical to the APKs used in the successful two-variant campaign; differences are the CI supervisor/tests, browser readiness test and prose. The test-generated Python bytecode from an earlier supervisor run is removed, not committed. Final qualification evidence: `test-results/workflow-taps-qualified/`.

For preceding base e1, [PR browser run 37114072938](https://github.com/AlphaCompute/alphaphone/actions/runs/37114072938) passes 1,190 main flows and nine additional native-shaped voice flows, with 12 explicit host-journal/real-agent recording/TTS skips. Its actual merge checkout `15fd3e1bf37855f6435190d92178d3c1951b7ece` has the same tree `c763e5b51beb16b54f84d5b1222ddde5c333e377` as e1. [Push 37114072493](https://github.com/AlphaCompute/alphaphone/actions/runs/37114072493) has one test-only failure: the renderer legitimately republishes a navigation marker between separate removal and query tasks. The correction keeps deletion and the unchanged native query in one browser task and still requires null while the marker is absent; five isolated repeated rendered checks pass. Failed and successful logs plus tree comparison remain in `test-results/mock-readiness-e1/`. These are previous-revision results, not hosted qualification of this candidate.

## Scope and remaining gates

This establishes actual native notification/Activity routing and encrypted queue recovery, plus rendered authenticated-resolution checks. It does not establish real hosted workflow delivery, notification routing across an independently killed app process, all channel/lock combinations, physical-device behavior or visible Computer Use acceptance. The resident worker failure and live-provider gates remain open.

The existing delivery ledger and route ledger retain at most 512 identities, subject also to encrypted-slot size limits. They fail closed instead of evicting pending or deduplication history. User-facing capacity recovery/export is not implemented; this is not an unlimited lifetime delivery claim. The required CI recovery campaign now includes this exact opt-in method for both distributions and grants notification permission only in its owned phase. Its settled-user switch gate is covered by 48 supervisor/switch scenarios. Required verification and both Android builds pass again after that CI change, with unchanged native/app/test source. Fresh hosted results remain pending. Full MVP completion is not claimed.
