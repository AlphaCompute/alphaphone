# Archived Eliza patches

Alpha consumes the merged upstream pin in `upstream.lock.json`. No local runtime
or native patches are applied. New generic changes belong in upstream PRs.

The 70 former patch files, their manifests and generated exports are recoverable
from commit `d31f364d7d46cd491334d11933a96ab67f414a6a`. The hash, upstream PR and merge
ledger is [docs/upstream-patch-map.json](../../docs/upstream-patch-map.json).
For example, `git show d31f364d7d46cd491334d11933a96ab67f414a6a:patches/eliza/0001-durable-device-actions.patch`
reads a preserved original.

Archival means these unused source artifacts are no longer build inputs. It does
not establish runtime, AOSP or device acceptance. Remaining qualification is
recorded in [the migration report](../../docs/upstream-patch-migration.md).
