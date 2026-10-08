# Explicit upstream patches

`vendor/eliza` stays at the pin in `upstream.lock.json` and is never edited. A shared change
that is not yet in a reviewed upstream commit is carried here as an explicit, tested patch:

- `<name>.patch`: `git diff --cached --binary --full-index` from a separate authoring clone at
  the pin (never `vendor/eliza`).
- `<name>-source.json`: the pin (`baseCommit`), the patch SHA-256, the authenticated upstream
  `basePaths` it applies to, `addedPaths`, the `changed` files and the SHA-256 of **every** file
  in the patched output.

`node scripts/export-eliza-patch.mjs <name> <authoring-clone> "<status>"` writes both files.
`npm run upstream:prepare-client` (run by `dev`, `build`, `typecheck`, `test` and the Android
build) calls `scripts/prepare-eliza-patches.mjs`, which reads the base through the same pin and
clean-checkout admission as native staging, applies the patches in a temporary directory,
verifies the full output inventory and atomically replaces the ignored `.eliza/patched`.
A pin change refuses the patch until it is requalified; changed, missing or unexpected cached
files are repaired; Gradle `build` state inside module directories is ignored.
`test/eliza-patch-preparation.test.mjs` covers these rules.

Gradle includes patched Android modules from `.eliza/patched`; the renderer imports patched
TypeScript from the same directory. When the change lands upstream, update the pin, delete the
patch and its manifest, and point consumers back at `vendor/eliza`.

| Patch | Upstream scope | Status |
| --- | --- | --- |
| `password-manager.patch` | Adds `plugins/plugin-native-passwords` (vault client, Android Autofill provider, fill/save activities, JVM and instrumentation tests) and extends `plugin-native-secure-store` (`PasswordVaultStore.KeyPolicy`, named multi-binding entries, `PasswordFacets`, `PasswordVaultFrame`, tests); registers the new package in `packages/scripts/native-capacitor-scaffold.json`. | Candidate for elizaOS `develop`; not submitted upstream. |
