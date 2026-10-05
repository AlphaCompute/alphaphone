package ai.elizaresearch.alphaphone;

import android.content.Context;
import android.os.SystemClock;
import java.util.Objects;
import org.json.JSONObject;
import static org.junit.Assert.*;

/** Test-only encrypted receipt observation; unobserved or replaced records are retained. */
final class ClockHistoryFixture implements AutoCloseable {
 private static final String SLOT="clock-handoff:v1:device";
 private final AlphaCredentialStore store;
 private String owned;
 ClockHistoryFixture(Context context)throws Exception{
  store=new AlphaCredentialStore(context);
  assertNull("Use a fixture without existing encrypted Clock history",store.readCredentialSlot(SLOT));
 }
 void completed(String action)throws Exception{
  long end=SystemClock.elapsedRealtime()+20000;
  while(SystemClock.elapsedRealtime()<end){
   String raw=store.readCredentialSlot(SLOT);
   if(raw!=null&&!Objects.equals(raw,owned)){
    JSONObject value=new JSONObject(raw),record=value.getJSONObject("record");
    if(!"opening".equals(record.getString("status"))){
     assertEquals(1,value.getInt("version"));assertEquals(action,record.getString("action"));
     assertEquals("Native handoff returned an opened receipt","opened",record.getString("status"));
     owned=raw;return;
    }
   }
   SystemClock.sleep(100);
  }
  throw new AssertionError("Clock encrypted completion missing; retain uncertain history");
 }
 @Override public void close()throws Exception{
  synchronized(AlphaCredentialStore.LOCK){
   String current=store.readCredentialSlot(SLOT);
   if(current==null)return;
   assertEquals("Retain changed or unobserved Clock history for recovery",owned,current);
   store.removeCredentialSlot(SLOT);assertNull(store.readCredentialSlot(SLOT));
  }
 }
}
