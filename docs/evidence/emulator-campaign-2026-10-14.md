# Emulator campaign, 2026-10-14

These are class E results only: developer APKs with an unpackaged runtime, built from commit 304232690 (#503), on arm64 AVD claude_mvpfinal_e_20261014 (API 35). They are not device, AOSP image or distribution evidence.

| Class | Variant | Status | Failed methods | Run |
|---|---|---|---|---|
| AccessibilityInstrumentedTest | launcher | failed | homeShadeSettingsAndComposerAtDoubleFontScale | run6-testmocks-confirm |
| AccessibilityInstrumentedTest | standalone | failed | homeShadeSettingsAndComposerAtDoubleFontScale | run6-testmocks-confirm |
| AssistantResidentReuseInstrumentedTest | launcher | passed |  | run4-flagoff-home |
| AssistantResidentReuseInstrumentedTest | standalone | passed |  | run4-flagoff-home |
| BrowserFlowInstrumentedTest | launcher | passed |  | run4-flagoff-home |
| BrowserFlowInstrumentedTest | standalone | passed |  | run4-flagoff-home |
| ChatContinuityInstrumentedTest | launcher | failed | draftSurvivesKeyboardSheetFullBackHomeAndRecreation | run6-testmocks-confirm |
| ChatContinuityInstrumentedTest | standalone | passed |  | run6-testmocks-confirm |
| ClockHandoffInstrumentedTest | launcher | passed |  | run4-flagoff-home |
| ClockHandoffInstrumentedTest | standalone | passed |  | run4-flagoff-home |
| ClockRepeatDaysInstrumentedTest | launcher | passed |  | run4-flagoff-home |
| ClockRepeatDaysInstrumentedTest | standalone | passed |  | run4-flagoff-home |
| ConnectionChooserInstrumentedTest | launcher | passed |  | run5-testmocks |
| ConnectionChooserInstrumentedTest | standalone | passed |  | run5-testmocks |
| ConnectionRoutesInstrumentedTest | launcher | failed | flagOffTransportRefusesEveryNonCloudRouteBeforeConnecting | run4-flagoff-home |
| ConnectionRoutesInstrumentedTest | standalone | failed | flagOffTransportRefusesEveryNonCloudRouteBeforeConnecting | run4-flagoff-home |
| DailyAppsInstrumentedTest | launcher | failed | localReminderPostsRealNotificationAndTapOpensItsContext, calendarFormCreatesAndDeletesRealReminder | run6-testmocks-confirm |
| DailyAppsInstrumentedTest | standalone | failed | localReminderPostsRealNotificationAndTapOpensItsContext, calendarFormCreatesAndDeletesRealReminder | run6-testmocks-confirm |
| HostedBackgroundWorkerInstrumentedTest | launcher | passed |  | run6-testmocks-confirm |
| HostedBackgroundWorkerInstrumentedTest | standalone | passed |  | run6-testmocks-confirm |
| HostedResultNoticeInstrumentedTest | launcher | failed | resultAndRenewalBuildersExpireAndStayRedacted | run4-flagoff-home |
| HostedResultNoticeInstrumentedTest | standalone | failed | resultAndRenewalBuildersExpireAndStayRedacted | run4-flagoff-home |
| JourneyJ05InstrumentedTest | launcher | failed | pageQuestionReachesSendAndItsSourceNoteReopensThePage | run4-flagoff-home |
| JourneyJ05InstrumentedTest | standalone | failed | pageQuestionReachesSendAndItsSourceNoteReopensThePage | run4-flagoff-home |
| LauncherAppsInstrumentedTest | launcher | passed |  | run4-flagoff-home |
| LauncherAppsInstrumentedTest | standalone | passed |  | run4-flagoff-home |
| LauncherHomeInstrumentedTest | launcher | failed | killedRendererWhileHomeRecoversOneMainActivityAndHomeStillReturns | run6-testmocks-confirm |
| LiveVoiceVadInstrumentedTest | launcher | passed |  | run3-voice-offline-launcher |
| LiveVoiceVadInstrumentedTest | standalone | passed |  | run2-voice-offline |
| LocalSpeechBridgeInstrumentedTest | launcher | passed |  | run3-voice-offline-launcher |
| LocalSpeechBridgeInstrumentedTest | standalone | passed |  | run2-voice-offline |
| LocalSpeechInstrumentedTest | launcher | passed |  | run3-voice-offline-launcher |
| LocalSpeechInstrumentedTest | standalone | passed |  | run2-voice-offline |
| MapsInstrumentedTest | launcher | failed | coordinatesSaveRenamePersistAndRemoveWithoutInventedProviderData, calendarLocationReturnsToTheSameEventAndFailsClosed | run6-testmocks-confirm |
| MapsInstrumentedTest | standalone | failed | coordinatesSaveRenamePersistAndRemoveWithoutInventedProviderData, calendarLocationReturnsToTheSameEventAndFailsClosed | run6-testmocks-confirm |
| NoteOriginInstrumentedTest | launcher | passed |  | run4-flagoff-home |
| NoteOriginInstrumentedTest | standalone | passed |  | run4-flagoff-home |
| NotesDocumentInstrumentedTest | launcher | passed |  | run4-flagoff-home |
| NotesDocumentInstrumentedTest | standalone | passed |  | run4-flagoff-home |
| NotesStorageDurabilityInstrumentedTest | launcher | failed | loweredTrashCapKeepsOlderOversizeTrashReadableAndShrinkable | run4-flagoff-home |
| NotesStorageDurabilityInstrumentedTest | standalone | failed | loweredTrashCapKeepsOlderOversizeTrashReadableAndShrinkable | run4-flagoff-home |
| NotesTrashBackstopInstrumentedTest | launcher | passed |  | run4-flagoff-home |
| NotesTrashBackstopInstrumentedTest | standalone | passed |  | run4-flagoff-home |
| PasswordVaultFillInstrumentedTest | launcher | failed | saveFillOnlyExactPackageRefuseAnotherCancelAndLock | run4-flagoff-home |
| PasswordVaultFillInstrumentedTest | standalone | failed | saveFillOnlyExactPackageRefuseAnotherCancelAndLock | run4-flagoff-home |
| PasswordVaultSettingsInstrumentedTest | launcher | failed | unlockAddListSearchRevealCopyAndLockWithoutLeakingSecrets | run6-testmocks-confirm |
| PasswordVaultSettingsInstrumentedTest | standalone | failed | unlockAddListSearchRevealCopyAndLockWithoutLeakingSecrets | run6-testmocks-confirm |
| PosterCalendarJourneyInstrumentedTest | launcher | failed | cancellingTheScanOrTheCalendarReviewLeavesNoRow, posterBecomesExactlyOneReviewedProviderEventShownOnHome | run6-testmocks-confirm |
| PosterCalendarJourneyInstrumentedTest | standalone | failed | cancellingTheScanOrTheCalendarReviewLeavesNoRow, posterBecomesExactlyOneReviewedProviderEventShownOnHome | run6-testmocks-confirm |
| ReminderLifecycleInstrumentedTest | launcher | failed | rebootWithChangedBootIdRepostsPostedOnceWithSameRouteAndNoRecurrenceAdvance | run4-flagoff-home |
| ReminderLifecycleInstrumentedTest | standalone | failed | rebootWithChangedBootIdRepostsPostedOnceWithSameRouteAndNoRecurrenceAdvance | run4-flagoff-home |
| RendererRecoveryInstrumentedTest | launcher | failed | killedRendererRecreatesOneMainActivityWithThePage | run6-testmocks-confirm |
| RendererRecoveryInstrumentedTest | standalone | failed | killedRendererRecreatesOneMainActivityWithThePage | run6-testmocks-confirm |
| ResidentAlwaysPresentInstrumentedTest | launcher | failed | signedOutOfflineStartsTheResidentAndSendsNothing | run2-voice-offline |
| ResidentAlwaysPresentInstrumentedTest | standalone | failed | signedOutOfflineStartsTheResidentAndSendsNothing | run2-voice-offline |
| RotationInstrumentedTest | launcher | passed |  | run6-testmocks-confirm |
| RotationInstrumentedTest | standalone | passed |  | run6-testmocks-confirm |
| SelectedDocumentInstrumentedTest | launcher | passed |  | run6-testmocks-confirm |
| SelectedDocumentInstrumentedTest | standalone | passed |  | run6-testmocks-confirm |
| SettingsRolesInstrumentedTest | launcher | failed | homeRequestDeclineAndAcceptMatchRoleHolders | run6-testmocks-confirm |
| SpeechSentenceCancellationInstrumentedTest | launcher | passed |  | run3-voice-offline-launcher |
| SpeechSentenceCancellationInstrumentedTest | standalone | passed |  | run2-voice-offline |
| VoiceNoteReadAloudInstrumentedTest | launcher | passed |  | run3-voice-offline-launcher |
| VoiceNoteReadAloudInstrumentedTest | standalone | passed |  | run2-voice-offline |
| WorkflowApprovalNoticeInstrumentedTest | launcher | failed | approvalNoticeTapAfterAccountChangeIsFencedWithoutAStaleApproval | run6-testmocks-confirm |
| WorkflowApprovalNoticeInstrumentedTest | standalone | failed | approvalNoticeTapAfterAccountChangeIsFencedWithoutAStaleApproval | run6-testmocks-confirm |

Fixes are in progress in the draft PRs #510, #511, #512, #513 and #515 (one per area).
