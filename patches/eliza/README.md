# Pending Eliza patches

Shared code comes from the reviewed commit in `upstream.lock.json` and
`vendor/eliza`. Never edit that checkout. Delete a patch and its manifest when the
pin includes its merged replacement, and switch consumers to authenticated upstream
source.

## Applied candidates

| Patch | Shared scope |
| --- | --- |
| `0038-password-manager.patch` | Password vault, native Autofill provider and renderer client |
| `0048-contracts-runtime-capabilities.patch` | Runtime capability contracts |
| `0065-browser-speech.patch` | Browser speech worker, recognizer and microphone admission |
| `0066-local-speech-deterministic-synthesis.patch` | Deterministic local Piper synthesis |

Each applied patch has a `<topic>-source.json` manifest with its pinned base,
patch hash, authenticated source paths and full output hashes. Export staged
changes from a separate checkout at the pin with:

```sh
node scripts/export-eliza-patch.mjs NNNN-topic /path/to/authoring-checkout "qualification status"
```

`npm run upstream:prepare-client` applies the series into `.eliza/patched`, checks
its complete file inventory and replaces that generated cache atomically. Pin
changes require requalification. Gradle and renderer imports use the authenticated
output; they never patch the submodule.

Server-side changes under `packages/contracts`, `plugins/plugin-assistant` and
`plugins/plugin-workflow` use `scripts/eliza-patch-overlay.mjs` during resident
agent and worker builds. The overlay records every original file before changing
it and restores the pinned bytes afterward. An interrupted overlay must be
restored with `node scripts/eliza-patch-overlay.mjs --restore` before another build.
Worker and runtime provenance must agree on the patch set.

## Reference candidates

Reference patches have `<topic>-source-base.json` manifests and are not applied to
Alpha's build. They are reviewed and tested in isolated upstream checkouts:

- `0060-password-transfer.patch`: password import and export.
- `0077-action-journal-android.patch` and `0078-action-journal-client.patch`: action journal.
