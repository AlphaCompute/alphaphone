# Notification channel recovery

Build73 source adds read-only app permission, each existing own channel's importance and group-blocked state, and Android interruption-filter readback. Existing Notifications settings rows display the limitation; an enabled app no longer implies its reminder channel is enabled. DND status describes interruption policy, not guaranteed delivery. No DND mutation, notification-listener access or content upload is added.

`AlphaNotifications.status()` issues opaque current-process channel capabilities. `openChannelSettings({id})` accepts only one of those IDs and rechecks the channel still exists before opening Android's channel settings for this package. The app cannot silently re-enable channels. Settings refreshes on return and reentry; query failures show unavailable. Existing prototype components supply the layout without template changes.

Official platform contracts: [NotificationManager](https://developer.android.com/reference/android/app/NotificationManager), [channel settings intent](https://developer.android.com/reference/android/provider/Settings#ACTION_CHANNEL_NOTIFICATION_SETTINGS). App access is confined to its own channels. Other-app listener permission/redaction remains a separate unimplemented scope.

Run each immutable distribution separately:

```sh
ANDROID_SERIAL=emulator-N node scripts/test-notification-channels.mjs ARCHIVE/standalone-debug.apk ARCHIVE/standalone-androidTest.apk OUTPUT
```

The wrapper validates both archived hashes, snapshots POST_NOTIFICATIONS grant/user flags, grants the fixture precondition, runs the opt-in native flow, and restores/verifies permission state even on failure. The test creates one UUID synthetic channel; it changes that channel through real Android Settings, observes blocked status while app permission stays allowed, explicitly restores it through Settings, then posts a real notification and taps its actual prototype shade row. An exact package-scoped synthetic broadcast receipt proves the original PendingIntent target was invoked; no real mail/message or user reminder is sent. Unknown channel IDs are rejected. Cleanup cancels only its notification and deletes only the newly-created channel; existing user channels are never changed. Android may internally retain a tombstone for deleted channel IDs; no claim of removing platform audit history is made.

Source typecheck and wrapper syntax checks pass. Native compilation/lint and both-variant execution remain pending. This is channel recovery coverage, not DND manipulation, physical delivery timing, full AOSP boot or third-party notifications.
