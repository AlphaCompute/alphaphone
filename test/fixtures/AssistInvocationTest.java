package ai.elizaresearch.alphaphone;

/** Plain-JVM check of the assistant invocation origin rule. Not an Android or device test. */
public final class AssistInvocationTest {
 private static void check(boolean condition,String name){if(!condition)throw new AssertionError(name);}
 public static void main(String[] args){
  check(AssistInvocation.origin("ai.elizaresearch.alphaphone.sense",true).equals("listener"),"same-signer listener");
  check(AssistInvocation.origin("ai.elizaresearch.alphaphone.sense",false).equals("assist"),"a differently signed package with the listener's name is not the listener");
  for(String other:new String[]{null,"","com.android.systemui","ai.elizaresearch.alphaphone","ai.elizaresearch.alphaphone.sense.evil","AI.ELIZARESEARCH.ALPHAPHONE.SENSE"})
   check(AssistInvocation.origin(other,true).equals("assist"),"other caller "+other);
  check(AssistInvocation.take("listener",1000,1000+AssistInvocation.LISTENER_WINDOW_MS,false).equals("listener"),"a fresh unlocked listener invocation");
  check(AssistInvocation.take("listener",1000,1001+AssistInvocation.LISTENER_WINDOW_MS,false).equals("assist"),"a listener invocation read too late never opens the microphone");
  check(AssistInvocation.take("listener",1000,1200,true).equals("assist"),"an invocation that arrived behind the keyguard stays assist after unlock");
  check(AssistInvocation.take("listener",1000,900,false).equals("assist"),"a clock that went backwards is not fresh");
  check(AssistInvocation.take("assist",1000,1000,false).equals("assist")&&AssistInvocation.take(null,0,0,false).equals("assist"),"other origins stay assist");
  System.out.println("PASS assist invocation");
 }
}
