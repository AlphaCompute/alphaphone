# Settings and Calendar Build66 source checkpoint

Build66 source is frozen for native verification. TypeScript and runner syntax checks passed; the new native flows below have not yet been executed. Build64 Calendar range navigation already passed for both distribution variants, including restoration of Calendar permissions. This checkpoint does not establish external account synchronization, physical location accuracy, or storage-failure acceptance.

## Settings handoffs and location

The reference Accounts row now opens Android's actual accounts/synchronization Settings page through `Settings.ACTION_SYNC_SETTINGS`. Privacy distinguishes precise, approximate, and denied location using the actual fine/coarse permission grants. Approximate permission counts as allowed for consumers that only need a boolean.

`SettingsNativeInstrumentedTest` exercises actual coarse-only permission, the real Accounts handoff and Android Back return, then precise permission and resume readback. It requires `settingsNative=1`. Run it through `scripts/test-settings-native.mjs APP.apk MATCHING_TEST.apk OUTPUT` with `ANDROID_SERIAL` explicitly naming the emulator. The runner snapshots grants and user flags, restores them in `finally`, verifies restoration, and records APK hashes. It refuses permission states it cannot safely restore.

## Calendar completeness

A CalendarProvider result that reaches the native instance limit retains a visible incomplete-results warning. An unreturned date in that truncated range cannot say “Free all day.” The warning has an explicit retry action; a repeated truncated read remains incomplete.

`CalendarTruncationInstrumentedTest` creates an owned provider calendar with 2,001 recurring instances followed by a sentinel event beyond the query limit. It checks the actual omitted date, persistent incomplete warning, and explicit retry without claiming that the sentinel was returned. Cleanup deletes only that calendar. Provider recurrence expansion is part of the pending native proof, not a mocked result.

`scripts/test-calendar-range.mjs APP.apk MATCHING_TEST.apk OUTPUT` now runs both the existing visible-range test and the new truncation test. It requires explicit emulator selection, verifies the matching archived APK pair, and restores Calendar grants and flags after execution. The expected successful native result is two tests.

## Stale reminders

When reminder refresh fails, Calendar keeps a persistent warning and retry affordance, including after leaving and returning to the view. Existing reminder detail also says its data is out of date. Editing, deleting, completing, or snoozing a stale existing reminder first retries the read; it does not mutate based on stale displayed data. After a successful refresh, the user can explicitly retry their intended action.

`ReminderStaleInstrumentedTest` deliberately rejects `DailyApps.listReminders` at the renderer/native bridge boundary, verifies that the warning outlives a transient toast and survives navigation, then restores forwarding and requires an actual native read before the warning clears. It restores the original bridge function in cleanup. This is an explicit transport-rejection fixture; it does not simulate or prove Android disk corruption recovery. One-off reminder Done/Snooze support is unchanged in this slice.

## Native follow-up and Build67 fixture repair

Build66 Settings passed on both distribution variants, with original permissions restored. The existing Calendar range flow passed again on standalone, but the new truncation flow failed before observing its warning. It is not accepted as passing.

The original fixture used one `COUNT=2001` recurrence. AOSP's [RecurrenceProcessor](https://android.googlesource.com/platform/frameworks/opt/calendar/+/504844526f1b7afec048c6d2976ffb332670d5ba/src/com/android/calendarcommon2/RecurrenceProcessor.java) bounds expansion to 2,000 iterations per series. Provider expansion failure is therefore a concrete suspected fixture cause, rather than evidence that Alpha returned more than its limit. Build67 uses three real 800-instance series plus the sentinel and requires an actual provider cursor count of 2,401 before entering the UI. The original no-false-free-state assertion remains unchanged. Failure diagnostics now include only bounded warning/connection/loading state, not user event text. Native rerun remains pending.

Build67's explicit provider precondition failed with four instances, not the expected 2,401, before any UI assertion. This establishes that the emulator provider did not expand those MINUTELY series as assumed; it does not establish Alpha truncation behavior. Build68 removes that recurrence assumption: it creates 2,001 distinct real CalendarProvider events plus one later sentinel, using `ContentResolver.applyBatch` with at most 200 inserts per batch. Every insertion result must contain a URI, and the owned-calendar instance count must equal 2,002 before the unchanged incomplete-state UI assertions run. Cleanup still deletes only the uniquely owned fixture calendar. Native rerun remains pending.

Build68 standalone truncation passed with 2,002 actual provider rows and the incomplete-state UI. The separate range navigation test failed on its future event. Source review found an A→B→A race: the pending A request was invalidated, but its `attemptedKey` still equalled the newly desired A, preventing another query after discarding that response. The next source checkpoint clears only the invalidated active request's attempted key and schedules the current range again. `scripts/test-calendar-query-race.mjs` exercises the actual adapter through a delayed provider boundary and passes: discarded old A is followed by a second A query and current data. This is host lifecycle evidence, not native provider acceptance; the existing native range assertions remain unchanged and include bounded state diagnostics for the rerun.
