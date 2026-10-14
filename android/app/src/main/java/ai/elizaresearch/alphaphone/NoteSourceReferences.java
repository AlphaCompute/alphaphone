package ai.elizaresearch.alphaphone;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Reference counting for a note's linked source (J03, option a). A Notes 'a1:' link names an entry
 * in the 'note-source-references' preferences, whose value is the document URI the note can reopen
 * while Android keeps its persisted read grant. A grant stays while any reference names its URI,
 * even after the picker selection that granted it is forgotten or evicted; it is released when the
 * last saved or restorable (Trash) note that references it is gone. No Android types: host-tested.
 */
final class NoteSourceReferences {
 private NoteSourceReferences(){}
 static final String PREFERENCES="note-source-references";
 /** Stored references. Pruning keeps the map from silently filling. */
 static final int LIMIT=128;
 /**
  * When each reference was last retained (epoch ms), kept beside the references so it survives a
  * process restart. A link is retained when a content question about the document is asked, and a
  * summary note may save it from the conversation much later, so a reference no note names yet is
  * kept for GRACE_MS after it was last retained (the Notes Trash retention) before it is pruned.
  */
 static final String RETAINED_PREFERENCES="note-source-reference-times";
 static final long GRACE_MS=3L*24*60*60*1000;
 static boolean valid(String reference){return reference!=null&&reference.matches("a1:[a-f0-9]{64}");}
 /** True when any stored reference names this document URI. */
 static boolean referenced(Map<String,?> references,String uri){
  if(uri==null)return false;
  for(Map.Entry<String,?> entry:references.entrySet())if(valid(entry.getKey())&&uri.equals(entry.getValue()))return true;
  return false;
 }
 /**
  * Stored references whose retain time is missing, unreadable or ahead of now (a reference stored
  * before times were kept, or a clock moved backwards). The caller records now for them, so each
  * gets a full grace period instead of being pruned at once or held forever.
  */
 static List<String> unseeded(Map<String,?> references,Map<String,?> retainedAt,long now){
  List<String> seed=new ArrayList<>();
  for(String key:references.keySet()){
   if(!valid(key))continue;
   Object retained=retainedAt.get(key);
   if(!(retained instanceof Long)||(Long)retained>now)seed.add(key);
  }
  return seed;
 }
 /**
  * Stored references no saved or restorable note names (keep) and that were last retained at least
  * GRACE_MS ago. A reference without a usable retain time is kept (see unseeded). Entries that are
  * not a1: references are left for their owner.
  */
 static List<String> unreferenced(Map<String,?> references,Set<String> keep,Map<String,?> retainedAt,long now){
  List<String> drop=new ArrayList<>();
  for(String key:references.keySet()){
   if(!valid(key)||keep.contains(key))continue;
   Object retained=retainedAt.get(key);
   if(!(retained instanceof Long))continue;
   long at=(Long)retained;
   if(at>now||now-at<GRACE_MS)continue;
   drop.add(key);
  }
  return drop;
 }
 /** Document URIs of the dropped references that no remaining reference names. */
 static Set<String> orphaned(Map<String,?> references,Collection<String> dropped){
  Set<String> candidates=new LinkedHashSet<>();
  for(String key:dropped){Object value=references.get(key);if(value instanceof String)candidates.add((String)value);}
  for(Map.Entry<String,?> entry:references.entrySet())if(!dropped.contains(entry.getKey())&&valid(entry.getKey()))candidates.remove(entry.getValue());
  return candidates;
 }
}
