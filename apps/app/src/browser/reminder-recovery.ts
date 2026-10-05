import {reminderDocument} from './reminder-store';
import {openDomainRecovery} from './domain-recovery';
export function openReminderRecovery(){openDomainRecovery(reminderDocument,'reminders','Browser reminder recovery','Download your saved reminders before resetting. Reset clears reminders, alarms and their action receipts. An older saved copy stays available as a backup. Close older Alpha tabs before continuing.');}
