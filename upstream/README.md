# Pinned upstream inputs

Alpha consumes the reviewed commit in `upstream.lock.json`. Runtime preparation
uses `runtime-source.json` and `runtime-consumer.json` with empty patch/override
lists. Every prepared tracked file, mode and symlink is checked against the
committed Git tree; unexpected source files are rejected.

Native Java and Calendar/Reminders plugin staging read and authenticate committed
files from `vendor/eliza`. Renderer Clock imports use that same pinned checkout.
Product package IDs, socket namespaces and the Alpha environment hook remain
explicit consumer transformations recorded in generated source manifests.

`base/eliza-app` retains its independent historical import manifest. It is not the
runtime source. Historical patch hashes and upstream PR disposition are recorded
in `docs/upstream-patch-map.json`. Source adoption does not establish APK, emulator,
live-provider, AOSP-image or physical-device acceptance.
