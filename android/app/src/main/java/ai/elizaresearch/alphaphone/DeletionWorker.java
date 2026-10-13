package ai.elizaresearch.alphaphone;
import android.content.Context;
import androidx.work.*;
/** Delayed local deletion recovery. A claimed provider mutation is never automatically retried. */
public final class DeletionWorker extends Worker {
 public DeletionWorker(Context context,WorkerParameters parameters){super(context,parameters);}
 @Override public Result doWork(){try{NativeDeletionCoordinator.get(getApplicationContext()).reconcile();return Result.success();}catch(Exception unavailable){return Result.failure();}}
}
