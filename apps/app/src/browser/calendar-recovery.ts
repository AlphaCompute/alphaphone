import {calendarDocument} from './calendar-store';
import {openDomainRecovery} from './domain-recovery';
/**
 * Damaged-storage recovery only. Alpha has no app-data backup, import or restore (P-25): a calendar
 * cannot be restored from a file, and reset is the only way forward for unreadable saved events.
 */
export function openCalendarRecovery(){openDomainRecovery(calendarDocument,'calendar','App calendar recovery','Saved calendar data cannot be read. Reset clears active events, preferences and action receipts so the calendar works again. You can download the unreadable saved bytes first for inspection; they cannot be restored into Alpha. Close older Alpha tabs before continuing.');}
