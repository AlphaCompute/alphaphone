# Eliza phone integration patch series

Apply this series to a clean Eliza checkout at commit `4573712ebf0466daa4dfadaa4482704c209d9b8c`. This is the exact reproduction base, not the Alpha product's existing vendor pin. Do not apply a historical mixed Cloud review artifact as an additional patch: its resolved upstream changes are already represented by0020.

`mvp-source-base.json` records the source repository, base commit, exact patch hashes, ownership paths and final hashes for all102 changed files. `mvp-series` records all35 patch filenames in order. Verify patch hashes against the manifest, check the clean base commit, then apply each entry sequentially. For each entry, `git apply --check` must succeed before `git apply`. Stop on any mismatch; do not use reject files, fuzzy manual application, or silently substitute a newer base.

The sequence includes device actions, local voice/Whisper routes, workflow approval/lifecycle/compiler support, Calendar/Notes, hosted digests, Cloud runtime proof and session primary reads, managed Gmail Inbox, Google delegation, managed owner provisioning, qualification formatting, the SDK app-auth export, validated Google response shapes with malformed-response HTTP coverage, conversation-title preservation across reconnect and restart, and versioned portable workflow approval presentation with legacy compatibility. Runtime keys, credentials, deployment configuration and account authorization are not supplied by these source patches. Synthetic test identities are fixtures, not production accounts.

After application, compare all manifest file hashes and run the repository's required owning checks and full verification using its pinned toolchain. The export has passed exact source replay against the stated base; it does not itself certify final root checks, a deployed runtime, provider account permissions, Android flows or device acceptance. Any final verification evidence must name the exact resulting source snapshot.

The Alpha vendor pin `760ad0f18ad6e34581f696642434215e397ccbc5` differs from the reproduction base in88 committed files. Those unrelated base changes are deliberately excluded. Applying a series successfully to another base is insufficient to claim identical code or behavior. Integrating into that vendor pin or a newer upstream commit requires a separate reviewed port and verification.

The composed source snapshot `43774cecbaa36b5acec4ffda84fec6271a66493db88acd09bfcb8f373a3c7d36` passes284/284 root verification tasks and postchecks. Evidence remains local in `test-results/title-live-qualification-staging/qualification.json`; this does not establish deployment or device acceptance. Older unnumbered patches in this directory are historical review artifacts and must not be applied in addition to `mvp-series`.

The31-patch composed source snapshot `b9d9c3ce077d4abd950cfabf0dfa05b91b1d4b4c4b85f51805388692a9f90e78` passes full root verification and five real HTTP/PGlite/Smithers approval cases (92 assertions). The existing local and remote runtime snapshots are unchanged by exporting source. That historical authoring test returns a known fixture from its model stub; the later33-patch live evidence below is separate.

The33-patch composed source snapshot `c801276cabd3fff6a1ad0d47ec0cb2b8e08ea855b3109ca42d984800aa47dc8a` adds bounded semantic validation of generated workflow source, one model repair, and an exact public Approval/AgentGenerateOptions contract. Production-only source/dist qualification covers12 cases; seven HTTP/PGlite/Smithers integration cases pass144 assertions, and full root verification passes. See `test-results/authoring-api-candidate-integration/QUALIFICATION.md`. Canonical replay matches29,565 source entries with98 changed files.

The same33-patch source also passed an actual local Cerebras-generated workflow: reviewed canonical approval, one deterministic result56, and receipt-preserving fixture removal. `test-results/authoring-api-live-qualification-staging/final-readback.json` reconciles the original run without replay; `RESULT.md` retains the harness contract failures and precise limits. This is local live inference evidence, not enclave or Cloud acceptance.

The34-patch snapshot `e1c0f2e92d10b6844ae73cdbeba89ab40a42db80be55655b575eb3e2c41bbaf5` adds capability-negotiated selected reminder read/update/complete/snooze/cancel with owner/target/revision binding. Full root284/284 and postchecks pass using the documented qualified alias-read baseline; owning HTTP/PGlite, types and lint pass. Exact replay covers29,566 top-level entries and99 changed files. See `test-results/reminder-candidate-integration/QUALIFICATION.md` for retained fresh-install and initial baseline failures. This source export does not establish live paired reminder or Android acceptance.

The35-patch snapshot `f1129550bdcaf6994bdca4043493d333921530f87954434776c81b644434a3d4` adds generic explicit-null action schema conversion and argument validation, including nullable selected-reminder recurrence. Full local root284 tasks and postchecks pass; catalogue and existing device-action flows pass. Canonical replay exactly matches29,567 top-level entries and102 changed files. The first34 patch files remain byte-identical. Evidence: `test-results/null-schema-candidate-integration` and `test-results/null-schema-canonical-export-staging/reproduction.json`.

The preceding e1 live reminder run failed on the nullable schema and its Linux full verification failed at Cloud-e2e with279/283 tasks passed before a9.5GiB cgroup OOM. Its separate Linux app-host build passed. Those retained failures do not qualify the35-patch correction: corrected-source live paired reminders, Linux verification, Cloud/enclave deployment and full MVP acceptance remain open. No vendor checkout is changed by this export.

### Embedded workflow execution location

The consumer patch `workflow-runtime-location.patch` removes hard-coded Cloud
ownership/health from workflow status, automation status and service metadata.
Execution is embedded in the current agent runtime (`eliza://workflow`), whether
that agent runs on Android, a browser-development host or an optional remote host.
`mode: local` is relative to the agent process; it does not claim that the caller
and agent share a device or that text-model inference is local. Both authoring
and embedded execution services must be registered before status reports ready.
