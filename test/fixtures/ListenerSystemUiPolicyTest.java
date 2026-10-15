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
  System.out.println("PASS listener SystemUI policy: identity, recording, pause-only capability");
 }
}
