package ai.elizaresearch.alphaphone;

import ai.eliza.plugins.passwords.PasswordFormPolicy;
import ai.eliza.plugins.passwords.PasswordFormPolicy.Node;

/**
 * Plain-JVM check (issue #404) that the HTTP authentication prompt's origin rule and the
 * field shape Alpha reports (BrowserHttpAuthAutofill) are accepted by the pinned upstream
 * PasswordFormPolicy for exactly the verified origin, and refused for wrong origins, frames,
 * missing field origins and an untrusted host. It does not run Android, a provider, a vault
 * or a device.
 */
public final class LoginBindingTest {
 static final String HOST = "ai.elizaresearch.alphaphone";
 static final int CLASS_TEXT = 1, TEXT_PASSWORD = 0x80, TEXT_VISIBLE_PASSWORD = 0x90, FLAG_NO_SUGGESTIONS = 0x80000;
 static int checks = 0;

 static void eq(Object expected, Object actual, String what) {
  if (expected == null ? actual != null : !expected.equals(actual)) throw new AssertionError(what + ": expected " + expected + " got " + actual);
  checks++;
 }

 /** Mirrors BrowserHttpAuthAutofill.field(...) plus OriginField.onProvideAutofillStructure. */
 static Node field(String origin, boolean password, int id, String value) {
  Node node = new Node();
  node.id = "f" + id; node.text = true; node.visible = true; node.focused = password;
  node.inputType = CLASS_TEXT | (password ? TEXT_PASSWORD : FLAG_NO_SUGGESTIONS);
  node.hints = java.util.List.of(password ? "password" : "username");
  if (origin != null) {
   // ViewStructure.setWebDomain(origin) stores scheme and host; the port travels in the extras.
   java.net.URI uri = java.net.URI.create(origin);
   node.webDomain = uri.getHost(); node.webScheme = uri.getScheme();
   node.topOrigin = origin; node.fieldOrigin = origin;
  }
  node.value = value;
  return node;
 }

 static Node prompt(String origin, String user, String pass) {
  Node root = new Node(); // the dialog window: title and message are not text fields
  Node title = new Node(); title.id = "title"; root.add(title);
  root.add(field(origin, false, 1, user)).add(field(origin, true, 2, pass));
  return root;
 }

 static String rejected(Node root, String pkg, boolean hostIsBrowser, boolean forSave) {
  try { PasswordFormPolicy.evaluate(pkg, HOST, hostIsBrowser, root, p -> false, forSave); return null; }
  catch (PasswordFormPolicy.Rejected r) { return r.getMessage(); }
 }

 public static void main(String[] args) throws Exception {
  // --- Origin rule for the challenge ---
  eq("https://example.com", BrowserHttpAuthOrigin.forChallenge("example.com", "https://example.com/login", null), "committed page");
  eq("https://example.com:8443", BrowserHttpAuthOrigin.forChallenge("example.com:8443", "https://example.com:8443/a"), "explicit port");
  eq("https://example.com", BrowserHttpAuthOrigin.forChallenge("example.com:443", "https://Example.com/a"), "default port normalised");
  eq(null, BrowserHttpAuthOrigin.forChallenge("example.com:8443", "https://example.com/a"), "reported port contradicts page");
  eq(null, BrowserHttpAuthOrigin.forChallenge("example.com", "https://example.com/a", "https://example.com:8443/b"), "redirect to another port");
  eq(null, BrowserHttpAuthOrigin.forChallenge("example.com", "http://example.com/a"), "cleartext page");
  eq(null, BrowserHttpAuthOrigin.forChallenge("example.com", "https://example.com/a", "http://example.com/b"), "redirect to cleartext");
  eq("https://example.com", BrowserHttpAuthOrigin.forChallenge("example.com", "https://other.example/a", "https://example.com/b"), "only the matching pending redirect counts");
  eq(null, BrowserHttpAuthOrigin.forChallenge("example.com", "https://other.example/a"), "no page for this host");
  eq(null, BrowserHttpAuthOrigin.forChallenge("example.com", "https://user:pw@example.com/a"), "user info");
  eq(null, BrowserHttpAuthOrigin.forChallenge("", "https://example.com/"), "missing host");
  eq(null, BrowserHttpAuthOrigin.forChallenge("accounts.example.com", "https://example.com/"), "subdomain is a different binding");

  // --- Shared upstream policy with Alpha's field shape ---
  String origin = "https://example.com:8443";
  PasswordFormPolicy.Target fill = PasswordFormPolicy.evaluate(HOST, HOST, true, prompt(origin, null, null), p -> false, false);
  eq(origin, fill.webOrigin, "fill binds to the exact origin, port included");
  eq(null, fill.appPackage, "never bound to Alpha's app identity");
  eq("f1", fill.usernameId, "username field");
  eq("f2", fill.passwordId, "password field");
  PasswordFormPolicy.Target save = PasswordFormPolicy.evaluate(HOST, HOST, true, prompt(origin, "ada", "s3cret"), p -> false, true);
  eq(origin, save.webOrigin, "save binds to the same origin");

  eq("Host interface is never filled", rejected(prompt(null, null, null), HOST, true, false), "no origin: the prompt is Alpha UI and is refused");
  eq("Untrusted browser", rejected(prompt(origin, null, null), HOST, false, false), "a host that is not a browser");
  eq("Untrusted browser", rejected(prompt(origin, null, null), "com.example.other", true, false), "another package is not trusted");

  Node wrongField = prompt(origin, null, null); wrongField.children.get(2).fieldOrigin = "https://evil.example";
  eq("Cross-origin frame", rejected(wrongField, HOST, true, false), "wrong field origin");
  Node noField = prompt(origin, null, null); noField.children.get(2).fieldOrigin = null;
  eq("Field origin unavailable", rejected(noField, HOST, true, false), "missing field origin");
  Node frame = prompt(origin, null, null); frame.children.get(1).webDomain = "evil.example";
  eq("Cross-origin frame", rejected(frame, HOST, true, false), "a second domain");
  Node wrongTop = prompt(origin, null, null); for (Node n : wrongTop.children) if (n.topOrigin != null) n.topOrigin = "https://evil.example";
  eq("Cross-origin frame", rejected(wrongTop, HOST, true, false), "top-level origin of another host");
  Node cleartext = prompt(origin, null, null); for (Node n : cleartext.children) if (n.webScheme != null) n.webScheme = "http";
  eq("Insecure origin", rejected(cleartext, HOST, true, false), "cleartext scheme");

  // The previous username input type (VISIBLE_PASSWORD) would have made the form ambiguous.
  Node legacy = prompt(origin, null, null); legacy.children.get(1).inputType = CLASS_TEXT | TEXT_VISIBLE_PASSWORD;
  eq("Ambiguous password fields", rejected(legacy, HOST, true, false), "legacy username type");

  System.out.println("PASS login binding " + checks);
 }
}
