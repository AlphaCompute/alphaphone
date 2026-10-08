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
