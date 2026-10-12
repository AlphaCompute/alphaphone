package ai.elizaresearch.alphaphone;

import android.app.KeyguardManager;
import android.app.PendingIntent;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Context;
import android.content.Intent;
import android.database.ContentObserver;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Size;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;

/**
 * The device photo/video library as Android permits it (issue 408, policy P-24).
 *
 * Scope is read from Android on every call; nothing is cached as a grant. The catalog is
 * paged on demand while Photos is open: no background indexer, no copies, no upload. Every
 * row has a stable identity (kind, MediaStore id, add generation) and a mutation revision.
 * Changes to media this app does not own go through Android's own confirmation
 * (MediaStore.create*Request), so destructive and share actions are always reviewed by the
 * owner in system UI. Owned captures keep using AlphaPhotosPlugin.
 */
@CapacitorPlugin(name = "AlphaPhotoLibrary", permissions = {
 @Permission(alias = "mediaLegacy", strings = {PhotoLibraryAccess.READ_EXTERNAL_STORAGE}),
 @Permission(alias = "media", strings = {PhotoLibraryAccess.READ_MEDIA_IMAGES, PhotoLibraryAccess.READ_MEDIA_VIDEO}),
 @Permission(alias = "mediaSelected", strings = {PhotoLibraryAccess.READ_MEDIA_VISUAL_USER_SELECTED})
})
public class AlphaPhotoLibraryPlugin extends Plugin {
 private static final Uri CATALOG = MediaStore.Files.getContentUri("external");
 private static final String BASE = "media_type IN (1,3) AND " + MediaStore.MediaColumns.IS_PENDING + "=0";
 private final ExecutorService worker = Executors.newSingleThreadExecutor();
 private final Handler main = new Handler(Looper.getMainLooper());
 private volatile boolean destroyed;
 private ActivityResultLauncher<IntentSenderRequest> review;
 private PluginCall pendingReview;
 private JSArray pendingItems;
 private String pendingOperation = "";
 private String lastScope = "";
 private ContentObserver observer;
 private final Runnable changed = () -> {
  if (destroyed) return;
  JSObject event = new JSObject();
  event.put("at", System.currentTimeMillis());
  notifyListeners("libraryChanged", event);
 };

 @Override public void load() {
  review = getActivity().registerForActivityResult(new ActivityResultContracts.StartIntentSenderForResult(), this::reviewed);
  observer = new ContentObserver(main) {
   // Debounced: a burst of external edits produces one event; the renderer decides
   // whether to revalidate (only while Photos is visible).
   @Override public void onChange(boolean self) { main.removeCallbacks(changed); main.postDelayed(changed, 1500); }
  };
  ContentResolver resolver = getContext().getContentResolver();
  resolver.registerContentObserver(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, true, observer);
  resolver.registerContentObserver(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, true, observer);
  lastScope = scopeName();
 }

 private void submit(PluginCall call, Runnable action) {
  if (destroyed) { call.reject("Device library closed"); return; }
  try { worker.execute(() -> { if (destroyed) call.reject("Device library closed"); else action.run(); }); }
  catch (RejectedExecutionException stopped) { call.reject("Device library closed"); }
 }

 private boolean granted(String permission) {
  return ContextCompat.checkSelfPermission(getContext(), permission) == android.content.pm.PackageManager.PERMISSION_GRANTED;
 }

 private String scopeName() {
  int sdk = Build.VERSION.SDK_INT;
  return PhotoLibraryAccess.scope(sdk,
   sdk >= 33 && granted(PhotoLibraryAccess.READ_MEDIA_IMAGES),
   sdk >= 33 && granted(PhotoLibraryAccess.READ_MEDIA_VIDEO),
   sdk >= 34 && granted(PhotoLibraryAccess.READ_MEDIA_VISUAL_USER_SELECTED),
   sdk < 33 && granted(PhotoLibraryAccess.READ_EXTERNAL_STORAGE));
 }

 private boolean locked() {
  KeyguardManager keyguard = (KeyguardManager) getContext().getSystemService(Context.KEYGUARD_SERVICE);
  return keyguard != null && keyguard.isDeviceLocked();
 }

 private JSObject scopeResult() {
  int sdk = Build.VERSION.SDK_INT;
  JSObject out = new JSObject();
  String scope = scopeName();
  out.put("scope", scope);
  out.put("sdk", sdk);
  out.put("images", sdk >= 33 ? granted(PhotoLibraryAccess.READ_MEDIA_IMAGES) : "full".equals(scope));
  out.put("videos", sdk >= 33 ? granted(PhotoLibraryAccess.READ_MEDIA_VIDEO) : "full".equals(scope));
  out.put("canSelectMore", sdk >= 34 && "selected".equals(scope));
  out.put("canEditOthers", sdk >= 30);
  out.put("locked", locked());
  out.put("version", MediaStore.getVersion(getContext()));
  return out;
 }

 @PluginMethod public void scope(PluginCall call) { call.resolve(scopeResult()); }

 /** One Android dialog. On Android 14+ it offers Allow all, Select photos and Don't allow. */
 @PluginMethod public void requestAccess(PluginCall call) {
  if ("full".equals(scopeName())) { call.resolve(scopeResult()); return; }
  requestPermissionForAliases(PhotoLibraryAccess.requestAliases(Build.VERSION.SDK_INT), call, "accessResult");
 }

 @PermissionCallback private void accessResult(PluginCall call) {
  JSObject out = scopeResult();
  boolean blocked = false;
  for (String alias : PhotoLibraryAccess.requestAliases(Build.VERSION.SDK_INT)) {
   if (getPermissionState(alias) == PermissionState.DENIED) blocked = true;
  }
  // Android stops showing the dialog after repeated denials; Settings is the only path then.
  out.put("settingsRequired", "denied".equals(out.getString("scope")) && blocked);
  lastScope = out.getString("scope");
  call.resolve(out);
 }

 @Override protected void handleOnResume() {
  super.handleOnResume();
  // Grants can be downgraded or revoked in Settings while Alpha is in the background.
  String now = scopeName();
  if (!now.equals(lastScope)) {
   String previous = lastScope;
   lastScope = now;
   JSObject event = scopeResult();
   event.put("previous", previous);
   notifyListeners("scopeChanged", event);
  }
 }

 private String[] fields() {
  List<String> out = new ArrayList<>(java.util.Arrays.asList(
   MediaStore.MediaColumns._ID, MediaStore.Files.FileColumns.MEDIA_TYPE, MediaStore.MediaColumns.MIME_TYPE,
   MediaStore.MediaColumns.DISPLAY_NAME, MediaStore.MediaColumns.BUCKET_DISPLAY_NAME, MediaStore.MediaColumns.WIDTH,
   MediaStore.MediaColumns.HEIGHT, MediaStore.MediaColumns.DATE_TAKEN, MediaStore.MediaColumns.DATE_MODIFIED,
   MediaStore.MediaColumns.DATE_ADDED, MediaStore.MediaColumns.SIZE, MediaStore.Video.VideoColumns.DURATION,
   MediaStore.MediaColumns.ORIENTATION));
  if (Build.VERSION.SDK_INT >= 30) {
   out.add(MediaStore.MediaColumns.GENERATION_ADDED);
   out.add(MediaStore.MediaColumns.GENERATION_MODIFIED);
   out.add(MediaStore.MediaColumns.IS_FAVORITE);
   out.add(MediaStore.MediaColumns.OWNER_PACKAGE_NAME);
   out.add(MediaStore.MediaColumns.IS_TRASHED);
  }
  return out.toArray(new String[0]);
 }

 private static boolean video(Cursor row) { return row.getInt(1) == MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO; }
 private static long added(Cursor row) { return Build.VERSION.SDK_INT >= 30 ? row.getLong(13) : row.getLong(9); }
 private static long generation(Cursor row) { return Build.VERSION.SDK_INT >= 30 ? row.getLong(14) : 0; }
 private static String id(Cursor row) { return PhotoLibraryAccess.id(video(row), row.getLong(0), added(row)); }
 private static String revision(Cursor row) { return PhotoLibraryAccess.revision(row.getLong(8), row.getLong(10), generation(row), Build.VERSION.SDK_INT); }

 private JSObject metadata(Cursor row) {
  JSObject item = new JSObject();
  boolean video = video(row);
  item.put("id", id(row));
  item.put("revision", revision(row));
  item.put("kind", video ? "video" : "image");
  item.put("mime", row.getString(2) == null ? "" : row.getString(2));
  item.put("name", row.getString(3) == null ? "" : row.getString(3));
  item.put("album", row.getString(4) == null ? "" : row.getString(4));
  item.put("width", row.getInt(5));
  item.put("height", row.getInt(6));
  long taken = row.getLong(7);
  item.put("takenAt", taken > 0 ? taken : row.getLong(8) * 1000);
  item.put("modifiedAt", row.getLong(8) * 1000);
  item.put("size", row.getLong(10));
  item.put("duration", video ? row.getLong(11) / 1000d : 0);
  item.put("orientation", row.getInt(12));
  item.put("favorite", Build.VERSION.SDK_INT >= 30 && row.getInt(15) == 1);
  item.put("owned", Build.VERSION.SDK_INT >= 30 && getContext().getPackageName().equals(row.getString(16)));
  return item;
 }

 private static Uri uri(boolean video, long rowId) {
  return ContentUris.withAppendedId(video ? MediaStore.Video.Media.EXTERNAL_CONTENT_URI : MediaStore.Images.Media.EXTERNAL_CONTENT_URI, rowId);
 }

 private String thumbnail(boolean video, long rowId, int size) throws Exception {
  Bitmap bitmap = getContext().getContentResolver().loadThumbnail(uri(video, rowId), new Size(size, size), null);
  try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
   if (!bitmap.compress(Bitmap.CompressFormat.JPEG, 80, output)) throw new IllegalStateException();
   return "data:image/jpeg;base64," + Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP);
  } finally { bitmap.recycle(); }
 }

 /** Refuses reads with no grant or while the device is locked. */
 private boolean readable(PluginCall call) {
  if ("denied".equals(scopeName())) { call.reject("Photo library access is not allowed", "LIBRARY_DENIED"); return false; }
  if (locked()) { call.reject("Unlock the phone to use the device library", "LIBRARY_LOCKED"); return false; }
  return true;
 }

 private Cursor exact(PhotoLibraryAccess.Parsed parsed) {
  Bundle query = new Bundle();
  String selection = BASE + " AND _id=? AND media_type=?";
  query.putString(ContentResolver.QUERY_ARG_SQL_SELECTION, selection);
  query.putStringArray(ContentResolver.QUERY_ARG_SQL_SELECTION_ARGS, new String[] {Long.toString(parsed.rowId), parsed.video ? "3" : "1"});
  if (Build.VERSION.SDK_INT >= 30) query.putInt(MediaStore.QUERY_ARG_MATCH_TRASHED, MediaStore.MATCH_INCLUDE);
  return getContext().getContentResolver().query(CATALOG, fields(), query, null);
 }

 /** The exact row for an identity, or null when it is gone or its row id was reused. */
 private JSObject current(String key) {
  PhotoLibraryAccess.Parsed parsed = PhotoLibraryAccess.parse(key);
  try (Cursor row = exact(parsed)) {
   if (row == null || !row.moveToFirst() || added(row) != parsed.added) return null;
   JSObject item = metadata(row);
   item.put("trashed", Build.VERSION.SDK_INT >= 30 && isTrashed(row));
   return item;
  }
 }

 private static boolean isTrashed(Cursor row) {
  return Build.VERSION.SDK_INT >= 30 && row.getInt(17) == 1;
 }

 /** Newest first, keyset on the MediaStore id so pages never repeat or skip rows under inserts. */
 @PluginMethod public void page(PluginCall call) {
  submit(call, () -> {
   if (!readable(call)) return;
   try {
    int limit = PhotoLibraryAccess.pageLimit(call.getInt("limit", 0));
    boolean thumbs = call.getBoolean("thumbnails", false) && limit <= PhotoLibraryAccess.THUMBNAIL_ROWS_MAX;
    int size = PhotoLibraryAccess.thumbnailSize(call.getInt("thumbnailSize", 0));
    String before = call.getString("before", "");
    long cursor = before.isEmpty() ? Long.MAX_VALUE : Long.parseLong(before);
    if (cursor <= 0) throw new IllegalArgumentException();
    StringBuilder selection = new StringBuilder(BASE + " AND _id<?");
    List<String> args = new ArrayList<>();
    args.add(Long.toString(cursor));
    String kind = call.getString("kind", "all");
    if ("image".equals(kind)) selection.append(" AND media_type=1");
    else if ("video".equals(kind)) selection.append(" AND media_type=3");
    else if (!"all".equals(kind)) throw new IllegalArgumentException();
    String text = call.getString("query", "");
    if (!text.trim().isEmpty()) {
     selection.append(" AND (" + MediaStore.MediaColumns.DISPLAY_NAME + " LIKE ? ESCAPE '\\' OR " + MediaStore.MediaColumns.BUCKET_DISPLAY_NAME + " LIKE ? ESCAPE '\\')");
     String like = PhotoLibraryAccess.like(text);
     args.add(like); args.add(like);
    }
    Long from = call.getLong("from"), to = call.getLong("to");
    if (from != null) { selection.append(" AND " + MediaStore.MediaColumns.DATE_ADDED + ">=?"); args.add(Long.toString(from / 1000)); }
    if (to != null) { selection.append(" AND " + MediaStore.MediaColumns.DATE_ADDED + "<?"); args.add(Long.toString((to + 999) / 1000)); }
    if (call.getBoolean("favorites", false)) {
     if (Build.VERSION.SDK_INT < 30) throw new IllegalArgumentException();
     selection.append(" AND is_favorite=1");
    }
    Bundle query = new Bundle();
    query.putString(ContentResolver.QUERY_ARG_SQL_SELECTION, selection.toString());
    query.putStringArray(ContentResolver.QUERY_ARG_SQL_SELECTION_ARGS, args.toArray(new String[0]));
    query.putStringArray(ContentResolver.QUERY_ARG_SORT_COLUMNS, new String[] {MediaStore.MediaColumns._ID});
    query.putInt(ContentResolver.QUERY_ARG_SORT_DIRECTION, ContentResolver.QUERY_SORT_DIRECTION_DESCENDING);
    query.putInt(ContentResolver.QUERY_ARG_LIMIT, limit + 1);
    JSArray items = new JSArray();
    String next = "";
    long last = 0;
    try (Cursor rows = getContext().getContentResolver().query(CATALOG, fields(), query, null)) {
     if (rows == null) throw new IllegalStateException();
     while (rows.moveToNext()) {
      if (destroyed) throw new IllegalStateException();
      if (items.length() == limit) { next = Long.toString(last); break; }
      JSObject item = metadata(rows);
      last = rows.getLong(0);
      if (thumbs) { try { item.put("image", thumbnail(video(rows), last, size)); } catch (Exception unavailable) { item.put("image", ""); } }
      items.put(item);
     }
    }
    JSObject out = scopeResult();
    out.put("items", items);
    out.put("next", next);
    out.put("generation", maxGeneration());
    call.resolve(out);
   } catch (IllegalArgumentException invalid) {
    call.reject("Invalid library query");
   } catch (Exception failure) {
    call.reject("The device library could not be read");
   }
  });
 }

 private long maxGeneration() {
  if (Build.VERSION.SDK_INT < 30) return 0;
  Bundle query = new Bundle();
  query.putString(ContentResolver.QUERY_ARG_SQL_SELECTION, BASE);
  query.putStringArray(ContentResolver.QUERY_ARG_SORT_COLUMNS, new String[] {MediaStore.MediaColumns.GENERATION_MODIFIED});
  query.putInt(ContentResolver.QUERY_ARG_SORT_DIRECTION, ContentResolver.QUERY_SORT_DIRECTION_DESCENDING);
  query.putInt(ContentResolver.QUERY_ARG_LIMIT, 1);
  query.putInt(MediaStore.QUERY_ARG_MATCH_TRASHED, MediaStore.MATCH_INCLUDE);
  try (Cursor row = getContext().getContentResolver().query(CATALOG, new String[] {MediaStore.MediaColumns.GENERATION_MODIFIED}, query, null)) {
   return row != null && row.moveToFirst() ? row.getLong(0) : 0;
  }
 }

 /** Inspect one item: current metadata and a bounded local preview. Pixels stay on the phone. */
 @PluginMethod public void inspect(PluginCall call) {
  submit(call, () -> {
   if (!readable(call)) return;
   try {
    JSObject item = current(call.getString("id", ""));
    if (item == null || item.getBoolean("trashed", false)) { call.reject("This item is no longer in the library", "LIBRARY_MISSING"); return; }
    PhotoLibraryAccess.Parsed parsed = PhotoLibraryAccess.parse(item.getString("id"));
    try { item.put("image", thumbnail(parsed.video, parsed.rowId, Math.min(PhotoLibraryAccess.PREVIEW_MAX, Math.max(64, call.getInt("size", 720))))); }
    catch (Exception unavailable) { item.put("image", ""); }
    call.resolve(item);
   } catch (IllegalArgumentException invalid) {
    call.reject("Invalid library id");
   } catch (Exception failure) {
    call.reject("This item could not be read");
   }
  });
 }

 /** Revalidate known identities: current, changed (new revision), or missing (deleted, trashed,
  * revoked from a selected-only grant, or row id reused). */
 @PluginMethod public void validate(PluginCall call) {
  submit(call, () -> {
   if (!readable(call)) return;
   try {
    JSArray items = call.getArray("items");
    if (items == null || items.length() < 1 || items.length() > PhotoLibraryAccess.VALIDATE_MAX) throw new IllegalArgumentException();
    JSArray out = new JSArray();
    for (int i = 0; i < items.length(); i++) {
     org.json.JSONObject item = items.getJSONObject(i);
     String key = item.getString("id");
     JSObject now = current(key);
     JSObject result = new JSObject();
     result.put("id", key);
     if (now == null || now.getBoolean("trashed", false)) result.put("status", "missing");
     else if (!now.getString("revision").equals(item.optString("revision"))) { result.put("status", "changed"); now.remove("trashed"); result.put("item", now); }
     else result.put("status", "current");
     out.put(result);
    }
    JSObject result = scopeResult();
    result.put("items", out);
    call.resolve(result);
   } catch (Exception invalid) {
    call.reject("Select 1–200 library ids to validate");
   }
  });
 }

 /** Rows changed since a generation (Android 11+). A different MediaStore version or a large
  * backlog asks the renderer to reset its catalog instead of guessing. */
 @PluginMethod public void changes(PluginCall call) {
  submit(call, () -> {
   if (!readable(call)) return;
   JSObject out = scopeResult();
   try {
    String version = call.getString("version", "");
    long since = call.getLong("generation", -1L);
    if (Build.VERSION.SDK_INT < 30 || since < 0 || !version.equals(MediaStore.getVersion(getContext()))) {
     out.put("reset", true); out.put("items", new JSArray()); out.put("generation", maxGeneration()); call.resolve(out); return;
    }
    Bundle query = new Bundle();
    query.putString(ContentResolver.QUERY_ARG_SQL_SELECTION, BASE + " AND generation_modified>?");
    query.putStringArray(ContentResolver.QUERY_ARG_SQL_SELECTION_ARGS, new String[] {Long.toString(since)});
    query.putStringArray(ContentResolver.QUERY_ARG_SORT_COLUMNS, new String[] {MediaStore.MediaColumns.GENERATION_MODIFIED});
    query.putInt(ContentResolver.QUERY_ARG_SORT_DIRECTION, ContentResolver.QUERY_SORT_DIRECTION_ASCENDING);
    query.putInt(ContentResolver.QUERY_ARG_LIMIT, PhotoLibraryAccess.CHANGES_MAX + 1);
    query.putInt(MediaStore.QUERY_ARG_MATCH_TRASHED, MediaStore.MATCH_INCLUDE);
    JSArray items = new JSArray();
    long generation = since;
    boolean reset = false;
    try (Cursor rows = getContext().getContentResolver().query(CATALOG, fields(), query, null)) {
     if (rows == null) throw new IllegalStateException();
     while (rows.moveToNext()) {
      if (items.length() == PhotoLibraryAccess.CHANGES_MAX) { reset = true; break; }
      JSObject item = metadata(rows);
      item.put("trashed", isTrashed(rows));
      generation = Math.max(generation, generation(rows));
      items.put(item);
     }
    }
    out.put("reset", reset);
    out.put("items", reset ? new JSArray() : items);
    out.put("generation", reset ? maxGeneration() : generation);
    call.resolve(out);
   } catch (Exception failure) {
    call.reject("Library changes could not be read");
   }
  });
 }

 private List<Uri> currentUris(JSArray items, Set<String> unique) throws Exception {
  if (items == null || items.length() < 1 || items.length() > PhotoLibraryAccess.ACTION_MAX) throw new IllegalArgumentException();
  List<Uri> uris = new ArrayList<>();
  for (int i = 0; i < items.length(); i++) {
   org.json.JSONObject item = items.getJSONObject(i);
   String key = item.getString("id");
   if (!unique.add(key)) throw new IllegalArgumentException();
   JSObject now = current(key);
   // Every item must still be exactly what the owner reviewed; a stale item rejects the whole set.
   if (now == null || !now.getString("revision").equals(item.optString("revision"))) throw new IllegalStateException("stale");
   PhotoLibraryAccess.Parsed parsed = PhotoLibraryAccess.parse(key);
   uris.add(uri(parsed.video, parsed.rowId));
  }
  return uris;
 }

 /**
  * Favorite, unfavorite, trash, restore or delete through Android's confirmation dialog.
  * The result reports only what a fresh read verifies afterwards.
  */
 @PluginMethod public void requestChange(PluginCall call) {
  submit(call, () -> {
   if (!readable(call)) return;
   if (Build.VERSION.SDK_INT < 30) { call.reject("Changing device media requires Android 11 or later", "LIBRARY_UNSUPPORTED"); return; }
   String operation = call.getString("operation", "");
   if (!PhotoLibraryAccess.supportedChange(operation)) { call.reject("Unsupported library change"); return; }
   try {
    JSArray items = call.getArray("items");
    List<Uri> uris = currentUris(items, new HashSet<>());
    ContentResolver resolver = getContext().getContentResolver();
    PendingIntent intent;
    switch (operation) {
     case "favorite": intent = MediaStore.createFavoriteRequest(resolver, uris, true); break;
     case "unfavorite": intent = MediaStore.createFavoriteRequest(resolver, uris, false); break;
     case "trash": intent = MediaStore.createTrashRequest(resolver, uris, true); break;
     case "restore": intent = MediaStore.createTrashRequest(resolver, uris, false); break;
     default: intent = MediaStore.createDeleteRequest(resolver, uris); break;
    }
    getActivity().runOnUiThread(() -> {
     if (destroyed || pendingReview != null) { call.reject("Finish the open Android review first"); return; }
     pendingReview = call; pendingItems = items; pendingOperation = operation;
     try { review.launch(new IntentSenderRequest.Builder(intent.getIntentSender()).build()); }
     catch (RuntimeException failure) { pendingReview = null; pendingItems = null; call.reject("Android review could not open"); }
    });
   } catch (IllegalStateException stale) {
    call.reject("A selected item changed or is gone. Reload the library and review again.", "LIBRARY_STALE");
   } catch (Exception invalid) {
    call.reject("Select 1–20 distinct current library items");
   }
  });
 }

 private void reviewed(ActivityResult result) {
  PluginCall call = pendingReview;
  JSArray items = pendingItems;
  String operation = pendingOperation;
  pendingReview = null; pendingItems = null; pendingOperation = "";
  if (call == null) return;
  if (result.getResultCode() != android.app.Activity.RESULT_OK) {
   JSObject out = new JSObject(); out.put("status", "declined"); out.put("operation", operation); call.resolve(out); return;
  }
  submit(call, () -> {
   try {
    // Report each item's verified state, never the request as a whole.
    JSArray outcomes = new JSArray();
    int verified = 0;
    for (int i = 0; i < items.length(); i++) {
     String key = items.getJSONObject(i).getString("id");
     JSObject now = current(key);
     boolean ok;
     switch (operation) {
      case "favorite": ok = now != null && now.getBoolean("favorite", false); break;
      case "unfavorite": ok = now != null && !now.getBoolean("favorite", true); break;
      case "trash": ok = now == null || now.getBoolean("trashed", false); break;
      case "restore": ok = now != null && !now.getBoolean("trashed", true); break;
      default: ok = now == null; break;
     }
     JSObject outcome = new JSObject();
     outcome.put("id", key);
     outcome.put("status", ok ? "verified" : "unverified");
     if (ok) verified++;
     outcomes.put(outcome);
    }
    JSObject out = new JSObject();
    out.put("status", verified == items.length() ? "applied" : verified == 0 ? "unverified" : "partial");
    out.put("operation", operation);
    out.put("outcomes", outcomes);
    call.resolve(out);
   } catch (Exception failure) {
    call.reject("The change could not be verified. Reload the library before retrying.");
   }
  });
 }

 /** Android's chooser with read-only grants for exactly the reviewed items. Opening the chooser
  * is not a delivery receipt. */
 @PluginMethod public void share(PluginCall call) {
  submit(call, () -> {
   if (!readable(call)) return;
   try {
    List<Uri> uris = currentUris(call.getArray("items"), new HashSet<>());
    ContentResolver resolver = getContext().getContentResolver();
    String mime = null;
    for (Uri uri : uris) {
     String type = resolver.getType(uri);
     if (type == null) type = "application/octet-stream";
     mime = mime == null ? type : mime.equals(type) ? mime : mime.startsWith("image/") && type.startsWith("image/") ? "image/*" : mime.startsWith("video/") && type.startsWith("video/") ? "video/*" : "*/*";
    }
    Intent send = uris.size() == 1
     ? new Intent(Intent.ACTION_SEND).putExtra(Intent.EXTRA_STREAM, uris.get(0))
     : new Intent(Intent.ACTION_SEND_MULTIPLE).putParcelableArrayListExtra(Intent.EXTRA_STREAM, new ArrayList<>(uris));
    send.setType(mime).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
    ClipData clip = ClipData.newRawUri("Selected media", uris.get(0));
    for (int i = 1; i < uris.size(); i++) clip.addItem(new ClipData.Item(uris.get(i)));
    send.setClipData(clip);
    int count = uris.size();
    getActivity().runOnUiThread(() -> {
     if (destroyed || getActivity().isFinishing()) { call.reject("Return to Photos and share again"); return; }
     try {
      getActivity().startActivity(Intent.createChooser(send, "Share selected media"));
      JSObject out = new JSObject(); out.put("status", "opened"); out.put("count", count); call.resolve(out);
     } catch (RuntimeException failure) { call.reject("Android sharing could not open"); }
    });
   } catch (IllegalStateException stale) {
    call.reject("A selected item changed or is gone. Reload the library and review again.", "LIBRARY_STALE");
   } catch (Exception invalid) {
    call.reject("Select 1–20 distinct current library items");
   }
  });
 }

 @Override protected void handleOnDestroy() {
  destroyed = true;
  main.removeCallbacks(changed);
  if (observer != null) getContext().getContentResolver().unregisterContentObserver(observer);
  PluginCall call = pendingReview;
  pendingReview = null;
  if (call != null) call.reject("Photos closed before Android's review finished. Reload the library to see the current state.");
  worker.shutdown();
 }
}
