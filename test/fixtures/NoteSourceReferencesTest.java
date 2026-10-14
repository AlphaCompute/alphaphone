package ai.elizaresearch.alphaphone;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Host-JVM check of note source reference counting (J03). Not Android or provider evidence. */
public final class NoteSourceReferencesTest {
 private static void check(boolean value,String message){if(!value)throw new AssertionError(message);}
 static String ref(char c){return "a1:"+String.valueOf(c).repeat(64);}
 public static void main(String[] args){
  String pdf="content://provider/document/report.pdf",photo="content://provider/document/photo.png";
  Map<String,Object> refs=new LinkedHashMap<>();
  refs.put(ref('a'),pdf);refs.put(ref('b'),pdf);refs.put(ref('c'),photo);refs.put("legacy-key","content://other");
  // A grant stays while any reference names its document, whatever the picker selection did.
  check(NoteSourceReferences.referenced(refs,pdf)&&NoteSourceReferences.referenced(refs,photo),"referenced documents keep their grant");
  check(!NoteSourceReferences.referenced(refs,"content://provider/document/other"),"an unreferenced document does not");
  check(!NoteSourceReferences.referenced(refs,"content://other"),"only a1: references count");
  check(!NoteSourceReferences.referenced(refs,null),"no uri");
  long now=1_800_000_000_000L;
  // Every reference was last retained longer ago than the grace period.
  Map<String,Object> old=new HashMap<>();for(String key:refs.keySet())old.put(key,now-NoteSourceReferences.GRACE_MS);
  // Two notes link the PDF, one the photo. The note with the photo is deleted (no longer kept).
  List<String> drop=NoteSourceReferences.unreferenced(refs,Set.of(ref('a'),ref('b')),old,now);
  check(drop.equals(List.of(ref('c'))),"the deleted note's reference is pruned: "+drop);
  check(NoteSourceReferences.orphaned(refs,drop).equals(Set.of(photo)),"its document has no other reference, so its grant is released");
  // One of the two PDF notes is deleted: the other still names the PDF, so its grant stays.
  drop=NoteSourceReferences.unreferenced(refs,Set.of(ref('a'),ref('c')),old,now);
  check(drop.equals(List.of(ref('b'))),"only the deleted note's reference is pruned");
  check(NoteSourceReferences.orphaned(refs,drop).isEmpty(),"a document another note references keeps its grant");
  // The last reference goes: released.
  drop=NoteSourceReferences.unreferenced(refs,Set.of(),old,now);
  check(drop.size()==3&&!drop.contains("legacy-key"),"every unnamed a1: reference is pruned; other keys are left alone");
  check(NoteSourceReferences.orphaned(refs,drop).equals(Set.of(pdf,photo)),"both documents are released");
  // A link retained for a content question may be saved in a summary note much later: it is kept for
  // the grace period after it was last retained, also across a process restart (the time is stored).
  Map<String,Object> recent=new HashMap<>(old);recent.put(ref('c'),now-1000);
  check(!NoteSourceReferences.unreferenced(refs,Set.of(),recent,now).contains(ref('c')),"a just-retained link is not pruned");
  recent.put(ref('c'),now-NoteSourceReferences.GRACE_MS+60_000);
  check(!NoteSourceReferences.unreferenced(refs,Set.of(),recent,now).contains(ref('c')),"nor one still inside the grace period");
  check(NoteSourceReferences.GRACE_MS>=24L*60*60*1000,"the grace period outlasts a conversation, not minutes");
  recent.put(ref('c'),now-NoteSourceReferences.GRACE_MS);
  check(NoteSourceReferences.unreferenced(refs,Set.of(),recent,now).contains(ref('c')),"after the grace period it is");
  // No retain time (stored before times were kept) or a time ahead of now (a clock moved backwards):
  // kept, and reported for seeding with now, so it gets a full grace period rather than none or forever.
  recent.remove(ref('c'));
  check(!NoteSourceReferences.unreferenced(refs,Set.of(),recent,now).contains(ref('c')),"a reference without a time is not pruned");
  check(NoteSourceReferences.unseeded(refs,recent,now).equals(List.of(ref('c'))),"it is seeded: "+NoteSourceReferences.unseeded(refs,recent,now));
  recent.put(ref('c'),now+60_000);
  check(!NoteSourceReferences.unreferenced(refs,Set.of(),recent,now).contains(ref('c')),"a future time does not prune");
  check(NoteSourceReferences.unseeded(refs,recent,now).equals(List.of(ref('c'))),"a future time is re-seeded");
  recent.put(ref('c'),"not a time");
  check(NoteSourceReferences.unseeded(refs,recent,now).equals(List.of(ref('c')))&&!NoteSourceReferences.unreferenced(refs,Set.of(),recent,now).contains(ref('c')),"an unreadable time is kept and re-seeded");
  check(NoteSourceReferences.unseeded(refs,old,now).isEmpty(),"timed references and other keys are not seeded");
  // Pruning keeps the bounded map from filling: 128 stale links, all pruned when no note names them.
  Map<String,Object> full=new LinkedHashMap<>();
  Map<String,Object> fullTimes=new HashMap<>();
  for(int i=0;i<NoteSourceReferences.LIMIT;i++){full.put("a1:"+String.format("%064x",i),"content://provider/document/"+i);fullTimes.put("a1:"+String.format("%064x",i),now-NoteSourceReferences.GRACE_MS-i);}
  check(NoteSourceReferences.unreferenced(full,Set.of(),fullTimes,now).size()==NoteSourceReferences.LIMIT,"a full map of deleted notes' links is emptied");
  check(NoteSourceReferences.valid(ref('f'))&&!NoteSourceReferences.valid("a1:XYZ")&&!NoteSourceReferences.valid("b1:"+"a".repeat(64))&&!NoteSourceReferences.valid(null),"a1: shape");
  System.out.println("PASS note source references");
 }
}
