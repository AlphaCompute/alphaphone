package ai.elizaresearch.alphaphone;

import ai.eliza.plugins.passwords.PasswordFormPolicy;
import ai.eliza.plugins.securestore.nativeonly.PasswordAutofillPolicy;
import android.content.Context;
import android.graphics.Rect;
import android.os.Bundle;
import android.text.InputType;
import android.util.SparseArray;
import android.view.View;
import android.view.ViewStructure;
import android.view.autofill.AutofillId;
import android.view.autofill.AutofillManager;
import android.view.autofill.AutofillValue;
import android.webkit.WebView;
import androidx.webkit.JavaScriptExecutionWorld;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.ScriptHandler;
import androidx.webkit.WebMessageCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.function.Supplier;
import org.json.JSONObject;

/**
 * Engine-attested login fields for one browser tab (issue #404): the native browser adapter the
 * shared password policy requires, giving every login field a per-field origin
 * ({@link PasswordAutofillPolicy#FIELD_ORIGIN}) that the browser engine reported.
 *
 * <p>A script ({@code res/raw/browser_login_fields.js}) runs at document start in every frame, in
 * an isolated JavaScript world page script cannot reach, and reports focused username/password
 * fields over a {@code WebMessageListener}. The listener's {@code sourceOrigin} and
 * {@code isMainFrame} come from WebView; {@link BrowserFieldOrigin#bind} accepts only a committed
 * HTTPS origin equal to the tab's committed top-level origin. Admitted fields appear to Android
 * Autofill as virtual children of {@link Anchor}, a transparent, non-interactive view over the
 * tab; the tab WebView's own structure is then excluded so no field is offered twice. The
 * selected provider (integrated vault, Proton or another) owns unlock, choice and save. Values it
 * fills are posted only to the reply proxy of the frame that reported the field.
 *
 * <p>Nothing here logs, stores or forwards a value: fill values go from the framework to that
 * frame; submitted values go from that frame to the framework session for the provider's Save.
 */
final class BrowserLoginFields {
 static final String CHANNEL="__alphaLoginFields";
 private static final String WORLD="alpha-browser-login-v1";
 /** Virtual ids advance per binding, so values for an earlier binding never match a newer one. */
 private static final int SPAN=4;

 /** The tab as the browser host sees it now (selection, visibility, navigation, committed URL). */
 interface Host { BrowserFieldOrigin.TabSnapshot snapshot(); }

 /**
  * Whether this WebView provider can attest field origins: engine-supplied message origins and
  * scripts in an isolated world, in every frame. Without both, fill stays off.
  */
 static boolean supported(){
  try{return WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)&&WebViewFeature.isFeatureSupported(WebViewFeature.JS_INJECTION_IN_FRAME_AND_WORLD);}
  catch(RuntimeException|LinkageError unavailable){return false;}
 }

 private final WebView web;
 private final Host host;
 final Anchor anchor;
 private JavaScriptExecutionWorld world;
 private ScriptHandler script;
 private boolean closed;
 private BrowserFieldOrigin.Binding binding;
 /** The latest focus report of the bound fields: which of them is focused, and where. */
 private BrowserFieldOrigin.Report focus;
 private JavaScriptReplyProxy proxy;
 private int base=0;

 private BrowserLoginFields(WebView web,Host host){this.web=web;this.host=host;this.anchor=new Anchor(web.getContext());}

 /**
  * Installs the listener and script before the tab loads anything (WebView applies both only to
  * documents loaded afterwards). Returns null when unsupported or when setup fails; the caller
  * then keeps fill off for the integrated vault.
  */
 static BrowserLoginFields install(WebView web,Host host){
  if(!supported())return null;
  BrowserLoginFields fields=new BrowserLoginFields(web,host);
  try{
   String source=source(web.getContext());
   fields.world=WebViewCompat.getExecutionWorld(web,WORLD);
   // "*" only makes the channel exist in every frame of this isolated world; whether a frame
   // may be filled is decided natively from the engine's sourceOrigin, never from this rule.
   WebViewCompat.addWebMessageListener(web,CHANNEL,Set.of("*"),fields.world,fields::onPostMessage);
   fields.script=WebViewCompat.addJavaScriptOnEvent(web,source,WebViewCompat.INJECTION_EVENT_DOCUMENT_START,Set.of("*"),fields.world);
   return fields;
  }catch(Exception|LinkageError unavailable){fields.close();return null;}
 }

 private static String source(Context context)throws java.io.IOException{
  try(InputStream input=context.getResources().openRawResource(R.raw.browser_login_fields)){
   ByteArrayOutputStream output=new ByteArrayOutputStream();byte[] buffer=new byte[4096];int count;
   while((count=input.read(buffer))!=-1){if(output.size()+count>65536)throw new java.io.IOException("Script too large");output.write(buffer,0,count);}
   return new String(output.toByteArray(),StandardCharsets.UTF_8);
  }
 }

 private void onPostMessage(WebView view,WebMessageCompat message,android.net.Uri sourceOrigin,boolean isMainFrame,JavaScriptReplyProxy reply){
  if(closed||view!=web||message==null||message.getType()!=WebMessageCompat.TYPE_STRING)return;
  BrowserFieldOrigin.Report report=BrowserFieldOrigin.Report.parse(message.getData());
  if(report==null)return;
  BrowserFieldOrigin.TabSnapshot now=host.snapshot();
  // The only origin source: what WebView reported for the posting frame.
  BrowserFieldOrigin.EngineSource engine=new BrowserFieldOrigin.EngineSource(sourceOrigin==null?null:sourceOrigin.toString(),isMainFrame);
  switch(report.kind){
   case FOCUS: {
    BrowserFieldOrigin.Decision decision=BrowserFieldOrigin.bind(engine,now);
    // Re-focus of the same fields (switching between them, or returning from a provider's unlock
    // screen) keeps the binding and its virtual ids, so a pending fill result still matches.
    if(binding!=null&&binding.sameFields(engine,report)){
     focus=report;
     if(decision.fillable())enter(report);
     return;
    }
    // Focus moved to other fields: any earlier binding ends, including when the new field is refused.
    revoke(true);
    if(!decision.fillable())return;
    binding=new BrowserFieldOrigin.Binding(decision.origin,now.navigation,report);
    proxy=reply;focus=report;
    base=(base+SPAN)%0x3ffffff0;
    enter(report);
    return;
   }
   case BLUR:
    if(binding!=null&&binding.sameFrame(engine,report))exit();
    return;
   case GONE:
    // The bound document is unloading (including a frame navigating on its own).
    if(binding!=null&&binding.sameFrame(engine,report))revoke(true);
    return;
   case SUBMIT:
    if(binding==null||!binding.sameFrame(engine,report)||!binding.admits(now))return;
    if(report.password!=binding.fields.password||(report.username!=0&&report.username!=binding.fields.username))return;
    AutofillManager manager=manager();
    if(manager==null)return;
    if(report.username!=0)manager.notifyValueChanged(anchor,base+1,AutofillValue.forText(report.usernameValue));
    manager.notifyValueChanged(anchor,base+2,AutofillValue.forText(report.passwordValue));
  }
 }

 private AutofillManager manager(){return web.getContext().getSystemService(AutofillManager.class);}
 private boolean admitted(){BrowserFieldOrigin.Binding current=binding;return !closed&&current!=null&&proxy!=null&&current.admits(host.snapshot());}
 private int focusedId(BrowserFieldOrigin.Report report){return base+(report.focused==report.password?2:1);}

 private void enter(BrowserFieldOrigin.Report report){
  AutofillManager manager=manager();
  if(manager==null||!admitted())return;
  manager.notifyViewEntered(anchor,focusedId(report),screenBounds(report));
 }
 private void exit(){
  AutofillManager manager=manager();
  if(manager!=null&&binding!=null&&focus!=null)manager.notifyViewExited(anchor,focusedId(focus));
 }

 /**
  * Ends the current binding. With {@code exit}, the focused field is exited so its popup closes.
  * Fields are never reported invisible here: a provider that saves when all fields disappear
  * would turn a cancel path into a Save offer. Callers that cancel do so with
  * {@code AutofillManager#cancel}; a committed session needs nothing more.
  */
 void revoke(boolean exit){
  BrowserFieldOrigin.Binding old=binding;BrowserFieldOrigin.Report focused=focus;
  binding=null;proxy=null;focus=null;
  if(old==null)return;
  old.revoke();
  AutofillManager manager=manager();
  if(exit&&manager!=null)manager.notifyViewExited(anchor,focusedId(focused==null?old.fields:focused));
 }

 void close(){
  if(closed)return;
  revoke(true);closed=true;
  if(script!=null){try{script.remove();}catch(RuntimeException ignored){}script=null;}
  if(world!=null){try{WebViewCompat.removeWebMessageListener(web,world,CHANNEL);}catch(RuntimeException ignored){}world=null;}
 }

 /** Screen rectangle of the focused field, for the framework popup. Page-supplied geometry only positions UI. */
 private Rect screenBounds(BrowserFieldOrigin.Report report){
  int[] location=new int[2];anchor.getLocationOnScreen(location);
  float scale=report.viewportWidth>0&&anchor.getWidth()>0?anchor.getWidth()/report.viewportWidth:anchor.getResources().getDisplayMetrics().density;
  int left=clamp(Math.round(report.x*scale),anchor.getWidth()),top=clamp(Math.round(report.y*scale),anchor.getHeight());
  int right=clamp(Math.round((report.x+report.width)*scale),anchor.getWidth()),bottom=clamp(Math.round((report.y+report.height)*scale),anchor.getHeight());
  return new Rect(location[0]+left,location[1]+top,location[0]+Math.max(left,right),location[1]+Math.max(top,bottom));
 }
 private static int clamp(int value,int max){return Math.max(0,Math.min(Math.max(0,max),value));}

 private void fill(SparseArray<AutofillValue> values){
  BrowserFieldOrigin.Binding current=binding;JavaScriptReplyProxy target=proxy;
  if(values==null||target==null||!admitted())return;
  String username=text(values.get(base+1)),password=text(values.get(base+2));
  if(username==null&&password==null)return;
  try{
   JSONObject message=new JSONObject();
   message.put("t","fill").put("d",current.document).put("o",current.origin);
   if(username!=null&&current.fields.username!=0){message.put("u",current.fields.username);message.put("uv",username);}
   if(password!=null){message.put("p",current.fields.password);message.put("pv",password);}
   target.postMessage(message.toString());
  }catch(Exception dropped){/* The frame is gone; nothing is retried or recorded. */}
 }
 private static String text(AutofillValue value){return value!=null&&value.isText()?value.getTextValue().toString():null;}

 /**
  * The tab's login fields as Android Autofill sees them: a transparent view over the WebView
  * that never draws, takes focus or touches, and exposes children only while bound.
  */
 final class Anchor extends View {
  Anchor(Context context){
   super(context);
   setFocusable(false);setClickable(false);setLongClickable(false);
   setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
  }
  @Override public boolean onTouchEvent(android.view.MotionEvent event){return false;}
  @Override public int getImportantForAutofill(){return admitted()?View.IMPORTANT_FOR_AUTOFILL_YES:View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS;}
  @Override public void onProvideAutofillVirtualStructure(ViewStructure structure,int flags){
   BrowserFieldOrigin.Binding current=binding;
   if(current==null||!admitted()){structure.setChildCount(0);return;}
   BrowserFieldOrigin.Report fields=current.fields;
   // The committed top-level origin, as the tab WebView reports it, for the shared policy's host check.
   String top=BrowserFieldOrigin.exactHttps(host.snapshot().state.documentUrl);
   structure.setWebDomain(current.origin);
   Bundle extras=structure.getExtras();
   if(top!=null&&extras!=null)extras.putString(PasswordFormPolicy.TOP_ORIGIN_EXTRA,top);
   boolean user=fields.username!=0;
   structure.setChildCount(user?2:1);
   AutofillId parent=structure.getAutofillId();
   int index=0;
   BrowserFieldOrigin.Report focused=focus==null?fields:focus;
   if(user)child(structure.newChild(index++),parent,base+1,current.origin,false,fields.usernameAutocomplete,focused.focused==fields.username);
   child(structure.newChild(index),parent,base+2,current.origin,true,fields.passwordAutocomplete,focused.focused==fields.password);
  }
  /** One virtual field. Its origin is the binding's engine-reported frame origin, never the top-level URL. */
  private void child(ViewStructure child,AutofillId parent,int id,String origin,boolean password,String autocomplete,boolean focused){
   child.setAutofillId(parent,id);
   child.setAutofillType(View.AUTOFILL_TYPE_TEXT);
   child.setAutofillHints(new String[]{password?View.AUTOFILL_HINT_PASSWORD:View.AUTOFILL_HINT_USERNAME});
   child.setInputType(InputType.TYPE_CLASS_TEXT|(password?InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD:InputType.TYPE_TEXT_VARIATION_WEB_EMAIL_ADDRESS));
   ViewStructure.HtmlInfo.Builder html=child.newHtmlInfoBuilder("input").addAttribute("type",password?"password":"text");
   if(!autocomplete.isEmpty())html.addAttribute("autocomplete",autocomplete);
   child.setHtmlInfo(html.build());
   child.setWebDomain(origin);
   child.setVisibility(View.VISIBLE);
   child.setFocused(focused);
   child.setDataIsSensitive(true);
   child.setClassName("android.widget.EditText");
   Bundle extras=child.getExtras();
   if(extras!=null)extras.putString(PasswordAutofillPolicy.FIELD_ORIGIN,origin);
  }
  @Override public void autofill(SparseArray<AutofillValue> values){fill(values);}
 }
}
