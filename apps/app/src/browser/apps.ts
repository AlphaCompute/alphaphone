import { browserDevProfile } from './dev-profile';
import { devSurfacesEnabled } from '../build-flags';
const all = [
 ['mail','Mail','inbox'],['calendar','Calendar','calendar'],['messages','Messages','messages'],
 ['browser','Browser','browser'],['camera','Camera','camera'],['photos','Photos','photos'],
 ['maps','Maps','maps'],['notes','Notes','notes'],['files','Files','files'],
 ['workflows','Workflows','workflows'],['phone','Phone','phone'],['contacts','Contacts','contacts'],
 ['wallet','Wallet','wallet'],['settings','Settings','settings'],
];
const deferred=new Set(['messages','phone','contacts','wallet']);
/** Stable package identities shared by app launching and development event sources. */
export const browserApps=all.filter(([id])=>devSurfacesEnabled&&browserDevProfile||!deferred.has(id)).map(([id,label,view])=>({packageName:`browser.${id}`,label,view}));
