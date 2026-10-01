package ai.elizaresearch.alphaphone;

import android.app.Activity;
import android.content.*;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** User-selected SAF tree only. Renderer gets opaque capabilities, never authority
 * from a supplied URI/path. No broad storage permission or provider fallback. */
@CapacitorPlugin(name="AlphaFiles")
public class AlphaFilesPlugin extends Plugin {
 private static final String PREF="alpha-files-tree",KEY="root";
 private final ExecutorService worker=Executors.newSingleThreadExecutor();
 private final AtomicBoolean picking=new AtomicBoolean();
 private final Map<String,Entry> entries=new HashMap<>();
 private Uri tree;private String rootId;
 private static final class Entry { final String id=UUID.randomUUID().toString();Uri uri;final String parent;Entry(Uri uri,String parent){this.uri=uri;this.parent=parent;} }
 private interface Work {JSObject run()throws Exception;}
 private JSObject result(String status,String message){JSObject out=new JSObject();out.put("status",status);out.put("message",message);return out;}
 private void run(PluginCall call,Work task){try{worker.execute(()->{try{call.resolve(task.run());}catch(SecurityException e){entries.clear();rootId=null;call.resolve(result("revoked","Folder access expired. Choose the folder again."));}catch(Exception e){call.resolve(result("failed","The document provider could not confirm this operation. Refresh before retrying."));}});}catch(RejectedExecutionException e){call.resolve(result("unavailable","Files closed. Reopen Files to continue."));}}
 private ContentResolver resolver(){return getContext().getContentResolver();}
 private boolean retained(boolean write){if(tree==null)return false;for(android.content.UriPermission p:resolver().getPersistedUriPermissions())if(tree.equals(p.getUri())&&p.isReadPermission()&&(!write||p.isWritePermission()))return true;return false;}
 private Entry root(){
  if(tree==null){String saved=getContext().getSharedPreferences(PREF,0).getString(KEY,null);if(saved==null)return null;tree=Uri.parse(saved);}
  if(!retained(false))throw new SecurityException();
  if(rootId==null){Entry root=new Entry(DocumentsContract.buildDocumentUriUsingTree(tree,DocumentsContract.getTreeDocumentId(tree)),null);entries.put(root.id,root);rootId=root.id;}
  return entries.get(rootId);
 }
 private Entry entry(String id){if(root()==null)return null;return entries.get(id);}
 private Entry authorize(Uri uri,String parent){for(Entry item:entries.values())if(item.uri.equals(uri)&&Objects.equals(item.parent,parent))return item;if(entries.size()>=2048)throw new IllegalStateException("Folder session limit");Entry value=new Entry(uri,parent);entries.put(value.id,value);return value;}
 private JSObject describe(Entry item)throws Exception{
  String[] fields={DocumentsContract.Document.COLUMN_DISPLAY_NAME,DocumentsContract.Document.COLUMN_MIME_TYPE,DocumentsContract.Document.COLUMN_FLAGS,DocumentsContract.Document.COLUMN_SIZE,DocumentsContract.Document.COLUMN_LAST_MODIFIED};
  try(Cursor row=resolver().query(item.uri,fields,null,null,null)){
   if(row==null||!row.moveToFirst())throw new java.io.FileNotFoundException();
   String name=row.getString(0),mime=row.getString(1);long flags=row.getLong(2),size=row.isNull(3)?-1:row.getLong(3),modified=row.isNull(4)?-1:row.getLong(4);boolean directory=DocumentsContract.Document.MIME_TYPE_DIR.equals(mime),write=retained(true);
   JSObject value=new JSObject();value.put("id",item.id);value.put("parentId",item.parent);value.put("name",name);value.put("mimeType",mime);value.put("directory",directory);value.put("size",size);value.put("modified",modified);
   value.put("revision",name+"|"+mime+"|"+size+"|"+modified+"|"+flags);
   value.put("canCreate",write&&directory&&(flags&DocumentsContract.Document.FLAG_DIR_SUPPORTS_CREATE)!=0);
   value.put("canRename",write&&item.parent!=null&&(flags&DocumentsContract.Document.FLAG_SUPPORTS_RENAME)!=0);
   value.put("canDelete",write&&item.parent!=null&&(flags&DocumentsContract.Document.FLAG_SUPPORTS_DELETE)!=0);
   value.put("canMove",write&&!directory&&item.parent!=null&&(flags&DocumentsContract.Document.FLAG_SUPPORTS_MOVE)!=0);
   return value;
  }
 }
 private JSObject list(Entry folder)throws Exception{
  if(folder==null)return result("unavailable","Choose a folder in Android to browse its contents.");
  JSObject details=describe(folder);if(!details.optBoolean("directory"))return result("unsupported","This selection is not a folder.");
  Uri children=DocumentsContract.buildChildDocumentsUriUsingTree(tree,DocumentsContract.getDocumentId(folder.uri));JSArray rows=new JSArray();boolean truncated=false;
  try(Cursor cursor=resolver().query(children,new String[]{DocumentsContract.Document.COLUMN_DOCUMENT_ID},null,null,null)){
   if(cursor==null)throw new IllegalStateException();
   while(cursor.moveToNext()){if(rows.length()>=250){truncated=true;break;}Uri uri=DocumentsContract.buildDocumentUriUsingTree(tree,cursor.getString(0));Entry child=authorize(uri,folder.id);rows.put(describe(child));}
  }
  JSObject out=result("ready",truncated?"Showing the first 250 entries. Open a smaller folder to see other items.":"Folder loaded from Android.");out.put("folder",details);out.put("entries",rows);out.put("truncated",truncated);out.put("rootId",rootId);return out;
 }
 @PluginMethod public void choose(PluginCall call){
  if(!picking.compareAndSet(false,true)){call.resolve(result("busy","A folder picker is already open."));return;}
  Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION|Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION|Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
  try{startActivityForResult(call,intent,"chosen");}catch(RuntimeException error){picking.set(false);call.resolve(result("unavailable","Android folder selection is unavailable."));}
 }
 @ActivityCallback private void chosen(PluginCall call,ActivityResult response){
  picking.set(false);if(call==null)return;Intent data=response.getData();
  if(response.getResultCode()!=Activity.RESULT_OK||data==null||data.getData()==null){call.resolve(result("cancelled","Folder selection cancelled."));return;}
  Uri uri=data.getData();int flags=data.getFlags()&(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
  run(call,()->{
   if(!"content".equals(uri.getScheme())||!DocumentsContract.isTreeUri(uri)||(flags&Intent.FLAG_GRANT_READ_URI_PERMISSION)==0)return result("unsupported","The provider did not grant readable folder access.");
   String previous=getContext().getSharedPreferences(PREF,0).getString(KEY,null);
   resolver().takePersistableUriPermission(uri,Intent.FLAG_GRANT_READ_URI_PERMISSION|((flags&Intent.FLAG_GRANT_WRITE_URI_PERMISSION)!=0?Intent.FLAG_GRANT_WRITE_URI_PERMISSION:0));
   if(!getContext().getSharedPreferences(PREF,0).edit().putString(KEY,uri.toString()).commit())return result("failed","Folder access could not be saved. Choose the folder again.");
   tree=uri;rootId=null;entries.clear();
   // Replace only this plugin's previously recorded tree grant. Individually
   // selected documents retain their separate grants. Tree previews are transient.
   if(previous!=null&&!previous.equals(uri.toString()))for(android.content.UriPermission permission:resolver().getPersistedUriPermissions())if(previous.equals(permission.getUri().toString())){try{resolver().releasePersistableUriPermission(permission.getUri(),(permission.isReadPermission()?Intent.FLAG_GRANT_READ_URI_PERMISSION:0)|(permission.isWritePermission()?Intent.FLAG_GRANT_WRITE_URI_PERMISSION:0));}catch(SecurityException ignored){}break;}
   return list(root());
  });
 }
 @PluginMethod public void list(PluginCall call){run(call,()->{Entry root=root();return list(call.getString("id")==null?root:entry(call.getString("id")));});}
 private String name(PluginCall call){String name=call.getString("name","").trim();if(name.isEmpty()||name.length()>255||name.equals(".")||name.equals("..")||name.indexOf('/')>=0||name.indexOf('\\')>=0||name.chars().anyMatch(Character::isISOControl))throw new IllegalArgumentException();return name;}
 private boolean current(JSObject row,PluginCall call){return row.getString("revision").equals(call.getString("expectedRevision"));}
 @PluginMethod public void createFolder(PluginCall call){run(call,()->{
  Entry folder=entry(call.getString("id"));if(folder==null)return result("revoked","Reload this folder first.");JSObject info=describe(folder);
  if(!info.optBoolean("canCreate"))return result("unsupported","This provider does not permit folder creation.");
  Uri created=DocumentsContract.createDocument(resolver(),folder.uri,DocumentsContract.Document.MIME_TYPE_DIR,name(call));if(created==null)return result("failed","The provider did not confirm folder creation. Refresh before retrying.");
  JSObject out=result("created","Folder created.");out.put("entry",describe(authorize(created,folder.id)));return out;
 });}
 @PluginMethod public void rename(PluginCall call){run(call,()->{
  Entry item=entry(call.getString("id"));if(item==null)return result("revoked","Reload this folder first.");JSObject info=describe(item);
  if(!info.optBoolean("canRename"))return result("unsupported","This provider does not permit renaming this item.");if(!current(info,call))return result("conflict","This item changed. Refresh before renaming.");
  Uri renamed=DocumentsContract.renameDocument(resolver(),item.uri,name(call));if(renamed==null)return result("failed","Rename was not confirmed. Refresh before retrying.");item.uri=renamed;JSObject out=result("renamed","Item renamed.");out.put("entry",describe(item));return out;
 });}
 @PluginMethod public void delete(PluginCall call){run(call,()->{
  Entry item=entry(call.getString("id"));if(item==null)return result("revoked","Reload this folder first.");JSObject info=describe(item);
  if(!info.optBoolean("canDelete"))return result("unsupported","This provider does not permit deletion.");if(!Boolean.TRUE.equals(call.getBoolean("confirmPermanent")))return result("confirmation-required","Permanently delete this item? This provider has no integrated trash or undo.");if(!current(info,call))return result("conflict","This item changed. Refresh before deleting.");
  if(info.optBoolean("directory")){JSObject contents=list(item);if(contents.getJSONArray("entries").length()>0)return result("unsupported","Only empty folders can be deleted here. Manage nonempty folders in Android Files.");}
  if(!DocumentsContract.deleteDocument(resolver(),item.uri))return result("failed","Deletion was not confirmed. Refresh before retrying.");entries.remove(item.id);return result("deleted","Item permanently deleted.");
 });}
 @PluginMethod public void move(PluginCall call){run(call,()->{
  Entry item=entry(call.getString("id")),destination=entry(call.getString("destinationId"));if(item==null||destination==null)return result("revoked","Reload source and destination folders first.");JSObject info=describe(item),target=describe(destination);
  if(!info.optBoolean("canMove")||!target.optBoolean("canCreate"))return result("unsupported","This provider does not support moving this file to that folder.");if(!current(info,call))return result("conflict","This file changed. Refresh before moving.");if(destination.id.equals(item.parent))return result("unsupported","This file is already in that folder.");Entry parent=entry(item.parent);if(parent==null)throw new SecurityException();
  Uri moved=DocumentsContract.moveDocument(resolver(),item.uri,parent.uri,destination.uri);if(moved==null)return result("failed","Move was not confirmed. Refresh both folders before retrying.");entries.remove(item.id);JSObject out=result("moved","File moved.");out.put("entry",describe(authorize(moved,destination.id)));return out;
 });}
 @PluginMethod public void select(PluginCall call){run(call,()->{
  Entry item=entry(call.getString("id"));if(item==null)return result("revoked","Reload this folder first.");JSObject info=describe(item);if(info.optBoolean("directory"))return result("unsupported","Open this folder to browse its contents.");
  String selectionId=SelectedDocumentAccess.authorize(getContext(),item.uri,0);JSObject out=result("selected","Document selected from your chosen folder.");out.put("action","files");out.put("selectionId",selectionId);out.put("name",info.getString("name"));out.put("mimeType",info.getString("mimeType"));out.put("uri",item.uri.toString());out.put("canRename",info.optBoolean("canRename"));return out;
 });}
 @PluginMethod public void forget(PluginCall call){run(call,()->{
  Uri old=tree;if(old==null){String saved=getContext().getSharedPreferences(PREF,0).getString(KEY,null);if(saved!=null)old=Uri.parse(saved);}
  if(!getContext().getSharedPreferences(PREF,0).edit().remove(KEY).commit())return result("failed","Folder selection could not be forgotten.");tree=null;rootId=null;entries.clear();
  if(old!=null)for(android.content.UriPermission p:resolver().getPersistedUriPermissions())if(old.equals(p.getUri())){int flags=(p.isReadPermission()?Intent.FLAG_GRANT_READ_URI_PERMISSION:0)|(p.isWritePermission()?Intent.FLAG_GRANT_WRITE_URI_PERMISSION:0);resolver().releasePersistableUriPermission(old,flags&(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION));break;}
  return result("forgotten","Folder access released.");
 });}
 @Override protected void handleOnDestroy(){worker.shutdownNow();}
}
