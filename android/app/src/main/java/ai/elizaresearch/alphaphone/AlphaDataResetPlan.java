package ai.elizaresearch.alphaphone;

import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Set;

/**
 * Ordered, resumable "Reset Alpha data". Plain Java (no Android types) so interruption, resume,
 * late-callback gating and path scoping run on the JVM in {@code test/alpha-data-reset.test.mjs}.
 *
 * <p>The durable marker is written before anything stops. While it exists every Alpha entry point
 * (process start, agent start, alarms, workers, notification listener) refuses to act, and the next
 * process start resumes the reset from the beginning. Every step is idempotent. The marker is
 * removed only after private files are gone; when Android clears the app data itself the marker
 * goes with it. Nothing here touches shared storage or another package's data.
 */
final class AlphaDataResetPlan {
 private AlphaDataResetPlan() {}

 enum Step { MARK, STOP_SERVICES, STOP_AGENT, CANCEL_WORK, CANCEL_NOTICES, DELETE_KEYS, CLEAR_WEB, CLEAR_PLATFORM, DELETE_FILES, UNMARK, RELAUNCH }
 enum Outcome {
  /** Android accepted its own clear of this package's data; it ends the process and removes the marker. */
  PLATFORM_CLEARING,
  /** Private files and keys were deleted by Alpha, the marker removed and a fresh start requested. */
  COMPLETED
 }

 /**
  * Steps that must be confirmed before Alpha deletes files itself (Android did not clear the
  * package). A failure of any of these leaves the marker, so the reset stays pending and gated.
  * CLEAR_WEB is not here: its on-disk storage ({@code app_webview}) is inside the private data
  * directory that DELETE_FILES removes. CANCEL_NOTICES is retried after DELETE_FILES and must pass then.
  */
 static final List<Step> REQUIRED = Collections.unmodifiableList(java.util.Arrays.asList(Step.STOP_SERVICES, Step.STOP_AGENT, Step.CANCEL_WORK, Step.DELETE_KEYS));

 /** Durable "reset in progress" record in Alpha's private no-backup directory. */
 interface Marker {
  boolean exists();
  void write() throws IOException;
  void clear() throws IOException;
 }

 /** Android-specific effects. Each must be safe to repeat after an interruption. */
 interface Host {
  /**
   * Stops navigation and disables the notification listener, reminder alarm receiver and autofill
   * service before anything else, so none of them runs while the agent is being stopped.
   */
  void stopServices() throws Exception;
  /** Stops the resident agent, waits for confirmed shutdown and disables its service (no sticky restart), or throws. */
  void stopAgent() throws Exception;
  /** Cancels this package's WorkManager work, JobScheduler jobs and AlarmManager alarms. */
  void cancelWork() throws Exception;
  /** Cancels this package's posted notices. */
  void cancelNotices() throws Exception;
  /** Deletes this package's Android Keystore aliases and confirms none is left. */
  void deleteKeys() throws Exception;
  /** Clears renderer web storage and cookies. */
  void clearWebStorage() throws Exception;
  /** Asks Android to clear this package's data. True when accepted. */
  boolean clearByPlatform();
  /** Deletes Alpha's private directories (never shared storage). */
  void deletePrivateFiles() throws IOException;
  /** Starts a fresh first-run process. */
  void relaunch();
 }

 interface Progress { void reached(Step step); }

 /** The reset could not finish safely. The marker stays, so the next start resumes it. */
 static final class Incomplete extends Exception {
  final List<Step> failed;
  Incomplete(List<Step> failed, Throwable cause) {
   super("Reset Alpha data is not finished: " + failed, cause);
   this.failed = Collections.unmodifiableList(new ArrayList<>(failed));
  }
 }

 /** The durable marker could not be written. Nothing was stopped or erased and no reset is pending. */
 static final class NotStarted extends Exception {
  NotStarted(Throwable cause) { super("Reset Alpha data did not start", cause); }
 }

 /** Late callbacks (alarms, workers, listener events, agent starts) do nothing while this is true. */
 static boolean blocked(boolean inProcess, Marker marker) {
  if (inProcess) return true;
  try { return marker.exists(); } catch (RuntimeException unreadable) { return true; }
 }

 static Outcome run(Marker marker, Host host, Progress progress) throws Exception {
  Progress at = progress == null ? step -> {} : progress;
  at.reached(Step.MARK);
  try { marker.write(); }
  catch (IOException | RuntimeException unwritten) { throw new NotStarted(unwritten); }
  List<Step> failed = new ArrayList<>();
  Throwable first = null;
  // Stopping is attempted in full even when one step fails: a platform clear force-stops whatever
  // is left, and a failure only matters if Alpha has to delete files itself.
  Step[] stops = {Step.STOP_SERVICES, Step.STOP_AGENT, Step.CANCEL_WORK, Step.CANCEL_NOTICES, Step.DELETE_KEYS, Step.CLEAR_WEB};
  for (Step step : stops) {
   at.reached(step);
   try { perform(host, step); }
   catch (Exception error) { failed.add(step); if (first == null) first = error; }
  }
  at.reached(Step.CLEAR_PLATFORM);
  if (host.clearByPlatform()) return Outcome.PLATFORM_CLEARING;
  // Deleting files under a runtime that may still write would let erased state reappear, and
  // reporting a finished reset with Keystore aliases left would be false.
  for (Step required : REQUIRED) if (failed.contains(required)) throw new Incomplete(failed, first);
  at.reached(Step.DELETE_FILES);
  host.deletePrivateFiles();
  if (failed.contains(Step.CANCEL_NOTICES)) {
   at.reached(Step.CANCEL_NOTICES);
   try { host.cancelNotices(); }
   catch (Exception error) { throw new Incomplete(Collections.singletonList(Step.CANCEL_NOTICES), error); }
  }
  at.reached(Step.UNMARK);
  marker.clear();
  at.reached(Step.RELAUNCH);
  host.relaunch();
  return Outcome.COMPLETED;
 }

 private static void perform(Host host, Step step) throws Exception {
  switch (step) {
   case STOP_AGENT: host.stopAgent(); break;
   case STOP_SERVICES: host.stopServices(); break;
   case CANCEL_WORK: host.cancelWork(); break;
   case CANCEL_NOTICES: host.cancelNotices(); break;
   case DELETE_KEYS: host.deleteKeys(); break;
   case CLEAR_WEB: host.clearWebStorage(); break;
   default: throw new IllegalArgumentException(step.name());
  }
 }

 /**
  * Deletes every entry directly under {@code root} except the names in {@code keep}. Symbolic links
  * are removed as links and never followed, so files they point at (another package, shared
  * storage) are untouched. {@code root} must be an absolute real directory, not a link.
  */
 static void deleteChildren(Path root, Set<String> keep) throws IOException {
  if (root == null || !root.isAbsolute()) throw new IOException("Reset root must be absolute");
  if (!Files.exists(root, LinkOption.NOFOLLOW_LINKS)) return;
  if (Files.isSymbolicLink(root) || !Files.isDirectory(root, LinkOption.NOFOLLOW_LINKS)) throw new IOException("Reset root must be a real directory");
  List<Path> children = new ArrayList<>();
  try (DirectoryStream<Path> entries = Files.newDirectoryStream(root)) { for (Path entry : entries) children.add(entry); }
  for (Path child : children) {
   if (keep.contains(child.getFileName().toString())) continue;
   deleteTree(root, child);
  }
 }

 private static void deleteTree(Path root, Path target) throws IOException {
  if (!target.normalize().startsWith(root.normalize())) throw new IOException("Refusing to delete outside the reset root");
  if (Files.isSymbolicLink(target) || !Files.isDirectory(target, LinkOption.NOFOLLOW_LINKS)) { deleteQuietly(target); return; }
  // walkFileTree does not follow links by default; a link inside the tree is visited as a file.
  Files.walkFileTree(target, new SimpleFileVisitor<Path>() {
   @Override public FileVisitResult visitFile(Path file, BasicFileAttributes attributes) throws IOException { deleteQuietly(file); return FileVisitResult.CONTINUE; }
   @Override public FileVisitResult visitFileFailed(Path file, IOException error) throws IOException { if (error instanceof NoSuchFileException) return FileVisitResult.CONTINUE; throw error; }
   @Override public FileVisitResult postVisitDirectory(Path directory, IOException error) throws IOException { if (error != null && !(error instanceof NoSuchFileException)) throw error; deleteQuietly(directory); return FileVisitResult.CONTINUE; }
  });
 }

 private static void deleteQuietly(Path path) throws IOException {
  try { Files.deleteIfExists(path); } catch (NoSuchFileException gone) { /* already removed */ }
 }
}
