/** Development-only host ASR. No network calls; audio is removed in finally. */
import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { homedir, tmpdir } from 'node:os';
export const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const model = process.env.ALPHA_ASR_MODEL || join(homedir(),'.cache/alphaphone-asr/tiny.en/ggml-model.bin');
const whisper = process.env.ALPHA_WHISPER_BIN || '/opt/homebrew/bin/whisper-cli';
const ffmpeg = process.env.ALPHA_FFMPEG_BIN || '/opt/homebrew/bin/ffmpeg';
const ffprobe = process.env.ALPHA_FFPROBE_BIN || '/opt/homebrew/bin/ffprobe';
export async function localAsrAvailable() {
 try { await Promise.all([access(model,constants.R_OK),...[whisper,ffmpeg,ffprobe].map(p=>access(p,constants.X_OK))]); return true; } catch { return false; }
}
function run(executable,args,signal,timeout=20000) {
 return new Promise((resolve,reject)=>{
  if(signal?.aborted) { reject(new Error('cancelled')); return; }
  const child=spawn(executable,args,{stdio:['ignore','pipe','pipe']});
  let stdout='',size=0,settled=false;
  const finish=(error)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);error?reject(error):resolve(stdout);};
  const abort=()=>{child.kill('SIGKILL');};
  const timer=setTimeout(abort,timeout);
  signal?.addEventListener('abort',abort,{once:true});
  child.stdout.on('data',chunk=>{size+=chunk.length;if(size>262144)abort();else stdout+=chunk.toString();});
  child.stderr.resume(); // diagnostics may contain transcript/path data; never log them
  child.on('error',()=>finish(new Error('ASR executable unavailable')));
  child.on('close',code=>finish(code===0&&!signal?.aborted?undefined:new Error(signal?.aborted?'cancelled':'ASR process failed or timed out')));
 });
}
export async function transcribeLocal(audio,mimeType,signal) {
 if(!Buffer.isBuffer(audio)||audio.length===0||audio.length>MAX_AUDIO_BYTES)throw new Error('Invalid audio size');
 if(!['audio/wav','audio/x-wav','audio/mp4','audio/m4a','audio/aac','audio/webm'].includes(mimeType))throw new Error('Unsupported audio type');
 if(!await localAsrAvailable())throw new Error('Local ASR is not configured');
 const directory=await mkdtemp(join(tmpdir(),'alphaphone-audio-'));
 try {
  const input=join(directory,'input.audio'),wav=join(directory,'audio.wav'),output=join(directory,'transcript');
  await writeFile(input,audio,{mode:0o600});
  const metadata=JSON.parse(await run(ffprobe,['-v','error','-protocol_whitelist','file,pipe','-show_entries','format=duration:stream=codec_type','-of','json',input],signal));
  const duration=Number(metadata.format?.duration);
  if(!Number.isFinite(duration)||duration<=0||duration>60||!metadata.streams?.some(stream=>stream.codec_type==='audio'))throw new Error('Audio must contain at most 60 seconds of speech');
  await run(ffmpeg,['-nostdin','-v','error','-protocol_whitelist','file,pipe','-i',input,'-map','0:a:0','-vn','-ar','16000','-ac','1','-c:a','pcm_s16le','-t','60',wav],signal);
  const decoded=await readFile(wav);
  let hasSignal=false;
  for(let offset=12;offset+8<=decoded.length;) {
   const size=decoded.readUInt32LE(offset+4),start=offset+8,end=Math.min(start+size,decoded.length);
   if(decoded.toString('ascii',offset,offset+4)==='data') {
    for(let sample=start;sample+1<end;sample+=2)if(decoded.readInt16LE(sample)!==0){hasSignal=true;break;}
    break;
   }
   offset=end+(size%2);
  }
  if(!hasSignal)throw new Error('No usable speech was recognized');
  await run(whisper,['-m',model,'-f',wav,'-l','en','-t','4','-ng','-nt','-np','-otxt','-of',output],signal,90000);
  const text=(await readFile(output+'.txt','utf8')).trim();
  // Whisper emits this marker for silence. It is not a transcript and must
  // never be offered as a successful note body. Keep the native draft so the
  // user can retry or discard it instead of reporting a false success.
  if(!text||text.length>16000||/^(?:\[\s*(?:blank_audio|silence|no speech)\s*\]\s*)+$/i.test(text))throw new Error('No usable speech was recognized');
  return {text,language:'en',engine:'whisper.cpp',local:true,durationSeconds:duration};
 } finally { await rm(directory,{recursive:true,force:true}); }
}
