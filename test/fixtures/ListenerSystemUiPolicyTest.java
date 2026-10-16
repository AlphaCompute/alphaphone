package ai.elizaresearch.alphaphone.sense;
import com.android.systemui.privacy.AlphaListeningPolicy;
public final class ListenerSystemUiPolicyTest {
 static final String CERT="a".repeat(64),PKG=AlphaListeningPolicy.PACKAGE;
 static void check(boolean value,String why){if(!value)throw new AssertionError(why);}
 static boolean identity(int uid,int user,String expected,String actual,boolean match,boolean sole){return AlphaListeningPolicy.identity(uid,user,true,true,true,expected,actual,match,sole);}
 static boolean pause(int uid,int notice,int creator,String pkg,boolean immutable,boolean broadcast,boolean auth,String marker){return AlphaListeningPolicy.pause(uid,notice,PKG,1,"listening-indicator",creator,pkg,immutable,broadcast,auth,marker);}
 public static void main(String[] args){
  check(identity(10042,0,CERT,CERT,true,true),"exact image identity");
  check(!identity(10042,10,CERT,CERT,true,true),"secondary foreground user");
  check(!identity(110042,0,CERT,CERT,true,true),"secondary UID");
  check(!identity(10042,0,"",CERT,true,true),"no configured signer");
  check(!identity(99000,0,CERT,CERT,true,true),"isolated UID never admitted as installed sense package");
  check(!identity(10042,0,CERT,"b".repeat(64),true,true),"substituted signer");
  check(!identity(10042,0,CERT,CERT,false,true),"Alpha signature mismatch");
  check(!identity(10042,0,CERT,CERT,true,false),"shared UID ambiguity");
  check(AlphaListeningPolicy.recording(10042,10042,false),"unsilenced matching capture");
  check(!AlphaListeningPolicy.recording(10042,10042,true),"silenced capture");
  check(!AlphaListeningPolicy.recording(10042,99001,false),"unmapped isolated capture");
  check(!AlphaListeningPolicy.recording(-1,-1,false),"invalid identity");
  check(pause(10042,10042,10042,PKG,true,true,false,AlphaListeningPolicy.PAUSE),"immutable pause token");
  check(!pause(10042,10042,10043,PKG,true,true,false,AlphaListeningPolicy.PAUSE),"wrong token owner");
  check(!pause(10042,10043,10042,PKG,true,true,false,AlphaListeningPolicy.PAUSE),"wrong notification owner");
  check(!pause(10042,10042,10042,"other",true,true,false,AlphaListeningPolicy.PAUSE),"wrong creator package");
  check(!pause(10042,10042,10042,PKG,false,true,false,AlphaListeningPolicy.PAUSE),"mutable token");
  check(!pause(10042,10042,10042,PKG,true,false,false,AlphaListeningPolicy.PAUSE),"not broadcast");
  check(!pause(10042,10042,10042,PKG,true,true,true,AlphaListeningPolicy.PAUSE),"unlock-requiring action");
  check(!pause(10042,10042,10042,PKG,true,true,false,"resume"),"resume marker");
  check(ListenerActionContract.PAUSE.equals(ListenerActionContract.marker(PKG+".action.PAUSE")),"only pause advertised");
  for(String action:new String[]{null,"",PKG+".action.RESUME",PKG+".action.STOP",PKG+".action.DISMISSED"})check(ListenerActionContract.marker(action)==null,"never advertise another action");
  check(ListenerActionContract.KEY.equals(AlphaListeningPolicy.ACTION_KEY),"producer consumer contract");
  // ---- lease visibility measurement ----
  check(AlphaListeningPolicy.effectivelyVisible(true,true,true,true,1f,100,100),"attached, shown and on screen");
  check(!AlphaListeningPolicy.effectivelyVisible(false,true,true,true,1f,100,100),"detached view");
  check(!AlphaListeningPolicy.effectivelyVisible(true,false,true,true,1f,100,100),"window hidden");
  check(!AlphaListeningPolicy.effectivelyVisible(true,true,false,true,1f,100,100),"an ancestor is hidden");
  check(!AlphaListeningPolicy.effectivelyVisible(true,true,true,false,1f,100,100),"aggregated visibility false");
  check(!AlphaListeningPolicy.effectivelyVisible(true,true,true,true,0.2f,100,100),"faded out");
  check(!AlphaListeningPolicy.effectivelyVisible(true,true,true,true,1f,89,100),"mostly clipped off screen");
  check(AlphaListeningPolicy.effectivelyVisible(true,true,true,true,1f,90,100),"burn-in shift within tolerance");
  check(!AlphaListeningPolicy.effectivelyVisible(true,true,true,true,1f,0,0)&&!AlphaListeningPolicy.effectivelyVisible(true,true,true,true,1f,200,100),"empty or inconsistent geometry");
  check(AlphaListeningPolicy.leaseTarget(10042,PKG,10042),"admitted listener provider");
  check(!AlphaListeningPolicy.leaseTarget(10042,"com.example",10042)&&!AlphaListeningPolicy.leaseTarget(10042,PKG,10043)&&!AlphaListeningPolicy.leaseTarget(-1,PKG,-1),"never another provider");
  check(AlphaListeningPolicy.chipAcknowledged(true,true)&&!AlphaListeningPolicy.chipAcknowledged(false,true)&&!AlphaListeningPolicy.chipAcknowledged(true,false),"chip acknowledged only with SystemUI's own recording observation");
  // ---- display, keyguard/AOD, shade and immersive ----
  check(AlphaListeningPolicy.display(2).equals("on")&&AlphaListeningPolicy.display(6).equals("on"),"display on");
  check(AlphaListeningPolicy.display(3).equals("doze")&&AlphaListeningPolicy.display(4).equals("doze"),"AOD");
  check(AlphaListeningPolicy.display(1).equals("off"),"display off");
  for(int state:new int[]{0,5,7,-1})check(AlphaListeningPolicy.display(state).equals("unknown"),"unknown: "+state);
  check(AlphaListeningPolicy.hiddenReason(true,"on",-1,true,true,false).equals("none"),"shown needs no reason");
  check(AlphaListeningPolicy.hiddenReason(false,"off",-1,false,false,false).equals("display_off"),"display off");
  check(AlphaListeningPolicy.hiddenReason(false,"doze",-1,false,false,true).equals("aod"),"AOD not showing the chip");
  check(AlphaListeningPolicy.hiddenReason(false,"on",999,true,true,false).equals("transition"),"within the debounce");
  check(AlphaListeningPolicy.hiddenReason(false,"on",1000,false,false,false).equals("none"),"after the debounce nothing explains it");
  check(AlphaListeningPolicy.hiddenReason(false,"on",-1,true,false,false).equals("shade"),"shade");
  check(AlphaListeningPolicy.hiddenReason(false,"on",-1,false,true,false).equals("fullscreen"),"immersive");
  check(AlphaListeningPolicy.hiddenReason(false,"on",-1,false,true,true).equals("none"),"immersive does not explain a hidden lock screen");
  check(AlphaListeningPolicy.hiddenReason(false,"unknown",-1,false,false,false).equals("none"),"unknown display has no reason");
  check(AlphaListeningPolicy.keyguardCounts(true,true,false),"lock screen / AOD chip");
  check(!AlphaListeningPolicy.keyguardCounts(true,false,false),"keyguard chip after unlock does not count");
  check(!AlphaListeningPolicy.keyguardCounts(true,true,true),"shade covers the lock-screen chip");
  check(AlphaListeningPolicy.statusBarCounts(true,false,false,false),"unlocked status bar");
  check(!AlphaListeningPolicy.statusBarCounts(true,true,false,false),"status-bar chip does not count on the keyguard");
  check(!AlphaListeningPolicy.statusBarCounts(true,false,true,false),"expanded shade covers the status bar");
  check(!AlphaListeningPolicy.statusBarCounts(true,false,false,true),"immersive app hid the status bar");
  check(AlphaListeningPolicy.statusBarHidden(0,1,false)&&!AlphaListeningPolicy.statusBarHidden(0,1,true)&&!AlphaListeningPolicy.statusBarHidden(1,1,false),"immersive, transient reveal, normal");
  check(AlphaListeningPolicy.shadeCounts(true,true)&&!AlphaListeningPolicy.shadeCounts(true,false)&&!AlphaListeningPolicy.shadeCounts(false,true),"shade counts only through the verified notification");
  check(AlphaListeningPolicy.shadeNotification(10042,10042,PKG,1,"listening-indicator",true),"listener's ongoing indicator");
  check(!AlphaListeningPolicy.shadeNotification(10042,10043,PKG,1,"listening-indicator",true)&&!AlphaListeningPolicy.shadeNotification(10042,10042,"x",1,"listening-indicator",true)
   &&!AlphaListeningPolicy.shadeNotification(10042,10042,PKG,2,"listening-indicator",true)&&!AlphaListeningPolicy.shadeNotification(10042,10042,PKG,1,"listener-status",true)
   &&!AlphaListeningPolicy.shadeNotification(10042,10042,PKG,1,"listening-indicator",false)&&!AlphaListeningPolicy.shadeNotification(-1,-1,PKG,1,"listening-indicator",true),"no other notification counts");
  System.out.println("PASS listener SystemUI policy: identity, recording, pause-only capability, lease visibility, display/shade/immersive");
 }
}
