package ai.elizaresearch.alphaphone;

/**
 * How Alpha's assistant surface was opened. Only identity Android reports (the launching package,
 * shared deliberately by the caller) and a same-signer check are used; caller extras never are.
 * "listener" means the AOSP image's always-on listener heard the wake phrase; every other start
 * (press-and-hold power through the assistant role, the system assist gesture, a launcher or
 * another app) is "assist". Pure Java so the rule runs on the JVM in repository tests.
 */
final class AssistInvocation {
 private AssistInvocation(){}
 static final String LISTENER="listener",ASSIST="assist";
 static final String LISTENER_PACKAGE="ai.elizaresearch.alphaphone.sense";

 static String origin(String launchedFromPackage,boolean sameSigner){
  return LISTENER_PACKAGE.equals(launchedFromPackage)&&sameSigner?LISTENER:ASSIST;
 }
 /** A listener invocation starts a voice turn only this soon after it arrived (monotonic clock). */
 static final long LISTENER_WINDOW_MS=5000;
 /**
  * The origin a read reports. A listener invocation counts only while fresh and only if the keyguard
  * was not showing when it arrived, so one that waited (hidden page, locked phone) can never open the
  * microphone later.
  */
 static String take(String origin,long arrivedAt,long now,boolean lockedAtArrival){
  return LISTENER.equals(origin)&&!lockedAtArrival&&now>=arrivedAt&&now-arrivedAt<=LISTENER_WINDOW_MS?LISTENER:ASSIST;
 }
}
