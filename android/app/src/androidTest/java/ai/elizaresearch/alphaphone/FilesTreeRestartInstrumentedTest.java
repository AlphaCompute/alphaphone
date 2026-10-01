package ai.elizaresearch.alphaphone;
import android.content.*;
import android.database.Cursor;
import android.net.Uri;
import android.os.SystemClock;
import android.provider.*;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.*;
import org.json.*;
import org.junit.Test;
import static org.junit.Assert.*;
/** Real picker/grant/process boundary. Explicit runner only, no existing tree replacement. */
public final class FilesTreeRestartInstrumentedTest {
 private String js(String s)throws Exception{return WebViewTestDriver.evaluate(s);}
 private void until(String s)throws Exception{for(int i=0;i<200;i++){if("true".equals(js("Boolean("+s+")")))return;SystemClock.sleep(100);}fail("Tree restart condition: "+s);}
 private void click(String name)throws Exception{String q="[...document.querySelectorAll('button')].find(e=>e.getClientRects().length&&e.getAttribute('aria-label')==="+JSONObject.quote(name)+"&&!e.disabled)";until(q);js("("+q+").click()");}
 private void save(File f,JSONObject v)throws Exception{Files.write(f.toPath(),v.toString().getBytes(StandardCharsets.UTF_8));}
 private String name(ContentResolver r,Uri uri)throws Exception{try(Cursor c=r.query(uri,new String[]{DocumentsContract.Document.COLUMN_DISPLAY_NAME},null,null,null)){assertNotNull(c);assertTrue(c.moveToFirst());return c.getString(0);}}
 private void write(ContentResolver r,Uri uri,String value)throws Exception{try(OutputStream out=r.openOutputStream(uri,"wt")){assertNotNull(out);out.write(value.getBytes(StandardCharsets.UTF_8));}}
 @Test public void processPhase()throws Exception{
  String phase=InstrumentationRegistry.getArguments().getString("treePhase");org.junit.Assume.assumeTrue("Explicit scoped process runner required",phase!=null);assertTrue(Set.of("prepare","verify","cleanup").contains(phase));
  Context c=InstrumentationRegistry.getInstrumentation().getTargetContext();ContentResolver r=c.getContentResolver();File file=new File(c.getNoBackupFilesDir(),"tree-restart-fixture.json");SharedPreferences prefs=c.getSharedPreferences("alpha-files-tree",0);
  if(phase.equals("cleanup")){
   if(!file.exists())return;JSONObject f=new JSONObject(new String(Files.readAllBytes(file.toPath()),StandardCharsets.UTF_8));
   String saved=prefs.getString("root",null),owned=f.optString("tree",null);
   assertTrue("Never remove an unrelated selected root",saved==null||saved.equals(owned));
   if(owned!=null){Uri tree=Uri.parse(owned),root=DocumentsContract.buildDocumentUriUsingTree(tree,DocumentsContract.getTreeDocumentId(tree));assertEquals(f.getString("folder"),name(r,root));
    List<Uri> children=new ArrayList<>();Uri query=DocumentsContract.buildChildDocumentsUriUsingTree(tree,DocumentsContract.getDocumentId(root));
    try(Cursor rows=r.query(query,new String[]{DocumentsContract.Document.COLUMN_DOCUMENT_ID,DocumentsContract.Document.COLUMN_DISPLAY_NAME},null,null,null)){assertNotNull(rows);while(rows.moveToNext()){assertTrue("Refuse unknown child in fixture folder",Set.of(f.getString("seedName"),f.getString("newName")).contains(rows.getString(1)));children.add(DocumentsContract.buildDocumentUriUsingTree(tree,rows.getString(0)));}}
    for(Uri child:children)assertTrue(DocumentsContract.deleteDocument(r,child));assertTrue(DocumentsContract.deleteDocument(r,root));
    for(UriPermission p:r.getPersistedUriPermissions())if(tree.equals(p.getUri()))r.releasePersistableUriPermission(tree,(p.isReadPermission()?1:0)|(p.isWritePermission()?2:0));
    assertTrue(prefs.edit().remove("root").commit());
    for(UriPermission p:r.getPersistedUriPermissions())assertFalse("Fixture grant released",tree.equals(p.getUri()));
   }else if(f.has("seed")){r.delete(Uri.parse(f.getString("seed")),null,null);}
   assertEquals("Preexisting persisted selections unchanged",f.getString("selections"),c.getSharedPreferences("selected-documents",0).getString("records","[]"));
   assertTrue(file.delete());return;
  }
  JSONObject f;
  if(phase.equals("prepare")){
   assertFalse("Refuse unresolved fixture",file.exists());assertFalse("Existing selected tree cannot safely be replaced/restored",prefs.contains("root"));String selections=c.getSharedPreferences("selected-documents",0).getString("records","[]");assertTrue("Leave capacity for disposable previews without evicting user selections",new JSONArray(selections).length()<=28);
   String run=UUID.randomUUID().toString();f=new JSONObject().put("folder","AlphaTree-"+run).put("seedName","before.txt").put("newName","after.txt").put("text","Owned SAF restart "+run).put("pid",android.os.Process.myPid()).put("selections",selections);save(file,f);
   ContentValues v=new ContentValues();v.put(MediaStore.Downloads.DISPLAY_NAME,f.getString("seedName"));v.put(MediaStore.Downloads.MIME_TYPE,"text/plain");v.put(MediaStore.Downloads.RELATIVE_PATH,"Download/"+f.getString("folder")+"/");v.put(MediaStore.Downloads.IS_PENDING,1);Uri seed=r.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI,v);assertNotNull(seed);f.put("seed",seed.toString());save(file,f);write(r,seed,f.getString("text"));v=new ContentValues();v.put(MediaStore.Downloads.IS_PENDING,0);assertEquals(1,r.update(seed,v,null,null));
  }else{assertTrue(file.exists());f=new JSONObject(new String(Files.readAllBytes(file.toPath()),StandardCharsets.UTF_8));assertNotEquals("Actual different Android process required",f.getInt("pid"),android.os.Process.myPid());assertEquals(f.getString("tree"),prefs.getString("root",null));}
  try(BoundedActivityScenario<MainActivity> scenario=BoundedActivityScenario.launch(MainActivity.class)){
   AppNavigation.liveMode();js(AppNavigation.request("Files"));until(AppNavigation.selected("Files"));
   if(phase.equals("prepare")){
    click("Choose folder");FilesTreeInstrumentedTest picker=new FilesTreeInstrumentedTest();picker.chooseFixtureFolder(f.getString("folder"));picker.pickerText("Use this folder");picker.pickerText("Allow");
    until("document.querySelector('button[aria-label=\"Open before.txt\"]')");String saved=prefs.getString("root",null);assertNotNull(saved);f.put("tree",saved);save(file,f);
   }else click("Saved folder");
   Uri tree=Uri.parse(f.getString("tree")),root=DocumentsContract.buildDocumentUriUsingTree(tree,DocumentsContract.getTreeDocumentId(tree));assertEquals(f.getString("folder"),name(r,root));boolean retained=false;for(UriPermission p:r.getPersistedUriPermissions())if(tree.equals(p.getUri()))retained=p.isReadPermission()&&p.isWritePermission();assertTrue("Actual persisted SAF read/write grant",retained);
   click("Open before.txt");until("document.querySelector('[data-screen]').textContent.includes("+JSONObject.quote(f.getString("text"))+")");click("Back");
   if(phase.equals("verify")){
    // Product currently creates folders, not text files. This is native grant
    // write proof, followed by the real product list/preview of the new bytes.
    Uri created=DocumentsContract.createDocument(r,root,"text/plain",f.getString("newName"));assertNotNull(created);write(r,created,f.getString("text")+" after restart");
    try(InputStream in=r.openInputStream(created);ByteArrayOutputStream bytes=new ByteArrayOutputStream()){assertNotNull(in);byte[] chunk=new byte[1024];int n;while((n=in.read(chunk))!=-1){assertTrue("Bounded owned text only",bytes.size()+n<=8192);bytes.write(chunk,0,n);}assertEquals(f.getString("text")+" after restart",new String(bytes.toByteArray(),StandardCharsets.UTF_8));}
    click("View and sort");click("Refresh folder");click("Open after.txt");until("document.querySelector('[data-screen]').textContent.includes("+JSONObject.quote(f.getString("text")+" after restart")+")");click("Back");
   }
  }
 }
}
