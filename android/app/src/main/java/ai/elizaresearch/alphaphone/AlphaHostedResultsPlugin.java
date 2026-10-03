package ai.elizaresearch.alphaphone;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import java.util.concurrent.*;
import org.json.JSONObject;

@CapacitorPlugin(name="AlphaHostedResults",permissions={@Permission(alias="notifications",strings={Manifest.permission.POST_NOTIFICATIONS})})
public class AlphaHostedResultsPlugin extends Plugin {
 static final String CHANNEL="alpha-hosted-results", ACTION="ai.elizaresearch.alphaphone.OPEN_HOSTED_RESULT", PREFIX="alpha-hosted-result:";
 private final ExecutorService io=Executors.newSingleThreadExecutor();
 // Capacitor can deliver an already queued bridge call after Activity destruction.
 // Reject it without recreating a worker or crashing the bridge HandlerThread.
 private void submit(PluginCall call,Runnable task){
  try{io.execute(task);}catch(RejectedExecutionException closed){if(call!=null)call.reject("Result bridge closed; reopen the app to continue.");}
 }
 private HostedResultNotices notices(){return HostedDelivery.get(getContext()).notices;}
 private void channel(){new HostedNoticePoster(getContext());}
 private boolean enabled(){return new HostedNoticePoster(getContext()).allowed();}
 @PluginMethod public void beginBackground(PluginCall call){submit(call,()->{try{HostedDelivery.get(getContext()).begin(call.getString("attemptId"));call.resolve();}catch(Exception error){call.reject("Background reservation unavailable");}});}
 @PluginMethod public void cancelBackground(PluginCall call){java.util.concurrent.CompletableFuture.runAsync(()->{try{HostedDelivery.get(getContext()).cancel(call.getString("attemptId"));call.resolve();}catch(Exception error){call.reject("Background reservation could not be cancelled");}});}
 @PluginMethod public void configureBackground(PluginCall call){submit(call,()->{try{call.resolve(new JSObject(HostedDelivery.get(getContext()).configure(call.getData()).toString()));}catch(Exception error){call.reject("Background delivery needs a verified connection");}});}
 @PluginMethod public void disableBackground(PluginCall call){java.util.concurrent.CompletableFuture.runAsync(()->{try{HostedDelivery.get(getContext()).disableSession(call.getString("sessionId"));call.resolve();}catch(Exception error){call.reject("Background delivery could not be paused");}});}
 @PluginMethod public void syncInbox(PluginCall call){submit(call,()->{try{HostedDelivery d=HostedDelivery.get(getContext());JSObject out=new JSObject();out.put("entries",d.sync(d.generation(call.getString("sessionId"))));call.resolve(out);}catch(Exception error){call.reject("Result sync unavailable; saved history is unchanged");}});}
 @PluginMethod public void setBackgroundPolling(PluginCall call){java.util.concurrent.CompletableFuture.runAsync(()->{try{Boolean enabled=call.getBoolean("enabled");if(enabled==null)throw new IllegalArgumentException();HostedDelivery.get(getContext()).polling(enabled);status(call);}catch(Exception error){call.reject("Background preference could not be saved");}});}
 @PluginMethod public void inboxHistory(PluginCall call){submit(call,()->{try{JSObject out=new JSObject();out.put("entries",HostedDelivery.get(getContext()).history(call.getString("sessionId")));call.resolve(out);}catch(Exception error){call.reject("Saved result history unavailable");}});}
 @Override public void load(){channel();capture(getActivity().getIntent());}
 @Override protected void handleOnNewIntent(Intent intent){capture(intent);}
 @Override protected void handleOnResume(){notifyListeners("pendingResult",new JSObject(),true);}
 private void capture(Intent intent){if(intent==null||!ACTION.equals(intent.getAction())||intent.getData()==null)return;String data=intent.getData().toString();if(!data.startsWith(PREFIX))return;String key=data.substring(PREFIX.length());submit(null,()->{try{notices().capture(key);intent.setData(null);notifyListeners("pendingResult",new JSObject(),true);}catch(Exception ignored){/* Keep Intent for a later retry; never expose a result from an uncommitted tap. */}});}
 @PluginMethod public void publishResult(PluginCall call){submit(call,()->{try{String phase=notices().publish(call.getData());JSObject out=new JSObject();out.put("phase",phase);call.resolve(out);}catch(Exception error){call.reject("Result notice unavailable; saved history is unchanged");}});}
 @PluginMethod public void pendingResult(PluginCall call){submit(call,()->{try{call.resolve(new JSObject(notices().peek().toString()));}catch(Exception error){call.reject("Saved result link unavailable");}});}
 @PluginMethod public void consumeResult(PluginCall call){submit(call,()->{try{notices().consume(call.getString("token",""));call.resolve();}catch(Exception error){call.reject("Result link changed");}});}
 @PluginMethod public void status(PluginCall call){try{JSObject out=new JSObject(HostedDelivery.get(getContext()).status().toString());out.put("enabled",enabled());call.resolve(out);}catch(Exception error){call.reject("Result status unavailable");}}
 @PluginMethod public void enable(PluginCall call){if(Build.VERSION.SDK_INT>=33&&getPermissionState("notifications")!=PermissionState.GRANTED){requestPermissionForAlias("notifications",call,"permissionResult");return;}Intent settings=new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,getContext().getPackageName()).putExtra(Settings.EXTRA_CHANNEL_ID,CHANNEL);getActivity().startActivity(settings);status(call);}
 @PermissionCallback private void permissionResult(PluginCall call){status(call);}
 @Override protected void handleOnDestroy(){io.shutdown();}
}
