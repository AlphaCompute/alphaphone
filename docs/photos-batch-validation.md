# Owned Photos batch favorite and reversible trash

Source implementation checkpoint; native execution is pending. This does not change earlier archived Photos acceptance or establish full product acceptance.

The existing prototype long-press selection and Favorite selected / Delete selected buttons now operate on 1–20 explicitly selected app-owned image/video captures. Their layout is unchanged. Favorite selected means set every selected item to favorite, rather than toggle each item unpredictably. Delete selected moves items to Android Recently deleted; it never permanently deletes them. External picker selections are not admitted to this owned library.

`AlphaPhotos.changeMany({operation:'favorite'|'trash'|'restore',items:[{id,revision}]})` validates the entire request's shape, size, distinct IDs and bounded revision strings before any write. It then returns ordered `{id,status,item?}` outcomes. Each mutation independently queries the exact owner, media type, published state and mutation revision and updates with a generation/state compare-and-set. Verified metadata is read back and the durable media revision marker committed before reporting success. A current item already in the requested state is `unchanged`; stale/unavailable rows are `stale`; ambiguous provider/storage failures are `unverified`. Android versions without platform trash/favorite support return `unsupported`. These are partial operations, not an atomic transaction. A destroyed plugin stops attempting remaining items.

The renderer clears selected-object context and playback before starting. Verified rows leave the selection; unsuccessful rows remain visibly selected with an explicit count and cancel/reselect recovery instruction. A failed bridge response never reports batch success or automatically retries. Refresh always re-reads native state. Undo uses only items confirmed to have changed to trash and their returned fresh revisions. It cannot restore a subsequent edit or unrelated row. After navigation/recreation, durable recovery remains available through the existing Recently deleted album; an old selection or approval is not revived. A departed surface does not receive a late success toast. Existing selected-file grants are untouched.

## Native full-flow fixture

`PhotosBatchInstrumentedTest.selectedFavoritePartialTrashUndoAndRecreatedRecoveryPreserveOwnedBytes` is gated by `photosBatch=1`. Run it against each matching archived standalone/launcher debug app and test APK using the project's instrumentation runner. No build or device invocation was performed at this checkpoint.

The test creates exactly three uniquely named app-owned JPEG fixtures and exercises genuine injected long-press/touch selection and the existing rendered buttons. It checks:

- Two selected rows become favorite while the unselected neighbor does not.
- An independently changed selection causes a truthful partial trash result; only the still-current row is trashed, and active read access to it is rejected.
- The actual Undo button restores that successful row byte-for-byte.
- Native receipts preserve the exact unchanged/stale item IDs; duplicate IDs reject the entire request before any write.
- A fresh real selection can trash both rows, actual Activity recreation preserves trash, and the existing Recently deleted controls restore both.
- Original bytes and the untouched neighbor are preserved, restored media has a different selected-object revision, and all fixture cleanup is exact-URI scoped with cleanup errors suppressed onto any original failure.

Validation performed: TypeScript `npm run typecheck` and `git diff --check`. Native compilation, lint, both distribution runs and physical-device acceptance remain pending. This fixture proves Activity recreation when executed; it does not claim a distinct-process restart.
