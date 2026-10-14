package ai.elizaresearch.alphaphone;
import android.content.*;
import android.app.KeyguardManager;
import android.provider.Settings;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.*;

@CapacitorPlugin(name="AlphaGmail")
public final class AlphaGmailPlugin extends Plugin {
 private final ExecutorService io=Executors.newSingleThreadExecutor();
 private GmailDelivery delivery(){return GmailDelivery.get(getContext());}
 private interface Work {JSObject run()throws Exception;}
 private void submit(PluginCall call,Work work){try{io.execute(()->{try{call.resolve(work.run());}catch(Exception unavailable){call.reject("Gmail background state could not be verified. Open Inbox and check the account.");}});}catch(RejectedExecutionException closed){call.reject("Gmail bridge closed");}}
 private boolean foreground(){return getActivity()!=null&&!getActivity().isFinishing()&&!getActivity().isDestroyed()&&getActivity().hasWindowFocus()&&!getContext().getSystemService(KeyguardManager.class).isDeviceLocked();}
 @PluginMethod public void configure(PluginCall call){if(!foreground()){call.reject("Select Gmail on the unlocked phone");return;}long attempt=delivery().begin();String credential=call.getString("credentialId"),grant=call.getString("grantId");submit(call,()->new JSObject(delivery().configure(attempt,credential,grant).toString()));}
 @PluginMethod public void withdraw(PluginCall call){submit(call,()->{delivery().withdraw(call.getString("grantId"));return new JSObject();});}
 @PluginMethod public void status(PluginCall call){submit(call,()->new JSObject(delivery().status().toString()));}
 @PluginMethod public void pending(PluginCall call){if(!foreground()){call.resolve(new JSObject());return;}submit(call,()->new JSObject(delivery().pending().toString()));}
 @PluginMethod public void consume(PluginCall call){submit(call,()->{delivery().consume(call.getString("token"));return new JSObject();});}
 @PluginMethod public void notificationSettings(PluginCall call){if(!foreground()){call.reject("Open settings on the unlocked phone");return;}try{getActivity().startActivity(new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,getContext().getPackageName()).putExtra(Settings.EXTRA_CHANNEL_ID,GmailNoticePoster.CHANNEL));call.resolve();}catch(RuntimeException unavailable){call.reject("Android notification settings unavailable");}}
 private void capture(Intent intent){if(intent==null||!GmailNoticePoster.ACTION.equals(intent.getAction())||intent.getData()==null)return;String uri=intent.getData().toString();if(!uri.startsWith(GmailNoticePoster.PREFIX))return;String key=uri.substring(GmailNoticePoster.PREFIX.length());try{io.execute(()->{try{delivery().capture(key);intent.setData(null);notifyListeners("pendingMail",new JSObject(),true);}catch(Exception ignored){/* Owner mismatch exposes no route. */}});}catch(RejectedExecutionException ignored){}}
 @Override public void load(){delivery();capture(getActivity().getIntent());delivery().resume();}
 @Override protected void handleOnNewIntent(Intent intent){capture(intent);}
 @Override protected void handleOnResume(){delivery().resume();notifyListeners("pendingMail",new JSObject(),true);}
 @Override protected void handleOnDestroy(){io.shutdown();}
}
