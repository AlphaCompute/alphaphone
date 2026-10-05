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
readers and writers share the same authority. The domains below remain outside the
canonical browser documents described in [browser storage](browser-storage.md).

Single-value preferences are not automatically equivalent to a multi-record
journal. The required invariant depends on the stored meaning: a preference may
intentionally be last-writer-wins, whereas an uncertain external operation must
retain its exact request identity until authoritative reconciliation.

## Outstanding domains

| Domain and authoritative source | Current mechanism and concrete concern | Required implementation and exit evidence |
| --- | --- | --- |
| Browser Notes: `prototype/agent-adapter.ts`, `runtime/notes-store.ts`, upstream `plugin-notes` client store | Browser construction passes `localStorage` to the shared synchronous store. `assertCurrent` compares bytes before a whole-envelope write and reads them back afterward. This detects observed changes but does not make comparison and write one transaction across processes. Android uses the separate secure Notes adapter. | Introduce a reviewed upstream asynchronous browser storage path while preserving collection identity, revisions, deletion tombstones, metadata and operation receipts. Update all UI/actions/readback consumers together. Prove simultaneous edits, stale edits, lost responses, migration and exact recovery across engines. Do not edit the pinned vendor checkout or claim native migration from browser evidence. |
| Note/audio deletion recovery: `runtime/note-audio-deletions.ts` | Browser pending records contain the reviewed note snapshot, target and audio identity. A separate effects lock coordinates deletion/restoration; localStorage comparison protects the pending map. Notes readback also uses the synchronous Notes envelope. | Migrate the pending map without removing the effects lock. Coordinate with the Notes storage change. Preserve unknown audio outcomes, exact original snapshots and deletion tombstones; prove no duplicate audio removal and no restoration over a newer note. |
| Connection selection, Cloud environment and conversation cache: `runtime/connection-ui.tsx` | These are separate from development Cloud account storage. Selection/environment are individual records; conversation choices are a serialized cache. Their intended cross-tab winner and cache-loss semantics need explicit classification. | Audit every reader, invalidation event and owner key. Keep credential storage separate. Prove that an older asynchronous connection/history completion cannot restore a retired owner or overwrite another owner's conversation choice. Do not migrate a writer alone. |
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
3. Classify connection preferences and conversation choices independently. In
   `connection-ui.tsx`, `send` currently captures the whole conversation cache
   before awaiting conversation creation, then writes that earlier map. Another
   owner's saved choice can be lost. Fix the complete read/write contract with
   concurrent owner coverage; merely moving a write after the await still leaves
   cross-process read-modify-write races.
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
