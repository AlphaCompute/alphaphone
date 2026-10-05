import {calendarDocument} from './calendar-store';
import {openDomainRecovery} from './domain-recovery';
export function openCalendarRecovery(){openDomainRecovery(calendarDocument,'calendar','Browser calendar recovery','Download your saved calendar before resetting. Reset clears active events, preferences and action receipts. An older saved copy stays available as a backup. Close older Alpha tabs before continuing.');}
