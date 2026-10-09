import {calendarDocument} from './calendar-store';
import {openDomainRecovery} from './domain-recovery';
import {prepareCalendarBackup,prepareCalendarSalvage} from './calendar-backup';
import {revision} from './revision';
export function openCalendarRecovery(){openDomainRecovery(calendarDocument,'calendar','App calendar recovery','Download your saved calendar before resetting or restoring event copies. Reset clears active events, preferences and action receipts. An older saved copy stays available as a backup. Close older Alpha tabs before continuing.',undefined,{
 prepare(raw){const state=prepareCalendarBackup(raw,revision);return {raw:JSON.stringify(state),summary:`${state.events.length} event record(s) in this backup.\n`+state.events.slice(0,20).map(event=>event.title).join('\n')+(state.events.length>20?'\n…':'')};},
 salvage(raw){const {state,skipped}=prepareCalendarSalvage(raw,revision);return {raw:JSON.stringify(state),summary:`${state.events.length} event record(s) can be recovered; ${skipped.length} record(s) will be skipped.\nOnly complete valid recurring series are kept. Keep the original backup for skipped records.\n`+state.events.slice(0,20).map(event=>event.title).join('\n')+(state.events.length>20?'\n…':'')+'\n'+skipped.slice(0,20).map(row=>`Skipped record ${row.index}: ${row.reason}`).join('\n')+(skipped.length>20?'\nMore skipped records are retained in your original backup.':'')};},
 save:(expected,raw,signal)=>calendarDocument.restore(expected,raw,signal),
});}
