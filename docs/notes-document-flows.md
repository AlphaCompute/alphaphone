# Notes text import/export

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

Run `npm run typecheck` and `node scripts/test-notes-documents-browser.mjs`.
The latter renders the actual Notes adapter/template with a synthetic native
boundary and checks create-new import, CR/LF-preserving export snapshot, cancel,
and browser reload. It is not Android/provider evidence.

`NotesDocumentInstrumentedTest` contains two ordinary native flows and one gated
process method:

- Actual SAF import, cancellation, export Save, independent exact-byte readback,
  re-import as a distinct note, and Activity recreation.
- Actual selected oversized/invalid-UTF-8 documents leave Notes unchanged.
- `documentProcessRestartPhase`, explicitly invoked by
  `scripts/test-native-restart.mjs notes`, prepares the same real document flow,
  then requires a changed PID before opening the saved note and checking exact
  stored content. The runner validates both APK hashes against one archive's
  manifest and matching distribution, force-stops between phases and attempts
  scoped cleanup. Fixture files/notes contain a unique synthetic UUID; no user
  note, arbitrary folder or broad trash cleanup is authorized.

Archive a matching APK pair with its flat `apk-manifest.json`, then run:

```
ANDROID_SERIAL=emulator-N ALPHA_NATIVE_TEST_AVD=owned-avd ALPHA_NATIVE_TEST_ABI=x86_64 \
node scripts/test-native-restart.mjs notes \
  test-results/notes-archive/standalone-debug.apk \
  test-results/notes-archive/standalone-androidTest.apk \
  test-results/notes-archive/notes-standalone
```

Repeat with matching launcher artifacts and a new output directory. The runner
leases the owned emulator, refuses existing package registrations, and creates
a disposable secondary user. Set `ALPHA_TEST_HOME_PACKAGE` for the stock HOME
package when it differs from `com.android.launcher3`. Strict instrumentation
records must prove the requested method completed; a summary line alone cannot
pass. Uncertain package cleanup retains the fixture user for recovery.

The native test obtains the exported file through real DocumentsUI selection,
then checks its provider-granted URI, unique name, MIME, encoded size,
modification-time window, read/write grant, delete support and exact bytes.
Cleanup reselects the exact file if needed and deletes only the validated grant.
Unknown metadata retains the private recovery journal. The test restores the
prior Files selection and checks that existing capabilities remain unchanged.
The runner's UUID binds the note record and export journal across phases.

Real DocumentsUI behavior, grant cleanup and errors require both-variant native
runs against the recorded APKs. Browser tests and compilation do not prove those
contracts. Private/cloud providers, interrupted writes, physical-device acceptance
and general multi-note import/export remain separate acceptance work.
