package ai.elizaresearch.alphaphone;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;

/** JVM checks for the resumable reset order, late-callback gate and private-path scoping. */
public final class AlphaDataResetPlanTest {
 static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }

 /** A simulated process death: not an Exception, so the plan cannot catch and continue past it. */
 static final class ProcessDeath extends Error { ProcessDeath() { super("process died"); } }

 static final class FileMarker implements AlphaDataResetPlan.Marker {
  final Path path; boolean unreadable;
  FileMarker(Path path) { this.path = path; }
  public boolean exists() { if (unreadable) throw new SecurityException("unreadable"); return Files.exists(path); }
  public void write() throws IOException { Files.write(path, "pending".getBytes("UTF-8")); }
  public void clear() throws IOException { Files.deleteIfExists(path); }
 }

 /** Records each effect; can die at, or fail, a chosen step; models a store that a live agent rewrites. */
 static final class FakeHost implements AlphaDataResetPlan.Host {
  final Path data; final List<String> calls = new ArrayList<>();
  String dieAt, failAt; boolean platformAccepts; boolean agentRunning = true; boolean relaunched;
  FakeHost(Path data) { this.data = data; }
  void at(String name) throws Exception {
   calls.add(name);
   if (name.equals(dieAt)) { dieAt = null; throw new ProcessDeath(); }
   if (name.equals(failAt)) throw new IllegalStateException(name + " unconfirmed");
  }
  public void stopAgent() throws Exception { at("stopAgent"); agentRunning = false; }
  public void stopServices() throws Exception { at("stopServices"); }
  public void cancelWork() throws Exception { at("cancelWork"); }
  public void cancelNotices() throws Exception { at("cancelNotices"); }
  public void deleteKeys() throws Exception { at("deleteKeys"); }
  public void clearWebStorage() throws Exception { at("clearWeb"); }
  public boolean clearByPlatform() { calls.add("clearByPlatform"); return platformAccepts; }
  public void deletePrivateFiles() throws IOException {
   calls.add("deleteFiles");
   if ("deleteFiles".equals(dieAt)) { dieAt = null; Files.deleteIfExists(data.resolve("files/notes.json")); throw new ProcessDeath(); }
   check(!agentRunning, "Files are never deleted under a running agent");
   AlphaDataResetPlan.deleteChildren(data, new HashSet<>(Arrays.asList("lib", "no_backup")));
   AlphaDataResetPlan.deleteChildren(data.resolve("no_backup"), Collections.singleton("alpha-data-reset.pending"));
  }
  public void relaunch() { calls.add("relaunch"); relaunched = true; }
 }

 static Path seed(Path root) throws IOException {
  Path data = Files.createDirectories(root.resolve("data/ai.elizaresearch.alphaphone"));
  Files.createDirectories(data.resolve("files/agent"));
  Files.write(data.resolve("files/notes.json"), "{\"notes\":[1]}".getBytes("UTF-8"));
  Files.write(data.resolve("files/agent/state.db"), new byte[] {1, 2, 3});
  Files.createDirectories(data.resolve("shared_prefs"));
  Files.write(data.resolve("shared_prefs/CapacitorStorage.xml"), "<map/>".getBytes("UTF-8"));
  Files.createDirectories(data.resolve("cache/http"));
  Files.write(data.resolve("cache/http/x"), new byte[] {9});
  Files.createDirectories(data.resolve("app_webview/Default"));
  Files.write(data.resolve("app_webview/Default/Local Storage"), new byte[] {7});
  Files.createDirectories(data.resolve("no_backup"));
  Files.write(data.resolve("no_backup/credential-slots.bin"), new byte[] {5});
  Files.createDirectories(data.resolve("lib"));
  Files.write(data.resolve("lib/libnative.so"), new byte[] {4});
  return data;
 }

 static void assertErased(Path data) throws IOException {
  for (String path : new String[] {"files", "shared_prefs", "cache", "app_webview", "no_backup/credential-slots.bin", "no_backup/alpha-data-reset.pending"})
   check(!Files.exists(data.resolve(path)), "Erased " + path);
  check(Files.exists(data.resolve("lib/libnative.so")), "The system-owned lib entry is kept");
 }

 public static void main(String[] args) throws Exception {
  Path temporary = Files.createTempDirectory("alpha-reset-");
  try {
   // 1. Platform clear accepted: every stop step runs first, then Android owns deletion and process end.
   {
    Path data = seed(temporary.resolve("platform"));
    FileMarker marker = new FileMarker(data.resolve("no_backup/alpha-data-reset.pending"));
    FakeHost host = new FakeHost(data); host.platformAccepts = true;
    List<AlphaDataResetPlan.Step> seen = new ArrayList<>();
    check(AlphaDataResetPlan.run(marker, host, seen::add) == AlphaDataResetPlan.Outcome.PLATFORM_CLEARING, "Platform outcome");
    check(host.calls.equals(Arrays.asList("stopAgent", "stopServices", "cancelWork", "cancelNotices", "deleteKeys", "clearWeb", "clearByPlatform")), "Platform order " + host.calls);
    check(seen.get(0) == AlphaDataResetPlan.Step.MARK, "The marker is written before anything stops");
    check(marker.exists(), "The marker stays until Android clears it with the rest of the data");
    check(Files.exists(data.resolve("files/notes.json")), "Alpha deletes nothing itself when Android accepts the clear");
   }
   // 2. Platform clear refused: Alpha deletes its private files, then the marker, then relaunches.
   {
    Path data = seed(temporary.resolve("fallback"));
    FileMarker marker = new FileMarker(data.resolve("no_backup/alpha-data-reset.pending"));
    FakeHost host = new FakeHost(data);
    check(AlphaDataResetPlan.run(marker, host, null) == AlphaDataResetPlan.Outcome.COMPLETED, "Fallback outcome");
    check(host.calls.subList(host.calls.size() - 3, host.calls.size()).equals(Arrays.asList("clearByPlatform", "deleteFiles", "relaunch")), "Fallback order " + host.calls);
    assertErased(data);
    check(host.relaunched, "Fresh first run requested");
   }
   // 3. Process death at every step: the marker blocks late callbacks and the next start finishes the reset.
   for (String step : new String[] {"stopAgent", "stopServices", "cancelWork", "cancelNotices", "deleteKeys", "clearWeb", "deleteFiles"}) {
    Path data = seed(temporary.resolve("death-" + step));
    FileMarker marker = new FileMarker(data.resolve("no_backup/alpha-data-reset.pending"));
    FakeHost host = new FakeHost(data); host.dieAt = step;
    boolean died = false;
    try { AlphaDataResetPlan.run(marker, host, null); } catch (ProcessDeath expected) { died = true; }
    check(died, "Interrupted at " + step);
    // New process: in-memory flag is gone, but the durable marker still closes every gate.
    check(AlphaDataResetPlan.blocked(false, marker), "Late callbacks are blocked after death at " + step);
    check(!host.relaunched, "No first run before the reset finishes");
    FakeHost resumed = new FakeHost(data);
    check(AlphaDataResetPlan.run(marker, resumed, null) == AlphaDataResetPlan.Outcome.COMPLETED, "Resume after " + step);
    check(resumed.calls.get(0).equals("stopAgent"), "Resume restarts from the first step");
    assertErased(data);
    check(!AlphaDataResetPlan.blocked(false, marker), "Gate opens only after the private data is gone");
   }
   // 4. Unconfirmed agent shutdown without a platform clear: nothing is deleted and the reset stays pending.
   {
    Path data = seed(temporary.resolve("unconfirmed"));
    FileMarker marker = new FileMarker(data.resolve("no_backup/alpha-data-reset.pending"));
    FakeHost host = new FakeHost(data); host.failAt = "stopAgent";
    boolean incomplete = false;
    try { AlphaDataResetPlan.run(marker, host, null); }
    catch (AlphaDataResetPlan.Incomplete expected) { incomplete = expected.failed.contains(AlphaDataResetPlan.Step.STOP_AGENT); }
    check(incomplete, "Unconfirmed shutdown reports an incomplete reset");
    check(host.calls.contains("cancelNotices") && host.calls.contains("deleteKeys"), "Remaining stop steps still run");
    check(!host.calls.contains("deleteFiles") && Files.exists(data.resolve("files/notes.json")), "No deletion under a possibly running agent");
    check(marker.exists() && AlphaDataResetPlan.blocked(false, marker), "Still pending and gated");
    // A notice cancellation failure alone does not block the private-file deletion.
    FakeHost later = new FakeHost(data); later.failAt = "cancelNotices";
    check(AlphaDataResetPlan.run(marker, later, null) == AlphaDataResetPlan.Outcome.COMPLETED, "Completes when only a notice step failed");
    assertErased(data);
   }
   // 5. Gate: in-process flag wins; an unreadable marker fails closed.
   {
    FileMarker marker = new FileMarker(temporary.resolve("absent-marker"));
    check(!AlphaDataResetPlan.blocked(false, marker), "Open with no reset");
    check(AlphaDataResetPlan.blocked(true, marker), "A completed reset in this process still blocks its late callbacks");
    marker.unreadable = true;
    check(AlphaDataResetPlan.blocked(false, marker), "Unreadable marker blocks");
   }
   // 6. No cross-app deletion: links are removed as links, never followed; roots must be real and absolute.
   {
    Path data = seed(temporary.resolve("links"));
    Path other = Files.createDirectories(temporary.resolve("links/data/com.example.otherapp/files"));
    Path shared = Files.createDirectories(temporary.resolve("links/storage/emulated/0/DCIM"));
    Files.write(other.resolve("theirs.txt"), "keep".getBytes("UTF-8"));
    Files.write(shared.resolve("photo.jpg"), new byte[] {1});
    Files.createSymbolicLink(data.resolve("files/agent/other-link"), other);
    Files.createSymbolicLink(data.resolve("photos-link"), shared);
    Files.createSymbolicLink(data.resolve("files/agent/photo-file-link"), shared.resolve("photo.jpg"));
    AlphaDataResetPlan.deleteChildren(data, new HashSet<>(Arrays.asList("lib", "no_backup")));
    check(!Files.exists(data.resolve("files"), java.nio.file.LinkOption.NOFOLLOW_LINKS) && !Files.exists(data.resolve("photos-link"), java.nio.file.LinkOption.NOFOLLOW_LINKS), "Links inside the private tree are removed");
    check(Files.exists(other.resolve("theirs.txt")), "Another package's file survives");
    check(Files.exists(shared.resolve("photo.jpg")), "Shared photos survive");
    boolean refused = false;
    try { AlphaDataResetPlan.deleteChildren(java.nio.file.Paths.get("relative"), Collections.emptySet()); }
    catch (IOException expected) { refused = true; }
    check(refused, "Relative roots are refused");
    Path linkedRoot = temporary.resolve("linked-root");
    Files.createSymbolicLink(linkedRoot, other);
    refused = false;
    try { AlphaDataResetPlan.deleteChildren(linkedRoot, Collections.emptySet()); } catch (IOException expected) { refused = true; }
    check(refused && Files.exists(other.resolve("theirs.txt")), "A linked root is refused");
    AlphaDataResetPlan.deleteChildren(temporary.resolve("missing-root"), Collections.emptySet());
   }
   System.out.println("PASS alpha data reset plan");
  } finally {
   try (java.util.stream.Stream<Path> walk = Files.walk(temporary)) {
    walk.sorted(Collections.reverseOrder()).forEach(path -> { try { Files.deleteIfExists(path); } catch (IOException ignored) { } });
   }
  }
 }
}
