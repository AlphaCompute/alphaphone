# Upstream migration review — October 9, 2026

The shared engine and native capability source belong in `elizaOS/eliza`. AlphaPhone
owns its renderer, installed storage identities, product policy and packaging. The
current source is authenticated by `upstream.lock.json`; the old app baseline is
historical provenance, not a second renderer to keep in sync.

## Directory decisions

- `base/`: retired. Keep [baseline provenance](eliza-app-baseline-provenance.json).
  `apps/app` is the AlphaPhone renderer. The upstream app supplies shared host and
  platform code; adopting its code does not replace this product's UI.
- `backend/`: the remaining four TypeScript files are a small development host:
  pinned-source loading, Alpha-specific proposal actions, provider composition and
  a live development check. They already import the shared runtime, assistant,
  provider, SQL and source resolver. Keep the product character, approved view
  list and proposal-only contract here. Moving this directory intact would put
  AlphaPhone behavior into the generic runtime.
- `android/`: keep application IDs, manifests, signing/distribution configuration,
  AOSP composition, product result checks and acceptance tests. Calendar, reminders,
  notifications, owned media, browser policies, source-host compatibility and speech
  are upstream capability owners. Keep installed aliases, AAD, filenames and bridge
  names when replacing implementations.
- `scripts/`: shared platform/source-resolution and speech tooling already come from
  the pin. Keep product release admission, APK inventories, fixture isolation and
  product acceptance campaigns here. Do not delete source-provenance checks merely
  because a server patch is no longer applied.

## Pin compatibility review

The previous `0d40aa6e` pin had commits outside upstream `develop`. Patch identity
alone was insufficient: several changes were already merged with different tests
or paths. Comparing the final source confirmed the Notes query contracts, original
chat text format, batch conversation implementation, renderer-safe voice exports
and private owner-context source. Calendar ownership policy has a newer upstream
source-admission implementation. Calendar and workflow extraction must use their
current owning packages, not restore the obsolete paths from the old branch.

Two missing compatibility changes were reproduced and migrated: native owner context
and confirmed credential shutdown ([#34729](https://github.com/elizaOS/eliza/pull/34729)),
and pull-control touch cancellation ([#34734](https://github.com/elizaOS/eliza/pull/34734)).
The native gap caused the first full APK compile to fail. Touch was tested with a
real browser reproduction that counted the unwanted compatibility click.

Deterministic local synthesis is merged in
[#34743](https://github.com/elizaOS/eliza/pull/34743). The Linux comparison passed
7/10 keyword checks with default noise and 10/10 with zero noise; only zero noise
produced identical repeated waveforms. This is host evidence, not Android runtime
qualification. The pin includes this change; patch 0066 and its overlay-copy code are retired.

## Remaining extraction

Password custody is merged in [#34755](https://github.com/elizaOS/eliza/pull/34755),
with a real encrypted-storage test. Its native UI still needs lifecycle review and
native unlock/fill evidence. Password transfer is a reference candidate, not an
admitted production feature. AlphaPhone now delegates the journal state machine to the shared engine, retaining
its result policy, Clock approval flow and one lock across both Activities. Native
validation of this adapter is still in progress. The renderer
[inventory](app-ownership-inventory.json) is an exhaustive static file inventory,
not a claim that every file has completed semantic review or migration.
