package ai.elizaresearch.alphaphone;

import android.content.Context;
import android.util.AtomicFile;
import ai.eliza.plugins.securestore.nativeonly.JsonCredentialSlots;
import java.io.File;

/** Product identity and limits for the installed shared JSON-slot format. */
final class AlphaCredentialStore {
 private final JsonCredentialSlots slots;
 AlphaCredentialStore(Context context){
  slots=new JsonCredentialSlots(new File(context.getApplicationContext().getNoBackupFilesDir(),"connection-credentials"),"alpha.connection.aes.v1",AlphaCredentialStore::slotLimit);
 }
 private static int slotLimit(String name){
  if("notes-audio-deletions:v1:device".equals(name))return 1024*1024;
  if(name!=null&&name.matches("note-audio-metadata:v1:[A-Za-z0-9_-]{1,100}"))return 512*1024;
  if("notes-records:v1:device".equals(name))return 32*1024*1024;
  // Restorable copies of deleted notes, purged three days after deletion.
  if("notes-trash:v1:device".equals(name))return 32*1024*1024;
  if(name!=null&&(name.startsWith("inbox-drafts:v1:")||name.matches("inbox-operation:v1:[a-f0-9]{64}")))return 8*1024*1024;
  return 256*1024;
 }
 String slotHash(String name)throws Exception{return slots.slotHash(name);}
 AtomicFile slotFile(String hash)throws Exception{return slots.slotFile(hash);}
 String readCredentialSlot(String name)throws Exception{return slots.read(name);}
 void writeCredentialSlot(String name,String value)throws Exception{slots.write(name,value);}
 void removeCredentialSlot(String name)throws Exception{slots.remove(name);}
 boolean compareExchangeCredentialSlot(String name,String expected,String value)throws Exception{return slots.compareExchange(name,expected,value);}
}
