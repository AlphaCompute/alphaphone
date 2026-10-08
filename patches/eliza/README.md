# patches/eliza

Explicit, tested upstream patches for `vendor/eliza` (elizaOS/eliza), per `AGENTS.md`.
`vendor/eliza` stays at the pin in `upstream.lock.json` and is never edited; the submodule
moves only when a reviewed upstream commit lands.

## Convention

- `NNNN-<topic>.patch`: a `git diff --full-index` taken from one recorded upstream commit, in a
  separate authoring clone or worktree (never `vendor/eliza`). One series number names one patch.
- The historical series 0001-0036 was retired on 2026-10-03/04 when Alpha moved to merged
  upstream (`db6888a4`, `55c2944f`; see git history and `docs/app-upstream-ownership.md`).
  Numbering continues from 0037.
- Each patch must pass `git apply --check` against a clean checkout of its recorded base.

A patch has exactly one of two manifests:

- **Applied to Alpha's build**, `<topic>-source.json`: the pin (`baseCommit`), the patch
  `sha256`, the authenticated upstream `basePaths` it applies to, `addedPaths`, the `changed`
  files and the SHA-256 of **every** file in the patched output. Written by
  `node scripts/export-eliza-patch.mjs NNNN-<topic> <authoring-clone> "<status>"` from staged
  changes (`git add -A`) at the pin.
- **Reference only** (for example server-side Eliza Cloud changes), `<topic>-source-base.json`:
  the base commit, the patch sha256, files changed, the contract and the exact verification
  commands with their results. These are applied and tested only in isolated upstream worktrees.

## Applied patches

`npm run upstream:prepare-client` (run by `dev`, `build`, `typecheck`, `test` and the Android
build) calls `scripts/prepare-eliza-patches.mjs`. It reads every `<topic>-source.json`, refuses a
manifest whose pin, patch hash, paths or series number do not check out, reads the base through
the same pin and clean-checkout admission as native staging, applies the patches in series order
in a temporary directory, verifies the full output inventory and atomically replaces the
ignored `.eliza/patched`. A pin change refuses the patch until it is requalified; changed,
missing or unexpected cached files are repaired; Gradle `build` state inside module directories
is ignored. `test/eliza-patch-preparation.test.mjs` covers these rules.

Gradle includes patched Android modules from `.eliza/patched`; the renderer imports patched
TypeScript from the same directory.

Applied patches that change server-side sources built into the resident agent or the workflow
worker (`plugins/plugin-assistant`, `plugins/plugin-workflow`, `packages/contracts`) reach them
through `scripts/eliza-patch-overlay.mjs`. `npm run agent:build-workflow-worker` and
`npm run agent:stage-android` overlay exactly those files from the authenticated
`.eliza/patched` onto the prepared runtime source for the duration of the worker or agent-bundle
build, then restore the original bytes and re-run the pinned-source admission. Every overlaid
path is journalled under `artifacts/` first; an interrupted build leaves the journal and refuses
the next build until `node scripts/eliza-patch-overlay.mjs --restore`. The worker artifact and
the staged agent record their overlay (`<output>.patch-overlay.json`,
`artifacts/staged-agent-runtime.patch-overlay.json`), and staging refuses a worker built with a
different patch set. Native-only patches (such as 0038) are not overlaid.

New patches are written in a separate authoring clone or worktree at the pin (never
`vendor/eliza`), exported with `node scripts/export-eliza-patch.mjs`, and must apply in series
order on top of every lower-numbered applied patch already on `main`. Series numbers for the
current round are reserved by owner: 0039-0044 calendar, reminders and clock; 0045-0049 assistant
device actions; 0050-0054 workflow digests; 0055-0059 Gmail inbox and Cloud (reference
patches); 0060-0064 browser and password manager; 0065-0066 voice; 0067-0069 Maps; 0070-0072
settings and diagnostics; 0073-0074 media; 0075-0076 shell and launcher; 0077-0078 connection
and onboarding. A row is added to the table below when a patch lands. When the change lands upstream, update the pin, delete the
patch and its manifest, and point consumers back at `vendor/eliza`.

| Patch | Upstream scope | Status |
| --- | --- | --- |
| `0038-password-manager.patch` (`password-manager-source.json`) | Adds `plugins/plugin-native-passwords` (vault client, Android Autofill provider, fill/save activities, JVM and instrumentation tests) and extends `plugin-native-secure-store` (`PasswordVaultStore.KeyPolicy`, named multi-binding entries, unrecoverable-vault reset, `PasswordFacets`, `PasswordVaultFrame`, tests); registers the new package in `packages/scripts/native-capacitor-scaffold.json`. | Candidate for elizaOS `develop`; not submitted upstream. |

## Reference patches

These change only Eliza Cloud server code (`packages/cloud`), which the phone does not build, so
they have a `-source-base.json` manifest and are never materialized into client source.

`0037-gmail-inbox-read-state.patch` (`gmail-inbox-read-state-source-base.json`, base `3cca1ee4f1f1e4cd417de7272ba5195263dcb63b`) adds the
reviewed managed Gmail inbox-v1 kinds `mark-read` and `mark-unread`, `capabilities.readState`,
and additive migration `0535_managed_gmail_read_state_operations` (widens
`managed_gmail_operation_receipts_kind_check`). It has not been upstreamed or deployed to
Eliza Cloud. Until it is, servers omit `readState`, and the client treats that as false.

### Apply and test (0037)

```sh
BASE=3cca1ee4f1f1e4cd417de7272ba5195263dcb63b
git -C vendor/eliza worktree add --detach /tmp/eliza-0037 "$BASE"
cd /tmp/eliza-0037
git apply --check /path/to/patches/eliza/0037-gmail-inbox-read-state.patch
git apply /path/to/patches/eliza/0037-gmail-inbox-read-state.patch
bun install --frozen-lockfile   # or provide lockfile-pinned pglite/drizzle-orm/hono
cd packages/cloud/shared
bun test src/lib/services/agent-google-connector/inbox-provider.http.integration.test.ts
node ../scripts/shared/check-migration-prefix-order.ts
cd - && git -C /path/to/vendor/eliza worktree remove --force /tmp/eliza-0037
```

The tests use synthetic tokens, a closed in-process fetch transport and PGlite. They make no
Google network calls.
