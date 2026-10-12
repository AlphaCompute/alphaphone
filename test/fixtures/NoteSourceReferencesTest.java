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
  // Two notes link the PDF, one the photo. The note with the photo is deleted (no longer kept).
  List<String> drop=NoteSourceReferences.unreferenced(refs,Set.of(ref('a'),ref('b')),new HashMap<>(),now);
  check(drop.equals(List.of(ref('c'))),"the deleted note's reference is pruned: "+drop);
  check(NoteSourceReferences.orphaned(refs,drop).equals(Set.of(photo)),"its document has no other reference, so its grant is released");
  // One of the two PDF notes is deleted: the other still names the PDF, so its grant stays.
  drop=NoteSourceReferences.unreferenced(refs,Set.of(ref('a'),ref('c')),new HashMap<>(),now);
  check(drop.equals(List.of(ref('b'))),"only the deleted note's reference is pruned");
  check(NoteSourceReferences.orphaned(refs,drop).isEmpty(),"a document another note references keeps its grant");
  // The last reference goes: released.
  drop=NoteSourceReferences.unreferenced(refs,Set.of(),new HashMap<>(),now);
  check(drop.size()==3&&!drop.contains("legacy-key"),"every unnamed a1: reference is pruned; other keys are left alone");
  check(NoteSourceReferences.orphaned(refs,drop).equals(Set.of(pdf,photo)),"both documents are released");
  // A reference retained moments ago may not be saved in its note yet.
  Map<String,Long> recent=new HashMap<>();recent.put(ref('c'),now-1000);
  check(!NoteSourceReferences.unreferenced(refs,Set.of(),recent,now).contains(ref('c')),"a just-retained link is not pruned");
  recent.put(ref('c'),now-NoteSourceReferences.GRACE_MS);
  check(NoteSourceReferences.unreferenced(refs,Set.of(),recent,now).contains(ref('c')),"after the grace period it is");
  recent.put(ref('c'),now+60_000);
  check(NoteSourceReferences.unreferenced(refs,Set.of(),recent,now).contains(ref('c')),"a clock moved backwards does not hold it forever");
  // Pruning keeps the bounded map from filling: 128 stale links, all pruned when no note names them.
  Map<String,Object> full=new LinkedHashMap<>();
  for(int i=0;i<NoteSourceReferences.LIMIT;i++)full.put("a1:"+String.format("%064x",i),"content://provider/document/"+i);
  check(NoteSourceReferences.unreferenced(full,Set.of(),new HashMap<>(),now).size()==NoteSourceReferences.LIMIT,"a full map of deleted notes' links is emptied");
  check(NoteSourceReferences.valid(ref('f'))&&!NoteSourceReferences.valid("a1:XYZ")&&!NoteSourceReferences.valid("b1:"+"a".repeat(64))&&!NoteSourceReferences.valid(null),"a1: shape");
  System.out.println("PASS note source references");
 }
}
