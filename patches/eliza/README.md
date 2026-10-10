# Pending Eliza patches

Shared code comes from the reviewed commit in `upstream.lock.json` and
`vendor/eliza`. Never edit that checkout. Delete a patch and its manifest when the
pin includes its merged replacement, and switch consumers to authenticated upstream
source.

## Applied candidates

None. The password manager and its encrypted custody come from the reviewed upstream pin.

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

## Reference candidates

Reference patches have `<topic>-source-base.json` manifests and are not applied to
Alpha's build. They are reviewed and tested in isolated upstream checkouts:

- `0060-password-transfer.patch`: password import and export.
