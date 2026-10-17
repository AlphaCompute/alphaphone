import {Capacitor} from '@capacitor/core';
/** Explicit Mac preview only. The paired agent owns Cloud credentials; the page never does.
 * The environment guard also keeps Node-only protocol consumers inert. */
export const developmentCloudVoiceEnabled=import.meta.env!==undefined&&import.meta.env.DEV===true&&import.meta.env.VITE_ELIZA_DEV_ALLOW_TEST_MOCKS==='1'&&!Capacitor.isNativePlatform()&&import.meta.env.VITE_ALPHA_DEV_CLOUD_VOICE==='1';
