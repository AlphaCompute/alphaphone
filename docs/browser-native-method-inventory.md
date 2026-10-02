# Native bridge method inventory

Generated from product main/debug Android source on October 2, 2026; instrumentation fixtures are excluded. This is an audit checklist, not a statement that every browser method is implemented.

| Plugin | Methods | Source |
| --- | --- | --- |
| Agent | `configureProvider`, `start`, `getStatus`, `stop`, `request`, `cancelStream`, `requestStream` | `android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaLocalAgentPlugin.java` |
| AlphaActionJournal | `reserve`, `markApplying`, `finish`, `recoverReminder`, `get`, `list` | `android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaActionJournalPlugin.java` |
| AlphaBrowser | `create`, `navigate`, `command`, `present`, `bookmarks`, `setBookmark`, `reviewReading`, `cancelReading`, `share`, `downloads`, `close` | `android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaBrowserPlugin.java` |
| AlphaCalendar | `requestAccess`, `list`, `requestWorkflowReadAccess`, `workflowCalendars`, `readWorkflowRange`, `open`, `inspect`, `remove`, `prepareAgentSource`, `cancelAgent`, `executeAgent`, `save` | `android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaCalendarPlugin.java` |
| AlphaConnection | `readDelegationCallback`, `clearDelegationCallback`, `secureWrite`, `pauseNotificationCollection`, `secureRead`, `secureCompareExchange`, `secureRemove`, `request`, `cancel`, `openExternal` | `android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaConnectionPlugin.java` |
| AlphaDevice | `setTextScale`, `snapshot`, `openSettings` | `android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaDevicePlugin.java` |
| AlphaFiles | `choose`, `list`, `createFolder`, `rename`, `delete`, `move`, `select`, `forget` | `android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaFilesPlugin.java` |
| AlphaHostedResults | `beginBackground`, `cancelBackground`, `configureBackground`, `disableBackground`, `syncInbox`, `setBackgroundPolling`, `inboxHistory`, `publishResult`, `pendingResult`, `consumeResult`, `status`, `enable` | `android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaHostedResultsPlugin.java` |
| AlphaMailAttachments | `readSelected`, `cancel`, `openReviewed` | `android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaMailAttachmentsPlugin.java` |
| AlphaMapsTransport | `request`, `cancel` | `android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaMapsTransportPlugin.java` |
| AlphaNoteAudio | `migrationStatus`, `describe`, `play`, `stop`, `state`, `remove`, `restore` | `android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaNoteAudioPlugin.java` |
| AlphaNoteDocuments | `importText`, `exportText` | `android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaNoteDocumentsPlugin.java` |
| AlphaNotifications | `status`, `openChannelSettings`, `crossAppStatus`, `notificationApps`, `setNotificationPolicy`, `resumeCrossApp`, `openNotificationAccess`, `notificationHistory`, `clearNotificationHistory`, `list`, `open`, `dismiss`, `clear` | `android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaNotificationsPlugin.java` |
| AlphaPhotos | `beginEdit`, `previewEdit`, `saveEdit`, `editResult`, `cancelEdit`, `list`, `read`, `share`, `shareMany`, `setTrashed`, `setFavorite`, `changeMany`, `summary`, `prepareDeleteTrash`, `cancelDeleteTrash`, `deletePreparedTrash`, `albums`, `changeAlbum` | `android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaPhotosPlugin.java` |
| AlphaVoiceCloud | `releaseLocalSpeech`, `startRecording`, `stopRecording`, `saveRecording`, `cancelRecording`, `pairedVoiceStatus`, `pairedTranscriptionStatus`, `transcribePairedRecording`, `synthesizePaired`, `synthesizeBrowserReading`, `transcribeRecording`, `localSpeechStatus`, `transcribeLocalRecording`, `synthesizeLocal`, `synthesize`, `play`, `stopPlayback`, `cancel` | `android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaVoiceCloudPlugin.java` |
| DailyApps | `surfaceInfo`, `closeAssistant`, `scheduleReminder`, `reminderDecision`, `selectedReminder`, `reminderOperationReceipt`, `operateReminder`, `listReminders`, `cancelReminder`, `restoreSelected`, `renameSelected`, `pdfSelected`, `readSelected`, `openSelected`, `shareSelected`, `forgetSelected`, `clockHandoff`, `capabilities`, `perform` | `android/app/src/main/java/ai/elizaresearch/alphaphone/DailyAppsPlugin.java` |
| DevelopmentAgent | `startRecording`, `stopRecording`, `saveRecording`, `cancelRecording`, `transcribeRecording`, `status`, `chat`, `cancel` | `android/app/src/debug/java/ai/elizaresearch/alphaphone/DevelopmentAgentPlugin.java` |
| DeviceApps | `buildInfo`, `list`, `launch` | `android/app/src/main/java/ai/elizaresearch/alphaphone/DeviceAppsPlugin.java` |

Total: 18 plugin declarations, 162 method declarations.

Imported upstream ports used by the renderer also require parity: ElizaSystem (status/settings/default roles), ElizaCamera (preview/capture/recording/focus/zoom/flash), ElizaContacts (permission/list/create), ElizaLocation (permission/watch/clear), and Capacitor SystemBars (style/insets). Their checkouts remain pinned and unmodified.

See [implementation and acceptance ledger](browser-dev-parity.md) for each capability group and remaining work.
