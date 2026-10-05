import {cachedDevicePreferences} from './device-preferences';
/** Alpha-owned media volume; never changes the host computer's output level. */
export function browserMediaVolume(){return (cachedDevicePreferences()?.music??0)/100;}
let installed=false;
export function installBrowserAudioSettings(){if(installed)return;installed=true;const apply=()=>document.querySelectorAll<HTMLMediaElement>('.os audio,.os video').forEach(media=>{media.volume=browserMediaVolume();});window.addEventListener('alpha:device-settings',apply);document.addEventListener('play',event=>{const media=event.target;if(media instanceof HTMLMediaElement&&media.closest('.os'))media.volume=browserMediaVolume();},true);apply();}
