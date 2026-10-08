/** Decode an owned browser clip to bounded 16 kHz mono samples. */
export async function recordingPcmSamples(blob:Blob,signal:AbortSignal):Promise<Float32Array>{
 signal.throwIfAborted();
 if(!blob.size||blob.size>16_000_000)throw Error('Recording size is invalid.');
 const context=new OfflineAudioContext(1,1,16000);
 const decoded=await context.decodeAudioData(await blob.arrayBuffer());
 signal.throwIfAborted();
 if(!Number.isFinite(decoded.duration)||decoded.duration<=0||decoded.duration>60)throw Error('Keep recordings under 60 seconds.');
 const length=Math.ceil(decoded.duration*16000),renderer=new OfflineAudioContext(1,length,16000);
 const source=renderer.createBufferSource();source.buffer=decoded;source.connect(renderer.destination);source.start();
 const rendered=await renderer.startRendering();signal.throwIfAborted();
 return rendered.getChannelData(0);
}
/** Convert an owned browser clip to bounded mono PCM16 WAV for local-agent ASR. */
export async function recordingPcmWav(blob:Blob,signal:AbortSignal):Promise<Uint8Array>{
 const samples=await recordingPcmSamples(blob,signal),bytes=new Uint8Array(44+samples.length*2),view=new DataView(bytes.buffer);
 const text=(offset:number,value:string)=>{for(let i=0;i<value.length;i++)bytes[offset+i]=value.charCodeAt(i);};
 text(0,'RIFF');view.setUint32(4,bytes.length-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);
 view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);
 text(36,'data');view.setUint32(40,samples.length*2,true);
 for(let i=0;i<samples.length;i++){const value=Math.max(-1,Math.min(1,samples[i]));view.setInt16(44+i*2,Math.round(value*(value<0?32768:32767)),true);}
 return bytes;
}
