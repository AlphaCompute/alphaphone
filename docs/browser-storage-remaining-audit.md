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

## Remaining review

Specify winner, refresh and retirement semantics for connection/environment,
appearance and simulated location preferences, then qualify their callers.
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

A concrete lifecycle gap was found: changing this preference retired mismatched
active watches but left a pending browser permission prompt alive. The candidate
now cancels pending prompts and invalidates pending permission-status reads when
location settings change, including same-tab notifications, storage events and
storage clearing. Malformed settings retire existing watches with UNAVAILABLE,
retain the exact original bytes, and reject late fixes. Coordinate updates keep
compatible active simulated watches and publish the new fix as before.

TypeScript and all 60 location cases across Chromium, Firefox and WebKit pass
on `88121114d0be667e4e09e9e4b335c71ca576d1bc`, including a real two-tab
storage-event regression. This is
browser location lifecycle evidence, not physical GPS or Android permission
acceptance. Malformed location settings still need an explicit user-facing
backup/reset path; automatic replacement would lose the retained bytes.

The adjacent preference review also found that appearance is loaded at startup
and saved on local changes without cross-tab refresh, and connection selection
storage retirement is currently installed only for the development profile.
Cloud environment selection has no equivalent storage-event retirement. These
remain implementation/qualification gaps; current conversation-cache tests do
not prove their ownership semantics.

## Repository fixture timing correction

The Notes integration checkpoint `f4132bdc` passed TypeScript but its root test
run ended with 335 passes and 12 failures; the production web build was not
reached. Ten Calendar runner cases failed to find result directories after the
15-second subprocess deadline, and two installed-upgrade success cases failed
under their 45-second budget.

A standalone pin-authentication probe took 47.4 seconds on the same machine.
Diagnostic copies with unchanged runner behavior and a two-minute subprocess
budget passed the Calendar success case in 37.5 seconds and the Calendar upgrade
case in 72.1 seconds. The fixture budgets are now two minutes, and subprocess
errors are asserted before reading missing result files. Production runner
deadlines, pin authentication, cleanup and evidence assertions are unchanged.
The full repository batch still needs qualification after this correction; two
diagnostic passes are not a full-suite pass. These are fake SDK/ADB fixture tests,
not Android builds or device acceptance.

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
passed before integrating current main; owning browser qualification is running.
This covers preference retirement, not actual provider authentication or native
credential replacement.

The repository run on `6472b2d7` completed with 340 passes and seven failures,
all reporting subprocess timeouts (including Java compilation and runner
fixtures). It did not reach the renderer build. The fixture-budget correction
exposes these causes but does not turn the run into a pass. Full current-source
verification remains open, and further blanket deadline increases have not been
made. The old Notes `f4132bdc` browser campaign was explicitly retired when its
source was superseded; partial results remain diagnostic only.
