# Mobile workflow packaging audit

This is an implementation gap, not a device acceptance result. The user's primary executor is the Android-resident agent; Nitro is not a prerequisite. Android builds remain excluded from this browser-focused pass.

The initial audit inspected `artifacts/local-agent-digests`; the launch/storage patch is now reproduced in `artifacts/local-agent-workers`, composed from the checked-in runtime and consumer patch manifests. The browser host successfully runs the workflow plugin. Its temporary-database integration test passed two wall-clock scheduled occurrences across restart with one persisted result each. That result does not prove the mobile payload can execute those workflows.

## Concrete missing boundaries

| Boundary | Current source evidence | Required implementation and verification |
| --- | --- | --- |
| Runtime plugin selection | `packages/agent/src/runtime/plugin-collector.ts` filters mobile plugins against core, views, platform and model-provider allow-lists. Its lean-chat workflow opt-in applies only off-mobile. | Add an explicit mobile workflow opt-in after the full dependency closure is staged. Preserve both workflow disables and the mobile exclusions for desktop actuators. Verify selected plugins for Android, browser and disabled profiles. |
| Bundle entry | `packages/agent/scripts/build-mobile-bundle.ts` maps `@elizaos/plugin-workflow` to `null-plugin.ts`. Its comment identifies generated catalogs and the workflow graph as excluded dependencies. | Replace the stub with an explicit mobile-capable workflow entry and stage every referenced catalog/resource. Verify bundle initialization and actual service/route availability; a successful build alone is insufficient. |
| Worker package resolution | `plugins/plugin-workflow/src/services/smithers-runtime.ts` calls `import.meta.resolve` for package JSON, creates workflow-local `node_modules/smthrs` and `node_modules/zod` links, and resolves Effect through Smithers. Control workers also import `@smthrs/engine/cancel-subtree`. | Ship a pinned, manifest-verified worker dependency closure or a tested bundled worker format that preserves dynamic workflow imports and Smithers' exact Effect instance. Test in a directory without access to the developer checkout or host `node_modules`. Do not replace the engine with simulated execution. |
| Worker executable and loader | The new process contract uses the service's `LD_PATH`, `BUN_PATH` and `LD_LIBRARY_PATH` on Android; browser development retains its Bun executable. Host tests cover both worker and control paths. | Stage and extract the verified artifact at the expected resource path, then confirm actual loader execution and approval/cancel control commands on Android. The tested host contract is not native process acceptance. |
| Runtime paths and updates | The new contract separates Android packaged dependencies under `AGENT_ROOT/workflow-worker` from state under `ELIZA_STATE_DIR/smthrs`; browser state stays compatible. Stale dependency links are replaced atomically. | Host integration now verifies an installation-directory move with pending approval and retained SQLite state. Qualify real app-update/extraction behavior and native restart without relying on a source checkout. |
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

This closes the demonstrated dependency-resolution, control and replay prerequisites on the host. Artifact staging and extraction are now implemented below. Mobile plugin enablement, Android executable/loader execution, lifecycle and physical-device acceptance remain open.

## Packaged executor launch and storage

`packaged-workflow-worker.patch` now adds a shared process contract to both the workflow executor and control worker. On Android it consumes the service's absolute `LD_PATH` and `BUN_PATH`, passing Bun as the loader's first argument; it forwards `LD_LIBRARY_PATH` and the five native Bun compatibility flags. It rejects missing or relative native paths and library search paths. Both launch modes disable automatic package installation and retain a filtered environment without provider or owner credentials.

Android resolves dependencies from `$AGENT_ROOT/workflow-worker` and durable workflow state from `$ELIZA_STATE_DIR/smthrs`. Explicit absolute `ELIZA_SMTHRS_RUNTIME_DIR` and `ELIZA_SMTHRS_STATE_DIR` overrides support packaged host qualification. Browser development retains ordinary Bun execution and its existing `<cwd>/.eliza/smthrs` databases. A missing packaged dependency fails rather than falling back to a source checkout. Existing dependency symlinks are replaced atomically after installation paths change; ordinary directories are preserved and cause an explicit failure.

Host contract tests verify native arguments/environment, rejected configurations, browser compatibility and stale-link recovery. The real patched executor test parks an approval, moves and removes the old dependency installation, restores the pending workflow, approves it and verifies one model-bridge call across replay. It also exercises denial and cancellation through the executor. These are host tests of actual worker processes, with synthetic model output. They do not prove that the Android loader executes on a device. Plugin enablement and native qualification remain open; the following section records the implemented artifact staging and extraction.

## Worker staging and native extraction

`agent:stage-workflow-worker` now validates the prepared source and artifact, matches source-stamp and lock hashes, checks all file hashes, rejects extra/missing files and symlinks, and enforces a 64 MiB payload and 1 MiB index limit. It stages `android/app/src/main/assets/agent/workflow-worker` with a bounded `files.sha256` extraction index. Full runtime staging validates this prerequisite before building its mobile bundle and stages the worker afterward. This pass invoked only the independent worker stage; it did not build a mobile bundle or APK.

`WorkflowWorkerAssets` is a product-owned Java helper called from native startup. It verifies every indexed file before replacing the previous worker directory, keeps the prior artifact intact after a corrupt or missing input, rejects traversal and duplicate paths, and cleans incomplete staging directories. It sets the packaged resource path only after extraction succeeds. The mobile workflow plugin is still disabled.

The new artifact contains 115 hashed files plus its manifest, totaling 8,315,153 bytes. Host-JVM tests exercised all 116 actual files, update replacement and corruption recovery. Focused regressions cover source/lock drift, missing/extra files, symlinks, traversal, duplicate entries and size limits. The rebuilt worker also passes real isolated approval, denial, cancellation, signal and replay tests. These checks exercise the native helper on the host JVM; Android `AssetManager`, service startup, loader execution and device behavior remain unverified.

The enablement audit found two additional required subprocess paths: the approval receipt reader and semantic source checker. The receipt reader is now addressed below. `workflow-source-check.ts` still launches Node with TypeScript and resolves package declarations from the source layout; that compiler/declaration dependency closure must be staged and tested before enabling local workflow authoring on Android. The bundler's historical generated-catalog comment is not sufficient evidence of the current dependency graph; the current source uses the typed phone capability catalog. Bundle qualification must follow the actual imports and semantic compiler requirements.

## Packaged approval receipts

`packaged-approval-receipts.patch` moves the canonical receipt reader onto the same loader, filtered environment and packaged working directory as execution/control workers. It resolves Effect through Smithers in both default-source and packaged modes, disables automatic package installation and retains read-only SQLite access. Streaming UTF-8 decoding prevents split multibyte output from corrupting receipt text. The integration regression fails with the old reader (`Approval store unavailable`) and passes with the patch. It verifies pending, approved and denied receipts; Unicode review text; stable request digests after moving the artifact; no model execution during receipt reads; and actual subprocess working directories. Deliberately replacing the saved workflow source with code that throws does not affect receipt reads, proving this path does not import the draft/workflow module. A fresh `artifacts/local-agent-receipts-final` source composition passes all nine runtime tests (94 assertions); dependency installation used the frozen lock with install scripts skipped. Local evidence is retained under `test-results/workflow-worker-receipts/`.

A declaration-graph probe with the installed TypeScript 6.0.3 found 873 source/declaration files totaling 15,962,427 bytes across 45 package versions, with zero diagnostics for Smithers/Zod imports. This is a sizing result for the next compiler-packaging step, not a packaged semantic-check pass. Compiler JavaScript, declaration resolution, negative source checks and native launch must still be implemented and qualified.

Open product boundary: an on-device executor cannot execute while the phone is powered off. Current digest scheduling skips missed occurrences rather than replaying a backlog. A different catch-up policy or optional remote executor requires an explicit product decision and separate implementation evidence.

The inspected parallel upstream compiler prototype also supplies useful compatibility regressions: valid approvals and supported type-only contracts pass; unavailable named/namespace runtime exports and unsupported subpaths are rejected; drafts are never executed. Production packaging must preserve those narrowed runtime-export checks rather than copying the full Smithers type surface blindly. Its broad declaration prototype has over 21,000 files and internal links, so it cannot be admitted directly by Alpha's current 4,096-entry, symlink-free extractor. Reuse the verified compatibility requirements while reducing and materializing the actual declaration graph.
