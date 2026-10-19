import {openSharePanel,composeSharedText,sharedTextEmailAvailable} from '../runtime/share-panel';
import {shareSelectedText,copySelectedText} from '../runtime/text-share';
import { type MapShare } from '../../../../.eliza/client-features/plugins/plugin-maps/src/client/share.ts';
export { placeShare, routeShare, type MapShare } from '../../../../.eliza/client-features/plugins/plugin-maps/src/client/share.ts';
export function shareMap(data:MapShare,signal:AbortSignal):Promise<'shared'|'copied'|'closed'> {
 signal.throwIfAborted();const snapshot=Object.freeze({title:data.title,text:[data.text,data.url].filter(Boolean).join('\n')});
 return openSharePanel({title:snapshot.title,current:()=>!signal.aborted,external:()=>shareSelectedText(snapshot,signal),email:sharedTextEmailAvailable()?()=>composeSharedText(snapshot.title,snapshot.text):undefined,copy:()=>copySelectedText(data.url||snapshot.text),copyLabel:data.url?'Copy link':'Copy text'}).then(()=> 'closed');
}
