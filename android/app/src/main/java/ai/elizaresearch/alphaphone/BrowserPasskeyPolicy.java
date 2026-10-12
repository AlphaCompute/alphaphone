package ai.elizaresearch.alphaphone;

/**
 * Passkeys are outside the MVP (owner decision 2026-10-12, issue #402).
 *
 * <p>Alpha is not a passkey provider, and the browser does not opt WebView into
 * browser-mode WebAuthn. That keeps passkey behaviour deterministic and truthful:
 * a passkey-only sign-in is reported as unsupported instead of working on some
 * WebView/provider combinations and failing silently on others. The user can
 * continue the same page in another installed browser (see
 * {@code AlphaBrowserPlugin#openExternally}), or sign in with a password, which the
 * selected password manager can still save and fill.
 *
 * <p>A later release may route WebAuthn to Android's system credential provider
 * after real browser and image qualification. That follow-up is deliberately a
 * source change to {@link #SYSTEM_PROVIDER_QUALIFIED}, reviewed with its evidence,
 * not a runtime flag or environment variable.
 */
final class BrowserPasskeyPolicy {
 private BrowserPasskeyPolicy(){}

 /** False until the system credential provider follow-up is qualified on a real image. */
 static final boolean SYSTEM_PROVIDER_QUALIFIED=false;

 /** Shown once per install when the first tab opens. It is informational and is not tied to a
  * passkey flow: with WebAuthn off WebView reports no passkey request, and Alpha never scripts
  * the page's own world to watch for one. The browser menu keeps "Open in another browser"
  * labelled for passkey sign-in, so the handoff is available when a site asks for a passkey. */
 static final String UNSUPPORTED_NOTICE=
  "Passkeys are not supported in Alpha's browser. Sign in with a password, or choose Open in another browser from the menu.";

 /** Whether a tab may request browser-mode WebAuthn from WebView. */
 static boolean requestBrowserWebAuthentication(){ return SYSTEM_PROVIDER_QUALIFIED; }
}
