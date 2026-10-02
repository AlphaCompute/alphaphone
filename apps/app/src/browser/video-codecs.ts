/** A reported codec can still fail to allocate; always retain the browser default as a final choice. */
export function* videoRecorders(stream:MediaStream):Generator<MediaRecorder>{
 if(typeof MediaRecorder==='undefined')return;
 const types=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/mp4','video/webm'];
 for(const mimeType of [...types,undefined]){
  try{if(mimeType&&!MediaRecorder.isTypeSupported(mimeType))continue;yield mimeType?new MediaRecorder(stream,{mimeType}):new MediaRecorder(stream);}catch{/* Try the next local encoder. */}
 }
}
