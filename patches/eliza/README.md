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
TypeScript from the same directory. When the change lands upstream, update the pin, delete the
patch and its manifest, and point consumers back at `vendor/eliza`.

| Patch | Upstream scope | Status |
| --- | --- | --- |
| `0038-password-manager.patch` (`password-manager-source.json`) | Adds `plugins/plugin-native-passwords` (vault client, Android Autofill provider, fill/save activities, JVM and instrumentation tests) and extends `plugin-native-secure-store` (`PasswordVaultStore.KeyPolicy`, named multi-binding entries, unrecoverable-vault reset, `PasswordFacets`, `PasswordVaultFrame`, tests); registers the new package in `packages/scripts/native-capacitor-scaffold.json`. | Candidate for elizaOS `develop`; not submitted upstream. |

## Reference-only Gmail patch

`0037-gmail-inbox-read-state.patch` (base `3cca1ee4f1f1e4cd417de7272ba5195263dcb63b`) adds the
reviewed managed Gmail inbox-v1 kinds `mark-read` and `mark-unread`, `capabilities.readState`,
and additive migration `0535_managed_gmail_read_state_operations` (widens
`managed_gmail_operation_receipts_kind_check`). It has not been upstreamed or deployed to
Eliza Cloud. Until it is, servers omit `readState`, and the client treats that as false.

This patch changes only Eliza Cloud server code (`packages/cloud`), which the phone does not
build. Its manifest is deliberately named `*-source-base.json`, not `*-source.json`, so a client
patch materializer that reads `*-source.json` manifests does not apply it to client source.

## Apply and test

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
