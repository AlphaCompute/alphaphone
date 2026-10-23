# Linux laptop handoff — 2026-10-23

Start with `codex/nubs-linux-laptop` in AlphaCompute/alphaphone. Its parent is tested candidate `6bb4d65b16af6f5c06988529214dd66ff484d2b7`; this checkpoint adds only this handoff and its archive index. The matching elizaOS/eliza branch points to the exact SDK pin `f931082ebd87a0fecc3f11f8eacf58f598294d4a`.

```sh
git clone --branch codex/nubs-linux-laptop --recurse-submodules https://github.com/AlphaCompute/alphaphone.git
cd alphaphone
npm ci
```

Use Node24.15.0, Bun1.4.2 and the repository README. For real browser Cloud QA, prepare the pinned SDK/dependencies with the documented agent preparation workflow, then `npm run dev:cloud`. It disables simulated surfaces and normally opens port5318. Sign in normally on the new computer; account credentials and sessions were deliberately not published. Default `npm run dev` enables development/test surfaces and is not live Cloud acceptance.

For Android, follow README's explicit Cloud runtime profile: prepare the pinned agent and workflow worker, stage with `--runtime-profile=cloud`, regenerate packaged licenses, then build with `--runtime-profile=cloud`. Default native speech inputs are a different profile. Do not invent model receipts or substitute mocks.

## Architecture and current result

The agent, notes, history and approvals stay on the device/computer. Eliza Cloud supplies Cerebras text and Cartesia voice using account balance. Do not provision a dedicated Cloud agent or container. The separate billed Active Compute observation remains deferred.

All four Alpha fixes are already pushed to [draft615](https://github.com/AlphaCompute/alphaphone/pull/615): finite plan diagnostics, pending-notification recovery, production assertion correction and verified canonical organization-credit admission. [Hosted browser CI](https://github.com/AlphaCompute/alphaphone/actions/runs/40012303056) passed all four shards, verification and production checks. Local verification:1809tests,1804passed,0failed,5skipped. Normal supported Cloud-profile archive built both variants/sixAPKs and passed1275Gradle tasks.

Actual accepted Android candidate: existing credit account, exact saved note and all six permission choices survived full no-snapshot cold startup. Agent connection showed Running on this device / Eliza Cloud. Native Android share chooser and exact local email draft passed. Browser permission setup, note reload persistence and local email draft passed. No email was sent.

## Known blockers — do not mark complete

- Notes AI returned Cloud400 and an apology. The exact cause is unresolved; current deployed legacy catch lacks reviewed safe provider diagnostics. Do not guess that the gateway400 proves a Cerebras rejection.
- Notes dictation recorded/uploaded real emulator input but received no provider-attested transcript. Exact deployed STT route ignores explicit provider choice and omits `X-Eliza-STT-Provider`; the client correctly refuses it. Existing merged [Eliza37013](https://github.com/elizaOS/eliza/pull/37013) already fixes that contract. Do not duplicate the patch or weaken the client check. A later approved backend release and real retest are required.
- Google is the Debian QA lane. Phone/SMS, email and genuine new-account signup still require MacBook acceptance.
- No merge or deployment is authorized. Draft status remains intentional.

## Preserved historical work

[linux-laptop-archive.json](linux-laptop-archive.json) lists separate remote `codex/nubs-linux-laptop-archive/*` branches. They retain local-only commit tips and exact snapshots of four dirty checkouts, including old dependency experiments, a provider-diagnostic test, historical admission docs and generated notices. They are backup/review material, not new product fixes; do not merge them wholesale into the tested candidate. Other inventoried source tips are already reachable from existing remote branches.

The Alpha-branded Cloud login source is also on elizaOS/eliza's existing `codex/alpha-cloud-sign-in-review-20261019` branch. Its separate deployment and acceptance were not claimed complete. Local edits and original branch/checkouts on Debian were not reset or cleaned to make this backup.

Credentials, browser profiles, emulator disks, private logs, downloaded live backend source, recordings and local screenshots stay on Debian. They are not needed to clone the source or continue development. Reauthenticate on the MacBook rather than copying account keys. Existing user notes inside the emulator are not transferred by Git.
