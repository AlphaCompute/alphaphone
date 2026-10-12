package ai.elizaresearch.alphaphone.sense;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/**
 * Explicit opt-in, status, pause and withdrawal for always-on listening. Listening is off until
 * the user reads this explanation, taps "Turn on" and grants the microphone. Withdrawal clears the
 * consent record; a later change to what is captured or where it goes (a new consent version)
 * requires opting in again. Touches are ignored while another window covers this one.
 */
public final class ConsentActivity extends Activity {
 private static final int REQUEST_MICROPHONE=1;
 static final String EXPLANATION=
  "When on, this phone's microphone stays open in the background, including while the phone is locked, so you can say “Alpha” instead of opening the app.\n\n"
  +"• Speech is detected and recognised on this phone. Audio is never uploaded and never saved.\n"
  +"• What you say is checked only for “Alpha”. Anything not addressed to Alpha is discarded. When you say “Alpha”, the Alpha app opens and handles your request as if you had opened it.\n"
  +"• A notification and the system microphone indicator show while listening is on, including on the lock screen.\n"
  +"• Pause or turn off at any time from the notification, the Quick Settings tile, the microphone privacy toggle or by saying “Alpha, stop listening”.\n"
  +"• Listening pauses during calls and whenever another app uses the microphone. Calls are never recorded.\n"
  +"• After a restart, listening waits until you unlock the phone.\n\n"
  +"People near you may be heard. Only turn this on where that is lawful and appropriate.";

 private LinearLayout column;

 @Override protected void onCreate(Bundle state){
  super.onCreate(state);
  setTitle("Always-on listening");
  getWindow().setHideOverlayWindows(true);
  ScrollView scroll=new ScrollView(this);
  column=new LinearLayout(this);
  column.setOrientation(LinearLayout.VERTICAL);
  int pad=dp(20);
  column.setPadding(pad,pad,pad,pad);
  scroll.addView(column);
  scroll.setFitsSystemWindows(true);
  setContentView(scroll);
 }

 @Override protected void onResume(){super.onResume();render();}

 private int dp(int value){return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP,value,getResources().getDisplayMetrics()));}

 private TextView text(String value,float size){
  TextView view=new TextView(this);
  view.setText(value);
  view.setTextSize(TypedValue.COMPLEX_UNIT_SP,size);
  view.setPadding(0,0,0,dp(16));
  column.addView(view);
  return view;
 }

 private void button(String label,View.OnClickListener click){
  Button button=new Button(this);
  button.setText(label);
  button.setFilterTouchesWhenObscured(true);
  button.setOnClickListener(click);
  column.addView(button,new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT,LinearLayout.LayoutParams.WRAP_CONTENT));
 }

 private void render(){
  column.removeAllViews();
  ListenerStore store=new ListenerStore(this);
  ListenerPolicy.State state=Listener.state(this);
  boolean consented=ListenerPolicy.consented(store.consentVersion());
  TextView status=text(ListenerPolicy.label(state),22);
  status.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
  text(EXPLANATION,16);
  if(!consented||!store.enabled()||state==ListenerPolicy.State.PERMISSION_REQUIRED||state==ListenerPolicy.State.STOPPED_AFTER_ERRORS){
   button(consented?"Turn on listening":"I understand — turn on listening",view->requestMicrophone());
  }
  if(state==ListenerPolicy.State.PAUSED_USER)button("Resume listening",view->{store.resume();changed();});
  if(ListenerPolicy.holdsMicrophone(state)||state==ListenerPolicy.State.PAUSED_CALL){
   button("Pause for 15 minutes",view->{store.pause(ListenerPolicy.pauseUntil(System.currentTimeMillis(),15));changed();});
   button("Pause for 1 hour",view->{store.pause(ListenerPolicy.pauseUntil(System.currentTimeMillis(),60));changed();});
   button("Pause until I resume",view->{store.pause(ListenerPolicy.PAUSE_UNTIL_RESUMED);changed();});
  }
  if(consented&&store.enabled())button("Turn off listening",view->{store.setEnabled(false);changed();});
  if(consented)button("Turn off and withdraw consent",view->{store.revokeConsent();changed();});
 }

 private void changed(){Listener.refresh(this);render();}

 private void requestMicrophone(){
  String[] wanted=checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED
   ?new String[]{Manifest.permission.RECORD_AUDIO}:new String[]{Manifest.permission.RECORD_AUDIO,Manifest.permission.POST_NOTIFICATIONS};
  requestPermissions(wanted,REQUEST_MICROPHONE);
 }

 @Override public void onRequestPermissionsResult(int code,String[] permissions,int[] results){
  super.onRequestPermissionsResult(code,permissions,results);
  if(code!=REQUEST_MICROPHONE)return;
  if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){render();return;}
  new ListenerStore(this).grantConsent(System.currentTimeMillis());
  changed();
 }
}
