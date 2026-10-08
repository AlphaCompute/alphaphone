package ai.elizaresearch.alphaphone;

import android.graphics.Bitmap;
import android.net.Uri;
import android.net.http.SslError;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewStructure;
import android.view.autofill.AutofillManager;
import android.view.autofill.AutofillValue;
import ai.eliza.plugins.passwords.PasswordFormPolicy;
import android.util.SparseArray;
import android.webkit.*;
import android.widget.FrameLayout;
import android.widget.TextView;
import androidx.webkit.ProfileStore;
import androidx.webkit.WebStorageCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import android.content.Intent;
import java.util.*;

/** Public navigation only. Child WebViews deliberately have no app JavaScript interface.
 * Product decision: normal tabs share one persistent browser-only profile so
 * sign-ins, cookies and site storage survive tab close and app restart, like a
 * normal browser. That profile is never the Capacitor host's default profile.
 * Private tabs use ephemeral profiles that are purged on close and at startup. */
@CapacitorPlugin(name = "AlphaBrowser")
public class AlphaBrowserPlugin extends Plugin {
 /** Durable profile shared by every normal tab. Never "Default" (the host's). */
 static final String PERSISTENT_PROFILE = "alpha_browser_v1";
 static final String PRIVATE_PREFIX = "alpha_private_";
 /** Builds before the sign-in decision gave every tab an ephemeral profile. */
 static final String LEGACY_PREFIX = "alpha_public_";
 static boolean ephemeralProfile(String name) { return name != null && (name.startsWith(PRIVATE_PREFIX) || name.startsWith(LEGACY_PREFIX)); }
 private final Map<String, Tab> tabs = new HashMap<>();
 private String namespace = PRIVATE_PREFIX + UUID.randomUUID().toString().replace("-", "");
 private final WebViewListener hostNavigation = new WebViewListener() {
  @Override public void onPageStarted(WebView view) {
   // This callback belongs only to the privileged host document, not child pages.
   if(view==getBridge().getWebView())resetHostDocument();
  }
 };
 private void resetHostDocument() {
  presentedId=null;cancelFile();if(reading!=null)reading.cancel();
  if(downloads!=null)downloads.dismissDialogs();
  ArrayList<Tab> all=new ArrayList<>(tabs.values());tabs.clear();
  // Private profiles are purged; the persistent profile keeps its sign-ins.
  for(Tab tab:all)dispose(tab);
  session=null;
  // A failed deletion must never make the next document reuse an old private profile.
  namespace=PRIVATE_PREFIX+UUID.randomUUID().toString().replace("-", "");
 }
 private String session;
 private long sequence;
 private String presentedId;
 private boolean paused;
 private boolean destroyed;
 private BrowserDownloads downloads;
 private BrowserReading reading;
 private BrowserBookmarks bookmarks;
 private BrowserSessionStore sessionStore;
 private boolean clearing;
 private final AutofillManager.AutofillCallback autofillCallback=new AutofillManager.AutofillCallback() {
  @Override public void onAutofillEvent(View view,int virtualId,int event) { autofillEvent(view,virtualId,event); }
  @Override public void onAutofillEvent(View view,int event) { autofillEvent(view,View.NO_ID,event); }
 };
 private void autofillEvent(View view,int virtualId,int event) {
  if(event!=AutofillManager.AutofillCallback.EVENT_INPUT_SHOWN)return;
  for(Tab tab:tabs.values())if(tab.web==view){
   tab.autofillVirtualId=virtualId;
   // A dataset can arrive after the overlay/navigation cancellation. Revoke
   // that late presentation too, using the framework's real virtual-field ID.
   if(!paused && !canAutofill(tab))cancelAutofill(tab);
   break;
  }
 }
 private final android.os.Handler navigationHandler = new android.os.Handler(android.os.Looper.getMainLooper());
 private static boolean cleanedProfiles;
 private final Map<String,String> retiredProfiles=new LinkedHashMap<>();
 private android.content.SharedPreferences profileRetirement;
 private ActivityResultLauncher<Intent> filePicker;
 private ActivityResultLauncher<Intent> pageShare;
 private boolean shareOutstanding;
 private ValueCallback<Uri[]> fileCallback;
 private Tab fileTab;
 private long fileNavigation;
 private boolean pickerOutstanding;
 private void cancelFile() { ValueCallback<Uri[]> callback=fileCallback;fileCallback=null;fileTab=null;if(callback!=null)callback.onReceiveValue(null); }
 @Override public void load() {
  reading=new BrowserReading(getActivity(),id->{AlphaVoiceCloudPlugin voice=(AlphaVoiceCloudPlugin)getBridge().getPlugin("AlphaVoiceCloud").getInstance();voice.cancelBrowserSpeech(id);});
  pageShare=getActivity().getActivityResultRegistry().register("alpha-browser-share",new ActivityResultContracts.StartActivityForResult(),result->{shareOutstanding=false;});
  downloads=new BrowserDownloads(getActivity());
  bookmarks=new BrowserBookmarks(getActivity());
  sessionStore=new BrowserSessionStore(getActivity());
  profileRetirement=getContext().getSharedPreferences("alpha-browser-retired-profiles",0);
  // Capacitor constructs plugins before Builder.create replaces its listener
  // list. Register on the next main-loop turn so that replacement cannot erase
  // this callback. No renderer/native browser requests run during construction.
  navigationHandler.post(()->{if(!destroyed)getBridge().addWebViewListener(hostNavigation);});
  filePicker=getActivity().getActivityResultRegistry().register("alpha-browser-file",new ActivityResultContracts.StartActivityForResult(),result->{
   pickerOutstanding=false;ValueCallback<Uri[]> callback=fileCallback;Tab tab=fileTab;fileCallback=null;fileTab=null;
   if(callback==null)return;
   if(result.getResultCode()!=android.app.Activity.RESULT_OK||tab==null||tab.dead||tabs.get(tab.id)!=tab||tab.navigation!=fileNavigation){callback.onReceiveValue(null);return;}
   Intent data=result.getData();LinkedHashSet<Uri> selected=new LinkedHashSet<>();
   if(data!=null){if(data.getData()!=null)selected.add(data.getData());if(data.getClipData()!=null)for(int i=0;i<data.getClipData().getItemCount();i++)selected.add(data.getClipData().getItemAt(i).getUri());}
   if(selected.isEmpty()||selected.size()>16||selected.stream().anyMatch(uri->uri==null||!"content".equals(uri.getScheme()))){callback.onReceiveValue(null);return;}
   callback.onReceiveValue(selected.toArray(new Uri[0]));
  });
  getActivity().runOnUiThread(() -> {
  // The privileged local renderer is never a credential destination.
  getBridge().getWebView().setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
  AutofillManager autofill=getActivity().getSystemService(AutofillManager.class);
  if(autofill!=null)autofill.registerCallback(autofillCallback);
  if (cleanedProfiles || !WebViewFeature.isFeatureSupported(WebViewFeature.MULTI_PROFILE)) return;
  cleanedProfiles=true;
  // Chromium keeps loaded profile instances until process exit. Delete retired
  // shells before this process loads any child profile; one failure must not
  // prevent cleanup of other independently retired profiles.
  // Only private and legacy per-tab profiles are ephemeral. The persistent
  // normal-tab profile is retained across restarts by product decision.
  for(String name:ProfileStore.getInstance().getAllProfileNames()) if(ephemeralProfile(name)) {
   try { ProfileStore.getInstance().deleteProfile(name);
    if(!ProfileStore.getInstance().getAllProfileNames().contains(name))profileRetirement.edit().remove(name).apply();
   } catch(Exception unavailable) { profileRetirement.edit().putString(name,"pending").apply(); }
  }
 }); }

 private static class Tab { BrowserReadingWorld readingWorld; String id, profile, opener, url = "", error = "", finishedUrl = "", lastCommittedUrl = ""; WebView web; FrameLayout frame; TextView message; boolean priv, handedOff, loading, dead, committed, autofillEnabled; int httpStatus, autofillVirtualId=View.NO_ID; long navigation; Runnable timeout; }
 /** Credentials stay in the framework/provider and the remote document. No bridge API
  * reads fields or replaces Chromium's frame-specific webDomain metadata. The only addition
  * is the committed top-level origin, which the password provider requires to equal the
  * field origin so cross-origin frames are never filled. */
 private boolean canAutofill(Tab t) {
  return !paused && !t.dead && t.committed && !t.loading && t.error.isEmpty()
    && Objects.equals(presentedId,t.id) && t.web.isShown()
    && "https".equalsIgnoreCase(Uri.parse(t.url).getScheme())
    && Objects.equals(t.url,t.web.getUrl());
 }
 private void cancelAutofill(Tab t) {
  t.autofillEnabled=false;
  AutofillManager manager=getActivity().getSystemService(AutofillManager.class);
  if(manager!=null) {
   // AOSP keeps the popup anchor in the active session's fillable IDs.
   // Visibility=false hides that popup synchronously. Do this BEFORE clearFocus
   // or cancel can reset those IDs; notifyViewExited alone is asynchronous.
   if(t.autofillVirtualId!=View.NO_ID) {
    manager.notifyViewVisibilityChanged(t.web,t.autofillVirtualId,false);
    manager.notifyViewExited(t.web,t.autofillVirtualId);
   }else {
    manager.notifyViewVisibilityChanged(t.web,false);
    manager.notifyViewExited(t.web);
   }
  }
  t.web.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
  t.web.clearFocus();
  if(manager!=null)manager.cancel();
  t.autofillVirtualId=View.NO_ID;
 }
 private void disableAutofill(Tab t) {
  if(t.autofillEnabled)cancelAutofill(t);
  else t.web.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
 }
 private void syncAutofill(Tab t) {
  // Provider authentication can pause this Activity. Keep the same-document
  // session, but never provide/fill fields until this selected tab resumes.
  if(paused) { t.web.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS); return; }
  if(canAutofill(t)) { t.autofillEnabled=true; t.web.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_YES); }
  else disableAutofill(t);
 }
 private final class CredentialWebView extends WebView {
  private final Tab tab;
  CredentialWebView(Tab tab) { super(getActivity());this.tab=tab; }
  @Override public void onProvideAutofillVirtualStructure(ViewStructure structure,int flags) {
   if(canAutofill(tab)) {
    super.onProvideAutofillVirtualStructure(structure,flags);
    String origin=topOrigin(tab.url);
    if(origin!=null && structure.getExtras()!=null)structure.getExtras().putString(PasswordFormPolicy.TOP_ORIGIN_EXTRA,origin);
   }
   else structure.setChildCount(0);
  }
  @Override public void onProvideAutofillStructure(ViewStructure structure,int flags) {
   if(canAutofill(tab))super.onProvideAutofillStructure(structure,flags);
   else structure.setChildCount(0);
  }
  @Override public void autofill(SparseArray<AutofillValue> values) {
   if(canAutofill(tab))super.autofill(values);
  }
 }
 /** Exact https://host[:port] of the committed document, or null. */
 static String topOrigin(String url) {
  Uri uri=Uri.parse(url==null?"":url);
  String host=uri.getHost();
  if(!"https".equalsIgnoreCase(uri.getScheme()) || host==null || host.isEmpty() || uri.getUserInfo()!=null)return null;
  int port=uri.getPort();
  return "https://"+host.toLowerCase(java.util.Locale.ROOT)+(port==-1||port==443?"":":"+port);
 }
 private void clearTimeout(Tab t) { if(t.timeout!=null) navigationHandler.removeCallbacks(t.timeout); t.timeout=null; }
 private void loading(Tab t) { loading(t,false); }
 private void loading(Tab t,boolean startedCallback) {
  if(reading!=null)reading.cancel();
  disableAutofill(t);
  if(downloads!=null)downloads.cancelReview(t.id);
  if(t.readingWorld!=null&&!startedCallback)t.readingWorld.invalidate();
  t.navigation++;if(fileTab==t)cancelFile();
  clearTimeout(t); t.loading=true; t.committed=false; t.error=""; t.httpStatus=0; t.finishedUrl="";
  t.web.setVisibility(View.INVISIBLE); t.message.setText("Loading website…"); t.message.setVisibility(View.VISIBLE);
  t.timeout=()->{if(t.loading&&!t.dead)fail(t,"This page is taking too long. Check your connection, then reload from the menu.");};
  navigationHandler.postDelayed(t.timeout,30000);
 }
 private void dispose(Tab t) {
  if(t.readingWorld!=null)t.readingWorld.close();
  if(reading!=null)reading.cancel();
  disableAutofill(t);
  if(downloads!=null)downloads.cancelReview(t.id);
  if(fileTab==t)cancelFile();
  clearTimeout(t);
  if(t.frame != null && t.frame.getParent() != null) ((ViewGroup)t.frame.getParent()).removeView(t.frame);
  // Normal tabs keep the shared persistent profile. A private profile is purged
  // only once no live tab (for example its pop-up) still uses it.
  boolean purge=t.priv&&ephemeralProfile(t.profile)&&tabs.values().stream().noneMatch(other->other!=t&&Objects.equals(other.profile,t.profile));
  if(purge) {
   // Retirement is durable even if the asynchronous purge or process stops.
   profileRetirement.edit().putString(t.profile,"pending").commit();
   retiredProfiles.put(t.profile,"pending");
   while(retiredProfiles.size()>256)retiredProfiles.remove(retiredProfiles.keySet().iterator().next());
  }
  android.webkit.WebStorage storage=null;
  if(purge) try {
   androidx.webkit.Profile profile=t.dead?ProfileStore.getInstance().getProfile(t.profile):WebViewCompat.getProfile(t.web);
   if(profile!=null&&ephemeralProfile(profile.getName())&&t.profile.equals(profile.getName()))storage=profile.getWebStorage();
  } catch(Exception unavailable) { /* Pending startup cleanup remains. */ }
  if(!t.dead) {
   t.web.stopLoading();t.web.setWebViewClient(new WebViewClient());t.web.setWebChromeClient(null);
   t.web.destroy();t.dead=true;
  }
  final android.webkit.WebStorage retiredStorage=storage;
  final String retiredName=t.profile;
  // WebView.destroy posts Chromium native destruction. Retire only that
  // profile's data after that task; never clear the host/default profile.
  if(retiredName!=null&&retiredStorage!=null&&WebViewFeature.isFeatureSupported(WebViewFeature.DELETE_BROWSING_DATA))navigationHandler.post(()->{
   try { WebStorageCompat.deleteBrowsingData(retiredStorage,()->{
    retiredProfiles.put(retiredName,"purged");
    profileRetirement.edit().putString(retiredName,"purged-awaiting-process-cleanup").apply();
   }); } catch(Exception unavailable) { retiredProfiles.put(retiredName,"pending"); }
  });
 }
 private boolean safe(String value) {
  try { Uri u = Uri.parse(value); return ("https".equalsIgnoreCase(u.getScheme()) || "http".equalsIgnoreCase(u.getScheme())) && u.getHost() != null && u.getUserInfo() == null && !value.contains("\n") && !value.contains("\r"); } catch (Exception e) { return false; }
 }
 private void fail(Tab t, String message) { disableAutofill(t); clearTimeout(t); t.error = message; t.loading = false; t.committed = false; t.web.stopLoading(); t.web.setVisibility(View.INVISIBLE); t.message.setText(message); t.message.setVisibility(View.VISIBLE); emit(t); }
 private JSObject state(Tab t) { JSObject s = new JSObject(); s.put("session", session); s.put("id", t.id); s.put("sequence", ++sequence); s.put("navigation", String.valueOf(t.navigation)); s.put("url", t.url); s.put("title", t.dead ? "" : t.web.getTitle()); s.put("loading", t.loading); s.put("committed", t.committed); s.put("httpStatus", t.httpStatus); s.put("progress", t.dead ? 0 : t.web.getProgress()); s.put("canBack", !t.dead && t.web.canGoBack()); s.put("canForward", !t.dead && t.web.canGoForward()); s.put("error", t.error); s.put("private", t.priv); return s; }
 private void emit(Tab t) { if (tabs.get(t.id) == t) notifyListeners("stateChanged", state(t)); }
 private void run(PluginCall call, java.util.function.Consumer<Tab> action) { getActivity().runOnUiThread(() -> { if (!Objects.equals(session, call.getString("session"))) { call.reject("Expired browser session"); return; } Tab t = tabs.get(call.getString("id")); if (t == null || t.dead) { call.reject("Browser tab is unavailable"); return; } try { action.accept(t); call.resolve(state(t)); } catch (Exception e) { call.reject("Browser operation failed"); } }); }
 @PluginMethod public void create(PluginCall call) { getActivity().runOnUiThread(() -> {
  String requested = call.getString("session"), id = call.getString("id");
  if (requested == null || id == null || !id.matches("[A-Za-z0-9_-]{1,80}")) { call.reject("Invalid browser identity"); return; }
  if (session != null && !session.equals(requested)) { call.reject("Expired browser session"); return; }
  session = requested;
  boolean priv = Boolean.TRUE.equals(call.getBoolean("private", false));
  if (tabs.containsKey(id)) { Tab existing = tabs.get(id); if (existing.priv != priv) { call.reject("Browser tab identity changed"); return; } call.resolve(state(existing)); return; }
  if (tabs.size() >= 8) { call.reject("Close a tab before opening another"); return; }
  if (clearing && !priv) { call.reject("Browsing data is being cleared. Try again in a moment."); return; }
  if (!WebViewFeature.isFeatureSupported(WebViewFeature.MULTI_PROFILE) || !WebViewFeature.isFeatureSupported(WebViewFeature.GET_WEB_VIEW_RENDERER)) { call.reject("This Android WebView does not support isolated browser profiles"); return; }
  // Normal tabs keep their data by decision P-04, so only private tabs depend on
  // secure profile-scoped deletion when they close.
  if (priv && !WebViewFeature.isFeatureSupported(WebViewFeature.DELETE_BROWSING_DATA)) { call.reject("Private tabs need an Android System WebView that can securely delete their data. Update Android System WebView to use private tabs."); return; }
  try { call.resolve(state(build(id, priv, priv ? namespace + "_" + id : PERSISTENT_PROFILE))); }
  catch (Exception e) { call.reject("Could not create an isolated browser tab"); }
 }); }
 /** One child WebView in the given browser-only profile. Pop-ups pass their
  * opener's profile so a site's sign-in window shares its session. */
 private Tab build(String id, boolean priv, String profileName) throws Exception {
  Tab t = new Tab(); t.id = id; t.priv = priv; t.web = new CredentialWebView(t);
  try {
   // setProfile creates a missing profile. Chromium retains loaded profile
   // shells until process exit; private retirement purges data before startup deletion.
   if (profileName == null || "Default".equals(profileName) || (priv != ephemeralProfile(profileName))) throw new IllegalStateException();
   t.profile = profileName; WebViewCompat.setProfile(t.web, t.profile);
   // Check mode before loading any remote page; inspect its renderer after a
   // navigation has committed rather than rejecting an unstarted WebView.
   if (!WebViewFeature.isFeatureSupported(WebViewFeature.MULTI_PROCESS) || !WebViewCompat.isMultiProcessEnabled()) throw new IllegalStateException();
   WebSettings settings = t.web.getSettings(); settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true); settings.setAllowFileAccess(false); settings.setAllowContentAccess(false); settings.setAllowFileAccessFromFileURLs(false); settings.setAllowUniversalAccessFromFileURLs(false); settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW); settings.setJavaScriptCanOpenWindowsAutomatically(false); settings.setSupportMultipleWindows(true); settings.setSaveFormData(false); settings.setSafeBrowsingEnabled(true); t.web.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
   CookieManager.getInstance().setAcceptThirdPartyCookies(t.web, false);
   t.readingWorld=new BrowserReadingWorld(t.web);
   t.frame = new FrameLayout(getActivity()); t.frame.setClipChildren(true); t.frame.setVisibility(View.GONE); t.frame.addView(t.web, new FrameLayout.LayoutParams(-1,-1));
   t.message = new TextView(getActivity()); t.message.setPadding(24,24,24,24); t.message.setBackgroundColor(0xfffafafa); t.message.setTextColor(0xff222222); t.message.setVisibility(View.GONE); t.frame.addView(t.message, new FrameLayout.LayoutParams(-1,-1));
   t.web.setWebViewClient(new WebViewClient() {
    @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
     String target = r.getUrl().toString();
     // mailto/tel/intent/market belong to other apps. The current page stays.
     if (BrowserExternalLinks.external(target)) { if (r.isForMainFrame()) handoff(t, target, r.hasGesture()); return true; }
     if (!safe(target)) { if (r.isForMainFrame()) fail(t,"This address type is not supported."); return true; }
     return false;
    }
    @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) { if (r.isForMainFrame() && !safe(r.getUrl().toString())) return new WebResourceResponse("text/plain","UTF-8",new java.io.ByteArrayInputStream(new byte[0])); return null; }
    @Override public void onPageStarted(WebView v, String url, Bitmap icon) { if (!safe(url)) { fail(t,"This address type is not supported."); return; } t.url=url; if(t.readingWorld!=null)t.readingWorld.pageStarted(url); loading(t,true); emit(t); }
    @Override public void onPageCommitVisible(WebView v, String url) {
     if (!t.error.isEmpty() || !url.equals(v.getUrl())) return;
     if (WebViewCompat.getWebViewRenderProcess(v) == null) { fail(t,"Isolated browser renderer is unavailable."); return; }
     clearTimeout(t); t.lastCommittedUrl=url; t.committed=true; t.loading=!(url.equals(t.finishedUrl) || v.getProgress()==100); t.url=url; t.message.setVisibility(View.GONE); t.web.setVisibility(View.VISIBLE); syncAutofill(t); emit(t);
    }
    @Override public void onPageFinished(WebView v, String url) { if (!t.error.isEmpty() || !safe(url) || !url.equals(t.url)) return; t.finishedUrl=url; if(t.committed) { clearTimeout(t); t.loading=false; syncAutofill(t); emit(t); } }
    @Override public void onReceivedHttpAuthRequest(WebView v, HttpAuthHandler handler, String host, String realm) { handler.cancel(); fail(t,"This site asks for a browser password prompt (HTTP authentication), which is not supported."); }
    @Override public void onReceivedSslError(WebView v, SslErrorHandler handler, SslError error) { handler.cancel(); fail(t,"Secure connection failed. The certificate was not accepted."); }
    @Override public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) { if (r.isForMainFrame()) { if (BuildConfig.DEBUG) android.util.Log.w("AlphaBrowser", "Main-frame network failure code=" + e.getErrorCode()); fail(t,"Page could not load. Check the address and connection, then reload."); } }
    @Override public void onReceivedHttpError(WebView v, WebResourceRequest r, WebResourceResponse response) {
     // An HTTP response is still a document: preserve the site's explanation,
     // retry links and traffic challenges. Transport/TLS failures remain fatal.
     if (r.isForMainFrame()) { t.httpStatus=response.getStatusCode(); emit(t); }
    }
    @Override public boolean onRenderProcessGone(WebView v, RenderProcessGoneDetail detail) { if(t.readingWorld!=null)t.readingWorld.close(); if(reading!=null)reading.cancel();disableAutofill(t); clearTimeout(t); t.dead=true; t.loading=false; t.committed=false; t.error="Browser renderer stopped. Close this tab and open a new one."; t.frame.removeView(v); v.destroy(); t.message.setText(t.error); t.message.setVisibility(View.VISIBLE); JSObject event=new JSObject(); event.put("session",session); event.put("id",t.id); event.put("sequence",++sequence); event.put("error",t.error); event.put("loading",false); notifyListeners("stateChanged",event); return true; }
   });
   t.web.setWebChromeClient(new WebChromeClient() {
    @Override public void onProgressChanged(WebView v,int p) { if(p==100 && t.committed && t.error.isEmpty()) t.loading=false; syncAutofill(t); emit(t); }
    @Override public void onReceivedTitle(WebView v,String title) { emit(t); }
    @Override public void onPermissionRequest(PermissionRequest request) { request.deny(); }
    @Override public void onGeolocationPermissionsShowPrompt(String origin,GeolocationPermissions.Callback cb) { cb.invoke(origin,false,false); }
    @Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> cb,FileChooserParams params) {
     if(paused||t.dead||tabs.get(t.id)!=t||!Objects.equals(presentedId,t.id)||!v.isShown()||pickerOutstanding||!t.committed||t.loading||!t.error.isEmpty()||!safe(t.url)||params.getMode()==FileChooserParams.MODE_SAVE){cb.onReceiveValue(null);return true;}
     cancelFile();fileCallback=cb;fileTab=t;fileNavigation=t.navigation;pickerOutstanding=true;
     Intent picker=new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
     ArrayList<String> types=new ArrayList<>();for(String type:params.getAcceptTypes())if(type!=null&&type.matches("[A-Za-z0-9!#$&^_.+-]+/[A-Za-z0-9!#$&^_.+*\\-]+"))types.add(type);
     if(!types.isEmpty())picker.putExtra(Intent.EXTRA_MIME_TYPES,types.toArray(new String[0]));
     picker.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,params.getMode()==FileChooserParams.MODE_OPEN_MULTIPLE);
     try{filePicker.launch(Intent.createChooser(picker,"Choose files for "+Uri.parse(t.url).getHost()));}
     catch(Exception unavailable){pickerOutstanding=false;cancelFile();}
     return true;
    }
    @Override public boolean onCreateWindow(WebView v,boolean dialog,boolean gesture,android.os.Message message) { return popup(t,gesture,message); }
    @Override public void onCloseWindow(WebView window) {
     // Only a pop-up this browser opened may close itself (window.close()).
     if(t.opener==null||tabs.get(t.id)!=t)return;
     tabs.remove(t.id);dispose(t);tabClosed(t.id);
    }
   });
   t.web.setDownloadListener((url,agent,disposition,mime,length) -> {
    if(paused||t.dead||!Objects.equals(presentedId,t.id)||tabs.get(t.id)!=t)return;
    disableAutofill(t);clearTimeout(t);t.loading=false;
    if(!t.lastCommittedUrl.isEmpty()&&Objects.equals(t.lastCommittedUrl,t.web.getUrl())){
     t.url=t.lastCommittedUrl;t.committed=true;t.web.setVisibility(View.VISIBLE);t.message.setVisibility(View.GONE);
    }else {t.committed=false;t.web.setVisibility(View.INVISIBLE);t.message.setText("Download requested. Enter an address to continue browsing.");t.message.setVisibility(View.VISIBLE);}
    long revision=t.navigation;
    downloads.request(t.id,url,disposition,mime,length,()->!paused&&!t.dead&&tabs.get(t.id)==t&&t.navigation==revision&&Objects.equals(presentedId,t.id));emit(t);
   });
   ((ViewGroup)getActivity().findViewById(android.R.id.content)).addView(t.frame); tabs.put(id,t); return t;
  } catch (Exception e) { dispose(t); throw e; }
 }
 private void notice(Tab t,String message) { if(tabs.get(t.id)!=t)return; JSObject event=new JSObject(); event.put("session",session); event.put("id",t.id); event.put("message",message); notifyListeners("notice",event); }
 /** target=_blank links and window.open open a new tab in the opener's profile.
  * Only a user gesture in the selected, committed tab may open one; the opener
  * is untrusted, so the new tab gets the same policy and no app bridge. */
 private boolean popup(Tab opener,boolean gesture,android.os.Message message) {
  if(paused||destroyed||opener.dead||tabs.get(opener.id)!=opener||!Objects.equals(presentedId,opener.id)||!opener.committed||!opener.error.isEmpty()){return false;}
  if(!gesture){notice(opener,"Blocked a pop-up that opened without a tap.");return false;}
  if(tabs.size()>=8){notice(opener,"Close a tab to open this link in a new tab.");return false;}
  if(!(message.obj instanceof WebView.WebViewTransport))return false;
  String id="p"+UUID.randomUUID().toString().replace("-","");
  Tab child;
  try{child=build(id,opener.priv,opener.profile);}catch(Exception unavailable){notice(opener,"This link could not open in a new tab.");return false;}
  child.opener=opener.id;
  loading(child);
  ((WebView.WebViewTransport)message.obj).setWebView(child.web);message.sendToTarget();
  JSObject event=new JSObject();event.put("session",session);event.put("id",id);event.put("opener",opener.id);event.put("private",child.priv);
  notifyListeners("tabOpened",event);emit(child);
  return true;
 }
 private boolean ownsRoute(Intent intent) {
  String own=getContext().getPackageName();
  if(own.equals(intent.getPackage()))return true;
  for(android.content.pm.ResolveInfo info:getContext().getPackageManager().queryIntentActivities(intent,0))
   if(info.activityInfo!=null&&own.equals(info.activityInfo.packageName))return true;
  return false;
 }
 /** Hand a tapped mailto/tel/intent/market link to Android. The page stays loaded. */
 private void handoff(Tab t,String raw,boolean gesture) {
  if(paused||destroyed||t.dead||tabs.get(t.id)!=t)return;
  // A tapped target=_blank link to another app first opens a pop-up tab whose
  // creation was already gesture-gated in popup(). That still-empty pop-up may
  // hand off exactly once and then closes, so an opener script cannot reuse it.
  Tab opener=t.opener==null?null:tabs.get(t.opener);
  boolean fresh=opener!=null&&!t.handedOff&&!t.committed&&t.lastCommittedUrl.isEmpty();
  Tab report=fresh?opener:t;
  if(fresh){t.handedOff=true;if(!Objects.equals(presentedId,t.id)&&!Objects.equals(presentedId,opener.id)){closePopup(t);return;}}
  else{
   if(!Objects.equals(presentedId,t.id))return;
   if(!gesture){notice(t,"Blocked a link to another app that opened without a tap.");return;}
  }
  Intent intent=BrowserExternalLinks.intentFor(raw,getContext().getPackageName());
  if(intent==null||ownsRoute(intent)){notice(report,"This link type is not supported.");if(fresh)closePopup(t);return;}
  for(Tab tab:tabs.values())disableAutofill(tab);
  try{getActivity().startActivity(intent);if(fresh)closePopup(t);}
  catch(android.content.ActivityNotFoundException missing){
   String fallback=BrowserExternalLinks.fallback(raw);
   if(fallback!=null&&safe(fallback)){t.url=fallback;loading(t);emit(t);if(t.readingWorld!=null)t.readingWorld.prepare(fallback);t.web.loadUrl(fallback);}
   else{notice(report,"No app on this device can open this link.");if(fresh)closePopup(t);}
  }
  catch(RuntimeException blocked){notice(report,"This link could not be opened.");if(fresh)closePopup(t);}
 }
 private void tabClosed(String id){JSObject event=new JSObject();event.put("session",session);event.put("id",id);notifyListeners("tabClosed",event);}
 /** Close a pop-up after its callback returns; a WebView is not destroyed inside its own callback. */
 private void closePopup(Tab t){navigationHandler.post(()->{if(tabs.get(t.id)!=t)return;tabs.remove(t.id);dispose(t);tabClosed(t.id);});}
 @PluginMethod public void navigate(PluginCall call) { String url=call.getString("url"); if (url==null || !safe(url)) { call.reject("Enter an HTTP or HTTPS address without credentials"); return; } run(call,t -> { t.url=url; loading(t); emit(t); if(t.readingWorld!=null)t.readingWorld.prepare(url); t.web.loadUrl(url); }); }
 @PluginMethod public void command(PluginCall call) { run(call,t -> { String op=call.getString("command"); if ("back".equals(op)) { if(t.web.canGoBack()){loading(t);if(t.readingWorld!=null)t.readingWorld.prepareHistory(-1);t.web.goBack();} } else if ("forward".equals(op)) { if(t.web.canGoForward()){loading(t);if(t.readingWorld!=null)t.readingWorld.prepareHistory(1);t.web.goForward();} } else if ("reload".equals(op)) {loading(t);if(t.readingWorld!=null)t.readingWorld.prepare(t.web.getUrl());t.web.reload();} else if ("stop".equals(op)) { clearTimeout(t); if(!t.committed)fail(t,"Loading stopped. Reload from the menu to try again."); else {t.web.stopLoading();t.loading=false;syncAutofill(t);} } else throw new IllegalArgumentException(); emit(t); }); }
 @PluginMethod public void present(PluginCall call) { getActivity().runOnUiThread(() -> {
  if (!Objects.equals(session,call.getString("session"))) { call.reject("Expired browser session"); return; }
  String nextId=call.getString("id");
  // Revoke selected-tab authority before any synchronous framework callback.
  presentedId=nextId;if(reading!=null)reading.check();
  for(Tab old:tabs.values())if(!Objects.equals(old.id,presentedId)){disableAutofill(old);old.frame.setVisibility(View.GONE);}
  Tab t=tabs.get(call.getString("id")); if(t!=null) { float d=getContext().getResources().getDisplayMetrics().density; FrameLayout.LayoutParams p=new FrameLayout.LayoutParams(Math.max(0,Math.round(call.getFloat("width",0f)*d)),Math.max(0,Math.round(call.getFloat("height",0f)*d))); p.leftMargin=Math.round(call.getFloat("x",0f)*d); p.topMargin=Math.round(call.getFloat("y",0f)*d); t.frame.setLayoutParams(p); t.frame.setVisibility(paused?View.GONE:View.VISIBLE); syncAutofill(t); } call.resolve();
 }); }
 private boolean bookmarkSession(PluginCall call) {
  String requested=call.getString("session");
  if(requested==null||requested.isEmpty()||requested.length()>100||(session!=null&&!session.equals(requested))){call.reject("Expired browser session");return false;}
  session=requested;return true;
 }
 private JSObject bookmarkResult(ArrayList<String> urls) { JSObject result=new JSObject();JSArray list=new JSArray();for(String url:urls)list.put(url);result.put("urls",list);return result; }
 @PluginMethod public void bookmarks(PluginCall call) { getActivity().runOnUiThread(()->{
  if(!bookmarkSession(call))return;
  try{call.resolve(bookmarkResult(bookmarks.read()));}catch(Exception unavailable){call.reject("Saved bookmarks could not be read. Existing bookmarks were not changed.");}
 }); }
 @PluginMethod public void setBookmark(PluginCall call) { getActivity().runOnUiThread(()->{
  if(!bookmarkSession(call))return;
  String url=call.getString("url");Boolean saved=call.getBoolean("saved");
  if(!BrowserBookmarks.valid(url)||saved==null){call.reject("Only HTTPS addresses without embedded credentials can be bookmarked.");return;}
  try{call.resolve(bookmarkResult(bookmarks.change(url,saved)));}catch(Exception unavailable){call.reject("Bookmark could not be saved. The device stores up to 100 bookmarks; existing data was not changed.");}
 }); }
 @PluginMethod public void browsingState(PluginCall call) { getActivity().runOnUiThread(()->{
  if(!bookmarkSession(call))return;
  try{call.resolve(JSObject.fromJSONObject(sessionStore.read()));}catch(Exception unavailable){call.reject("Saved tabs and history could not be read. They were not changed.");}
 }); }
 /** Normal tabs and history only; the renderer never sends private tabs. */
 @PluginMethod public void saveBrowsingState(PluginCall call) { getActivity().runOnUiThread(()->{
  if(!bookmarkSession(call))return;
  if(clearing){call.reject("Browsing data is being cleared.");return;}
  try{
   org.json.JSONObject state=new org.json.JSONObject();
   state.put("history",call.getArray("history",new JSArray()));state.put("tabs",call.getArray("tabs",new JSArray()));state.put("cur",call.getString("cur",""));
   call.resolve(JSObject.fromJSONObject(sessionStore.write(state)));
  }catch(Exception unavailable){call.reject("Tabs and history could not be saved.");}
 }); }
 /** Clear browsing data: cookies and site data, history and cache of the
  * persistent normal-tab profile. Open normal tabs close first so a live page
  * cannot rewrite its data; private tabs are unaffected. Bookmarks remain. */
 @PluginMethod public void clearBrowsingData(PluginCall call) { getActivity().runOnUiThread(()->{
  if(!bookmarkSession(call))return;
  if(clearing){call.reject("Browsing data is already being cleared.");return;}
  if(!WebViewFeature.isFeatureSupported(WebViewFeature.MULTI_PROFILE)||!WebViewFeature.isFeatureSupported(WebViewFeature.DELETE_BROWSING_DATA)){call.reject("This Android WebView cannot clear browser data. Update Android System WebView.");return;}
  clearing=true;JSArray closed=new JSArray();
  for(Tab tab:new ArrayList<>(tabs.values()))if(!tab.priv){tabs.remove(tab.id);dispose(tab);closed.put(tab.id);tabClosed(tab.id);}
  try{sessionStore.clear();}catch(Exception unavailable){clearing=false;call.reject("Browsing history could not be cleared.");return;}
  // WebView.destroy posts native destruction; clear after those tasks.
  navigationHandler.post(()->{
   try{
    androidx.webkit.Profile profile=ProfileStore.getInstance().getOrCreateProfile(PERSISTENT_PROFILE);
    CookieManager cookies=profile.getCookieManager();
    cookies.removeAllCookies(removed->{
     try{WebStorageCompat.deleteBrowsingData(profile.getWebStorage(),()->{cookies.flush();clearing=false;JSObject result=new JSObject();result.put("closed",closed);call.resolve(result);});}
     catch(Exception unavailable){clearing=false;call.reject("Website data could not be cleared.");}
    });
   }catch(Exception unavailable){clearing=false;call.reject("Website data could not be cleared.");}
  });
 }); }
 /** Cookies and storage for the selected tab's site (registrable domain) only. */
 @PluginMethod public void clearSiteData(PluginCall call) { getActivity().runOnUiThread(()->{
  if(!Objects.equals(session,call.getString("session"))){call.reject("Expired browser session");return;}
  Tab t=tabs.get(call.getString("id"));
  if(t==null||t.dead||!safe(t.url)||!Objects.equals(call.getString("url"),t.url)){call.reject("Load a website before clearing its data.");return;}
  if(!WebViewFeature.isFeatureSupported(WebViewFeature.DELETE_BROWSING_DATA)){call.reject("This Android WebView cannot clear site data.");return;}
  try{
   String[] site=new String[1];
   site[0]=WebStorageCompat.deleteBrowsingDataForSite(WebViewCompat.getProfile(t.web).getWebStorage(),Uri.parse(t.url).getHost(),()->{JSObject result=new JSObject();result.put("site",site[0]);call.resolve(result);});
  }catch(Exception unavailable){call.reject("Site data could not be cleared.");}
 }); }
 @PluginMethod public void reviewQuestion(PluginCall call) { reviewPage(call,true); }
 @PluginMethod public void reviewReading(PluginCall call) { reviewPage(call,false); }
 private void reviewPage(PluginCall call,boolean question) { getActivity().runOnUiThread(()->{
  Tab tab=tabs.get(call.getString("id"));String owner=session,url=call.getString("url"),navigation=call.getString("navigation");
  java.util.function.BooleanSupplier current=()->!destroyed&&!paused&&Objects.equals(owner,session)&&Objects.equals(session,call.getString("session"))&&tab!=null&&tabs.get(tab.id)==tab&&!tab.dead&&Objects.equals(presentedId,tab.id)&&tab.web.isShown()&&tab.committed&&!tab.loading&&tab.error.isEmpty()&&Objects.equals(url,tab.url)&&Objects.equals(url,tab.web.getUrl())&&Objects.equals(navigation,String.valueOf(tab.navigation))&&url!=null&&url.startsWith("https://");
  if(!current.getAsBoolean()){call.reject("Load a visible HTTPS page before reading");return;}
  if(question)reading.reviewQuestion(call,tab.web,tab.readingWorld,current);else reading.review(call,tab.web,tab.readingWorld,current);
 }); }
 @PluginMethod public void cancelReading(PluginCall call) { getActivity().runOnUiThread(()->{if(Objects.equals(session,call.getString("session")))reading.cancel();call.resolve();}); }
 String consumeReading(PluginCall call)throws Exception{return reading.consume(call);}
 @PluginMethod public void share(PluginCall call) { run(call,t->{
  // The renderer supplies only identity/revision guards. Page data comes from
  // the committed native document, never caller-provided share text or title.
  if(paused||destroyed||shareOutstanding||pickerOutstanding||!Objects.equals(presentedId,t.id)||!t.web.isShown()||!t.committed||t.loading||!t.error.isEmpty()
    ||!Objects.equals(call.getString("navigation"),String.valueOf(t.navigation))||!Objects.equals(call.getString("url"),t.url)||!Objects.equals(t.web.getUrl(),t.url)||!safe(t.url)||t.url.length()>4096||t.url.chars().anyMatch(c->c<32||c==127))throw new IllegalStateException("Current page changed");
  String title=t.web.getTitle();if(title==null||title.length()>512||title.chars().anyMatch(c->c<32||c==127))title=Uri.parse(t.url).getHost();
  Intent send=new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT,t.url).putExtra(Intent.EXTRA_SUBJECT,title).putExtra(Intent.EXTRA_TITLE,title);
  for(Tab tab:tabs.values())disableAutofill(tab);
  shareOutstanding=true;try{pageShare.launch(Intent.createChooser(send,"Share page"));}catch(RuntimeException failure){shareOutstanding=false;throw failure;}
 }); }
 @PluginMethod public void downloads(PluginCall call) { getActivity().runOnUiThread(()->{String requested=call.getString("session");if(requested==null||(session!=null&&!Objects.equals(session,requested))){call.reject("Expired browser session");return;}session=requested;for(Tab tab:tabs.values())disableAutofill(tab);downloads.show();call.resolve();}); }
 @PluginMethod public void close(PluginCall call) { getActivity().runOnUiThread(() -> { if (!Objects.equals(session,call.getString("session"))) { call.reject("Expired browser session"); return; } Tab t=tabs.remove(call.getString("id")); if(t!=null) dispose(t); call.resolve(); }); }
 @Override protected void handleOnPause() { paused=true;if(reading!=null)reading.cancel();flushCookies(); for(Tab t:tabs.values()) { syncAutofill(t); t.frame.setVisibility(View.GONE); if(!t.dead)t.web.onPause(); } }
 /** Persist normal-tab sign-in cookies promptly; the process may be killed in background. */
 private void flushCookies() {
  try{if(WebViewFeature.isFeatureSupported(WebViewFeature.MULTI_PROFILE)){androidx.webkit.Profile profile=ProfileStore.getInstance().getProfile(PERSISTENT_PROFILE);if(profile!=null)profile.getCookieManager().flush();}}catch(Exception unavailable){/* Chromium also flushes periodically. */}
 }
 @Override protected void handleOnResume() { paused=false; for(Tab t:tabs.values()) if(!t.dead){t.web.onResume();JSObject event=state(t);event.put("surfaceResumed",true);notifyListeners("stateChanged",event);} }
 @Override protected void handleOnDestroy() { destroyed=true;if(reading!=null)reading.cancel();getBridge().removeWebViewListener(hostNavigation);if(downloads!=null)downloads.destroy();AutofillManager manager=getActivity().getSystemService(AutofillManager.class);if(manager!=null)manager.unregisterCallback(autofillCallback);cancelFile();if(filePicker!=null)filePicker.unregister();if(pageShare!=null)pageShare.unregister();ArrayList<Tab> all=new ArrayList<>(tabs.values());tabs.clear();
  // Clear first: a private profile shared with a pop-up is purged only when no tab still uses it.
  for(Tab t:all) dispose(t); session=null; }
}
