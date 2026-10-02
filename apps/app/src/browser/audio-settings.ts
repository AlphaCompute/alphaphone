/** Alpha-owned media volume; never changes the host computer's output level. */
export function browserMediaVolume(){try{const value=JSON.parse(localStorage.getItem('alpha.browser.device.v1')||'{}').music;return typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(1,value/100)):.7;}catch{return .7;}}
let installed=false;
export function installBrowserAudioSettings(){if(installed)return;installed=true;const apply=()=>document.querySelectorAll<HTMLMediaElement>('.os audio,.os video').forEach(media=>{media.volume=browserMediaVolume();});window.addEventListener('alpha:device-settings',apply);document.addEventListener('play',event=>{const media=event.target;if(media instanceof HTMLMediaElement&&media.closest('.os'))media.volume=browserMediaVolume();},true);apply();}
