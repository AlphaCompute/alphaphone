# Browser continuity and durable bookmarks

The browser retains tabs, selected tab, in-memory history and bookmark state across view resets. These keys are only renderer memory; they are not a disk session restore. Overlays still reset and native surfaces still hide on departure.

Explicit user bookmarks use the existing menu/library without new chrome. Native Android stores at most 100 unique HTTPS URLs (4096 characters each) encrypted with AES-GCM and an Android Keystore key. Embedded credentials, whitespace/control characters and non-HTTPS schemes are rejected. Bookmark changes are serialized and the renderer changes only after native commit succeeds. Failed decryption or writes preserve the existing ciphertext and report failure instead of silently replacing it. The store contains no page content, form data, history, cookies or credentials. URLs are not sent to the agent. The native child website has no app bridge. Bookmark URLs can themselves contain private query parameters, which is why plaintext preferences are not used.

Cold startup restores only explicit bookmarks. It opens one empty tab; no saved website or history is loaded automatically. Tab profiles currently retain their ephemeral isolation lifecycle; the October 7 owner decision replaces this with a persistent sign-in profile plus an explicit ephemeral private tab ([decisions](decisions.md#october-7-owner-product-decisions), item 12). There is no account synchronization, vault credential storage or automatic page summarization.

`BrowserContinuityInstrumentedTest#tabsSurviveAppNavigationAndBookmarksSurviveActivityRecreation` exercises two actual HTTPS WebViews with independent storage, native back/forward, app switching, user bookmark creation/navigation/removal, native ciphertext readback and Activity recreation. This test is not process-death evidence.

`node scripts/test-native-restart.mjs bookmark APP.apk MATCHING_TEST.apk OUTPUT` with the [owned-emulator configuration](verification.md) runs `bookmarkProcessRestartPhase` in separate instrumentation processes. It saves a UUID-scoped bookmark through the real UI, force-stops the app, requires a different PID, verifies no automatic native page and a restored library entry, explicitly opens that bookmark, removes it through the UI, then force-stops again and verifies removal in another PID. Cleanup removes only its recorded synthetic URL; all other bookmarks are preserved. APK hashes and phase outcomes are archived. Require both distributions to pass prepare, verify in a new PID, verifyRemoved in another PID, and scoped cleanup. The shared upstream lifecycle verifies archived/installed APKs and uses a fresh secondary Android user, retaining it if termination or cleanup is uncertain.

## Android provider capability

Native browser creation requires `WebViewFeature.DELETE_BROWSING_DATA` for
profile-scoped browsing-data purging. Detect the feature at runtime rather than
assuming support from an Android API or WebView version. Production requires a
maintained, trusted WebView provider and its update policy. A development emulator
provider or a successful APK build does not qualify the shipping provider.
