# Remaining browser persistence audit

The transactional migrations in [browser-storage.md](browser-storage.md) do not
complete the persistence review. This audit covers independent renderer stores,
operation intents and delegated storage ports outside the canonical browser
domains. It is a source review, not a claim that every
listed path has reproduced data loss or passed concurrency qualification.

## Audit boundary

The reviewed product source is the integration at `3c914dc1c59a31a2acff1dea5eb2320d233f2e34`,
with upstream `60d66613e3a31e88f17ef396f1c33997fc578ac7`. Searching direct
`localStorage` and `sessionStorage` writes in browser, runtime and prototype
TypeScript found 27 source lines. Some lines contain multiple writes; the count
is not a count of stores. Shared engines and injected storage ports require
separate inspection. In particular, the product Notes wrapper delegates to
`plugins/plugin-notes/src/client/notes-store.ts`.

Single-value preferences are not automatically equivalent to a multi-record
journal. The required invariant depends on the stored meaning: a preference may
intentionally be last-writer-wins, whereas an uncertain external operation must
retain its exact request identity until authoritative reconciliation.

## Outstanding domains

| Domain and authoritative source | Current mechanism and concrete concern | Required implementation and exit evidence |
| --- | --- | --- |
| Browser Notes: `prototype/agent-adapter.ts`, `runtime/notes-store.ts`, upstream `plugin-notes` client store | Browser construction passes `localStorage` to the shared synchronous store. `assertCurrent` compares bytes before a whole-envelope write and reads them back afterward. This detects observed changes but does not make comparison and write one transaction across processes. Android uses the separate secure Notes adapter. | Introduce a reviewed upstream asynchronous browser storage path while preserving collection identity, revisions, deletion tombstones, metadata and operation receipts. Update all UI/actions/readback consumers together. Prove simultaneous edits, stale edits, lost responses, migration and exact recovery across engines. Do not edit the pinned vendor checkout or claim native migration from browser evidence. |
| Reminder creation recovery: `runtime/reminder-creations.ts` | Browser readers, retention, acknowledgement and recovery now share a canonical document. Its archive retains exact legacy bytes; unknown request IDs survive failed commits and reconciliation never reschedules. Android retains secure compare-exchange. | Migrated. The browser recovery control exports the archive and requires an explicit reset; stale captures cannot erase newer requests. |
| Reminder edit/decision/deletion recovery: `runtime/reminder-deletions.ts` | The legacy deletion map now also stores reviewed update, complete and snooze operations. It uses the same browser read/compare/write pattern. Migrating the reminder database did not migrate this separate pending-intent store. | Preserve all operation kinds and exact binding hashes in one canonical pending map. Prove two-tab retention, exact receipt acknowledgement, failed removal, stale reset and no replay during reconciliation. |
| Note/audio deletion recovery: `runtime/note-audio-deletions.ts` | Browser pending records contain the reviewed note snapshot, target and audio identity. A separate effects lock coordinates deletion/restoration; localStorage comparison protects the pending map. Notes readback also uses the synchronous Notes envelope. | Migrate the pending map without removing the effects lock. Coordinate with the Notes storage change. Preserve unknown audio outcomes, exact original snapshots and deletion tombstones; prove no duplicate audio removal and no restoration over a newer note. |
| Real Cloud setup intent: `runtime/cloud-personal-intent.ts`, `runtime/connection-ui.tsx` | Implementation candidate: browser activation/cutover intents now use a canonical document, unique update revisions and exact expected-value admission/acknowledgement. Query results reconcile only the intent captured before their request. Android keeps its existing renderer slot with expected-value updates. | Controlled cases cover concurrent admission, failed writes, replacement intents, cancellation before dispatch, changed status snapshots and exact backup/reset. Combined browser qualification remains pending; real hosting and native persistence remain separate gates. |
| Workflow client pending intents: `prototype/workflow-adapter.ts` | Run submission, metadata, lifecycle and approval intents are separate owner/workflow keys. UI checks are synchronous and operation controllers are per tab. Several completion paths remove a key without comparing its exact current value. These are distinct from canonical development execution and draft stores. | Capture owner/workflow scope before awaits; use atomic expected-value admission and acknowledgement for each operation. Keep independent operations distinct, preserve pending lifecycle discovery, and never clear a replacement intent. Prove cross-tab submission, conflicting approval, owner changes, lost responses and old completion after a newer intent. |
| Media saved-copy recovery: `prototype/camera-adapter.ts` | A localStorage pending operation token links a photo/video saved copy to receipt recovery. The token is separate from the IndexedDB media and album stores. Per-view checks do not establish cross-tab admission. | Retain exact operation-token ownership through asynchronous prepare/save/reconcile. Prove two-tab copy requests cannot overwrite another pending token or clear its recovery. Preserve existing saved-copy receipts; no automatic replay after an uncertain save. |
| Prototype application snapshots: `browser/simulated-apps.ts`, `browser/simulator-writer.ts`, `browser/simulator-recovery.ts` | Synchronous reducers use an origin-wide writer lease with `ifAvailable`; a second tab is intentionally refused writes. Snapshot byte checks protect observed external changes. Reset bypasses that lease and performs a localStorage compare/remove. | Decide and document whether single-writer behavior remains the development contract. Even with that contract, reset must coordinate with the writer and compare the captured revision. Preserve malformed bytes, queued local drafts and workflow fixture receipts. Qualify writer death, stale snapshots, explicit reset and a refused second writer. |
| Connection selection, Cloud environment and conversation cache: `runtime/connection-ui.tsx` | These are separate from development Cloud account storage. Selection/environment are individual records; conversation choices are a serialized cache. Their intended cross-tab winner and cache-loss semantics need explicit classification. | Audit every reader, invalidation event and owner key. Keep credential storage separate. Prove that an older asynchronous connection/history completion cannot restore a retired owner or overwrite another owner's conversation choice. Do not migrate a writer alone. |
| Clock handoff status: `prototype/clock-adapter.ts` | A single nonsecret record stores opening/unknown/opened state; it is informational and never a claim that an alarm was created. Completion checks its operation ID before writing, but comparison and write are separate. | Preserve truthful handoff semantics and bind completion atomically if multiple views can write. Verify an older completion cannot replace a newer handoff and that failed retention prevents dispatch. Browser Clock simulation is not physical ringing evidence. |
| Appearance and simulated location: `prototype/settings-adapter.ts`, `browser/location-simulation.ts` | Individual preference values with events/readback. These do not share the multi-record receipt semantics above. | Verify deliberate last-writer-wins behavior, malformed-value handling, cross-tab refresh and pending sensor cancellation. Migrate only if the required invariant needs stronger coordination; avoid adding a redundant writable mirror. |

## Implementation order

1. Keep the current account/development-domain integration immutable while its
   combined verification runs. Record terminal results against that source.
2. Address operation-intent admission and expected acknowledgements: real Cloud,
   workflow client intents, reminder pending records and media-copy tokens.
   Use controlled providers; do not turn a test into real provisioning or sending.
3. Coordinate the shared Notes browser storage change with audio-deletion recovery.
   Preserve the native secure adapter and exact installed-data identities.
4. Resolve simulator reset ownership, then classify preference/cache records with
   their own explicit semantics. A zero-result search for the old helper is not
   proof that browser persistence is complete.

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
