package ai.elizaresearch.alphaphone;
import android.content.*;
import android.app.Activity;
import androidx.activity.result.ActivityResult;
import android.net.Uri;
import android.os.*;
import android.provider.OpenableColumns;
import androidx.core.content.FileProvider;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import java.io.*;
import java.nio.*;
import java.nio.charset.*;
import java.security.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicBoolean;
/** Explicit selected-file import and temporary read-only attachment handoff. No network. */
@CapacitorPlugin(name="AlphaMailAttachments")
public final class AlphaMailAttachmentsPlugin extends Plugin {
 static final int MAX_BYTES=5*1024*1024;
 private final ExecutorService worker=Executors.newSingleThreadExecutor();
 private final AtomicInteger generation=new AtomicInteger();
 private final Handler main=new Handler(Looper.getMainLooper());
 private final AtomicBoolean saving=new AtomicBoolean();
 private final Map<PluginCall,Integer> exports=new ConcurrentHashMap<>();
 private File folder(){File f=new File(getContext().getCacheDir(),"mail-attachments");if(!f.isDirectory()&&!f.mkdirs())throw new IllegalStateException();return f;}
 private static String hash(byte[] bytes)throws Exception{StringBuilder out=new StringBuilder();for(byte b:MessageDigest.getInstance("SHA-256").digest(bytes))out.append(String.format(Locale.ROOT,"%02x",b&255));return out.toString();}
 static void validate(String name,String mime,byte[] data)throws Exception{
  if(name==null||name.length()>120||name.isBlank()||name.matches(".*[\\\\/\\p{Cntrl}].*")||data.length>MAX_BYTES)throw new IllegalArgumentException("Invalid name or file exceeds 5 MiB");
  boolean ok=false;String lower=name.toLowerCase(Locale.ROOT);
  switch(mime){
   case "application/pdf":ok=lower.endsWith(".pdf")&&data.length>=5&&new String(data,0,5,StandardCharsets.US_ASCII).equals("%PDF-");break;
   case "image/png":ok=lower.endsWith(".png")&&data.length>=8&&Arrays.equals(Arrays.copyOf(data,8),new byte[]{(byte)137,80,78,71,13,10,26,10});break;
   case "image/jpeg":ok=(lower.endsWith(".jpg")||lower.endsWith(".jpeg"))&&data.length>=3&&(data[0]&255)==255&&(data[1]&255)==216&&(data[2]&255)==255;break;
   case "image/webp":ok=lower.endsWith(".webp")&&data.length>=12&&new String(data,0,4,StandardCharsets.US_ASCII).equals("RIFF")&&new String(data,8,4,StandardCharsets.US_ASCII).equals("WEBP");break;
   case "text/plain":ok=lower.endsWith(".txt")&&StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(data)).toString().indexOf('\0')<0;break;
  }if(!ok)throw new IllegalArgumentException("File MIME/name/content is unsupported");
 }
 private static byte[] read(InputStream in)throws IOException{ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] block=new byte[16384];int n;while((n=in.read(block))!=-1){if(out.size()+n>MAX_BYTES)throw new IOException("File exceeds 5 MiB");out.write(block,0,n);}return out.toByteArray();}
 @PluginMethod public void readSelected(PluginCall call){int token=generation.get();worker.execute(()->{try{Uri uri=SelectedDocumentAccess.resolve(call.getString("selectionId"));if(uri==null)throw new SecurityException();String name;try(android.database.Cursor row=getContext().getContentResolver().query(uri,new String[]{OpenableColumns.DISPLAY_NAME},null,null,null)){if(row==null||!row.moveToFirst())throw new IOException();name=row.getString(0);}String mime=getContext().getContentResolver().getType(uri);byte[] data;try(InputStream in=getContext().getContentResolver().openInputStream(uri)){if(in==null)throw new IOException();data=read(in);}validate(name,mime,data);if(token!=generation.get())throw new CancellationException();JSObject result=new JSObject();result.put("name",name);result.put("mimeType",mime);result.put("size",data.length);result.put("sha256",hash(data));result.put("dataBase64",android.util.Base64.encodeToString(data,android.util.Base64.NO_WRAP));call.resolve(result);}catch(Exception error){call.reject("Select a valid PDF, PNG, JPEG, WebP or UTF-8 TXT file up to 5 MiB. Selection cancelled or unavailable.");}});}
 private void revoke(File file){try{Uri uri=FileProvider.getUriForFile(getContext(),getContext().getPackageName()+".mailattachments",file);getContext().revokeUriPermission(uri,Intent.FLAG_GRANT_READ_URI_PERMISSION);}catch(RuntimeException ignored){}file.delete();}
 private void cleanup(){File[] files=folder().listFiles();if(files!=null)for(File f:files)revoke(f);}
 @PluginMethod public void cancel(PluginCall call){generation.incrementAndGet();cleanup();call.resolve();}
 @PluginMethod public void openReviewed(PluginCall call){int token=generation.get();worker.execute(()->{File file=null;try{String encoded=call.getString("dataBase64");if(encoded==null||encoded.length()>7*1024*1024||!Boolean.TRUE.equals(call.getBoolean("reviewed")))throw new IllegalArgumentException();byte[] data=android.util.Base64.decode(encoded,android.util.Base64.NO_WRAP);String name=call.getString("name"),mime=call.getString("mimeType");validate(name,mime,data);if(!hash(data).equals(call.getString("sha256")))throw new SecurityException();if(token!=generation.get())throw new CancellationException();cleanup();file=new File(folder(),UUID.randomUUID()+"-"+name);try(FileOutputStream out=new FileOutputStream(file)){out.write(data);out.getFD().sync();}File ready=file;main.post(()->{try{if(token!=generation.get()||getActivity()==null||!getActivity().hasWindowFocus())throw new CancellationException();Uri uri=FileProvider.getUriForFile(getContext(),getContext().getPackageName()+".mailattachments",ready);Intent intent=new Intent(Intent.ACTION_VIEW).setDataAndType(uri,mime).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);intent.setClipData(ClipData.newRawUri("Reviewed attachment",uri));try{getActivity().startActivity(intent);}catch(ActivityNotFoundException missing){if(!"application/pdf".equals(mime))throw missing;Intent fallback=new Intent(getActivity(),AlphaMailPdfActivity.class).setData(uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);getActivity().startActivity(fallback);}main.postDelayed(()->revoke(ready),15*60*1000);JSObject result=new JSObject();result.put("status","opened");result.put("message","Sent a temporary read-only copy to the viewer. Viewing is not confirmed.");call.resolve(result);}catch(Exception error){revoke(ready);call.reject("No viewer available, or the review was cancelled. No completed viewing is claimed.");}});}catch(Exception error){if(file!=null)revoke(file);call.reject("Attachment bytes, review or file type invalid.");}});}
 private JSObject saveResult(String status,String message){JSObject result=new JSObject();result.put("status",status);result.put("message",message);return result;}
 private byte[] reviewedBytes(PluginCall call)throws Exception{
  String encoded=call.getString("dataBase64");if(encoded==null||encoded.length()>7*1024*1024||!Boolean.TRUE.equals(call.getBoolean("reviewed")))throw new IllegalArgumentException();
  byte[] bytes=android.util.Base64.decode(encoded,android.util.Base64.NO_WRAP);validate(call.getString("name"),call.getString("mimeType"),bytes);if(!hash(bytes).equals(call.getString("sha256")))throw new SecurityException();return bytes;
 }
 @PluginMethod public void saveReviewed(PluginCall call){
  if(!saving.compareAndSet(false,true)){call.reject("An attachment save is already pending.");return;}int token=generation.get();
  try{worker.execute(()->{try{reviewedBytes(call);main.post(()->{
   try{if(token!=generation.get()||getActivity()==null||!getActivity().hasWindowFocus())throw new CancellationException();exports.put(call,token);
    Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(call.getString("mimeType")).putExtra(Intent.EXTRA_TITLE,call.getString("name")).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
    startActivityForResult(call,intent,"savedReviewed");
   }catch(Exception error){exports.remove(call);saving.set(false);call.resolve(saveResult("cancelled","Save destination unavailable or review closed."));}
  });}catch(Exception error){saving.set(false);call.reject("Review valid attachment bytes before saving.");}});}catch(RejectedExecutionException error){saving.set(false);call.reject("Attachment service closed.");}
 }
 @ActivityCallback private void savedReviewed(PluginCall call,ActivityResult response){
  if(call==null){exports.clear();saving.set(false);return;}Integer token=exports.remove(call);
  if(response.getResultCode()!=Activity.RESULT_OK||response.getData()==null){saving.set(false);call.resolve(saveResult("cancelled","Save cancelled."));return;}
  Uri uri=response.getData().getData();
  if(token==null||token!=generation.get()||uri==null||!"content".equals(uri.getScheme())){saving.set(false);call.resolve(saveResult("unverified","Review closed or destination unavailable. Inspect the chosen destination before retrying."));return;}
  try{worker.execute(()->{boolean opened=false;try{
   byte[] bytes=reviewedBytes(call);if(token!=generation.get())throw new CancellationException();
   try(OutputStream out=getContext().getContentResolver().openOutputStream(uri,"wt")){if(out==null)throw new IOException();opened=true;if(token!=generation.get())throw new CancellationException();out.write(bytes);out.flush();}
   try(InputStream in=getContext().getContentResolver().openInputStream(uri)){DocumentExportBytes.verify(in,bytes);}
   if(token!=generation.get())throw new CancellationException();call.resolve(saveResult("saved","Saved to the chosen destination. Exact bytes verified."));
  }catch(Exception error){call.resolve(saveResult("unverified",opened?"The destination may contain some or all bytes. Inspect it before retrying.":"Save not confirmed. Inspect the chosen destination before retrying."));}finally{saving.set(false);}});}catch(RejectedExecutionException error){saving.set(false);call.resolve(saveResult("unverified","Attachment service closed. Inspect the chosen destination."));}
 }
 @Override public void load(){cleanup();}
 @Override protected void handleOnDestroy(){generation.incrementAndGet();main.removeCallbacksAndMessages(null);cleanup();worker.shutdown();super.handleOnDestroy();}
}
