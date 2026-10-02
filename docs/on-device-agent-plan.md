# Android-resident agent — October 1, 2026

## Accepted direction

The user has replaced the Nitro/TEE agent-hosting direction with an agent running on the Android device. This supersedes the earlier cloud-only execution constraint. Nitro provisioning, enclave measurement and KMS admission are no longer prerequisites for the primary agent path. Existing remote services and evidence are retained; this decision does not authorize shutting them down or migrating accounts destructively.

The target puts orchestration, conversation state, tool policy, approvals, receipts and scheduling on the phone. The Alpha renderer remains separate from the runtime and keeps its existing native selected-content boundaries. Cloud login must not be required merely to start the local agent. External accounts still require their own consent, and external inference still requires an explicitly configured provider.

**Execution and inference remain separate.** The implemented first slice runs the agent locally with an explicitly configured hosted Cerebras model, reusing the existing provider integration. This describes the current implementation, not acceptance of a fully offline model. It must disclose that selected prompt/context leaves the device. A fully local language model needs a separately qualified engine/model, memory and thermal measurements, and offline task-quality evidence. On-device speech remains required either way. This document does not choose or download a model.

## Current source evidence

| Component | Inspected source in pinned `vendor/eliza` | Reuse boundary |
| --- | --- | --- |
| Android process lifecycle | `packages/app/platforms/android/app/src/main/java/ai/elizaos/app/ElizaAgentService.java` | Existing foreground service, runtime extraction, restart logic and authenticated native IPC. It prefers APK-packaged JNI executables for ordinary APKs; writable-directory execution is only the privileged fallback. Alpha now stages that packaged path; device execution still needs qualification. |
| Runtime packaging | `packages/app/scripts/lib/stage-android-agent.ts` | Pinned Bun/musl/dependency artifacts and mobile agent bundle staging for ARM64/x86_64. Keep exact artifact provenance; do not install the whole desktop dependency tree on the phone. |
| Native bridge | `plugins/plugin-native-agent/android` | Start/stop/status/request/stream primitives; service locator resolves the consumer's own package. Reuse narrow exports rather than the upstream UI. |
| Renderer transport | `packages/ui/src/api/android-native-agent-transport.ts` | Authenticated request and streaming codec/reference. Extract or adapt the narrow contract without importing the entire upstream UI dependency graph. |
| Native acceptance harness | `packages/app/scripts/android-native-agent.ts` and `packages/app/test/android-native-agent` | Existing real-runtime lifecycle lane. Source existence is not a new Alpha or physical-phone pass. |

Alpha now has a native local-agent bridge, generated product-namespaced lifecycle sources, secure provider setup, explicit start/stop, and reproducible Android payload staging. Browser development uses an actual local Eliza host through a private bridge. The initial `runtimeMode: unconfigured` remains a no-connection-selected default. The separate host-forwarded DevelopmentAgent path is not on-device execution. See [setup and verification boundaries](local-agent-development.md). The vendor checkout and pristine baseline remain unchanged.

## Implementation sequence

1. **Qualify the executable packaging boundary.** Audit the mobile bundle's dependency closure and native artifacts. Prefer an APK-packaged executable/library route that works with Alpha's normal target SDK and enforcing Android policy. The existing privileged-system path is a candidate for the custom image only, not permission to grant new privileges. Do not lower the target SDK, disable SELinux or require root to make the demonstration pass. Prove the chosen path on ARM64 before claiming feasibility is verified.
2. **Add an explicit on-device connection mode.** Separate it from Cloud, remote pairing, mock and host development. Expose starting, ready, stopped, recovering, failed and provider-unconfigured states. Use native-owned authenticated IPC, cancellation and streaming; no unauthenticated localhost port or credential storage in renderer localStorage. Browser development uses the real local host through a clearly disclosed development bridge and cannot report a real Android process.
3. **Run the existing agent core with a bounded MVP plugin set.** Preserve the current product feature profile. Keep model credentials in native secure storage; bind local owner/agent identity and persisted data independently of a Cloud session. Reuse the canonical approval/receipt protocols and database rather than creating a second mock agent, scheduler or note store.
4. **Connect device tools directly through reviewed proposals.** Retain selected-object identity/revision, explicit approvals, account isolation, cancellation epochs and unknown-outcome handling. Exercise Notes, Calendar, Reminders, selected Files and browser reading through the existing adapters. Local execution does not grant blanket access to every app or page.
5. **Define lifecycle and schedule recovery.** Persist workflow occurrences and results before acknowledging them. Handle app backgrounding, user stop, process death, reboot, lock state, network loss and battery restrictions. A foreground service is not an immortal process; start/restart must obey Android lifecycle rules. Show unavailable/missed/catch-up status honestly.
6. **Reconcile onboarding and design.** Make on-device startup the primary path once available. Keep optional account/provider setup separate. Replace enclave claims with factual runtime location, provider route, storage and capability status; never claim all data stays local when hosted inference is selected.
7. **Qualify and publish.** Browser contract tests and repository verification first; later, both Android variants, real process/IPC provenance, offline behavior, restart/receipt correctness and physical battery/thermal/latency tests. The earlier instruction to skip Android builds remains in force for the present browser pass. Native execution cannot be accepted until a native qualification pass is authorized and completed.

## Changed acceptance requirements

| Previous gate | New disposition |
| --- | --- |
| Nitro deployment, PCR/KMS identity and enclave rollback | Superseded for the primary on-device agent; preserve historical records. Replace with signed runtime artifacts, process identity, native IPC isolation and app/runtime update recovery. |
| Cloud owner enrollment before primary chat | Optional remote path; local setup needs device-local owner/agent initialization and provider setup if hosted inference is used. |
| Two remote loops executing while the phone is powered off | Incompatible with a device-only executor. Proposed replacement: durable local schedules with explicit missed-occurrence policy and deduplicated catch-up after startup. This is an acceptance change requiring explicit agreement, not an equivalent pass. An optional remote executor would be a separate feature. |
| No local-runtime payloads | Superseded for the agent runtime. Local language-model payloads remain undecided. |
| Native tools, provider consent, speech, signed device images and user acceptance | Still required; moving orchestration does not itself complete them. |

## Platform references

Android restricts untrusted apps from executing files in their writable app home directory: [Android 10 execution changes](https://developer.android.com/about/versions/10/behavior-changes-10#execute-permission). Background foreground-service starts also have restrictions: [Android foreground-service startup rules](https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start). These are packaging/lifecycle constraints to engineer around using supported mechanisms, not reasons to retain Nitro.

Status: the local runtime integration and browser development path are implemented; the mobile bundle and native source compilation are checked. APK/device execution, lifecycle and physical acceptance remain open. The staged payload includes an embedding model but no offline text-generation model. No remote infrastructure was removed. See [current setup and limits](local-agent-development.md).

See the [mobile workflow packaging audit](mobile-workflow-packaging.md) for the remaining worker dependency, loader, resource-path and lifecycle work. The host scheduling pass does not close these device packaging boundaries.
