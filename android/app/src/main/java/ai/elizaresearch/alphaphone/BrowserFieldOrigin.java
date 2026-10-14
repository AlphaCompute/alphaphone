package ai.elizaresearch.alphaphone;

import ai.eliza.plugins.browsersurface.BrowserAutofillEligibility;
import ai.eliza.plugins.browsersurface.BrowserWebOrigin;
import java.net.URLDecoder;

/**
 * The exact origin a login field in Alpha's browser may be filled or saved for (issue #404).
 * Plain Java so it runs on the JVM in {@code npm test}; anything it cannot parse fails closed.
 *
 * <p>The origin comes only from the browser engine: {@code WebViewCompat.WebMessageListener}
 * delivers each message with the {@code sourceOrigin} and {@code isMainFrame} of the frame that
 * posted it, supplied by WebView rather than by any script ({@link EngineSource}). The message
 * itself ({@link Report}) says only which fields of that frame are login fields; it has no
 * origin, frame or address field, so neither page script nor Alpha's own injected script can
 * name one. The report comes from a script Alpha runs in an isolated JavaScript world that page
 * script cannot reach ({@code BrowserLoginFields}).
 *
 * <p>Policy: a field is bound only when its frame's engine-reported origin is committed HTTPS and
 * equals the tab's committed top-level origin (scheme, host and port), on the selected, shown,
 * resumed, finished tab with no site prompt open. A binding holds only for the navigation it was
 * made in ({@link Binding#admits}); a message a replaced document sent late can at most bind
 * that dead document's reply proxy, whose fill the script's document check drops. The top-level
 * document and same-origin frames qualify; a frame of any other origin, an opaque (sandboxed)
 * origin or cleartext is refused. A same-origin frame holds the same site's credentials, and the
 * values travel only to the frame that reported the field.
 */
final class BrowserFieldOrigin {
 private BrowserFieldOrigin(){}

 /** What WebView itself reported about the frame that posted a message. Never page content. */
 static final class EngineSource {
  /** {@code sourceOrigin} from {@code WebMessageListener#onPostMessage}, as a string. */
  final String sourceOrigin;
  /** {@code isMainFrame} from {@code WebMessageListener#onPostMessage}. */
  final boolean mainFrame;
  EngineSource(String sourceOrigin,boolean mainFrame){this.sourceOrigin=sourceOrigin;this.mainFrame=mainFrame;}
 }

 /** The tab as the browser host sees it now. */
 static final class TabSnapshot {
  /** The WebView supports engine-attested messages from an isolated world. */
  boolean supported;
  /** Selected, shown, resumed, committed, finished, error-free, no overlay; documentUrl is the committed address. */
  BrowserAutofillEligibility.TabState state;
  long navigation;
 }

 /** Fill/save is allowed for {@code origin}, or refused with a user-readable {@code refusal}. */
 static final class Decision {
  final String origin,refusal;
  private Decision(String origin,String refusal){this.origin=origin;this.refusal=refusal;}
  boolean fillable(){return origin!=null;}
 }

 static final String UNSUPPORTED="Password manager fill is off in Alpha's browser: this Android System WebView cannot report which site owns a login field. Update Android System WebView.";
 static final String HIDDEN="Password manager fill is off: the page is not the one shown, or it is still loading.";
 static final String NO_ORIGIN="Password manager fill is off for this field: the browser engine reported no site for it.";
 static final String INSECURE="Password manager fill is off for this field: it is not on a verified HTTPS page.";
 static final String FRAME="Password manager fill is off for this field: it belongs to an embedded frame from another site.";
 static final String MISMATCH="Password manager fill is off for this field: the browser engine's site does not match this page.";
 private static Decision refuse(String why){return new Decision(null,why);}

 /** Exact {@code https://host[:port]}, default port omitted, or null. */
 static String exactHttps(String url){
  String origin=BrowserWebOrigin.of(url);
  return origin!=null&&origin.startsWith("https://")?origin:null;
 }

 /**
  * Decide whether fields reported with {@code engine} may be offered to the password manager.
  * Every condition must hold; the first failing one is reported.
  */
 static Decision bind(EngineSource engine,TabSnapshot tab){
  if(tab==null||!tab.supported)return refuse(UNSUPPORTED);
  if(!BrowserAutofillEligibility.eligible(tab.state))return refuse(HIDDEN);
  if(engine==null||engine.sourceOrigin==null)return refuse(NO_ORIGIN);
  String origin=exactHttps(engine.sourceOrigin);
  if(origin==null)return refuse(BrowserWebOrigin.of(engine.sourceOrigin)!=null?INSECURE:NO_ORIGIN);
  String top=exactHttps(tab.state.documentUrl);
  if(top==null)return refuse(INSECURE);
  if(!origin.equals(top))return refuse(engine.mainFrame?MISMATCH:FRAME);
  return new Decision(origin,null);
 }

 /**
  * Fields of one frame bound to an engine-reported origin. Revoked by the host on navigation,
  * tab change, overlay, error, close, renderer loss or a later focus elsewhere; after that, or
  * whenever the tab no longer qualifies, no structure is offered and late fill values are dropped.
  * Pausing (a provider's own unlock screen) makes the tab ineligible until it resumes, so values
  * are delivered only to the resumed, shown tab.
  */
 static final class Binding {
  final String origin,document;final long navigation;final Report fields;private volatile boolean live=true;
  Binding(String origin,long navigation,Report fields){this.origin=origin;this.navigation=navigation;this.fields=fields;this.document=fields.document;}
  void revoke(){live=false;}
  boolean live(){return live;}
  boolean admits(TabSnapshot now){
   return live&&now!=null&&now.supported&&now.navigation==navigation&&BrowserAutofillEligibility.eligible(now.state)&&origin.equals(exactHttps(now.state.documentUrl));
  }
  /** A later message from the same frame document (same engine origin and script document id). */
  boolean sameFrame(EngineSource engine,Report report){
   return live&&engine!=null&&report!=null&&origin.equals(exactHttps(engine.sourceOrigin))&&document.equals(report.document);
  }
  /** The same document's same username and password fields: a re-focus (for example after a provider's unlock screen), not a new form. */
  boolean sameFields(EngineSource engine,Report report){
   return sameFrame(engine,report)&&report.kind==Kind.FOCUS&&report.username==fields.username&&report.password==fields.password;
  }
 }

 /**
  * A focus report refused only because the tab was not eligible yet ({@link #HIDDEN}: still
  * loading, a site prompt open, not shown or paused). Login pages commonly focus a field on load
  * ({@code autofocus} or {@code focus()}), before the load finishes, and the script does not report
  * a field again while it stays focused. The report is kept for the navigation it arrived in and
  * re-run through {@link #bind} in full when the tab becomes eligible; every other refusal is final.
  * Keeping it grants nothing: only a later successful {@code bind} creates a {@link Binding}.
  */
 static final class Deferred {
  final EngineSource engine;final Report report;final long navigation;
  private Deferred(EngineSource engine,Report report,long navigation){this.engine=engine;this.report=report;this.navigation=navigation;}
  /** The report to retry, or null when the refusal is not a wait for eligibility. */
  static Deferred of(EngineSource engine,Report report,TabSnapshot tab,Decision decision){
   if(engine==null||report==null||report.kind!=Kind.FOCUS||tab==null||!tab.supported||decision==null||decision.fillable())return null;
   return HIDDEN.equals(decision.refusal)?new Deferred(engine,report,tab.navigation):null;
  }
  /** A later message from the same frame document (same engine source and script document id). */
  boolean sameFrame(EngineSource other,Report message){
   return other!=null&&message!=null&&java.util.Objects.equals(engine.sourceOrigin,other.sourceOrigin)&&engine.mainFrame==other.mainFrame&&report.document.equals(message.document);
  }
  /** Still the navigation the report arrived in; a later document never inherits it. */
  boolean current(TabSnapshot now){return now!=null&&now.navigation==navigation;}
 }

 enum Kind{FOCUS,BLUR,GONE,SUBMIT}

 /**
  * One message from Alpha's isolated-world script. Grammar (nothing else is accepted):
  * <pre>
  * focus|DOC|FOCUSED|USERNAME|PASSWORD|USERNAME_AC|PASSWORD_AC|x,y,w,h,viewportWidth
  * blur|DOC
  * gone|DOC
  * submit|DOC|USERNAME|PASSWORD|encodedUsername|encodedPassword
  * </pre>
  * DOC is the script's random per-document id; keys are the script's small positive field
  * numbers (USERNAME may be 0 for none). Values are percent-encoded. There is no origin, URL or
  * frame field: the origin is {@link EngineSource}'s alone.
  */
 static final class Report {
  static final int MAX_MESSAGE=24576,MAX_VALUE=1024,MAX_KEY=100000;
  final Kind kind;final String document;
  final int focused,username,password;
  final String usernameAutocomplete,passwordAutocomplete;
  /** Field box in CSS pixels of the top-level viewport, and that viewport's CSS width. */
  final float x,y,width,height,viewportWidth;
  /** Submitted values; only for {@link Kind#SUBMIT}. */
  final String usernameValue,passwordValue;
  private Report(Kind kind,String document,int focused,int username,int password,String usernameAutocomplete,String passwordAutocomplete,float[] box,String usernameValue,String passwordValue){
   this.kind=kind;this.document=document;this.focused=focused;this.username=username;this.password=password;
   this.usernameAutocomplete=usernameAutocomplete;this.passwordAutocomplete=passwordAutocomplete;
   this.x=box[0];this.y=box[1];this.width=box[2];this.height=box[3];this.viewportWidth=box[4];
   this.usernameValue=usernameValue;this.passwordValue=passwordValue;
  }
  /** Parsed report, or null when the message is not exactly one of the accepted shapes. */
  static Report parse(String message){
   if(message==null||message.isEmpty()||message.length()>MAX_MESSAGE)return null;
   String[] part=message.split("\\|",-1);
   try{
    if(part.length<2||!part[1].matches("[0-9a-f]{16,32}"))return null;
    String doc=part[1];float[] none=new float[5];
    switch(part[0]){
     case "blur":
      return part.length==2?new Report(Kind.BLUR,doc,0,0,0,"","",none,null,null):null;
     case "gone":
      return part.length==2?new Report(Kind.GONE,doc,0,0,0,"","",none,null,null):null;
     case "focus": {
      if(part.length!=8)return null;
      int focused=key(part[2],false),username=key(part[3],true),password=key(part[4],false);
      if(focused<0||username<0||password<0||username==password||(focused!=username&&focused!=password))return null;
      String ua=part[5],pa=part[6];
      if(!(ua.isEmpty()||ua.equals("username")||ua.equals("email"))||!(pa.isEmpty()||pa.equals("current-password")||pa.equals("new-password")))return null;
      if(username==0&&!ua.isEmpty())return null;
      String[] numbers=part[7].split(",",-1);
      if(numbers.length!=5)return null;
      float[] box=new float[5];
      for(int i=0;i<5;i++){
       if(!numbers[i].matches("-?[0-9]{1,6}(\\.[0-9]{1,3})?"))return null;
       box[i]=Float.parseFloat(numbers[i]);
      }
      if(box[2]<0||box[3]<0||box[4]<0)return null;
      return new Report(Kind.FOCUS,doc,focused,username,password,ua,pa,box,null,null);
     }
     case "submit": {
      if(part.length!=6)return null;
      int username=key(part[2],true),password=key(part[3],false);
      if(username<0||password<0||username==password)return null;
      String u=value(part[4]),p=value(part[5]);
      if(u==null||p==null||p.isEmpty()||(username==0&&!u.isEmpty()))return null;
      return new Report(Kind.SUBMIT,doc,0,username,password,"","",none,u,p);
     }
     default: return null;
    }
   }catch(RuntimeException malformed){return null;}
  }
  /** Positive field key, or 0 when {@code optional} and absent; -1 when invalid. */
  private static int key(String text,boolean optional){
   if(!text.matches("[0-9]{1,6}"))return -1;
   int value=Integer.parseInt(text);
   if(value==0)return optional?0:-1;
   return value>MAX_KEY?-1:value;
  }
  private static String value(String encoded){
   if(encoded.length()>MAX_VALUE*12||!encoded.matches("[A-Za-z0-9%._~!*'()-]*"))return null;
   String decoded;
   try{decoded=URLDecoder.decode(encoded,"UTF-8");}catch(java.io.UnsupportedEncodingException unavailable){return null;}
   if(decoded.length()>MAX_VALUE)return null;
   for(int i=0;i<decoded.length();i++)if(decoded.charAt(i)<0x20||decoded.charAt(i)==0x7f)return null;
   return decoded;
  }
 }
}
