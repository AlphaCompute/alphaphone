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
 /** A reference retained this recently may not be saved in its note yet, so it is never pruned. */
 static final long GRACE_MS=10L*60*1000;
 static boolean valid(String reference){return reference!=null&&reference.matches("a1:[a-f0-9]{64}");}
 /** True when any stored reference names this document URI. */
 static boolean referenced(Map<String,?> references,String uri){
  if(uri==null)return false;
  for(Map.Entry<String,?> entry:references.entrySet())if(valid(entry.getKey())&&uri.equals(entry.getValue()))return true;
  return false;
 }
 /**
  * Stored references no saved or restorable note names (keep), other than ones retained within
  * the grace period. Entries that are not a1: references are left for their owner.
  */
 static List<String> unreferenced(Map<String,?> references,Set<String> keep,Map<String,Long> retainedAt,long now){
  List<String> drop=new ArrayList<>();
  for(String key:references.keySet()){
   if(!valid(key)||keep.contains(key))continue;
   Long retained=retainedAt.get(key);
   if(retained!=null&&now-retained<GRACE_MS&&now>=retained)continue;
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
