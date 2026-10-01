package ai.elizaresearch.alphaphone;
import android.content.Context;
import androidx.annotation.NonNull;
import androidx.work.*;
import java.util.concurrent.TimeUnit;
/** Ordinary best-effort work, never exact alarms or a foreground service. */
public final class HostedDeliveryWorker extends Worker {
 private static final String PERIODIC="alpha-hosted-results-periodic",CATCHUP="alpha-hosted-results-catchup";
 private final String generation;
 public HostedDeliveryWorker(@NonNull Context context,@NonNull WorkerParameters params){super(context,params);generation=params.getInputData().getString("generation");}
 static void schedule(Context context,String generation){Data data=new Data.Builder().putString("generation",generation).build();Constraints constraints=new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();WorkManager manager=WorkManager.getInstance(context);manager.enqueueUniquePeriodicWork(PERIODIC,ExistingPeriodicWorkPolicy.UPDATE,new PeriodicWorkRequest.Builder(HostedDeliveryWorker.class,15,TimeUnit.MINUTES).setInputData(data).setConstraints(constraints).setBackoffCriteria(BackoffPolicy.EXPONENTIAL,30,TimeUnit.SECONDS).build());manager.enqueueUniqueWork(CATCHUP,ExistingWorkPolicy.REPLACE,new OneTimeWorkRequest.Builder(HostedDeliveryWorker.class).setInputData(data).setConstraints(constraints).build());}
 static void cancel(Context context){WorkManager manager=WorkManager.getInstance(context);manager.cancelUniqueWork(PERIODIC);manager.cancelUniqueWork(CATCHUP);}
 @NonNull @Override public Result doWork(){if(generation==null)return Result.failure();try{HostedDelivery.get(getApplicationContext()).syncBackground(generation);return Result.success();}catch(SecurityException disabled){return Result.success();}catch(Exception unavailable){return Result.retry();}}
 @Override public void onStopped(){HostedDelivery.get(getApplicationContext()).stop(generation);}
}
