package android.app;
import android.os.Bundle;
public class Notification {
 public Action[] actions;
 public String getChannelId(){return null;}
 public static class Action {
  public PendingIntent actionIntent;
  public boolean isAuthenticationRequired(){return false;}
  public Bundle getExtras(){return new Bundle();}
 }
}
