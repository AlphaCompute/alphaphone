export class BrowserAlertAudio {
 private context?:AudioContext;
 private tones=new Set<OscillatorNode>();
 constructor(){const prime=()=>{try{this.context??=new AudioContext();void this.context.resume().catch(()=>{});}catch{}};document.addEventListener('pointerdown',prime,true);document.addEventListener('keydown',prime,true);window.addEventListener('alpha:device-settings',()=>this.stop());window.addEventListener('pagehide',()=>{this.stop();void this.context?.close().catch(()=>{});this.context=undefined;});}
 play(stream:'ring'|'alarm'){
  let settings:any;try{settings=JSON.parse(localStorage.getItem('alpha.browser.device.v1')||'{}');}catch{return;}if(settings.doNotDisturb||document.hidden||document.documentElement.dataset.devBackground==='true')return;
  const requested=Number(settings[stream]??70),volume=Number.isFinite(requested)?Math.max(0,Math.min(100,requested))/100:.7,context=this.context;if(!volume||!context||context.state!=='running')return;
  const tone=context.createOscillator(),gain=context.createGain(),at=context.currentTime;tone.frequency.value=stream==='alarm'?880:660;gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(volume*.12,at+.015);gain.gain.linearRampToValueAtTime(0,at+.3);tone.connect(gain);gain.connect(context.destination);this.tones.add(tone);tone.onended=()=>{tone.disconnect();gain.disconnect();this.tones.delete(tone);};tone.start();tone.stop(at+.32);
 }
 stop(){for(const tone of this.tones){try{tone.stop();}catch{}tone.disconnect();}this.tones.clear();}
}
