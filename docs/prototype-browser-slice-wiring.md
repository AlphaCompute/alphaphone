# Public native browser slice: wiring and qualification

Source-only candidate, 2026-09-29. Frontend `npm run typecheck` passed after addition. Android compilation and real surface tests have not run. Do not report navigation acceptance until those pass.

New files:

- `android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaBrowserPlugin.java`
- `apps/app/src/prototype/browser-adapter.ts`

Root integration (shared files intentionally not edited by this task):

1. Add `implementation 'androidx.webkit:webkit:1.11.0'` to app dependencies (matches reviewed upstream plugin default).
2. Register `AlphaBrowserPlugin.class` with MainActivity before bridge creation, like other product plugins. Register it in any independent host Activity that actually renders the full browser, or explicitly disallow browser there.
3. Import `installPrototypeBrowserAdapter` and call it **last inside `if (!fixture)`**, after generic native/data/agent wrappers. This replaces generic external-browser controls and ensures fixture mode is unchanged.
4. Browser adapter sets `nativeControls` and exports `reload`, `stopLoading`, `loading`. The template now exposes Reload and, during loading, Stop in a production-only menu group. Fixture mode does not set `nativeControls`, preserving its original menu.

Behavior: HTTP(S)-only public navigation; strict scheme checks in initial navigation, main-frame interception/override and page-start guard; credential-containing URLs rejected; SSL cancellation; separate per-tab WebView and unique AndroidX profile; renderer capability required; no injected JavaScript interface; actual URL/title/progress/back/forward events; browser-owned history; close/tab switching; pending/loading/error metadata; native content clipped above the unchanged assistant composer. Native pages are hidden for host sheets, address editing, menu, tabs, background and view exit. Native error text occupies the content area only. Profiles are never reused and prior-process profiles are retired at next plugin startup.

Qualification boundaries: only public browsing; HTTP authentication denied, OS autofill disabled, upload/camera/mic/location/popups denied, downloads show unavailable. This does not stop a person manually typing into a website form and does not claim form submission or credential safety qualification. Cookie storage is per tab, not shared login. No agent page read/write interface or production browser credentials integration. HTTP may still fail under the app's existing network-security configuration; do not widen cleartext policy implicitly. No production behavior is based on fixture URL content or booked confirmations. Real bookmarks/history metadata is session-local; no restoration/replay of POST or native sessions.

Required immediate checks: compile both flavors; verify provider supports MULTI_PROFILE/renderer, launch HTTPS, navigate link/back/forward, title/address update, switch/close tabs, show exact menu and agent composer without native view occlusion/touch leakage, keyboard bounds, app background/resume, SSL failure, disallowed redirect, offline reload, process recreation, profile isolation. Native overlay geometry is an integration risk until tested on the phone. A controlled HTTPS endpoint should supply repeatable link/redirect/error fixtures; remote sites alone are insufficient evidence.

Renderer startup: before any remote load, require supported and enabled AndroidX multiprocess mode. The per-WebView renderer handle is checked on `onPageCommitVisible`; page pixels remain hidden until then. This avoids relying on an unstarted WebView handle, without relaxing the isolated-process requirement. See [AndroidX WebViewCompat](https://developer.android.com/reference/androidx/webkit/WebViewCompat). This path still needs device verification.
