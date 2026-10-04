package ai.elizaresearch.alphaphone;

/** Native runtime/provider credentials must never round-trip through the renderer. */
final class RendererCredentialSlots {
 static String requireAllowed(String slot) {
  if(slot==null||slot.isEmpty()||slot.length()>1024||slot.startsWith("resident-results:")||slot.startsWith("local-agent-provider:"))throw new SecurityException("Native-only credential slot");
  return slot;
 }
}
