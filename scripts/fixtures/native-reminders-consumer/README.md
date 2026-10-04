# Independent native reminder fixture

Synthetic app only. `FixtureHost.STORAGE` deliberately uses private SharedPreferences to test durable opaque-token behavior; it is NOT encrypted and is NOT a production secure adapter.

The opt-in instrumentation method requires `-e reminderEngineFixture 1`, a fresh owned secondary user, and notification permission on API33+. It creates only synthetic records in this app's private storage and notifications under two configured channels. A runner must provision/remove its exact secondary user and preserve the original foreground user. No runner or emulator action is invoked by building this fixture.

Flow coverage: real engine singleton/conflicting identity, independent store namespaces, schedule/read/selected, durable operation replay and approval-binding/stale-target rejection, null-alert no-PendingIntent behavior, explicit broadcasts to the manifest receiver after actual due time, real notifications and action PendingIntents, opaque ledger capture/consume without task completion, cross-engine notification isolation, snooze/Done/stale occurrence, and exact ID cancellation.

The test does not claim natural AlarmManager timing, encrypted production storage, rendered Capacitor lifecycle, reboot/process-death, or baseline upgrade acceptance. Inexact scheduling timing is not made artificially exact; the explicit owned receiver broadcast provides deterministic delivery after its true deadline.
