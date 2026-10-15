import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runJvm} from './fixtures/jvm-tools.mjs';

// Runs the production method on a host JVM with a synthetic ContentResolver. This is not
// Android acceptance: it checks dispatch and readback rules without deleting real media.
test('permitted permanent deletion fences restored/changed items and requires exact absence',()=>{
 const source=readFileSync('android/app/src/main/java/ai/elizaresearch/alphaphone/PermittedMediaCatalog.java','utf8');
 const method=source.slice(source.indexOf(' JSObject deleteTrashed('),source.indexOf(' @Override public void close()',source.indexOf(' JSObject deleteTrashed(')));
 const dir=mkdtempSync(join(tmpdir(),'alpha-permitted-trash-'));
 try{
 const file=join(dir,'PermittedTrashFixture.java');
 writeFileSync(file,`import java.util.*;
 public class PermittedTrashFixture {
  static class JSObject extends HashMap<String,Object>{String getString(String key){return (String)get(key);}Boolean getBoolean(String key){return (Boolean)get(key);}}
  static class Bundle extends HashMap<String,Object>{Bundle(){}Bundle(Bundle before){super(before);}void putInt(String key,int value){put(key,value);}void putString(String key,String value){put(key,value);}void putStringArray(String key,String[] value){put(key,value);}}
  static class MediaStore{static final String QUERY_ARG_MATCH_TRASHED="trash";static final int MATCH_ONLY=1,MATCH_INCLUDE=2;}
  static class ContentResolver{static final String QUERY_ARG_SQL_SELECTION="where",QUERY_ARG_SQL_SELECTION_ARGS="args";}
  static class MediaLibraryKey{long id=7;String volume="external";boolean video;static MediaLibraryKey parse(String id){if(!id.equals("m:i:external:7"))throw new IllegalArgumentException();return new MediaLibraryKey();}}
  static class Cursor implements AutoCloseable{boolean present;Cursor(boolean present){this.present=present;}boolean moveToFirst(){return present;}long getLong(int index){return index==9?10:2;}public void close(){}}
  boolean exists=true,trashed=true,changed=false,failedReadback=false;int deletes=0,reads=0;String providerRevision="r1";
  JSObject mutationSource(String id,String revision){if(!exists||!revision.equals(providerRevision))throw new IllegalStateException("stale");JSObject row=new JSObject();row.put("trashed",trashed);return row;}
  String revision(Cursor row,String volume){return providerRevision;}
  void unlocked(){}
  Object uri(MediaLibraryKey key){return key;}
  void invalidate(){}
  Cursor query(String volume,boolean video,Bundle query){reads++;if(deletes>0&&failedReadback)return null;return new Cursor(exists);}
  final Resolver resolver=new Resolver();
  class Resolver{int delete(Object uri,Bundle query){deletes++;String sql=(String)query.get("where");String[] args=(String[])query.get("args");
   if(!sql.equals("_id=? AND is_pending=0 AND is_trashed=1 AND generation_modified=? AND generation_added=?"))throw new AssertionError("missing atomic fence");
   if(!Arrays.equals(args,new String[]{"7","10","2"}))throw new AssertionError("wrong generation binding");
   if(!trashed||changed)return 0;exists=false;return 1;}}
 ${method}
  static void require(boolean value){if(!value)throw new AssertionError();}
  static void refused(PermittedTrashFixture f,String revision)throws Exception{try{f.deleteTrashed("m:i:external:7",revision);throw new AssertionError("unexpected deletion success");}catch(IllegalStateException expected){}}
  public static void main(String[] args)throws Exception{
   PermittedTrashFixture ok=new PermittedTrashFixture();require(ok.deleteTrashed("m:i:external:7","r1").getString("status").equals("deleted"));require(!ok.exists&&ok.deletes==1&&ok.reads==2);
   PermittedTrashFixture restored=new PermittedTrashFixture();restored.trashed=false;refused(restored,"r1");require(restored.deletes==0&&restored.exists);
   PermittedTrashFixture stale=new PermittedTrashFixture();refused(stale,"old");require(stale.deletes==0&&stale.exists);
   PermittedTrashFixture raced=new PermittedTrashFixture();raced.changed=true;refused(raced,"r1");require(raced.exists);
   PermittedTrashFixture unknown=new PermittedTrashFixture();unknown.failedReadback=true;refused(unknown,"r1");require(unknown.deletes==1&&!unknown.exists);
   System.out.println("PASS exact-revision trash deletion, generation race, restored refusal, authoritative absence and unknown readback");
  }
 }`);
 assert.match(runJvm([file],'PermittedTrashFixture'),/PASS exact-revision/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
