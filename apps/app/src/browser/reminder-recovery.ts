import {reminderActionDocument} from './reminder-action-document';
import {reminderCreationDocument} from './reminder-creation-document';
import {reminderDocument} from './reminder-store';
import {openDomainRecovery} from './domain-recovery';
export function openReminderRecovery(){openDomainRecovery(reminderDocument,'reminders','Browser reminder recovery','Download your saved reminders before resetting. Reset clears reminders, alarms and their action receipts. An older saved copy stays available as a backup. Close older Alpha tabs before continuing.');}

export function openReminderCreationRecovery(){openDomainRecovery(reminderCreationDocument,'reminder creation history','Browser reminder creation recovery','Download the request-history archive before resetting. An unconfirmed reminder may already exist. Check saved reminders before creating replacements. Reset clears only browser creation history; it does not cancel or remove reminders, undo their effects or create another reminder. Close older Alpha tabs before continuing.');}

export function openReminderActionRecovery(){openDomainRecovery(reminderActionDocument,'reminder action history','Browser reminder action recovery','Download the request-history archive before resetting. An unconfirmed action may already have changed a reminder. Check saved reminders before trying again. Reset clears only browser action history; it does not undo, repeat or cancel reminder actions. Close older Alpha tabs before continuing.');}
