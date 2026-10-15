package ai.elizaresearch.alphaphone;

/** Per-capture admission, reserved before permission/start and cancelled without waiting for startup. */
final class LiveCaptureAdmission {
 static final class Ticket {
  final String id;final long epoch;
  private boolean cancelled,discard;
  private Runnable cancel;
  Ticket(String id,long epoch){this.id=id;this.epoch=epoch;}
 }
 private Ticket active;
 synchronized Ticket begin(String id,long epoch){
  cancelAll();active=new Ticket(id,epoch);return active;
 }
 synchronized boolean current(Ticket ticket){return active==ticket&&!ticket.cancelled;}
 /** Explicit Stop permits the captured tail; replacement/lifecycle cancellation discards it. */
 synchronized boolean events(Ticket ticket){return active==ticket&&!ticket.discard;}
 synchronized boolean attach(Ticket ticket,Runnable cancel){
  if(!current(ticket)){cancel.run();return false;}
  ticket.cancel=cancel;return true;
 }
 synchronized void stop(String id){if(active!=null&&active.id.equals(id))cancel(active,false);}
 synchronized void cancelAll(){if(active!=null)cancel(active,true);}
 private void cancel(Ticket ticket,boolean discard){
  ticket.cancelled=true;ticket.discard|=discard;
  if(ticket.cancel!=null){Runnable cancel=ticket.cancel;ticket.cancel=null;cancel.run();}
 }
}
