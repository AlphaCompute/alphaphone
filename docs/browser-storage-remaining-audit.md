# Remaining browser persistence audit

The transactional migrations in [browser-storage.md](browser-storage.md) do not
complete the persistence review. This audit covers independent renderer stores,
operation intents and delegated storage ports outside the canonical browser
domains. It is a source review, not a claim that every
listed path has reproduced data loss or passed concurrency qualification.

## Audit boundary

Inspect direct `localStorage` and `sessionStorage` writes together with delegated
storage ports. A direct-call count misses the product Notes wrapper, which delegates
to `plugins/plugin-notes/src/client/notes-store.ts`, and does not establish whether
readers and writers share the same authority. The table below tracks outstanding qualification and migration work alongside the
canonical browser documents described in [browser storage](browser-storage.md).

Single-value preferences are not automatically equivalent to a multi-record
journal. The required invariant depends on the stored meaning: a preference may
intentionally be last-writer-wins, whereas an uncertain external operation must
retain its exact request identity until authoritative reconciliation.

## Outstanding domains

| Domain and authoritative source | Current mechanism and concrete concern | Required implementation and exit evidence |
| --- | --- | --- |
| Browser Notes: `prototype/agent-adapter.ts`, `runtime/notes-store.ts`, upstream `plugin-notes` client store | The candidate browser adapter now uses the reviewed upstream asynchronous `DocumentNotesStore` with IndexedDB compare-and-exchange receipts. Legacy v1/v2/Daily bytes are archived without a writable mirror. Android retains its secure Notes adapter. Browser qualification is in progress. | Introduce a reviewed upstream asynchronous browser storage path while preserving collection identity, revisions, deletion tombstones, metadata and operation receipts. Update all UI/actions/readback consumers together. Prove simultaneous edits, stale edits, lost responses, migration and exact recovery across engines. Do not edit the pinned vendor checkout or claim native migration from browser evidence. |
| Note/audio deletion recovery: `runtime/note-audio-deletions.ts` | The candidate pending map uses a canonical browser JSON document and preserves the separate audio effects lock. Deletion readback uses the canonical Notes snapshot; reset also takes the effects lock. Unknown audio outcomes remain pending until explicit reconciliation or confirmed recovery reset. | Migrate the pending map without removing the effects lock. Coordinate with the Notes storage change. Preserve unknown audio outcomes, exact original snapshots and deletion tombstones; prove no duplicate audio removal and no restoration over a newer note. |
| Connection selection and Cloud environment: `runtime/connection-ui.tsx` | Individual nonsecret preferences remain in renderer storage. Credential storage is separate. Conversation restart choices now have an atomic document implementation described below. | Verify selection/environment winner semantics, cross-tab retirement, and late authentication completions. Browser conversation tests do not establish native persistence or credential acceptance. |
| Appearance and simulated location: `prototype/settings-adapter.ts`, `browser/location-simulation.ts` | Individual preference values with events/readback. These do not share the multi-record receipt semantics above. | Verify deliberate last-writer-wins behavior, malformed-value handling, cross-tab refresh and pending sensor cancellation. Migrate only if the required invariant needs stronger coordination; avoid adding a redundant writable mirror. |

## Scope distinctions

Cloud setup intents, workflow pending requests and saved-copy requests now use
canonical browser documents. Simulator reset requires the same writer lease as
its reducers. Their recovery and verification contracts live in
[browser storage](browser-storage.md); they are not outstanding migrations here.
This does not establish a passing result for every engine or live provider.

`prototype/clock-adapter.ts` uses its `alphaphone:clock-handoff:v1` record for the
native handoff UI. The browser path opens the simulated Clock directly, and mock
requests do not write the record. Audit native handoff retention separately:
completion compares an operation ID before a separate localStorage write, and
initial retention currently lacks readback. Do not present this record as an
outstanding browser Clock journal or as proof an alarm was created.

## Implementation order

1. Add an asynchronous Notes storage contract upstream and migrate every browser
   reader and writer together. The synchronous editor snapshot may remain for
   rendering, but it cannot authorize a mutation or deletion readback.
2. Move audio-deletion recovery with Notes. Preserve the separate effects lock,
   original note snapshots, unknown audio outcomes and deletion tombstones.
3. Qualify conversation restart choices in `runtime/conversation-selection.ts` and
   both history/send consumers. Writes compare the captured owner choice inside
   the canonical transaction; another owner's entry is retained. Each tab keeps
   its active chat until retirement, when in-memory choices are cleared. A failed
   restart-choice save may retain the verified chat for this session with a
   visible warning. Cache reset does not delete agent conversations or send text.
   The strengthened implementation passed TypeScript and the owning three-engine cases before consolidation; merged-source qualification is pending. Full-product and native qualification remain separate. Connection selection and
   Cloud environment preference classification remain separate.
4. Specify preference winner and refresh semantics, then verify appearance and
   simulated location against those semantics. Avoid creating redundant mirrors.

## Notes migration boundaries

`prototype/agent-adapter.ts` opens the browser store and uses its `list`, `raw`,
`replace`, `target`, `assertCurrent` and `execute` paths. Its asynchronous Android
store is already a separate adapter; preserve that native contract. Browser
`note-audio-deletions.ts` independently reads the Notes envelope to distinguish
an original note, a changed note and an exact deletion tombstone. Changing only
the editor would leave this recovery reader on retired bytes.

Keep collection and note identities, revision hashes, metadata and deletion
operation IDs unchanged. Preserve the original current, legacy and daily Notes
inputs for explicit recovery. Cover initialization races, queued editor saves,
external edits, cancellation around commit, failed acknowledgement and recovery
before replacing all browser consumers. No pinned vendor edits or writable
localStorage mirror may stand in for the upstream change.

## Qualification and remaining product gates

For each migrated domain, cover real IndexedDB write failure, two independent
pages, late owner changes, exact malformed backup, stale reset, tab termination
and retained unknown outcomes. Reuse shared transactional storage; product keys,
UI policy and recovery copy belong in Alpha. Native receipt storage must keep its
existing secure contract.

Browser and root verification qualify their exact source only. Current native
IPC, Android process/reboot/Doze behavior, real Gmail and Cloud grants, provider
revocation, installed autofill, physical speech and signed release/pilot journeys
remain separate items in [current MVP status](mvp-current-status.md). This audit neither waives those gates nor represents the MVP as complete.

## Notes implementation checkpoint

The browser candidate consumes upstream resident backport
`94eb746e1ae82612767b2c84a3fc5e7f7aabbca3`, published on
`elizaOS/eliza:codex/resident-async-notes-port-20261005`. Its four changed files
match reviewed upstream PR #33664 through `547063aab41bd8807fdde3c19411fc5fc6972c57`.
The backport passed 14 client tests, strict leaf TypeScript and owning lint.
A full upstream root verification is still outstanding; the obsolete original
root campaign was explicitly retired after the source advanced.

Product TypeScript passes. The focused 34-case browser campaign is in progress;
no browser pass is claimed yet. Added cases cover two independent editors,
initialization receipt stability, lost acknowledgement, metadata/identity
preservation, late legacy changes, exact malformed backups, stale reset,
new collection identity, canonical audio tombstones and effects-lock coordination.
Existing failure tests now download both persisted bytes and the unsaved draft.
Integration fixtures read and mutate canonical Notes, while initial legacy
fixtures remain intact to exercise migration.

Recovery is exposed only for failed Notes storage or pending/failed audio
recovery. Reset creates a new empty collection without reimporting the archived
legacy copies, deleting audio files, or treating unknown deletion outcomes as
resolved. Broader browser, product root and physical-device acceptance remain
open.
