/** Meter only the microphone stream already admitted by the recording session. */
const meters=new Map<string,{context:AudioContext;analyser:AnalyserNode;samples:Float32Array<ArrayBuffer>}>();
export function startRecordingMeter(id:string,stream:MediaStream):()=>void {
 let context:AudioContext|undefined,source:MediaStreamAudioSourceNode|undefined,analyser:AnalyserNode|undefined;
 let closed=false;
 const close=()=>{if(closed)return;closed=true;if(meters.get(id)?.context===context)meters.delete(id);source?.disconnect();analyser?.disconnect();if(context)void context.close().catch(()=>{});};
 try{context=new AudioContext();source=context.createMediaStreamSource(stream);analyser=context.createAnalyser();analyser.fftSize=2048;source.connect(analyser);meters.set(id,{context,analyser,samples:new Float32Array(analyser.fftSize)});void context.resume().catch(close);}
 catch{close();}
 return close;
}
export function recordingLevels(id?:string):{h:number}[]{
 const meter=id?meters.get(id):undefined;
 if(!meter||meter.context.state!=='running')return Array.from({length:44},()=>({h:4}));
 meter.analyser.getFloatTimeDomainData(meter.samples);
 return Array.from({length:44},(_,index)=>{const from=Math.floor(index*meter.samples.length/44),to=Math.floor((index+1)*meter.samples.length/44);let power=0;for(let i=from;i<to;i++)power+=meter.samples[i]**2;return {h:4+Math.round(44*Math.min(1,Math.sqrt(power/(to-from))*4))};});
}

/** PCM metrics from the same admitted microphone stream, never synthesized activity. */
export function recordingMetrics(id:string):{peak:number;rms:number}{
 const meter=meters.get(id);if(!meter||meter.context.state!=='running')throw Error('Recording metrics are unavailable.');
 meter.analyser.getFloatTimeDomainData(meter.samples);let power=0,peak=0;
 for(const sample of meter.samples){power+=sample*sample;peak=Math.max(peak,Math.abs(sample));}
 return {peak,rms:Math.sqrt(power/meter.samples.length)};
}
