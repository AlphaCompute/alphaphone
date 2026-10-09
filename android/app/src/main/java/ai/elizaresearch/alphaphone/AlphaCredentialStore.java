package ai.elizaresearch.alphaphone;

import android.content.Context;
import android.util.AtomicFile;
import ai.eliza.plugins.securestore.nativeonly.JsonCredentialSlots;
import java.io.File;
import java.nio.charset.StandardCharsets;

/** Product identity and limits for the installed shared JSON-slot format. */
final class AlphaCredentialStore {
 /** Definite refusal before any byte is written: the value exceeds its slot's cap. */
 static final class StorageFullException extends Exception {
  StorageFullException(){super("Secure storage slot is full");}
 }
 static final String NOTES_RECORDS="notes-records:v1:device";
 static final String NOTES_TRASH="notes-trash:v1:device";
 /** Encrypted copy of Notes edits whose collection commit failed or is uncertain. */
 static final String NOTES_DRAFT="notes-draft:v1:device";
 private final JsonCredentialSlots slots;
 AlphaCredentialStore(Context context){
  slots=new JsonCredentialSlots(new File(context.getApplicationContext().getNoBackupFilesDir(),"connection-credentials"),"alpha.connection.aes.v1",AlphaCredentialStore::slotLimit);
 }
 static int slotLimit(String name){
  if("notes-audio-deletions:v1:device".equals(name))return 1024*1024;
  if(name!=null&&name.matches("note-audio-metadata:v1:[A-Za-z0-9_-]{1,100}"))return 512*1024;
  if(NOTES_RECORDS.equals(name))return 32*1024*1024;
  // Restorable copies of deleted notes, purged three days after deletion.
  if(NOTES_TRASH.equals(name))return 32*1024*1024;
  if(NOTES_DRAFT.equals(name))return 32*1024*1024;
  if(name!=null&&(name.startsWith("inbox-drafts:v1:")||name.matches("inbox-operation:v1:[a-f0-9]{64}")))return 8*1024*1024;
  return 256*1024;
 }
 /** The shared slot rejects oversized values with a generic error; report the cap distinctly. */
 private static void requireCapacity(String name,String value)throws StorageFullException{
  if(value==null)return;
  // UTF-8 never encodes a char in fewer than 1 byte, so a short string cannot exceed the cap.
  if(value.length()<=slotLimit(name)/3)return;
  if(value.getBytes(StandardCharsets.UTF_8).length>slotLimit(name))throw new StorageFullException();
 }
 String slotHash(String name)throws Exception{return slots.slotHash(name);}
 AtomicFile slotFile(String hash)throws Exception{return slots.slotFile(hash);}
 String readCredentialSlot(String name)throws Exception{return slots.read(name);}
 void writeCredentialSlot(String name,String value)throws Exception{requireCapacity(name,value);slots.write(name,value);}
 void removeCredentialSlot(String name)throws Exception{slots.remove(name);}
 boolean compareExchangeCredentialSlot(String name,String expected,String value)throws Exception{requireCapacity(name,value);return slots.compareExchange(name,expected,value);}
}
