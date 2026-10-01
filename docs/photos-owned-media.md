# Owned Photos collections and trash

The production Photos adapter uses Android MediaStore for this package's published
images and videos only. Selected external images continue through explicit picker
grants. These collection operations add no broad photo-library permission.

Favorites (Android 11+) sets `IS_FAVORITE` on an active owned row and verifies the
returned generation and value. Videos and Favorites are native query predicates
applied before the 24-item page limit. The existing prototype album tiles, album
grid and viewer controls remain the UI. Custom albums are separate local metadata described below. Image analysis is not
implemented by these collections.

Recently deleted uses `IS_TRASHED`, with Android's actual expiration metadata.
Restore and Undo retain the original bytes. Mutations change the selected-object
revision; trash removes active read/share access and revokes owned video grants.

Delete all first captures an immutable list of owned trashed row IDs and generation
numbers. The existing confirmation sheet displays that snapshot's count. Its
opaque single-use token expires after two minutes and is never persisted or
replayed after process restart. Confirmation deletes only rows still owned,
trashed, and at the same generation. Newly trashed rows are excluded; changed or
restored rows are skipped. The UI preserves a partial-result status and reloads
remaining rows. More than 500 rows is explicitly unsupported in one confirmation.
Cancel has no media side effect. Android trash/favorite operations require API 30.

Pending native verification for this source revision:

- `PhotosTrashInstrumentedTest` (5 tests): real trash/Undo/recreation/exact bytes;
  older-than-first-page favorite query, UI unfavorite and recreation; immutable
  permanent-delete snapshot, Cancel, changed-row receipt, single-use token, and
  newly trashed row exclusion. Permanent-delete test refuses to run its destructive
  flow if app-owned trash is not initially empty and cleans up only its own URIs.
- `VideoInstrumentedTest` retains real camera recording, decoded playback and
  exact byte-range checks; its recreation step now opens the exact recorded ID
  through the Videos album and plays it again.

TypeScript checking is source validation only. APK/lint checks and both-flavor
native execution are owned by the coordinating build/test run; these additions
have not yet been claimed as device-tested.

## Custom albums (source for build 63)

The reference has custom album tiles and detail grids, but its creation path is a
simulated agent command. Production does not execute that handler. Explicit local
Photo info → Add to album → New album creates an album with the selected owned
asset. The same sheet adds/removes membership; the custom album's Manage control
renames it or asks for confirmation before deleting only the album. These
conditional controls reuse prototype typography, spacing and sheet tokens; the
unopened reference layout is unchanged.

Native private preferences persist up to 24 albums with up to 200 members each.
Every write commits before returning a receipt and compares the album revision.
Adding an item also validates its exact current media mutation revision and
ownership. Membership stores ID, original creation time/size and MediaStore
GENERATION_ADDED; changing favorite/trash state does not change that original
identity. Queries revalidate ownership and identity before pagination, hide
trashed items, and reject deleted/replaced assets. Restore can reveal the same
original member again. Album deletion never deletes media. Names and member
contents are not added to agent context; no album proposal capability is claimed.
External picker items remain outside these owned-media albums.

The new full-flow test creates only unique fixture media/albums, uses actual
renderer controls to create/rename/remove/add/cancel/delete, recreates the Activity,
checks stale revision rejection, trash/restore membership and exact unchanged
media bytes. Cleanup filters only the unique test album names and exact fixture
URIs. Native execution remains pending for this source revision.

Build 62's permanent-delete test exposed a receipt-classification issue: a restored
snapshot row produced a failed receipt rather than a skipped receipt (zero rows
were deleted). Build 63 reads the exact owned row including trash before deletion
and classifies missing/restored/changed generations as skipped. The delete itself
still enforces the immutable generation predicate for races. The test now reports
receipt counts before indexing and retains its independent restoration checks.

## Cross-surface mutation audit (source for build 64)

Album read/modify/commit now holds one process-wide lock, because the main and
assistant Activities have separate plugin workers but share durable preferences.
The album revision comparison is inside that lock. A successful native mutation
still persists after explicit user approval, but its late renderer receipt may
close/update selection only if the original manager is still active. It cannot
dismiss a new manager opened after leaving Photos.

The additional native flow starts both real Activities and dispatches album
writes through their actual Capacitor bridges. A bounded test-owned hold of the
same lock proves both workers reached the serialization boundary before release;
both distinct albums must persist. The second phase sends a rename through the
actual UI, leaves/reenters while the real worker waits, opens a new info sheet,
and verifies the committed rename does not dismiss that new sheet. Cleanup uses
only unique fixture names/UUIDs under the same lock. No mocked native receipt,
renderer production hook, or model inference is used. Execution is pending.

Build 64 native execution reached two further pending-state issues. The UI cleared
its prepared trash snapshot before awaiting deletion, hiding confirmation before
receipt; build 65 retains the disabled confirmation until the native result. The
absence assertion remains unchanged. The concurrency test proved both Activity
writes persisted, then exposed Back being consumed indefinitely while an album
write was pending. Build 65 allows closing that management sheet and navigating
away while the approved write continues; it makes no cancellation claim and the
manager-identity check still protects a newly opened sheet from late completion.
These fixes require the next native run.

## Owned multi-selection and sharing (source for build 66)

Long-pressing an owned library/album thumbnail enters the existing prototype
selection state; tapping toggles items, up to 20. The existing single-item Android
picker remains the Select photos action. Share selected validates every unique
owned, active row and its mutation revision before opening Android's real
ACTION_SEND_MULTIPLE chooser with matching ClipData and read-only grants. A stale
item rejects the whole selection instead of silently sharing a subset. The chooser
is not a delivery receipt. Cancel selection and leaving Photos clear the local
selection; no media is uploaded to the agent. Batch favorite/delete controls state
that they are unavailable and have no side effect.

`PhotosMultiShareInstrumentedTest` uses actual native long-press/tap input on three
unique JPEG fixtures. It checks the real chooser intent contains exactly two
selected URIs and no write grant, cancels, verifies all original bytes, then picks
the test APK's separate-UID recipient and verifies both hashes/count and exclusion
of the neighboring fixture. It also changes one selected row's real generation
and requires sharing to reject before opening another chooser. The existing
single-item receiver behavior remains supported. Typecheck passed; native build
and both-variant execution are pending.
