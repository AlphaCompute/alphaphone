# Visible Calendar ranges and real text size

Native provider, external calendar synchronization and physical-device accessibility are separate acceptance gates.

Calendar queries Android CalendarProvider around the visible selected month, including adjacent month-grid dates, rather than a fixed window relative to today. Queries remain bounded to approximately three months and the native370-day/2,000-instance limits remain. Navigation invalidates older responses and coalesces rapid range changes. Unknown, loading, denied and failed ranges cannot say “Free all day.” An explicit device-calendar refresh retries failure. Local reminders remain distinct from provider events. Saving a new event refreshes its actual selected date range.

`CalendarRangeInstrumentedTest#distantDatesLoadRealRowsAndNewestNavigationWins` creates only its own CalendarProvider calendar and real fixture events120days before and430days after today, uses the reference month/day controls, changes months around each query, and verifies the correct actual event without a stale event from another date. Cleanup deletes only the owned calendar. Existing calendar timeline/edit tests must also pass the new query lifecycle.

Settings Text size now changes the actual host WebView text zoom, persisted in Alpha's private Android preferences. The existing slider maps to75–150% relative to Android's accessibility font scale; default100% preserves normal reference sizing. Effective zoom is recomputed from the preference and current Configuration.fontScale, never multiplied into an already-scaled value. Activity creation/resume/configuration reapplies it. Browser child WebViews and external Android apps keep their own settings; the Alpha preference does not override website or external-editor sizing. There is no CSS transform of the entire screen.

Android documents [WebSettings.setTextZoom](https://developer.android.com/reference/android/webkit/WebSettings#setTextZoom(int)) as a percentage. Chromium's [AwSettings implementation](https://chromium.googlesource.com/chromium/src/+/main/android_webview/java/src/org/chromium/android_webview/AwSettings.java) records an explicit embedder zoom and skips its automatic fontScale update afterward. Alpha therefore includes Android fontScale exactly once when applying its own relative preference. Different WebView releases and physical large-font layouts still require qualification.

`TextScaleInstrumentedTest#textSizeChangesRealNotesAndSurvivesActivityRecreation` changes the actual Settings slider, verifies native persisted/effective zoom and enlarged rendered Notes glyph bounds, recreates the Activity and verifies again, then restores the prior preference. The separate gated `textScaleProcessRestartPhase` uses prepare/verify/cleanup and `scripts/test-text-scale-restart.mjs APP.apk MATCHING_TEST.apk OUTPUT` with an explicit emulator serial; it force-stops between phases, verifies real glyph geometry in the new process, records matching APK hashes and restores only the fixture's prior preference. Current-source native execution must be recorded separately from fixture compilation.

## Completeness and recovery

Truncated provider results retain an incomplete-results warning and explicit retry;
unreturned dates cannot say “Free all day.” The truncation fixture creates 2,001
distinct events plus a sentinel in its own calendar, checks all 2,002 provider rows
before UI assertions, and deletes only that calendar. Inserts use batches of at
most 200 and require a URI for every result. Do not assume recurrence expansion
will produce enough rows to exercise the limit.

`scripts/test-calendar-range.mjs APP.apk MATCHING_TEST.apk OUTPUT` requires an
explicit emulator, verifies the APK pair and restores Calendar grants and flags.
Both range navigation and truncation methods must pass. Rapid A→B→A navigation
must discard the retired query and issue a fresh query for the final range.

Failed reminder refresh keeps a warning across navigation. Existing reminder
mutations first refresh stale data and require the user to retry explicitly.
The bridge-rejection fixture proves that transport boundary, not disk-corruption
recovery.

Settings Accounts opens Android synchronization settings. Location status must
distinguish precise, approximate and denied grants. The Settings native runner
snapshots and restores grants and flags, verifies restoration, and refuses states
it cannot safely restore.
