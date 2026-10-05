import {bookmarkDocument,alertSoundDocument} from './preference-documents';
import {openDomainRecovery} from './domain-recovery';
export function openBookmarkRecovery(){openDomainRecovery(bookmarkDocument,'bookmarks','Browser bookmark recovery','Download saved bookmarks before resetting. Reset clears saved bookmarks and keeps the older copy available for backup. Close older Alpha tabs before continuing.');}
export function openAlertSoundRecovery(){openDomainRecovery(alertSoundDocument,'alert sound history','Notification sound recovery','Download saved sound history before resetting. Reset clears remembered notification sounds. Existing notices may sound once again. The older copy remains available for backup. Close older Alpha tabs before continuing.');}
