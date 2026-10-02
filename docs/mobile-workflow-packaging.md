# Mobile workflow packaging audit

This is an implementation gap, not a device acceptance result. The user's primary executor is the Android-resident agent; Nitro is not a prerequisite. Android builds remain excluded from this browser-focused pass.

The inspected source is the prepared `artifacts/local-agent-digests` checkout, composed from the checked-in runtime and consumer patch manifests. The browser host successfully runs the workflow plugin. Its temporary-database integration test passed two wall-clock scheduled occurrences across restart with one persisted result each. That result does not prove the mobile payload can execute those workflows.

## Concrete missing boundaries

| Boundary | Current source evidence | Required implementation and verification |
| --- | --- | --- |
| Runtime plugin selection | `packages/agent/src/runtime/plugin-collector.ts` filters mobile plugins against core, views, platform and model-provider allow-lists. Its lean-chat workflow opt-in applies only off-mobile. | Add an explicit mobile workflow opt-in after the full dependency closure is staged. Preserve both workflow disables and the mobile exclusions for desktop actuators. Verify selected plugins for Android, browser and disabled profiles. |
| Bundle entry | `packages/agent/scripts/build-mobile-bundle.ts` maps `@elizaos/plugin-workflow` to `null-plugin.ts`. Its comment identifies generated catalogs and the workflow graph as excluded dependencies. | Replace the stub with an explicit mobile-capable workflow entry and stage every referenced catalog/resource. Verify bundle initialization and actual service/route availability; a successful build alone is insufficient. |
| Worker package resolution | `plugins/plugin-workflow/src/services/smithers-runtime.ts` calls `import.meta.resolve` for package JSON, creates workflow-local `node_modules/smthrs` and `node_modules/zod` links, and resolves Effect through Smithers. Control workers also import `@smthrs/engine/cancel-subtree`. | Ship a pinned, manifest-verified worker dependency closure or a tested bundled worker format that preserves dynamic workflow imports and Smithers' exact Effect instance. Test in a directory without access to the developer checkout or host `node_modules`. Do not replace the engine with simulated execution. |
| Worker executable and loader | The executor spawns `BUN_BIN` or `process.execPath` directly. The Android service launches its main runtime through a shell launcher using packaged Bun/musl artifacts and a native-library search path. Worker/control environments currently omit `LD_LIBRARY_PATH`. | Implement and test an explicit native worker launch contract using packaged executable paths and the necessary loader/library environment. Do not assume the main process's launch mechanism automatically applies to child workers. Confirm both normal execution and approval/cancel control commands on Android before accepting this boundary. |
| Runtime paths and updates | `PLUGIN_ROOT` derives from module location. Generated workflow source and `runs.sqlite` live under a per-tenant/workflow state directory; package links refer to resolved installed packages. | Resolve read-only packaged resources separately from writable state. Verify process restart and application update with changed installation paths, including dependency-link recovery and retained pending approvals. Never rely on the source checkout layout. |
| Results and lifecycle | Resident results now use the local client and encrypted Android connection storage while the app is open. Remote background polling requires a different configured session. | Package the engine before qualifying native foreground sync. Implement resident background result delivery separately, retaining owner/session checks and commit-before-ack behavior. Test stop, process death, reboot, permission changes, network loss and device power constraints. |

## Implementation order

1. Build the worker dependency/resource artifact and verify it in an isolated host directory, using the same pinned engine and reviewed phone-operation protocols as browser development.
2. Implement the packaged worker launch and path contract, with distinct resource and state directories. Exercise run, approval, denial, cancellation and recovery through that contract.
3. Enable the mobile plugin and remove its bundle stub only when those artifacts and contracts are present. Keep missing payloads visibly unavailable.
4. Run source/contract and browser checks. A later authorized Android qualification must cover both variants, actual native process/IPC behavior and physical-device acceptance; do not infer those results from the host tests.

Open product boundary: an on-device executor cannot execute while the phone is powered off. Current digest scheduling skips missed occurrences rather than replaying a backlog. A different catch-up policy or optional remote executor requires an explicit product decision and separate implementation evidence.
