# Native Calendar upstream extraction

## Current boundary

MVP completion step13 remains incomplete. The product implements Calendar provider operations in `AlphaCalendarPlugin`, `CalendarEventGuard` and `CalendarCreationStore` (386 lines combined at source0b2c032). These three classes form a complete reusable boundary: provider queries, permission handling, native confirmation, atomic revision assertions, lifecycle cancellation and durable creation reconciliation. They do not require Alpha's credential store or reminder scheduler. Extracting only a guard utility would leave the reusable behavior product-owned.

The destination is an Android library in upstream `plugins/plugin-native-calendar`, with an explicit Android contract alongside the existing Apple contract. Delivery must use a reviewed upstream revision or an explicit reproducible patch in `patches/eliza`; never edit the vendor checkout. Alpha retains a thin registration adapter named `AlphaCalendar`, preserving the existing renderer protocol.

## Configuration and compatibility

Immutable host configuration must preserve these Alpha values:

- Local account `Alpha Phone` and calendar name `alpha-phone-local`.
- Creation journal `alpha-calendar-creations-v1`.
- Creation URI prefix `alphaphone://calendar-creation/`.
- Existing display labels and color.

Retain `context.getPackageName()` for provider ownership. Preserve pending operation IDs, unknown-result handling, persistence quarantine, source/event revisions, atomic provider assertions and confirmation ownership. Do not change user storage namespaces as part of extraction. If one process supports multiple configured instances, quarantine and journal locking must be scoped to the configured store rather than accidentally shared by a static global.

Wire the library through `android/settings.gradle` and `android/app/build.gradle`; keep the production renderer in `apps/app`. Existing Android tests access private review state through `AlphaCalendarPlugin.class.getDeclaredField`; adjust their observation boundary for inherited implementation without dropping dialog-release or busy-gate assertions.

## Required external-consumer proof

A separate minimal Android consumer must import the library with a different package, account/calendar and journal, and no Alpha source dependency. Execute actual permission, provider create/read/update/delete, cancelled confirmation, concurrent-edit rejection, creation process-restart reconciliation, and unsupported external/recurring-event rejection. A second caller of a copied helper is not this proof.

Then upgrade an existing Alpha fixture without clearing storage. Verify prior calendar records and pending creation IDs survive and the same operation does not duplicate an event. Run existing CalendarFlow, CalendarCrud, CalendarRange, CalendarExternalEditor, CalendarTruncation, CalendarAgentCrud and CalendarCreationRecovery instrumented flows in both standalone and launcher variants. Keep APK build, emulator provider execution and physical acceptance distinct.

## Reminder follow-up

Reminders are a larger independent extraction: ReminderStore, ReminderEnvelope, ReminderTaps, receiver dispatch, DailyApps permission/lifecycle bridge and action-journal receipt reconciliation. Inject secure-slot storage and Activity/receiver targets through narrow host interfaces. Keep existing receiver classes as forwarding shims because persisted PendingIntents target them. Preserve channel IDs, actions, URI prefixes, storage keys and atomic record/receipt commits. Existing upstream Apple reminder policy is not an Android scheduler.

## Status

This is the source-grounded implementation and acceptance boundary, not a completed extraction. Current hosted qualification continues for source0b2c032 while this next step is prepared. Signing, physical pilot, live providers and resident execution remain independent MVP gates.
