package ai.elizaresearch.alphaphone;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/**
 * Shared callback contract (test/fixtures/alphaphone-auth-callback-contract.json, the same file in
 * elizaOS/eliza): every vector goes through CloudSignInFlow.parseCallback. test/cloud-sign-in-flow.test.mjs
 * flattens the JSON into tab-separated lines (no JSON library on this plain JVM):
 * case<TAB>environment<TAB>expect<TAB>url<TAB>code<TAB>state<TAB>error, and authorize<TAB>name<TAB>value.
 */
public final class CloudSignInContractTest {
 public static void main(String[] args) throws Exception {
  List<String> lines = Files.readAllLines(Path.of(args[0]));
  int checks = 0;
  String state = CloudSignInFlow.newState(), challenge = CloudSignInFlow.s256(CloudSignInFlow.newVerifier());
  String query = new java.net.URI(CloudSignInFlow.authorizeUrl(CloudSignInFlow.Environment.PRODUCTION, challenge, state)).getRawQuery();
  for (String line : lines) {
   String[] f = line.split("\t", -1);
   if ("authorize".equals(f[0])) {
    if (!("&" + query + "&").contains("&" + f[1] + "=" + f[2] + "&")) throw new AssertionError("authorize URL lacks " + f[1] + "=" + f[2]);
    checks++; continue;
   }
   CloudSignInFlow.Environment environment = "staging".equals(f[1]) ? CloudSignInFlow.Environment.STAGING : CloudSignInFlow.Environment.PRODUCTION;
   CloudSignInFlow.Callback parsed = CloudSignInFlow.parseCallback(f[3], environment);
   String actual = parsed == null ? "reject" : parsed.kind == CloudSignInFlow.ReturnKind.SUCCESS ? "success" : parsed.kind == CloudSignInFlow.ReturnKind.ERROR ? "error" : "return";
   if (!f[2].equals(actual)) throw new AssertionError("expected " + f[2] + ", got " + actual + ": " + f[3]);
   if ("success".equals(actual) && !(f[4].equals(parsed.code) && f[5].equals(parsed.state) && parsed.error == null)) throw new AssertionError("success values: " + f[3]);
   if ("error".equals(actual) && !(f[6].equals(parsed.error) && f[5].equals(parsed.state) && parsed.code == null)) throw new AssertionError("error values: " + f[3]);
   if ("return".equals(actual) && (parsed.code != null || parsed.state != null || parsed.error != null)) throw new AssertionError("a return carries nothing: " + f[3]);
   checks++;
  }
  System.out.println("PASS callback contract (" + checks + " vectors)");
 }
}
