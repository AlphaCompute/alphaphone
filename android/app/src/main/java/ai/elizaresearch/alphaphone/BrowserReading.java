package ai.elizaresearch.alphaphone;

import android.app.AlertDialog;
import android.widget.ScrollView;
import android.widget.TextView;
import android.webkit.WebView;
import com.getcapacitor.*;
import java.util.Objects;
import java.util.UUID;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import org.json.JSONObject;
import org.json.JSONTokener;

/** One foreground, immutable, explicitly reviewed document. No remote-page bridge. */
final class BrowserReading {
 // This conservative, local heuristic is not a credential detector or a proof
 // that arbitrary web content is safe. False positives deliberately require
 // opening a different page; there is no bypass that sends a blocked document.
 static boolean sensitiveUrl(String value) {
  try {
   if(value==null||value.length()>8192)return true;
   java.net.URI uri=new java.net.URI(value);String host=uri.getHost();
   if(!"https".equalsIgnoreCase(uri.getScheme())||host==null||uri.getRawUserInfo()!=null)return true;
   host=host.toLowerCase(java.util.Locale.ROOT);if(host.endsWith("."))host=host.substring(0,host.length()-1);
   for(String provider:new String[]{"pass.proton.me","account.proton.me","accounts.google.com","passwords.google.com","bitwarden.com","bitwarden.eu","1password.com","lastpass.com","dashlane.com","keepersecurity.com","nordpass.com","passbolt.com"})if(host.equals(provider)||host.endsWith("."+provider))return true;
   String route=java.net.URLDecoder.decode(value,"UTF-8").toLowerCase(java.util.Locale.ROOT);
   return java.util.regex.Pattern.compile("(?:^|[^a-z0-9])(?:api[\\s_-]*key|vault|passwords?|passphrase|signin|sign-in|login|log-in|logout|auth|oauth|sso|account|accounts|security|mfa|2fa|otp|recovery|reset-password|credentials?|access_token|id_token|refresh_token|secret|token)(?:$|[^a-z0-9])").matcher(route).find();
  }catch(Exception error){return true;}
 }
 // Fixed traversal prunes excluded subtrees before reading text. Bounds include
 // traversal work, ancestor depth, per-node input and total output.
 static final String EXTRACT = """
 (()=>{
 if(!['text/html','application/xhtml+xml','text/plain'].includes(document.contentType))return null;
 // Scan the whole document before selecting an article: a vault/OTP sidebar
 // must not be omitted by choosing a harmless-looking main element.
 const deny=()=>({blocked:true});
 const sensitive=/(?:api[\\s_-]*key|access[\\s_-]*token|refresh[\\s_-]*token|password|passphrase|passcode|credential|vault|one[\\s-]*time[\\s-]*(?:password|code)|verification[\\s-]*code|security[\\s-]*code|authentication[\\s-]*code|recovery[\\s-]*(?:code|key|phrase)|backup[\\s-]*(?:code|key)|seed[\\s-]*phrase|secret[\\s-]*key|private[\\s-]*key|authenticator|two[\\s-]*factor|multi[\\s-]*factor|sign[\\s-]*in|log[\\s-]*in|\\botp\\b|\\bmfa\\b|\\b2fa\\b)/i;
 const normalize=value=>value.normalize('NFKC').replace(/[\\u200B-\\u200D\\uFEFF]/g,'');
 const pending=[document.documentElement];let inspected=0,characters=0,scanText='';
 while(pending.length){
  if(++inspected>12000)return deny();const n=pending.pop();if(!n)return deny();
  if(n.nodeType===1){
   if(['SCRIPT','STYLE','NOSCRIPT','TEMPLATE'].includes(n.tagName))continue;
   for(const attr of ['type','autocomplete','id','name','class','aria-label','title','placeholder']){
    const value=n.getAttribute(attr)||'';characters+=value.length;
    if(value.length>1024||characters>65536||sensitive.test(normalize(value)))return deny();
   }
   if(n.childNodes.length+pending.length>12000)return deny();
   for(let i=n.childNodes.length-1;i>=0;i--)pending.push(n.childNodes[i]);
  }else if(n.nodeType===3){
   // No input values, cookies, storage, form data or frame documents are read.
   const value=n.nodeValue||'';characters+=value.length;
   if(value.length>20000||characters>65536)return deny();
   scanText+=' '+normalize(value);
  }
 }
 // Unlabelled short authentication-like numbers are ambiguous. Reject rather
 // than assuming that a visible code is harmless prose. Years remain usable.
 if(sensitive.test(scanText))return deny();
 if(/(?:^|\\D)\\d{6,8}(?:\\D|$)/.test(scanText))return deny();

 const blocked='script,style,noscript,template,form,input,textarea,select,option,button,iframe,frame,object,embed,nav,header,footer,[contenteditable]:not([contenteditable="false"]),[hidden],[aria-hidden="true"],[role="navigation"],[role="textbox"],[role="button"]';
 const visible=e=>{const s=getComputedStyle(e);return !e.matches(blocked)&&s.display!=='none'&&s.visibility==='visible'&&Number(s.opacity)!==0&&s.contentVisibility!=='hidden'&&s.clip==='auto'&&s.clipPath==='none'&&Array.from(e.getClientRects()).some(r=>r.width>1&&r.height>1);};
 let root=document.querySelector('article,main,[role="main"]')||document.body;
 if(!root)return null;let a=root,depth=0;while(a){if(++depth>128||!visible(a))return null;a=a.parentElement;}
 const stack=[root];let text='',count=0,truncated=false;
 while(stack.length){if(++count>12000){truncated=true;break;}const n=stack.pop();
 if(n.nodeType===1){if(!visible(n))continue;const children=n.childNodes;if(children.length+stack.length>12000){truncated=true;break;}for(let i=children.length-1;i>=0;i--)stack.push(children[i]);}
 else if(n.nodeType===3){const raw=n.nodeValue||'';if(raw.length>20000)truncated=true;const value=raw.slice(0,20000).replace(/\\s+/g,' ').trim();if(value){const next=(text?'\\n':'')+value;const remaining=5000-text.length;text+=next.slice(0,remaining);if(next.length>remaining){truncated=true;break;}}}
 }
 if(text.length&&/[\\uD800-\\uDBFF]$/.test(text))text=text.slice(0,-1);
 return {text,truncated};
 })()
 """;
 private final android.app.Activity activity;
 private final Consumer<String> cancelSpeech;
 private AlertDialog dialog;
 private PluginCall pending;
 private BooleanSupplier current;
 private String binding, token, text, requestId;
 private long generation, expires;
 private boolean approved;
 BrowserReading(android.app.Activity activity,Consumer<String> cancelSpeech){this.activity=activity;this.cancelSpeech=cancelSpeech;}
 static String binding(PluginCall call)throws Exception{
  String origin=call.getString("origin"),owner=call.getString("ownerId"),session=call.getString("sessionId");Long expires=call.getLong("expiresAt");
  if("device".equals(call.getString("execution"))){
   if(origin!=null||owner==null||owner.isBlank()||owner.length()>256||session==null||session.isBlank()||session.length()>256||expires==null||expires<=System.currentTimeMillis()||expires>System.currentTimeMillis()+120000)throw new IllegalArgumentException();
   return new JSONObject().put("execution","device").put("owner",owner).put("session",session).put("expires",expires).toString();
  }
  if(origin==null||origin.length()>2048||owner==null||owner.isBlank()||owner.length()>256||session==null||session.isBlank()||session.length()>256||expires==null||expires<=System.currentTimeMillis())throw new IllegalArgumentException();
  java.net.URI uri=new java.net.URI(origin);boolean local=BuildConfig.DEBUG&&"http".equals(uri.getScheme())&&java.util.Set.of("127.0.0.1","10.0.2.2").contains(uri.getHost());
  if(uri.getHost()==null||(!"https".equals(uri.getScheme())&&!local)||uri.getRawUserInfo()!=null||uri.getRawQuery()!=null||uri.getRawFragment()!=null||!"".equals(uri.getRawPath()))throw new IllegalArgumentException();
  return new JSONObject().put("origin",origin).put("owner",owner).put("session",session).put("expires",expires).toString();
 }
 void review(PluginCall call,WebView web,BrowserReadingWorld world,BooleanSupplier stillCurrent){
  cancel();final long expected=generation;
  try{binding=binding(call);}catch(Exception error){call.reject("Select an available speech route before reading");return;}
  if(sensitiveUrl(web.getUrl())){call.reject("Reading unavailable on a sensitive or unverified page");return;}
  if(world==null||!world.ready()){call.reject("Isolated page reading is unavailable. Update Android System WebView, then reload this page.");return;}
  current=stillCurrent;pending=call;expires=System.currentTimeMillis()+120000;
  scheduleTimeout(expected,120000);
  world.evaluate(EXTRACT,encoded->{
   if(expected!=generation)return;
   try{
    if(!current.getAsBoolean())throw new IllegalStateException();
    Object decoded=new JSONTokener(encoded).nextValue();if(!(decoded instanceof JSONObject))throw new IllegalStateException();JSONObject result=(JSONObject)decoded;
    if(result.optBoolean("blocked")){PluginCall rejected=pending;pending=null;cancel();rejected.reject("Reading unavailable on a sensitive or ambiguous page");return;}
    String extracted=result.getString("text");if(extracted.isBlank()||extracted.length()>5000)throw new IllegalStateException();text=extracted;token=UUID.randomUUID().toString();
    String source=android.net.Uri.parse(web.getUrl()).getHost();boolean local="device".equals(call.getString("execution"));
    TextView preview=new TextView(activity);preview.setText("Source: "+source+"\nSpeech: "+(local?"On this device":call.getString("origin"))+"\nOwner: "+call.getString("ownerId")+(local?"\n\nRead on this device uses local speech. The excerpt is not sent to an agent or speech server.\n":"\n\nRead with selected agent sends exactly the following text for speech.\n")+text.length()+" characters"+(result.optBoolean("truncated")?" (truncated; no further text will be sent)":"")+"\n\n"+text);preview.setTextIsSelectable(true);int padding=(int)(20*activity.getResources().getDisplayMetrics().density);preview.setPadding(padding,padding,padding,padding);
    ScrollView scroll=new ScrollView(activity);scroll.addView(preview);
    dialog=new AlertDialog.Builder(activity).setTitle("Read this page aloud?").setView(scroll).setNegativeButton("Cancel",(d,w)->cancel()).setPositiveButton(local?"Read on this device":"Read with selected agent",(d,w)->{
     if(expected!=generation||!valid()){cancel();return;}approved=true;PluginCall accepted=pending;pending=null;dialog=null;JSObject response=new JSObject();response.put("readingToken",token);accepted.resolve(response);
    }).setOnCancelListener(d->cancel()).create();dialog.show();
   }catch(Exception error){cancel();}
  },()->{if(expected==generation)cancel();});
 }
 private void scheduleTimeout(long expected,long delay){new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(()->{if(expected==generation)cancel();},delay);}
 private boolean valid(){return current!=null&&current.getAsBoolean()&&System.currentTimeMillis()<expires;}
 String consume(PluginCall call)throws Exception{
  if(!approved||!valid()||!Objects.equals(token,call.getString("readingToken"))||!Objects.equals(binding,binding(call)))throw new IllegalStateException("Reading approval expired");
  requestId=call.getString("requestId");if(requestId==null||requestId.isBlank()||requestId.length()>256)throw new IllegalArgumentException();approved=false;token=null;String result=text;text=null;
  if("device".equals(call.getString("execution"))){expires=System.currentTimeMillis()+20*60*1000;scheduleTimeout(++generation,20*60*1000);}
  dialog=new AlertDialog.Builder(activity).setTitle("device".equals(call.getString("execution"))?"Reading on this device":"Reading with selected agent").setMessage("Preparing or playing the reviewed text. Stop reading cancels this request and playback.").setNegativeButton("Stop reading",(d,w)->cancel()).setOnCancelListener(d->cancel()).create();dialog.show();return result;
 }
 void check(){if(current!=null&&!valid())cancel();}
 void cancel(){generation++;PluginCall rejected=pending;pending=null;AlertDialog old=dialog;dialog=null;String active=requestId;requestId=null;current=null;binding=null;token=null;text=null;approved=false;if(old!=null)old.dismiss();if(rejected!=null)rejected.reject("Reading cancelled or page unavailable");if(active!=null)cancelSpeech.accept(active);}
}
