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

## Worker dependency artifact implemented

`scripts/build-workflow-worker.ts` now builds a relocatable worker dependency artifact from the authenticated prepared source and installed frozen dependencies. It retains shared chunks for Smithers, Effect and React, exposes the package paths used by compiled phone workflows and control workers, and includes the engine's dynamic React/components, graph, scheduler and SQLite imports. The manifest hashes every output file and records source-stamp and lock hashes. `dependencies.json` records bundled package versions, source paths and package-manifest hashes; available license/notice files are copied alongside it. Missing upstream notices still require a distribution review before release.

Build and exercise it without assembling an APK (Node 24 and Bun on PATH):

```sh
export ALPHA_LOCAL_AGENT_SOURCE_DIR="$PWD/artifacts/local-agent-digests"
export ALPHA_WORKFLOW_WORKER_OUTPUT="$PWD/artifacts/mobile-workflow-worker-qualified"
npm run agent:build-workflow-worker
npm run agent:test-workflow-worker
```

Choose a fresh output path for each build; the builder refuses to overwrite an existing artifact. The test verifies hashes, rejects symlinks, copies the artifact into an isolated temporary directory and runs a real SQLite-backed Smithers workflow with Bun package installation disabled. It then starts a second worker with the same run ID and database and requires both runs to finish with exactly one task execution. The fixture uses only synthetic local text and a temporary execution marker, with no provider credentials or external action.

The control follow-up adds the `approvalDecisionSchema` export required by approval workflows and exercises approval, denial, cancellation and signal delivery through fresh worker processes using the packaged artifact. Each approval run first parks, then restarts while still unapproved; the guarded task must not run. Approval resumes it exactly once, denial leaves it failed without execution, and cancellation leaves it durably cancelled after restart. A separate signal workflow parks across restart, receives a large UTF-8 payload through the real control API, and consumes the complete payload exactly once. The final artifact contains 115 hashed files. These tests use the real engine and SQLite store, not replacement control implementations. Repository verification also passes 44 checks, TypeScript and the web build; local evidence is retained under `test-results/workflow-worker-controls/`.

This closes the demonstrated dependency-resolution, control and replay prerequisites on the host. It does not stage the artifact into the mobile payload, enable the mobile workflow plugin, or establish Android executable/loader, lifecycle or physical-device acceptance. Those remain the next implementation and qualification boundaries above.

The native launch audit identified an existing contract to reuse: `ElizaAgentService` exports absolute `LD_PATH` and `BUN_PATH` plus `LD_LIBRARY_PATH`, and its main launcher invokes the loader with Bun as the first argument. Workflow workers currently spawn `BUN_BIN`/`process.execPath` directly and omit the library path and native Bun feature flags from their filtered environment. The next runtime patch should consume the existing packaged loader paths for both worker and control processes, keep browser development's ordinary Bun launch, separate packaged dependencies from durable state, and repair dependency links after installation-path changes. Host contract tests can verify arguments/environment and update recovery; native execution remains a distinct later gate.

Open product boundary: an on-device executor cannot execute while the phone is powered off. Current digest scheduling skips missed occurrences rather than replaying a backlog. A different catch-up policy or optional remote executor requires an explicit product decision and separate implementation evidence.
