# Remaining browser persistence audit

The transactional migrations in [browser-storage.md](browser-storage.md) do not
complete the persistence review. This audit covers independent renderer stores,
operation intents and delegated storage ports outside the canonical browser
domains. It is a source review, not a claim that every
listed path has reproduced data loss or passed concurrency qualification.

## Audit boundary

Inspect direct `localStorage` and `sessionStorage` writes together with delegated
storage ports. A direct-call count does not establish whether readers and
writers share the same authority. The domains below remain outside the
canonical browser documents described in [browser storage](browser-storage.md).

Single-value preferences are not automatically equivalent to a multi-record
journal. The required invariant depends on the stored meaning: a preference may
intentionally be last-writer-wins, whereas an uncertain external operation must
retain its exact request identity until authoritative reconciliation.

## Outstanding domains

| Domain and authoritative source | Current mechanism and concrete concern | Required implementation and exit evidence |
| --- | --- | --- |
| Connection selection and Cloud environment: `runtime/connection-ui.tsx` | Individual nonsecret preferences remain in renderer storage. Credential storage is separate. Conversation restart choices now have an atomic document implementation described below. | Verify selection/environment winner semantics, cross-tab retirement, and late authentication completions. Browser conversation tests do not establish native persistence or credential acceptance. |
| Simulated location: `browser/location-simulation.ts` | Individual preference values with events/readback. These do not share the multi-record receipt semantics above. | Verify deliberate last-writer-wins behavior, malformed-value handling, cross-tab refresh and pending sensor cancellation. Migrate only if the required invariant needs stronger coordination; avoid adding a redundant writable mirror. |

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

## Remaining review

Specify winner, refresh and retirement semantics for connection/environment,
and simulated location preferences, then qualify their callers.
Conversation choices, Notes and audio-deletion records now have canonical document
implementations; their contracts and owning suites are in
[browser storage](browser-storage.md). A domain migration does not establish
native or physical-device acceptance.

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

## Location preference lifecycle review

The location configuration is one complete development preference snapshot, not
an operation journal. `saveLocationSimulation` validates the full snapshot and
checks persisted bytes; the latest completed write supplies future reads. An
open location editor also refuses a save when it observes a changed starting
snapshot. That comparison is not a cross-process transaction and must not be
presented as one.

The location service cancels pending prompts and invalidates pending
permission-status reads when
location settings change, including same-tab notifications, storage events and
storage clearing. Malformed settings retire existing watches with UNAVAILABLE,
retain the exact original bytes, and reject late fixes. Coordinate updates keep
compatible active simulated watches and publish the new fix as before.

Browser location lifecycle checks do not establish physical GPS or Android
permission acceptance. Malformed location settings still need an explicit user-facing
backup/reset path; automatic replacement would lose the retained bytes.

Connection selection storage retirement is currently installed only for the
development profile.
Cloud environment selection has no equivalent storage-event retirement. These
remain implementation/qualification gaps; current conversation-cache tests do
not prove their ownership semantics.

## Appearance preference synchronization

Appearance remains a single last-writer-wins preference (`alpha.appearance.v1`).
The browser settings adapter follows changes from another tab, including removal
and storage clearing, and rereads the latest bytes when a page is restored. A
React-state marker identifies external reads so they are not written back as
local choices. Local changes retain their existing persistence and session-only
error message if storage fails.

Malformed bytes render the default light theme without overwriting the original
value. An explicit `?theme=` preview remains independent of other-tab changes;
mock previews retain their separate behavior. Native appearance is unchanged.
The owning browser suite covers two real tabs, rapid writes, remove/clear,
malformed values, explicit previews and write failure.

## Browser connection preference retirement

The candidate installs selection/environment storage-event retirement for normal
browser use as well as development mode. A changed agent target cancels pending
connection work and retires the active target without writing over the other
tab's preference. A Cloud-environment change detaches Cloud services and a Cloud
agent, while leaving an independent local/remote agent intact. Explicit Offline
and storage clearing also detach the Cloud service. Retired asynchronous work
cannot reopen the chooser after cancellation. No preference change silently
starts another login or sends text.

Six new browser tests use a disclosed synthetic identity boundary and two real
tabs; they make no provider requests and collect no credentials. TypeScript
passed before integrating current main; all six owning Chromium cases pass
after integrating merged Notes/main. Cross-engine and full-product qualification
remain open.
This covers preference retirement, not actual provider authentication or native
credential replacement.

The repository run on `6472b2d7` completed with 340 passes and seven failures,
all reporting subprocess timeouts (including Java compilation and runner
fixtures). It did not reach the renderer build. The fixture-budget correction
exposes these causes but does not turn the run into a pass. Full current-source
verification remains open, and further blanket deadline increases have not been
made. The old Notes `f4132bdc` browser campaign was explicitly retired when its
source was superseded; partial results remain diagnostic only.

## Unreadable development location settings

The recovery candidate opens the location editor when saved JSON is malformed,
empty or structurally invalid. Original text remains untouched until the user
confirms replacement, and the dialog offers an exact UTF-8 backup download.
Replacement validates every field, checks that the saved text still matches the
opened snapshot, and requires a fresh confirmation after edits. Navigation and
storage-write failure retain the original. Unavailable saved Maps places disable
place selection while preserving existing Home/Work bindings.

This is a single development preference with last-writer-wins semantics, not a
transactional operation journal. The starting-value check refuses observed stale
edits; it is not a cross-process atomic compare-and-exchange guarantee. No native
GPS, permission or workflow effect is authorized by recovery. TypeScript passes;
eight browser regressions are being qualified. Rendered review is complete. The
initial campaign exposed a WebKit click loss: the field change handler rewrote
the Save label between pointer-down and pointer-up. Reset now leaves inactive
confirmation untouched; the original campaign was explicitly retired for this
fix and is not a full-pass claim.

The corrected location campaign passed 89 of 90 Chromium/Firefox/WebKit cases;
all 24 recovery cases and the existing validation flow passed. The remaining
WebKit permission fixture let startup calls replace its rejection callback.
It now shares one rejection outcome across callers; all six focused checks
pass across Chromium, Firefox and WebKit. Confirmation rendering was inspected with the full explanation visible.

At merged source `9d45e5c7`, the combined appearance/connection campaign passed
65 of 66 cases. Chromium discarded an evaluation promise during fixture setup
in the remaining case; all module responses were HTTP 200. That exact case
passed a focused unchanged-source recheck (1.6 seconds). The initial failure
is retained; this is not a clean 66-case single-run claim.
