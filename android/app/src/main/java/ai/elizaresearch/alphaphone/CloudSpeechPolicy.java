package ai.elizaresearch.alphaphone;

import java.io.IOException;

/** Production Cloud speech admission; developer pairing has a separate policy. */
final class CloudSpeechPolicy {
 private CloudSpeechPolicy() {}
 static String host(String profile, boolean mocks, String environment) throws IOException {
  if (!mocks && !"cloud".equals(profile)) throw new IOException("Network speech is not enabled");
  if ("production".equals(environment)) return "api.eliza.app";
  if (mocks && "staging".equals(environment)) return "api-staging.eliza.app";
  throw new IOException("Cloud speech environment is unavailable");
 }
 static void requireTtsProvider(String profile, String provider) throws IOException {
  if ("cloud".equals(profile) && !"cartesia".equals(provider)) throw new IOException("Cartesia speech is unavailable");
 }
}
