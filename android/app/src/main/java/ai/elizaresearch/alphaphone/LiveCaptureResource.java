package ai.elizaresearch.alphaphone;

/** Serializes stop with release, including a source that finishes opening after cancellation. */
final class LiveCaptureResource {
 interface Source { void requestStop(); void close(); }
 private Source active;
 private volatile boolean stopped;
 void cancel(){stopped=true;}
 boolean stopped(){return stopped;}
 synchronized boolean attach(Source source){
  if(stopped)return false;
  if(active!=null)throw new IllegalStateException("Capture source already attached");
  active=source;return true;
 }
 synchronized void requestStop(){
  stopped=true;
  if(active!=null)try{active.requestStop();}catch(RuntimeException unavailable){/* Worker still owns release. */}
 }
 /** Called only by the capture worker (or the opener when no worker was started). */
 synchronized void release(Source source){
  if(active==source)active=null;
  source.close();
 }
}
