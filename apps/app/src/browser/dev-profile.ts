import { Capacitor } from '@capacitor/core';
/** Explicit local device simulator; never selected in an Android package. */
export const browserDevProfile=(import.meta.env?.DEV===true)&&!Capacitor.isNativePlatform()&&new URLSearchParams(location.search).get('mode')==='dev';

export const developmentAgentWorkflows=browserDevProfile&&new URLSearchParams(location.search).get('workflows')==='agent';
