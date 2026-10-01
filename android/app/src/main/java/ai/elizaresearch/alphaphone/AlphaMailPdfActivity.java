package ai.elizaresearch.alphaphone;

import android.app.Activity;
import android.content.*;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.os.*;
import android.view.*;
import android.widget.*;
import java.nio.ByteBuffer;
import java.util.UUID;

/** Displays only bounded raw pixels received from the isolated PDF renderer. */
public final class AlphaMailPdfActivity extends Activity {
 private final Handler main=new Handler(Looper.getMainLooper());
 private TextView status;private ImageView image;private Button previous,next;
 private Bitmap displayed;private Messenger remote;private ServiceConnection connection;
 private String pending;private Uri source;private int page,pages,generation;private boolean started,bound;
 private final Runnable timeout=()->fail("PDF rendering timed out. Close and reopen to retry.");
 private final Messenger replies=new Messenger(new Handler(Looper.getMainLooper(),message->{receive(message.getData());return true;}));
 @Override public void onCreate(Bundle state){
  super.onCreate(state);
  source=getIntent().getData();page=state==null?0:state.getInt("page",0);
  LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(Color.rgb(244,243,238));int pad=(int)(16*getResources().getDisplayMetrics().density);root.setPadding(pad,pad,pad,pad);root.setOnApplyWindowInsetsListener((view,insets)->{view.setPadding(pad,pad+insets.getSystemWindowInsetTop(),pad,pad+insets.getSystemWindowInsetBottom());return insets;});
  Button close=new Button(this);close.setText("Close PDF");style(close);close.setOnClickListener(v->finish());root.addView(close);
  status=new TextView(this);status.setTextColor(Color.rgb(32,32,25));status.setTextSize(16);status.setPadding(4,12,4,12);root.addView(status);
  image=new ImageView(this);image.setScaleType(ImageView.ScaleType.FIT_CENTER);image.setContentDescription("Selected PDF page");root.addView(image,new LinearLayout.LayoutParams(-1,0,1));
  LinearLayout controls=new LinearLayout(this);previous=new Button(this);previous.setText("Previous page");style(previous);previous.setOnClickListener(v->{if(pending==null&&page>0){page--;request();}});next=new Button(this);next.setText("Next page");style(next);next.setOnClickListener(v->{if(pending==null&&page+1<pages){page++;request();}});controls.addView(previous,new LinearLayout.LayoutParams(0,-2,1));controls.addView(next,new LinearLayout.LayoutParams(0,-2,1));root.addView(controls);setContentView(root);buttons(false);
  if(source==null||!"content".equals(source.getScheme())||!(getPackageName()+".mailattachments").equals(source.getAuthority())||source.getPathSegments().size()!=2||!"mail-attachments".equals(source.getPathSegments().get(0))){source=null;status.setText("Only the reviewed attachment can be opened.");}
 }
 @Override protected void onStart(){super.onStart();started=true;if(source==null)return;int token=++generation;status.setText("Opening PDF in isolated viewer…");connection=new ServiceConnection(){
  public void onServiceConnected(ComponentName name,IBinder binder){if(!started||token!=generation)return;remote=new Messenger(binder);request();}
  public void onServiceDisconnected(ComponentName name){if(token==generation)fail("PDF renderer stopped. Close and reopen to retry.");}
  public void onBindingDied(ComponentName name){if(token==generation)fail("PDF renderer stopped. Close and reopen to retry.");}
  public void onNullBinding(ComponentName name){if(token==generation)fail("Isolated PDF renderer is unavailable.");}
 };try{bound=bindService(new Intent(this,IsolatedPdfService.class),connection,Context.BIND_AUTO_CREATE);}catch(RuntimeException unavailable){bound=false;}if(!bound)fail("Isolated PDF renderer is unavailable.");}
 private void style(Button button){button.setAllCaps(false);button.setTextColor(Color.WHITE);button.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.rgb(57,58,203)));}
 private void buttons(boolean ready){previous.setEnabled(ready&&page>0);next.setEnabled(ready&&page+1<pages);}
 private void request(){
  if(!started||remote==null||pending!=null)return;pending=UUID.randomUUID().toString();buttons(false);status.setText("Rendering page "+(page+1)+"…");main.postDelayed(timeout,12000);
  try(ParcelFileDescriptor descriptor=getContentResolver().openFileDescriptor(source,"r")){
   if(descriptor==null)throw new IllegalStateException();Bundle data=new Bundle();data.putString("request",pending);data.putInt("page",page);data.putParcelable("descriptor",descriptor);Message message=Message.obtain(null,1);message.replyTo=replies;message.setData(data);remote.send(message);
  }catch(Exception error){fail("The reviewed PDF expired or could not be opened. Return to Inbox and review it again.");}
 }
 private void receive(Bundle data){
  SharedMemory pixels=null;ByteBuffer mapped=null;Bitmap bitmap=null;
  try{
   Object raw=data.getParcelable("pixels");if(raw!=null&&!(raw instanceof SharedMemory))throw new IllegalArgumentException();pixels=(SharedMemory)raw;
   if(!started||pending==null||!pending.equals(data.getString("request")))return;
   main.removeCallbacks(timeout);
   if(data.containsKey("error")){fail(data.getString("error"));return;}
   int width=data.getInt("width"),height=data.getInt("height"),count=data.getInt("pages");
   if(!data.getBoolean("isolated")||!data.getBoolean("internetDenied")||data.getInt("uid")==android.os.Process.myUid()||width<1||height<1||width>1536||height>1536||(long)width*height>IsolatedPdfService.MAX_PIXELS||count<1||count>IsolatedPdfService.MAX_PAGES||data.getInt("page")!=page||page>=count||pixels==null||pixels.getSize()!=(long)width*height*4)throw new IllegalArgumentException();
   mapped=pixels.mapReadOnly();bitmap=Bitmap.createBitmap(width,height,Bitmap.Config.ARGB_8888);bitmap.copyPixelsFromBuffer(mapped);clearImage();displayed=bitmap;bitmap=null;image.setImageBitmap(displayed);image.setContentDescription("PDF page "+(page+1)+" of "+count);pages=count;pending=null;status.setText("Page "+(page+1)+" of "+pages+" · isolated viewer");buttons(true);
  }catch(Exception|OutOfMemoryError error){fail("PDF page could not be displayed within viewer limits.");}
  finally{if(mapped!=null)SharedMemory.unmap(mapped);if(pixels!=null)pixels.close();if(bitmap!=null)bitmap.recycle();}
 }
 private void clearImage(){image.setImageDrawable(null);if(displayed!=null){displayed.recycle();displayed=null;}}
 private void fail(String text){pending=null;main.removeCallbacks(timeout);buttons(false);status.setText(text==null?"PDF unavailable":text);clearImage();disconnect();}
 private void disconnect(){remote=null;if(bound&&connection!=null){bound=false;try{unbindService(connection);}catch(IllegalArgumentException ignored){}}connection=null;}
 @Override protected void onStop(){started=false;generation++;pending=null;main.removeCallbacks(timeout);disconnect();clearImage();super.onStop();}
 @Override protected void onSaveInstanceState(Bundle state){state.putInt("page",page);super.onSaveInstanceState(state);}
}
