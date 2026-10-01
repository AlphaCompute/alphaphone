# Native content behind the prototype browser

Current implementation, 2026-09-29: the Alpha browser renders real public websites in isolated native child WebViews under the prototype chrome. Build 20 passed native HTTPS/history/tab-isolation and controlled stop/reload flows in both variants. Manual Google search later redirected to a traffic-check URL and did not reach results; that is not a search pass. Build 21 preserves HTTP response documents (including error explanations and retry links) instead of replacing them with a generic native error, and tightens the search test to require the actual `/search` page. Build 21 verified HTTP response/retry links but exposed a completion-order loading defect. Build 22 fixed that defect and passed HTTPS/history/isolation and HTTP recovery in both variants; Google search remains failed because it returned its traffic challenge. Computer Use confirmed the challenge body is visible. TLS and transport failures still stop navigation. See [the verification ledger](flow-verification.md) for current results.

The sections below retain the original design proposal and remaining acceptance requirements. The authoritative visual target is [the Alpha Phone prototype](https://alpha-phone-prototype.pages.dev/). The implementation uses the product-owned `AlphaBrowserPlugin`; no pinned upstream source was edited.

## Recommended first implementation

Keep the exact Alpha address bar, back/forward buttons, tab switcher, menu, library, and assistant chrome. Replace only the web-document viewport with a separate native Android WebView, using the existing upstream `plugin-native-browser-surface` ownership and geometry machinery. Register the Capacitor plugin only in Alpha's trusted local host. Never navigate that host WebView to a remote site, attach its bridge to a child WebView, or use an iframe as an isolation substitute.

This delivers a tractable real flow: enter an HTTPS address → load actual content → follow a link → back/forward/reload → open/switch/close tabs → return from another Alpha app. It does not supply the complete Chromium application, browser profile, extensions, password sync, or general agent automation. An owned Chromium distribution and its signed native bridge remain the longer-term full-browser path described in [native capability research](native-capability-research.md) and `vendor/eliza/packages/os/browser/README.md`. An official development Chromium APK does not contain that bridge.

## Exact presentation boundary

`apps/app/src/prototype/template.html` has a browser root with address controls, optional assistant activity strip, and `[data-bscroll="1"]` document viewport. `model.js` renders `host`, `path`, `hasLock`, `backOp`, `fwdOp`, `goBack`, `goFwd`, `nTabs`, `tabCards`, address editing, menu, bookmarks and history. Its `brPage` fixture maps known URLs to invented news/enclave/booking pages. Its `hist`/`pos` arrays and timer-driven booking are simulation, not browser history or confirmation evidence.

Add one viewport reference/binding without altering the reference geometry. In production, hide fixture page bodies when a native document is selected; new-tab/error/status surfaces remain host UI. Map existing controls to the native controller. Fixture mode retains all original bodies, seeds, timing, and visual comparisons. Native content receives the physical bounds of the actual viewport, not a hardcoded 412-pixel design rectangle.

Browser metadata must come from the selected native tab. Do not derive the address, lock, back availability or document title from the submitted string or the fixture URL table. Keep the full final origin inspectable even when the existing address display truncates it. A lock must not appear before a successful secure navigation or for an error page. Remote content must never paint over or receive touches in the address/assistant chrome.

## What the upstream plugin already supplies

Reviewed sources: `vendor/eliza/plugins/plugin-native-browser-surface/src/definitions.ts`, its Android `BrowserSurfacePlugin.kt`, `ChromiumBrowserLauncher.kt`, and `ChromiumBrowserIdentity.java`.

| Existing contract | Reuse and qualification |
| --- | --- |
| `owner`, `session`, monotonically managed `epoch` | Every operation is scoped to the active owner/session. Preserve stale-owner rejection on async callbacks and teardown. |
| `createSurface(id, process, storage, url?)` | Explicit policies; isolated Android rendering requires a supported out-of-app renderer. It does not guarantee a dedicated OS process per tab. |
| Isolated storage through AndroidX profiles | `MULTI_PROFILE` support is required; unsupported providers fail closed. Do not silently use the host's default profile. Existing per-surface profiles also mean login state is not automatically shared between tabs. |
| `setBounds`, rounded `outerClip`, `setOcclusionRects` | Existing native container clips content and routes touch around host overlays. Verify coordinate conversion and hit testing on the actual phone. |
| `presentSurface`, `reconcileOwner`, `destroySurface` | Present only the current document; reconcile desired IDs and release retired profiles according to existing cleanup rules. |
| `navigate`, `reloadSurface`, `goBack`, state/list APIs | Useful baseline. Current `navigate` calls `loadUrl` directly; enforce scheme/origin policy natively as well as in JavaScript. |
| `navigationChanged` and page-revision checking | Current completion event identifies the surface/owner/session/epoch; enrich state rather than assuming it contains all browser metadata. |
| `readPage` | Fixed native reader with timeout and rejection after navigation/owner changes or when hidden/loading/failed. Do not expose arbitrary JavaScript evaluation as a product API. Sensitive-content review remains required before model transmission. |

The reviewed Kotlin implementation lacks a complete forward/stop/progress/title contract, file chooser client, browser permission prompts, and explicit browser-grade SSL/error/process-recovery handling. It enables JavaScript and storage. Absence of an explicit unsafe SSL override is not evidence that a custom error UX or recovery path is implemented. Existing plugin code is a foundation, not a finished browser. Generic changes must be made through a reviewed upstream commit or explicit tested patch in `patches/eliza`, never by editing the pinned vendor checkout.

## Proposed host API and state

All commands retain `{owner, session, epoch, id}`. Native code validates identity, selected/presented state when appropriate, and input limits. Propose these additions to the upstream interface:

- `goForward`, `stopLoading`; return a new state snapshot after commands, with async state events for subsequent transitions.
- `stateChanged`: `{url, title, canGoBack, canGoForward, loading, progress, pageRevision, error, transportSecurity}` plus identity and event sequence. Reject stale sequences, former tab instances and old epochs. `transportSecurity` is a constrained status, not a certificate-trust claim inferred from a URL string.
- `setBounds`/occlusion remain the geometry API. The product adapter listens to viewport/keyboard/layout changes and sends updates only when geometry changes.
- File chooser and website permission requests are native user prompts with request IDs, requesting origin, resource types and exactly-once resolution/cancellation. Do not return selected file bytes to Alpha JavaScript merely to satisfy an upload.

Native WebView history is authoritative for redirects, same-document navigation, forms, and back/forward. Host persistence stores bounded tab identifiers and final safe URLs/bookmarks/history metadata; it must not serialize fixture `hist` as real history. For the first slice, restart restores tabs as unloaded entries requiring explicit selection; do not silently repeat POSTs or effects. Closing the last tab shows the existing new-tab screen.

First-slice decision: use existing per-tab isolated storage and label its limitations in release acceptance; do not market shared sign-in or private browsing. A shared browser-only profile across normal tabs requires a separate upstream profile-ownership change and tests proving it never aliases the Capacitor host profile. Do not choose `storage: shared` without proving that separation. Production persistence/cookie retention remains a release gate until this decision is implemented deliberately.

## Android policy and lifecycle

**Navigation.** Accept HTTPS URLs without embedded credentials. Plain search text goes to one explicitly configured search provider using URL encoding; do not use `search.example` or silently guess an agent endpoint. For the first slice, reject cleartext HTTP with an actionable error. Apply policy to initial loads, in-page top-level navigations and redirects. Handle external `tel`/`mailto` links only through the existing explicit native handoff policy with a user gesture. Reject `javascript:`, `file:`, `content:`, arbitrary `intent:` and privileged app routes. Browser-created blob/data subresources are distinct from user-entered top-level navigation and need explicit tests. Block popups initially with a clear status; a later `onCreateWindow` implementation must not assume the initiating frame is trustworthy.

**Settings.** Explicitly disable file access, file-URL cross-origin access, universal file access and mixed content. Enable Safe Browsing where supported, retaining platform warnings. Release remote debugging is off. No JavaScript interface, Capacitor transport, app cookie export, service binding or native messaging object exists in the child page. Android's [WebView guidance](https://developer.android.com/develop/ui/views/layout/webapps/webview) describes the distinct client responsibilities; its [unsafe file inclusion guidance](https://developer.android.com/privacy-and-security/risks/webview-unsafe-file-inclusion) explains why file settings and upload handling need explicit controls.

**Errors.** Native SSL errors always cancel; never implement a proceed button or generic retry that bypasses validation. Show the final attempted URL and a safe error state in the existing content region. Distinguish DNS/offline/HTTP main-frame failure from subresource failures. [WebViewClient](https://developer.android.com/reference/android/webkit/WebViewClient) explicitly instructs applications to cancel SSL errors. Do not turn a loading callback into a success receipt.

**Layers and keyboard.** Convert CSS viewport measurements through the host WebView scale and native density exactly once; test with the existing phone-surface transform, display cutouts, keyboard resize and accessibility font size. Hide the native page before showing tabs/address suggestions/library/full assistant or leaving Browser; restore only after correct bounds arrive. For partial overlays, use tested native occlusion rectangles. Native focus must move to the address field while editing and return to the page intentionally. Test taps as well as screenshots: a correct-looking overlay that passes taps through is a failure.

**Back and suspend.** Back first dismisses browser overlays/keyboard, then navigates native history, then returns to Alpha navigation. HOME/background hides the page and follows the selected media/background policy. Use per-WebView lifecycle methods; global `pauseTimers` can affect other WebViews including the host. Cancel pending chooser/permission callbacks on destruction and owner change. A renderer crash destroys the invalid WebView, preserves only safe metadata and offers explicit reload; [Android renderer termination guidance](https://developer.android.com/develop/ui/views/layout/webapps/handle-termination) requires removal/destruction rather than reusing the crashed instance. Never replay a partially submitted form automatically.

## Upload, downloads, credentials and agent boundaries

| Capability | First real implementation / deferred boundary |
| --- | --- |
| Upload | Implement `WebChromeClient.onShowFileChooser` using the system document/photo picker, respecting accepted MIME types and multi-select. Return only user-selected content URIs to that request. Do not accept page-supplied paths, grant broad storage, or reinterpret a requested capture as approval to take a photo. Cancel on navigation/owner change; test picker cancellation and activity recreation. [WebChromeClient reference](https://developer.android.com/reference/android/webkit/WebChromeClient) documents the callback and caller validation responsibilities. |
| Camera/microphone/location requests | Deny until origin-bound prompts and Android runtime permissions are implemented. Browser upload alone does not authorize these resources. Remembered grants need per-origin revocation. |
| Downloads | First slice reports unsupported with an explicit external-browser option. A later download manager path needs filename/MIME validation, user destination, authenticated-cookie handling, progress/cancel and no automatic opening of executable content. |
| Passwords/autofill | Use the OS-selected credential provider, such as Proton Pass, through actual WebView autofill support. Never collect a vault master password or copy credentials into the agent/app model. Test domain matching, save/fill, cancellation and provider lock on the exact Android/WebView/provider versions. Installing a provider does not enable or qualify it. |
| Passkeys | Treat as a separate capability gate. Android documents [Credential Manager WebView integration](https://developer.android.com/identity/sign-in/credential-manager-webview); feature detection and origin validation are required. An integration designed for an app's own relying-party pages is not authorization to expose a credential bridge to arbitrary websites. |
| Cookies | First-party sessions belong only to the browser profile. Set a deliberate third-party-cookie policy, initially blocked; [CookieManager](https://developer.android.com/reference/android/webkit/CookieManager) exposes per-WebView third-party acceptance. Do not assume Chrome and WebView share profiles or credentials. |
| Agent read | User invokes assistance on the selected visible document. Capture a bounded sanitized observation with URL, origin, tab, revision and timestamp; redact input/contenteditable/credential/payment fields and sensitive page content before transmission. A fixed reader still requires auditing: DOM text can contain secrets outside inputs. Page instructions remain untrusted data. |
| Agent write | Defer arbitrary clicking/typing/submission until a versioned observation/action contract and sensitive-action approvals are implemented. Existing booking timers, canned identity and fabricated confirmation remain fixture-only. Initial agent capability can propose a safe URL or summarize a deliberately shared page; report unavailable capabilities truthfully. |

## Implementation order and acceptance

1. Upstream capability/security patch: forward/stop/state, explicit settings/navigation policy, SSL/error/crash handling; verify isolated provider support on the target phone. No silent degraded mode.
2. Product adapter and viewport bridge: retain exact template chrome, remove production fixture document bodies, bind real metadata and tab lifecycle. Keep fixture screenshot suite unchanged.
3. Real device flow: controlled HTTPS page A → link B → back/forward → reload → second tab → switch → close → leave/return; confirm origin and button state throughout. Test large font, keyboard, scroll, native selection and overlays in both themes.
4. Security/lifecycle E2E: disallowed schemes/redirects, invalid certificate, offline reload, popup attempt, malicious page probing app bridge, stale callbacks after close/account switch, renderer death, background/restore, process death with no form replay. Verify host and sibling isolated tab storage do not leak.
5. Upload E2E against an owned test endpoint: choose a uniquely named text fixture using the real picker, verify exact received bytes, cancel without upload, deny access, navigate away while chooser open. No fabricated bridge response.
6. Add deliberate credential-provider and agent-read qualification separately. Test with dedicated test accounts and never record secrets in screenshots/logs. Only then expand capabilities.

Required evidence is source patch SHA, both APK hashes, Android/WebView versions and supported profile/renderer features, phone dimensions, actual UI/video and endpoint traces, and explicit per-case pass/fail. A build, the prototype's deterministic pixel comparison, or the external Chromium handoff test cannot establish this native-content flow. Full AOSP image boot, owned Chromium bridge, production agent authentication, default provider enrollment and physical Pixel10 acceptance remain independent gates.

## Agent tab context

The production browser adapter supplies the agent with an opaque session-scoped tab identity and monotonic document revision. Explicit navigation, native URL changes and new native loading cycles invalidate the previous document revision. Closing or switching a tab updates the selected identity. This does not grant page-content, browsing-history or credential access: no URL or page body is included by this context hook. Source typecheck passed; this addition follows build 10 and needs the next Android acceptance build.

## Search follow-up (not in build 13)

The address bar now resolves submitted plain-text queries through DuckDuckGo HTTPS while retaining direct URL navigation. This is the default product decision for the previously unconnected search flow; the renderer does not send keystrokes as suggestions. URLs containing credentials and unsupported schemes still fail before creating a native page. Search pages use the same isolated native browser profile and have no Capacitor bridge. The provider's supported query URL is documented at https://duckduckgo.com/duckduckgo-help-pages/settings/params . A new Android E2E case loads the real provider after explicit submission and checks the query, HTTPS origin and absent native bridge. That test is not yet built or run. Provider challenges, regional results and result-link traversal remain separate live acceptance checks.

### Search provider qualification, build 14 and next revision

Build 14's real DuckDuckGo search flow failed to reach the provider. Independent host requests reproduced a connection timeout for both `duckduckgo.com` (15 seconds) and `html.duckduckgo.com` (8 seconds), while `example.com` and `www.google.com/search?q=android+calendar+documentation` returned HTTP 200 in under one second. This is network evidence, not a claim that DuckDuckGo is generally unavailable.

The next revision uses Google Search as the explicit-submit default. There is no automatic fallback that forwards a query to a second provider, and no keystroke suggestions/background query traffic. The native address bar displays the actual provider URL. Provider selection in Settings remains a product gap. Google Search still needs the Android flow to pass; host HTTP 200 alone does not qualify search results, CAPTCHA handling, navigation or real-device behavior.
