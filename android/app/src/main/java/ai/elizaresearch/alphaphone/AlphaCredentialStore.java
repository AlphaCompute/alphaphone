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
 // Invalidate first: a crash or failed credential write must never resurrect an old admission.
 void writeCredentialSlot(String name,String value)throws Exception{
  synchronized(JsonCredentialSlots.LOCK){
   if(("cloud:production".equals(name)||"cloud:staging".equals(name))
      &&!java.util.Objects.equals(slots.read(name),value))invalidateProviderAdmission(name,value);
   slots.write(name,LocalAgentProviderAdmission.PROVIDER_SLOT.equals(name)?LocalAgentProviderAdmission.withoutAdmission(value):value);
  }
 }
 void removeCredentialSlot(String name)throws Exception{
  synchronized(JsonCredentialSlots.LOCK){invalidateProviderAdmission(name,null);slots.remove(name);}
 }
 boolean compareExchangeCredentialSlot(String name,String expected,String value)throws Exception{
  synchronized(JsonCredentialSlots.LOCK){
   if(!java.util.Objects.equals(slots.read(name),expected))return false;
   if(value==null)removeCredentialSlot(name);else writeCredentialSlot(name,value);
   return true;
  }
 }
 private void invalidateProviderAdmission(String changedSlot,String replacement)throws Exception{
  if(!"cloud:production".equals(changedSlot)&&!"cloud:staging".equals(changedSlot))return;
  String saved=slots.read(LocalAgentProviderAdmission.PROVIDER_SLOT);
  if(saved==null)return;
  org.json.JSONObject provider=new org.json.JSONObject(saved);
  if(!changedSlot.equals("cloud:"+provider.optString("environment","production")))return;
  String previous=slots.read(changedSlot);
  if(replacement!=null&&LocalAgentProviderAdmission.currentGeneration(saved,previous)!=null
     &&LocalAgentProviderAdmission.sameCloudCredential(previous,replacement))return;
  slots.write(LocalAgentProviderAdmission.PROVIDER_SLOT,LocalAgentProviderAdmission.withoutAdmission(saved));
 }
 /** Only explicit, validated native provider configuration may establish admission identity. */
 String compareExchangeProviderAdmission(String expected,String selection,String credentialSlot,String expectedCredential)throws Exception{
  synchronized(JsonCredentialSlots.LOCK){
   if(!java.util.Objects.equals(slots.read(LocalAgentProviderAdmission.PROVIDER_SLOT),expected)
      ||credentialSlot!=null&&!java.util.Objects.equals(slots.read(credentialSlot),expectedCredential))return null;
   org.json.JSONObject requested=new org.json.JSONObject(selection);
   boolean cloud="elizacloud".equals(requested.optString("provider"));
   if(cloud?!"cloud:production".equals(credentialSlot):credentialSlot!=null||expectedCredential!=null)throw new IllegalArgumentException();
   String admitted=LocalAgentProviderAdmission.admit(expected,selection,expectedCredential);
   slots.write(LocalAgentProviderAdmission.PROVIDER_SLOT,admitted);
   return admitted;
  }
 }
 /** Account invalidation may strip this admission, but never overwrite a newer CAS revision. */
 void rollbackProviderAdmission(String admitted,String previous)throws Exception{
  synchronized(JsonCredentialSlots.LOCK){
   String current=slots.read(LocalAgentProviderAdmission.PROVIDER_SLOT);
   if(current==null)return;
   org.json.JSONObject held=new org.json.JSONObject(current);
   if(!java.util.Objects.equals(current,admitted)
      &&(held.has("admissionGeneration")||held.has("admissionFingerprint")
       ||!LocalAgentProviderAdmission.withoutAdmission(admitted).equals(held.toString())))return;
   if(previous==null)slots.remove(LocalAgentProviderAdmission.PROVIDER_SLOT);
   else slots.write(LocalAgentProviderAdmission.PROVIDER_SLOT,LocalAgentProviderAdmission.withoutAdmission(previous));
  }
 }
 /** Read-only correlation, not an authorization or migration API. Legacy selections remain unavailable. */
 String providerAdmissionGeneration()throws Exception{
  synchronized(JsonCredentialSlots.LOCK){
   String saved=slots.read(LocalAgentProviderAdmission.PROVIDER_SLOT);
   if(saved==null)return null;
   org.json.JSONObject selected=new org.json.JSONObject(saved);
   String credential="elizacloud".equals(selected.optString("provider"))?slots.read("cloud:production"):null;
   return LocalAgentProviderAdmission.currentGeneration(saved,credential);
  }
 }
}
