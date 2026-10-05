# Notes text import/export

Source slice for Build70; native acceptance is pending.

Production Notes adds an Import text note action beside the existing header
controls. It launches Android's explicit document picker with text MIME filtering.
The selected content is read locally with the existing strict UTF-8/64 KiB
reader. A native-only transient-reader entrypoint avoids creating, persisting or
evicting any Files selection capability. UTF-8 BOM and CR/LF content are retained
for Notes; HTML textarea presentation normalizes line endings without changing
the stored imported body. Unsupported type/encoding, revoked access, oversized
content and cancellation do not create a note.

A successful import creates a new random-ID text note through the existing Notes
persistence/conflict guard. It never overwrites a same-title note. The source
filename provides the editable title; original content is not uploaded or sent
to an agent. Leaving Notes while selection is pending invalidates its completion.

The existing Share sheet exposes Export text file for text notes. Export captures
the current title/body before opening ACTION_CREATE_DOCUMENT. The user chooses
the destination; native code writes that bounded UTF-8 snapshot, closes it and
reads back exact bytes. Only matching bytes produce an exported receipt. A
provider that accepts writes but cannot be read back returns **unverified**, with
an explicit instruction to inspect the destination before retrying. Partial
writes cannot be automatically rolled back across arbitrary providers. Cancelling
selection never reports export success. Checklist/audio/link notes are not
silently flattened; this slice exports plain text bodies only, with the title as
the suggested filename. No broad storage permission or persistent URI grant is
requested.

Native ownership: AlphaNoteDocumentsPlugin, registered in MainActivity; shared
read implementation remains SelectedDocumentAccess. Renderer ownership:
notes-document-adapter.ts, installed after voice so existing audio UI/storage
continues to work. Mock mode (present only in `ELIZA_DEV_ALLOW_TEST_MOCKS=1` builds)
does not install this adapter or its native actions.
The prototype Notes layout and Share sheet styling are reused; the two new
production-only affordances are conditional and do not change reference fixtures.

## Verification

`npm run typecheck` and `scripts/test-notes-documents-browser.mjs` pass locally.
The latter renders the actual Notes adapter/template with a synthetic native
boundary and checks create-new import, CR/LF-preserving export snapshot, cancel,
and browser reload. It is not Android/provider evidence.

`NotesDocumentInstrumentedTest` contains two ordinary native flows and one gated
process method:

- Actual SAF import, cancellation, export Save, independent exact-byte readback,
  re-import as a distinct note, and Activity recreation.
- Actual selected oversized/invalid-UTF-8 documents leave Notes unchanged.
- `documentProcessRestartPhase`, explicitly invoked by
  `scripts/test-notes-document-restart.mjs`, prepares the same real document flow,
  then requires a changed PID before opening the saved note and checking exact
  stored content. The runner validates both APK hashes against one archive's
  manifest and matching distribution, force-stops between phases and attempts
  scoped cleanup. Fixture files/notes contain a unique synthetic UUID; no user
  note, arbitrary folder or broad trash cleanup is authorized.

Parent-owned command after archiving Build70:

```
ANDROID_SERIAL=emulator-5554 node scripts/test-notes-document-restart.mjs \
  test-results/prototype-build70/standalone-debug.apk \
  test-results/prototype-build70/standalone-androidTest.apk \
  test-results/prototype-build70/notes-standalone
```

Repeat with matching launcher artifacts. Native compilation and both-variant
execution are pending. Real DocumentsUI/provider destination behavior, grant
cleanup and errors must be assessed from those runs, not inferred from TS or
rendered-fixture passes. Private/cloud document providers, interrupted writes,
physical-device acceptance and general multi-note import/export remain separate.

## Build70 failure and Build71 test correction

Build70 standalone passes actual oversized and invalid-UTF-8 rejection. The
round-trip method fails at its first cancellation assertion before any export:
JavaScript click completion preceded DocumentsUI becoming the resumed Activity.
The shared helper correctly refused to report cancellation without sending Back.

Build71 source adds a Notes-local wait for both resumed DocumentsUI and its actual
accessible root before invoking the unchanged paired-Back cancellation helper.
Return additionally requires an enabled Notes document control and the cancelled
receipt. It does not waive cancellation or replace it with injected results.

The export test also journals the exact unique destination name, expected app
owner and creation-time boundary before Save. Its cleanup independently queries
that name even if no successful receipt assigned the output URI, rejects duplicate
names, unexpected owner/path/MIME/time, and deletes only the matching fixture.
Unverifiable metadata/ownership retains the private recovery journal and reports
cleanup failure, preserving the original failure with suppressed cleanup errors.
Actual provider owner attribution must be checked in the native run; no unknown
owner is accepted or broadly deleted. Build71 compilation/execution remains
pending; Build70's failed aggregate is not a round-trip acceptance result.

## Build71 provider attribution and corrected grant-based verification

Build71 reached actual cancellation, import, export Save and the native
exact-byte exported receipt, then failed the test's MediaStore lookup. The root's
bounded inspection found the unique export attributed to another package
(`com.android.soundpicker`), so app-owned MediaStore discovery was an invalid
assumption for this user-selected SAF destination. The failed aggregate remains
failed. Root recovered only that file after checking its exact row, UUID name, path,
MIME, creation time, observed owner and synthetic bytes, then verified row and
filesystem absence. Evidence: `test-results/prototype-build71/notes-export-recovery.json`.

The corrected test obtains the export through actual DocumentsUI selection using
the existing DailyApps Files picker, then validates the returned provider-granted
document URI: exact UUID name, MIME, encoded size, modification-time window,
read/write grant, delete support and independent exact bytes. Package ownership
is not substituted for an explicit SAF grant. Cleanup reselects that exact file
when no URI was recorded, repeats metadata/byte validation, and calls
DocumentsContract.deleteDocument on that grant only. Unknown metadata retains the
private recovery journal; there is no privileged MediaStore scan or blanket
permission change. The test checks room before allocating one temporary
selection, forgets only its new capability, restores the prior selection and
verifies all prior Files capability identities/URIs are unchanged without
printing their private values. Production import/export code is unchanged.
Native compile and both-variant corrected runs remain pending.

The process wrapper now passes its canonical run UUID into every phase. Both the
note persistence record and export recovery journal use that same UUID. Cleanup
fails if its matching export journal remains, even when no note record exists;
it neither reports success for an unresolved export nor touches another run.
The earlier failed prepare result remains failed even if a later scoped cleanup
succeeds. Build72 test corrections are source-only until native verification.
