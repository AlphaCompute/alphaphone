import { isAndroid } from '../native';
import { registerPlugin } from '../platform-plugins';
import { pauseHostedBackground } from './hosted-background';

/** No simulated UI is admitted until both independent live collectors are fenced. */
export async function pauseLiveActivityForMock():Promise<void> {
 if(!isAndroid)return;
 const results=await Promise.allSettled([
  Promise.resolve().then(()=>registerPlugin<{pauseNotificationCollection():Promise<void>}>('AlphaConnection').pauseNotificationCollection()),
  Promise.resolve().then(()=>pauseHostedBackground()),
 ]);
 if(results.some(result=>result.status==='rejected'))throw Error('Live background activity could not be paused. Retry before opening mock mode.');
}
