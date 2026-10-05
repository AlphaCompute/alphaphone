import {browserDocuments} from './documents';
import {BrowserDomainDocument} from './domain-document';

export const reminderCreationStorageKey='alpha.browser.reminder-creations.v1';
// The archive preserves exact older bytes, including a literal null or malformed JSON.
export const reminderCreationDocument=new BrowserDomainDocument(browserDocuments,reminderCreationStorageKey,()=>{
 const raw=localStorage.getItem(reminderCreationStorageKey);
 return raw===null?null:JSON.stringify({raw});
});
export type ReminderCreationArchive={raw:string|null};
export const emptyReminderCreationArchive=():ReminderCreationArchive=>({raw:null});
export function reminderCreationArchiveRaw(value:ReminderCreationArchive):string|null{
 if(!value||!Object.hasOwn(value,'raw')||value.raw!==null&&typeof value.raw!=='string'||Object.keys(value).some(key=>key!=='raw'))throw Error('Reminder creation history needs recovery');
 return value.raw;
}
