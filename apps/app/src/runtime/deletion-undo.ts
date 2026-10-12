import {registerPlugin} from '../platform-plugins';
import {DailyApps} from '../daily';
import {pendingDeletionStore} from './pending-deletion-store';
import {pendingReminderDeletions,retainReminderDeletion,acknowledgeReminderDeletion} from './reminder-deletions';
import {createDeletionUndo,deletionProvider,type CalendarDeletionBridge,type DeletionUndo} from './deletion-undo-core';
export type {DeletionUndo} from './deletion-undo-core';

let shared:DeletionUndo|undefined;
/** Shared by Calendar events and reminders so one timer and one reconciliation serve both. */
export function deletionUndo():DeletionUndo{
  return shared??=createDeletionUndo(pendingDeletionStore,deletionProvider(registerPlugin<CalendarDeletionBridge>('AlphaCalendar'),DailyApps,{pending:pendingReminderDeletions,retain:retainReminderDeletion,acknowledge:acknowledgeReminderDeletion}));
}
