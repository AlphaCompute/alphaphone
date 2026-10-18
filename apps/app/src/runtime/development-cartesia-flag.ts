import {Capacitor} from '@capacitor/core';
import {devSurfacesEnabled} from '../build-flags';
export const developmentCartesiaVoiceEnabled=import.meta.env.DEV===true&&devSurfacesEnabled&&!Capacitor.isNativePlatform()&&import.meta.env.VITE_ALPHA_DEV_CARTESIA==='1';
