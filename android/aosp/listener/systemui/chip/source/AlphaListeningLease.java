package com.android.systemui.privacy;

import android.content.Context;
import android.content.pm.ProviderInfo;
import android.net.Uri;
import android.os.Binder;
import android.os.Bundle;
import android.os.Handler;
import java.util.concurrent.Executor;

/**
 * SystemUI side of the listener's indicator health lease. Every {@link AlphaListeningPolicy#LEASE_RENEW_MS}
 * (and at once on any surface change) it measures its own views on the main thread and sends a
 * visibility acknowledgement to the admitted listener on the background executor. A hidden,
 * detached or unattributed surface is acknowledged as such, so the listener stops capture; if
 * SystemUI hangs or dies, renewals stop and the token binder dies, which also stops it.
 * Acknowledgements carry visibility facts only: no audio, transcript, consent or resume command.
 */
final class AlphaListeningLease {
 /** One acknowledgement: the admitted listener UID (-1 for none) and SystemUI-measured facts. */
 static final class Acknowledgement {
  final int uid;final boolean surface,chip,recording;final String display;
  Acknowledgement(int uid,boolean surface,boolean chip,boolean recording,String display){
   this.uid=uid;this.surface=surface;this.chip=chip;this.recording=recording;this.display=display;
  }
 }
 interface Source{Acknowledgement read();}

 private final Context context;private final Handler main;private final Executor background;private final Source source;
 /** Never shared beyond the lease provider: its death tells the listener this SystemUI process is gone. */
 private final Binder token=new Binder();
 private final Uri uri=Uri.parse("content://"+AlphaListeningPolicy.LEASE_AUTHORITY);
 private volatile long generation=-1; // background executor only (serial)
 private boolean running; // main thread only
 private final Runnable tick=this::tick;

 AlphaListeningLease(Context context,Handler main,Executor background,Source source){
  this.context=context;this.main=main;this.background=background;this.source=source;
 }
 void start(){running=true;main.post(tick);}
 /** A surface changed: acknowledge now rather than at the next renewal. */
 void now(){if(!running)return;main.removeCallbacks(tick);main.post(tick);}

 private void tick(){
  if(!running)return;
  Acknowledgement ack;
  try{ack=source.read();}catch(RuntimeException unreadable){ack=null;}
  Acknowledgement sent=ack;
  background.execute(()->deliver(sent));
  main.postDelayed(tick,AlphaListeningPolicy.LEASE_RENEW_MS);
 }

 private void deliver(Acknowledgement ack){
  if(ack==null||ack.uid<0||!target(ack.uid)){revoke();return;}
  try{
   if(generation<0){
    Bundle acquire=new Bundle();acquire.putBinder(AlphaListeningPolicy.KEY_TOKEN,token);
    Bundle out=call(AlphaListeningPolicy.LEASE_ACQUIRE,acquire);
    generation=out==null?-1:out.getLong(AlphaListeningPolicy.KEY_GENERATION,-1);
    if(generation<0)return;
   }
   Bundle renew=new Bundle();
   renew.putLong(AlphaListeningPolicy.KEY_GENERATION,generation);
   renew.putBoolean(AlphaListeningPolicy.KEY_SURFACE,ack.surface);
   renew.putBoolean(AlphaListeningPolicy.KEY_CHIP,AlphaListeningPolicy.chipAcknowledged(ack.recording,ack.chip));
   renew.putBoolean(AlphaListeningPolicy.KEY_RECORDING,ack.recording);
   renew.putString(AlphaListeningPolicy.KEY_DISPLAY,ack.display);
   Bundle out=call(AlphaListeningPolicy.LEASE_RENEW,renew);
   // A refused renewal (expired, revoked, replaced) is never retried on the same generation.
   if(out==null||!out.getBoolean(AlphaListeningPolicy.KEY_ACCEPTED,false))generation=-1;
  }catch(RuntimeException unavailable){generation=-1;}
 }

 private void revoke(){
  long current=generation;
  if(current<0)return;
  generation=-1;
  try{Bundle revoke=new Bundle();revoke.putLong(AlphaListeningPolicy.KEY_GENERATION,current);call(AlphaListeningPolicy.LEASE_REVOKE,revoke);}
  catch(RuntimeException unavailable){/* Expiry still stops capture. */}
 }

 private boolean target(int uid){
  try{
   ProviderInfo provider=context.getPackageManager().resolveContentProvider(AlphaListeningPolicy.LEASE_AUTHORITY,0);
   return provider!=null&&provider.applicationInfo!=null&&AlphaListeningPolicy.leaseTarget(uid,provider.packageName,provider.applicationInfo.uid);
  }catch(RuntimeException unavailable){return false;}
 }

 private Bundle call(String method,Bundle extras){return context.getContentResolver().call(uri,method,null,extras);}
}
