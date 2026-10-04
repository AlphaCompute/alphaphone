# Independent native Calendar consumer

This standalone Gradle build imports the staged upstream Calendar library and Capacitor, with no dependency on Alpha's app, renderer or native implementation classes. Its account, storage and Capacitor registration names differ from Alpha. This is a disposable test app, never an Alpha dependency.

From the repository root, use JDK 21 and a configured Android SDK:

```sh
node scripts/stage-native-calendar.mjs
android/gradlew -p scripts/fixtures/native-calendar-consumer assembleDebug assembleDebugAndroidTest
```

`ConsumerCreationRecoveryTest` uses actual CalendarProvider rows. It requires an explicitly owned disposable secondary Android user, both Calendar permissions, and instrumentation argument `calendarCreationRecovery=1`. It refuses user 0. It creates and cleans up only its exact synthetic calendar and operation IDs. It tests two concurrent independent store instances, same-ID reconciliation, ambiguous/missing markers, independent journal configurations and conflicting prefix rejection. Restoring a durable pre-receipt record models receipt loss; this is not an actual process-death test.

Further acceptance remains required: execute the fixture on the owned emulator, test inherited permission callbacks, actual native CRUD review/cancellation/conflicts, process death, and Alpha upgrade without clearing data. A successful APK build is only packaging evidence.

After building, execute the scoped recovery runner only against an AVD you own:

```sh
ALPHA_CALENDAR_TEST_SERIAL=emulator-5570 \
ALPHA_CALENDAR_TEST_AVD=your-exact-owned-avd-name \
node scripts/test-native-calendar-consumer.mjs
```

The runner refuses mismatched AVDs, a non-owner initial user, or pre-existing fixture packages. It creates a secondary user, installs only the fixture, grants its Calendar permissions, executes the provider test, restores user 0, stops/removes the secondary user, removes fixture packages and records APK hashes plus cleanup results. It never runs the provider test in user 0. Do not interpret a provider-only pass as permission-dialog, renderer, process-death or upgrade acceptance.

Use `--bridge` for the WebView-to-Capacitor flow: initially ungranted Calendar permission, reviewed create/read/update/delete, stale revisions, a provider edit while confirmation is open, Cancel, and pause dismissal. Use `--workflow-permission` in a separate fresh fixture user for the read-only permission callback. These modes do not pregrant Calendar permission; they interact with the system permission dialog. The host refuses existing fixture registrations across all users before any shared APK code replacement.

The fixture disables Gradle VFS watching after a local incremental run reused the previous instrumentation APK despite a source edit. When changing native tests, inspect the resulting APK hash and use `--rerun-tasks --no-watch-fs` if source/compiled identity is uncertain. Preserve earlier APK results rather than attributing them to new source.
