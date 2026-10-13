import {registerPlugin} from '../platform-plugins';
export type DeletionEntry={id:string;kind:'calendar'|'reminder';phase:string;window?:string;expiresAt?:number;deadline?:{expiresAt:number};target:{row?:{title?:string};fields?:{title?:string}};original?:{title?:string}};
export const deletions=registerPlugin<{
 receipt(input:{entry:import("./device-actions").JournalEntry}):Promise<{recovery:{status:"succeeded"|"failed";summary:string;result:Record<string,unknown>}|null}>;
 pending():Promise<{deletions:DeletionEntry[];deletedOrigins?:Array<{kind:'event'|'reminder';id:string}>}>;
 dismiss(input:{kind:string;id:string}):Promise<unknown>;
 undo(input:{kind:string;id:string}):Promise<unknown>;
 reviewReminder(input:{target:unknown}):Promise<{status:string}>;
 reviewAgentReminder(input:{operation:unknown;operationId:string;bindingHash:string;journalIdentity:unknown}):Promise<{status:string}>;
}>('AlphaDeletions');
export function refreshDeletionViews(){window.dispatchEvent(new Event('alpha:deletions-changed'));window.dispatchEvent(new Event('alpha:calendar-document-changed'));window.dispatchEvent(new Event('alpha:reminders-document-changed'));}
