# Real external Calendar editor test

This opt-in test requires the separately installed, verified F-Droid Etar APK. It does not download/install Etar, force an Activity component, intercept intents, create accounts or configure sync. Alpha remains the initiating designed UI; Etar is visibly external.

```sh
ANDROID_SERIAL=emulator-N \
ALPHA_BUILD_ARCHIVE=test-results/prototype-buildNN \
ALPHA_CALENDAR_EXTERNAL_RESULTS=test-results/prototype-buildNN/external-calendar \
node scripts/android-calendar-external-smoke.mjs
```

The archive must contain `apk-manifest.json` mapping filenames to SHA-256, plus matching `standalone-debug.apk`, `standalone-androidTest.apk`, `launcher-debug.apk`, and `launcher-androidTest.apk`. The new class must be compiled into those test APKs. Direct instrumentation requires `-e externalCalendar true` and class `ai.elizaresearch.alphaphone.CalendarExternalEditorInstrumentedTest`; without the opt-in it is skipped, not validated.

Dependency: `ws.xsoh.etar` versionCode57, installed universal APK SHA-256 `dae01d93c8920aa63845868db2190bcc4aa6ff8410b1289de1ce27b1bb89c599`, signer certificate SHA-256 `3f3176c3ce189c98054ff9e1d32daecf00a41572f4c7bd2b2f80607252ddb06e`. Provenance and official links are in [calendar-reminder-audit.md](calendar-reminder-audit.md). The runner reads the actual installed `base.apk` through adb and hashes its bytes; the instrumentation independently checks PackageManager version and current signer. Matching source version alone does not satisfy these pins.

The test creates its own uniquely named device-local calendar and overnight event without changing timezone. It uses Alpha’s Calendar event detail → Edit control, requires actual rendered Etar fixture title and edit controls, cancels and verifies unchanged provider fields, then explicitly changes only the title through Etar Save. Provider readback must retain the original row, calendar, begin/end epochs, timezone, recurrence/all-day/description fields. Back must return to Alpha, whose reloaded Calendar must display the updated event. It removes only its own calendar and verifies removal. The runner records/restores Calendar permission granted/denied state for both packages; it does not alter HOME or global default handlers. Use an English disposable emulator with no personal accounts/events.

`result.json` records installed dependency hash, both app/test APK hashes per variant, terminal outcome and fixture-scoped native receipt; `standalone.txt` and `launcher.txt` retain instrumentation output. A pass requires both `OK (1 test)` and all receipt assertions; dependency absence or mismatch fails before executing the flow. The initial source has only passed Node syntax checking; Java compilation and actual-device execution are pending parent coordination.

This proves the overnight/foreign-calendar advanced-editor fallback only when the run passes. It does not prove recurring-series scope choices, repeated-hour DST editing, account synchronization, external editor accessibility/visual parity, physical devices or HOME-role behavior. If the process crashes before Java cleanup, inspect and remove only the uniquely named `Alpha external editor ...` fixture calendar before retrying; never clear the entire CalendarProvider database.
