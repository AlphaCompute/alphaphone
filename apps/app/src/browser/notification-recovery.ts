import {notificationDocument} from './notification-store';
import {openDomainRecovery} from './domain-recovery';
export function openNotificationRecovery(){openDomainRecovery(notificationDocument,'notifications','Browser notification recovery','Download saved notification data before resetting. Reset clears notification settings, device events and history. Cross-app collection returns to off. The older saved copy remains available. Close older Alpha tabs before continuing.');}
