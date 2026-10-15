/*
MIT License

Copyright (c) 2026 Shaw Walters and elizaOS Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Original ComposerRealtimeVoiceWaveform: elizaOS/eliza bfc1168fa637fb3213437e5e3bca4f7820a12701.
Source: packages/ui/src/components/shell/ChatOverlay.tsx
Source SHA256: d4fa88029fe7aa1bab38d74f2fadec8f0bd566820acc6c0d192a334e72198751
Adaptation: original five-bar motif repeated across the composer, with phase keyframes, stagger and easing via WAAPI.
Color follows Alpha accent. Phase motion is not an audio-amplitude meter.
*/
import {useEffect,useLayoutEffect,useRef,useState} from 'react';

export const voiceBarHeights = [8, 13, 18, 13, 8] as const;
const composerBarHeights = Array.from({length:35},(_,index)=>voiceBarHeights[index%voiceBarHeights.length]);

export const voiceVisuals: Record<string,{scaleY:number[];opacity:number[];duration:number}> = {
  idle: { scaleY: [0.28], opacity: [0.42], duration: 0 },
  connecting: {
    scaleY: [0.26, 0.48, 0.26],
    opacity: [0.35, 0.88, 0.35],
    duration: 1.05,
  },
  listening: {
    scaleY: [0.32, 0.9, 0.48, 1, 0.32],
    opacity: [0.58, 1, 0.72, 0.94, 0.58],
    duration: 0.92,
  },
  transcribing: {
    scaleY: [0.38, 0.7, 0.38],
    opacity: [0.52, 0.92, 0.52],
    duration: 0.72,
  },
  thinking: {
    scaleY: [0.24, 0.52, 0.24],
    opacity: [0.38, 0.92, 0.38],
    duration: 1.18,
  },
  speaking: {
    scaleY: [0.42, 1, 0.52, 0.84, 0.42],
    opacity: [0.68, 1, 0.8, 0.96, 0.68],
    duration: 0.64,
  },
  interrupting: {
    scaleY: [0.58, 0.22],
    opacity: [0.82, 0.36],
    duration: 0.2,
  },
  paused: { scaleY: [0.24], opacity: [0.36], duration: 0 },
  error: { scaleY: [0.34], opacity: [1], duration: 0 },
};


export function VoiceActivity({phase,theme,compact=false}:{phase:string;theme:'light'|'dark';compact?:boolean}){
 const [reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 const root=useRef<HTMLSpanElement>(null);
 useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)'),changed=()=>setReduced(media.matches);media.addEventListener('change',changed);changed();return()=>media.removeEventListener('change',changed);},[]);
 const visual=voiceVisuals[phase]??voiceVisuals.idle,paused=reduced||visual.duration===0;
 useLayoutEffect(()=>{
  if(paused)return;
  const animations=[...(root.current?.children??[])].flatMap((element,index)=>typeof element.animate==='function'?[element.animate(visual.scaleY.map((scale,frame)=>({transform:`scaleY(${scale})`,opacity:visual.opacity[frame],easing:'ease-in-out'})),{duration:visual.duration*1000,iterations:Infinity,delay:(index%voiceBarHeights.length)*55,easing:'linear',fill:'both'})]:[]);
  const visibility=()=>{for(const animation of animations)if(document.hidden)animation.pause();else animation.play();};visibility();document.addEventListener('visibilitychange',visibility);
  return()=>{document.removeEventListener('visibilitychange',visibility);for(const animation of animations)animation.cancel();};
 },[visual,paused]);
 return <span ref={root} aria-hidden="true" data-alpha-voice-animation data-phase={phase} data-theme={theme} data-paused={paused}>
  {(compact?voiceBarHeights:composerBarHeights).map((height,index)=><span key={index} data-alpha-voice-bar style={{height,transform:`scaleY(${visual.scaleY.at(-1)})`,opacity:visual.opacity.at(-1)}}/>)}
 </span>;
}
