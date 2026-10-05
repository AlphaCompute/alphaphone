import { Capacitor } from '@capacitor/core';
import { devSurfacesEnabled } from '../build-flags';
/** Explicit local device simulator; never selected in an Android package or a
 * build without ELIZA_DEV_ALLOW_TEST_MOCKS=1 on the development server. */
export const browserDevProfile=devSurfacesEnabled&&!Capacitor.isNativePlatform()&&new URLSearchParams(location.search).get('mode')==='dev';

export const developmentAgentWorkflows=browserDevProfile&&new URLSearchParams(location.search).get('workflows')==='agent';
