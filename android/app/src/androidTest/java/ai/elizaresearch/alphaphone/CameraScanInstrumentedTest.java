package ai.elizaresearch.alphaphone;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Context;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.net.Uri;
import android.os.SystemClock;
import android.provider.MediaStore;
import android.view.accessibility.AccessibilityNodeInfo;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import static org.junit.Assert.*;

/** Real CameraX scan capture, real DocumentsUI image picker and real SAF PDF export.
 * Scan captures and picked images never publish to Photos unless Keep photo is chosen. */
@RunWith(AndroidJUnit4.class)
public class CameraScanInstrumentedTest {
 private Context context(){return InstrumentationRegistry.getInstrumentation().getTargetContext();}
 private String eval(String js)throws Exception{return WebViewTestDriver.evaluate(js);}
 private void until(String js,long millis)throws Exception{
  long end=SystemClock.elapsedRealtime()+millis;while(SystemClock.elapsedRealtime()<end){if("true".equals(eval("Boolean("+js+")")))return;SystemClock.sleep(150);}
  fail("Scan condition: "+js+"; dialogs="+eval("JSON.stringify([...document.querySelectorAll('dialog')].map(d=>({label:d.getAttribute('aria-label'),status:[...d.querySelectorAll('[role=status]')].map(e=>e.textContent.slice(0,200)),buttons:[...d.querySelectorAll('button')].map(b=>b.textContent+(b.disabled?' (disabled)':''))})))"));
 }
 private void until(String js)throws Exception{until(js,20000);}
 private void click(String label)throws Exception{String q="document.querySelector('button[aria-label='+"+JSONObject.quote(JSONObject.quote(label))+"+']')";until(q+" && !("+q+").disabled");eval("("+q+").click()");}
 private void clickText(String text)throws Exception{String q="[...document.querySelectorAll('dialog button')].find(b=>b.textContent.trim()==="+JSONObject.quote(text)+"&&!b.disabled)";until(q,120000);eval("("+q+").click()");}
 /** The scan review's dismiss control reads Cancel scan until OCR finishes, then Close scan. */
 private void closeScan()throws Exception{String q="[...document.querySelectorAll('dialog button')].find(b=>['Cancel scan','Close scan'].includes(b.textContent.trim()))";until(q);eval("("+q+").click()");}
 private String dialog(String label){return "document.querySelector('dialog[aria-label="+JSONObject.quote(label).replace("\"","\\\"")+"]')";}
 private Set<Long> ownedImages(){
  Set<Long> ids=new HashSet<>();
  try(Cursor c=context().getContentResolver().query(MediaStore.Images.Media.EXTERNAL_CONTENT_URI,new String[]{MediaStore.Images.Media._ID},MediaStore.MediaColumns.OWNER_PACKAGE_NAME+"=?",new String[]{context().getPackageName()},null)){if(c!=null)while(c.moveToNext())ids.add(c.getLong(0));}
  return ids;
 }
 private byte[] page(String text)throws Exception{
  Bitmap bitmap=Bitmap.createBitmap(1200,900,Bitmap.Config.ARGB_8888);
  try{Canvas canvas=new Canvas(bitmap);canvas.drawColor(Color.WHITE);Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);paint.setColor(Color.BLACK);paint.setTextSize(120);canvas.drawText(text,80,480,paint);
   ByteArrayOutputStream out=new ByteArrayOutputStream();assertTrue(bitmap.compress(Bitmap.CompressFormat.PNG,100,out));return out.toByteArray();}
  finally{bitmap.recycle();}
 }
 private void nativeSave()throws Exception{
  long end=SystemClock.elapsedRealtime()+20000;
  while(SystemClock.elapsedRealtime()<end){
   AccessibilityNodeInfo root=InstrumentationRegistry.getInstrumentation().getUiAutomation().getRootInActiveWindow();
   if(root!=null){ArrayDeque<AccessibilityNodeInfo> queue=new ArrayDeque<>();queue.add(root);while(!queue.isEmpty()){AccessibilityNodeInfo node=queue.remove();if(node.isEnabled()&&"save".equalsIgnoreCase(String.valueOf(node.getText()))&&String.valueOf(node.getPackageName()).contains("documentsui")){assertTrue("Actual DocumentsUI Save",node.performAction(AccessibilityNodeInfo.ACTION_CLICK));return;}for(int i=0;i<node.getChildCount();i++){AccessibilityNodeInfo child=node.getChild(i);if(child!=null)queue.add(child);}}}
   SystemClock.sleep(100);
  }
  fail("DocumentsUI Save not exposed");
 }
 private String shell(String command)throws Exception{try(java.io.InputStream input=new android.os.ParcelFileDescriptor.AutoCloseInputStream(InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand(command))){return new String(input.readAllBytes(),StandardCharsets.ISO_8859_1);}}
 private void enterScanMode()throws Exception{
  eval(AppNavigation.request("Camera"));until(AppNavigation.selected("Camera"));until("document.querySelector('[data-alpha-camera-screen]')");
  click("Scan mode");until("document.querySelector('button[aria-label=\"Scan text\"]')");
 }

 @Test public void scanCaptureAndPickedImageNeverPublishToPhotosUnlessKept()throws Exception{
  InstrumentationRegistry.getInstrumentation().getUiAutomation().grantRuntimePermission(context().getPackageName(),Manifest.permission.CAMERA);
  ContentResolver resolver=context().getContentResolver();String name="alpha-scan-"+UUID.randomUUID()+".png";Uri fixture=null;Set<Long> before=ownedImages(),created=new HashSet<>();
  try(BoundedActivityScenario<MainActivity> scenario=BoundedActivityScenario.launch(MainActivity.class)){
   AppNavigation.liveMode();until("document.documentElement.dataset.activeView");enterScanMode();
   click("Scan text");until(dialog("Review scanned text"));
   until(dialog("Review scanned text")+".textContent.includes('not saved to Photos unless you choose Keep photo')");
   SystemClock.sleep(1500);assertEquals("Scan capture is held in memory only",before,ownedImages());
   clickText("Keep photo");until(dialog("Review scanned text")+".textContent.includes('Photo kept in Android Photos.')");
   created.addAll(ownedImages());created.removeAll(before);assertEquals("Keep photo publishes exactly one image",1,created.size());
   closeScan();until("!"+dialog("Review scanned text"));
   Set<Long> afterKeep=ownedImages();
   fixture=new SelectedDocumentInstrumentedTest().fixtureBytes(resolver,name,"image/png",page("IMPORT"));
   click("Choose image");new SelectedDocumentInstrumentedTest().selectDocument(name);
   until(dialog("Review scanned text")+"?.textContent.includes('not copied to Photos')",30000);
   assertEquals("A picked image is reviewed without a Photos copy",afterKeep,ownedImages());
   closeScan();
  }finally{
   created.addAll(ownedImages());created.removeAll(before);for(long id:created)resolver.delete(ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI,id),null,null);
   if(fixture!=null)resolver.delete(fixture,null,null);
  }
 }

 /** Three pages: the scan capture plus two picked pages, reviewed as a searchable
  * PDF and written through the real Storage Access Framework destination. */
 @Test public void nativeThreePageSearchablePdfExportsThroughSaf()throws Exception{
  InstrumentationRegistry.getInstrumentation().getUiAutomation().grantRuntimePermission(context().getPackageName(),Manifest.permission.CAMERA);
  ContentResolver resolver=context().getContentResolver();String run=UUID.randomUUID().toString().substring(0,8);List<Uri> fixtures=new ArrayList<>();Set<Long> before=ownedImages();long started=System.currentTimeMillis();
  String listing="";
  try(BoundedActivityScenario<MainActivity> scenario=BoundedActivityScenario.launch(MainActivity.class)){
   for(String text:new String[]{"PAGE TWO","PAGE THREE"})fixtures.add(new SelectedDocumentInstrumentedTest().fixtureBytes(resolver,"alpha-page-"+run+"-"+text.replace(' ','-')+".png","image/png",page(text)));
   AppNavigation.liveMode();until("document.documentElement.dataset.activeView");enterScanMode();
   click("Scan text");until(dialog("Review scanned text"));clickText("Build multi-page PDF");until(dialog("Review scan document")+"?.querySelectorAll('img').length===1");
   for(int i=0;i<2;i++){clickText("Add page");new SelectedDocumentInstrumentedTest().selectDocument("alpha-page-"+run+"-"+(i==0?"PAGE-TWO":"PAGE-THREE")+".png");until(dialog("Review scan document")+"?.querySelectorAll('img').length==="+(i+2),30000);}
   clickText("Save document draft");until(dialog("Review scan document")+".textContent.includes('restored after Alpha restarts')");
   // Process death: the reviewed draft is restored from device storage.
   scenario.recreate();AppNavigation.liveMode();until("document.documentElement.dataset.activeView");enterScanMode();
   click("Scan document");until(dialog("Review scan document"));clickText("Load saved draft");until(dialog("Review scan document")+"?.querySelectorAll('img').length===3",30000);
   clickText("Save searchable PDF");until(dialog("Review searchable PDF"));
   clickText("Save reviewed searchable PDF");nativeSave();
   until(dialog("Review scan document")+"?.textContent.match(/saved|verified/i)",60000);
   assertEquals("No page was published to Photos",before,ownedImages());
   listing=shell("ls -1 /sdcard/Download/");
  }finally{for(Uri uri:fixtures)resolver.delete(uri,null,null);}
  String exported=null;for(String line:listing.split("\n"))if(line.trim().startsWith("Alpha document")&&line.trim().endsWith(".pdf"))exported=line.trim();
  assertNotNull("SAF wrote the reviewed PDF to Downloads: "+listing,exported);
  try{
   String pdf=shell("cat '/sdcard/Download/"+exported+"'");assertTrue("Real PDF bytes",pdf.startsWith("%PDF-"));
   Matcher pages=Pattern.compile("/Type\\s*/Page(?!s)").matcher(pdf);int count=0;while(pages.find())count++;
   assertEquals("Exactly three pages exported",3,count);
   assertTrue("Searchable PDF carries a text layer",pdf.contains("Tj")||pdf.contains("TJ"));
   assertTrue("Export is recent",Long.parseLong(shell("stat -c %Y '/sdcard/Download/"+exported+"'").trim())*1000>=started-5000);
  }finally{shell("rm -f '/sdcard/Download/"+exported+"'");}
 }
}
