# Password manager and provider setup

Settings → Password manager (also opened from the Browser menu) now has two parts: Alpha's own
**integrated password manager**, built on the shared upstream `plugin-native-passwords` plugin,
and **Other password providers**, the existing Proton Pass setup/status flow. Both remain
available; Android lets the user select exactly one Autofill provider.

## Integrated password manager

Implementation: upstream candidate `patches/eliza/password-manager.patch` (see
[patches/eliza/README.md](../patches/eliza/README.md)), materialized outside `vendor/eliza` into
`.eliza/patched` by `npm run upstream:prepare-client`. Alpha owns only identity and policy:
`android/app/src/main/res/values/eliza_passwords.xml` (vault directory `passwords` under the
no-backup directory, Keystore alias and AAD `alpha.passwords.vault.v1`, 60 s unlock window,
biometric allowed, host is a browser), the service declaration in `AndroidManifest.xml`,
`PasswordsPlugin` registration in `MainActivity`, the top-level-origin extra in
`AlphaBrowserPlugin.CredentialWebView`, and the renderer screens in `apps/app/src/passwords`.

| Capability | Behavior |
| --- | --- |
| Unlock | Platform BiometricPrompt: strong biometric or the device credential. Requires a secure screen lock. The Keystore key itself requires user authentication within the 60 s window and an unlocked device; an in-process grant (also ≤60 s) must exist too. Leaving the password pages, backgrounding Alpha or stopping the Activity locks. |
| List and search | Metadata only: name, username, bindings (website host or app label), update time. Search is local over that metadata. |
| Add, edit, delete | Name, username, one or more exact HTTPS websites (`https://host[:port]`), and a typed (write-only) or natively generated password. App bindings come only from a save capture and can be kept or removed, not hand-entered. Delete needs a second tap. |
| Generate | Native `SecureRandom`, 16/20/32 characters, every character class present, ambiguous glyphs excluded. The value is stored directly and never returned to the renderer. |
| Show and copy | Native only. Show opens a FLAG_SECURE dialog that hides after 30 s or when Alpha stops. Copy marks the clip sensitive and clears it after 45 s if it is still Alpha's clip. |
| Set as autofill service | Opens Android's own confirmation (`Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE` for Alpha's package, falling back to Settings). The status row reports only what `AutofillManager#getAutofillServiceComponentName` reads back on refresh or resume. Opening the screen is never treated as selection. |
| Fill | Works in other apps and in Alpha's own browser through the Android Autofill framework. See the rules below. |
| Save | "Save password?" is offered by Android after a sign-in; Alpha's prompt names the site or app and username, and writes only after Save and unlock. Same binding and username updates the existing entry. |
| Export | None in this version. Any future export must require explicit confirmation and a fresh authentication. |

Fill rules (implemented in the shared `PasswordFormPolicy`, tested on a JVM):

- A fill request never opens the vault. Android shows one "Fill with a saved password" choice with
  no values; selecting it opens the FLAG_SECURE picker, which unlocks and lists only entries bound
  to the exact request subject. Every fill needs that explicit choice.
- Websites: accepted only from a trusted browser. Alpha's browser is trusted only when its
  WebView reports the committed top-level HTTPS origin and it equals the field origin. Any second
  web domain in the structure (a cross-origin frame), non-HTTPS content or mixed native/web login
  fields refuses the whole request. No third-party browser is trusted by default.
- Apps: the framework-reported package, matched only if `PackageManager#hasSigningCertificate`
  confirms the signer recorded at save time (rotation-aware). Alpha's own native UI and its
  renderer WebView are never filled.
- Matching is exact: `accounts.example.com` and `example.com` are different bindings.

### Threat model

| Asset / boundary | Protection | Residual risk |
| --- | --- | --- |
| Vault at rest | One AES-256-GCM frame (`PasswordVaultFrame`) with host AAD in the no-backup directory; non-exportable Keystore key requiring user authentication and an unlocked device; `allowBackup=false` and data-extraction rules exclude everything. | Root or a compromised OS. StrongBox is not asserted. Removing the screen lock permanently invalidates the key; the vault becomes unreadable (reported as `key-invalidated`). |
| Agent, model, logs, journal, notifications, crash data | No bridge method resolves with a secret; the shared client rebuilds responses from allowlisted fields and rejects any secret-like key; errors never echo input; native code has no logging; nothing is written to view state, storage, toasts, notifications or the action journal; the agent observation is `sensitive` (no view, no selection) on every password page, and the agent client then refuses to send. No agent action, workflow step or backend code can reach the vault bridge (static test). | A password the user is typing exists in renderer memory until save/leave. The agent sees no labels or origins at all in this version. |
| Fill into the wrong origin | Exact origin/app binding, browser trust, top-level origin check, cross-origin frame refusal, signer verification, one-shot in-memory tokens (Intents carry only a random token), user choice per fill. | Chromium WebView flattening of cross-origin iframe forms under the top-level domain would not be detectable from the structure; real cross-origin iframe behavior needs device qualification. A site's own scripts can read fields the user fills. |
| Save capture | Captured values stay in memory behind a one-shot token (5 min), consumed once; nothing is written without Save and unlock. | Process death drops the capture (fails closed). |
| Reveal / clipboard | FLAG_SECURE, timed hide, sensitive clip flag (Android 13+ hides previews), verified-only clearing. | Other apps with clipboard access on older Android versions; the clip is not cleared if Alpha cannot verify it is still Alpha's. |
| Renderer compromise | Cannot read secrets; cannot mint app bindings; can trigger unlock prompts and native reveal/copy only after a real unlock. | A compromised renderer could rename/delete entries while unlocked. |

### Passkeys

Not implemented. The plugin is designed to add an Android Credential Manager provider
(`CredentialProviderService`, API 34+): RP-ID–bound credentials verified against
`CallingAppInfo` (privileged-browser allowlist or app signature/Digital Asset Links), keys held
under the same authenticated custody, signing only after BiometricPrompt. Remaining work is listed
in the plugin README: WebAuthn encoding, RP-ID/origin validation for browsers, counters and flags,
the provider settings entry and device qualification. TOTP secrets are not stored.

### Evidence boundary

`npm run verify` runs the JVM custody/policy tests, the shared client tests and the Alpha
boundary tests; Playwright covers the Settings UI with the flag-only development vault
(`?mode=dev`, `ELIZA_DEV_ALLOW_TEST_MOCKS=1`) and a controlled native bridge. Android
instrumentation sources compile; they do not establish real BiometricPrompt, provider selection,
WebView/Chromium fill, cross-origin iframe, save prompt or physical-device acceptance. The
production bundle audit refuses the development vault strings.

## Other password providers (Proton Pass)
Alpha Settings → Password manager reports a read-only Android snapshot. The Browser menu opens the same detail page. The UI distinguishes an absent, disabled, publisher-unrecognized or verified Proton package; no provider, another provider, or Proton selection; and Android autofill availability. Unknown observations remain unknown. A selected package is named as verified Proton only when its publisher matches the pinned certificate. A disabled verified package is labeled disabled.

The original Proton publisher SHA256 is pinned in `config/native-apps.json`. Android's rotation-aware `PackageManager.hasSigningCertificate` verifies that identity; package visibility is limited to `proton.android.pass`. No vault, passwords, form contents or unlock state is queried or sent to the agent. These metadata observations can become stale, so launch/setup authenticates the package again and the UI refreshes on app resume or explicit Refresh.

Choose password provider opens Android's public provider picker when the verified provider and autofill are available. Missing picker handlers fall back to Android Settings with search guidance. Without a verified provider, the Settings handoff remains generic. Android owns confirmation, selection and cancellation. Alpha never sets secure settings, forces a grant, enables a service or treats opening the picker as successful selection. The install action opens Proton's official download page; it does not download/install an APK. Open Proton Pass requires the pinned publisher again at dispatch.

Browser-only builds explain that the browser/OS manages passwords, offer no fake native installation/selection controls, and cannot report Android provider state. Mock mode, which exists only in `ELIZA_DEV_ALLOW_TEST_MOCKS=1` builds, keeps its simulated UI and does not install the live setup adapter. The development sample password provider is likewise flag-only; production builds and distribution APKs show only the real Android provider status.

This is onboarding, not official-provider acceptance. The embedded Alpha browser is distinct from a browser on Proton's recognized-browser list. Preserve any provider warning. Setup does not establish password saving/filling, cross-origin matching, unlock/resume, passkeys or release-signed/physical-device compatibility; those remain the acceptance gates in `browser-autofill-integration.md` and the MVP completion plan. Alpha neither restyles nor bypasses provider-owned vault/security UI.

Primary references:

- [AutofillManager](https://developer.android.com/reference/android/view/autofill/AutofillManager): `isAutofillSupported` and `getAutofillServiceComponentName` report device/user support and selected service. `hasEnabledAutofillServices` is deliberately not used: it asks whether the calling app itself provides the selected service.
- [Android autofill setup](https://developer.android.com/identity/autofill/autofill-services): user enablement and public provider picker.
- [AOSP15 CredentialsPickerActivity](https://android.googlesource.com/platform/packages/apps/Settings/+/refs/heads/android15-release/src/com/android/settings/applications/credentials/CredentialsPickerActivity.java) and [Settings manifest](https://android.googlesource.com/platform/packages/apps/Settings/+/refs/heads/android15-release/AndroidManifest.xml): exported package-scheme request action routes into the combined picker. Alpha does not infer selection from activity results.
- [PackageManager signing verification](https://developer.android.com/reference/android/content/pm/PackageManager#hasSigningCertificate(java.lang.String,%20byte[],%20int)): publisher verification respects proof of signing-key rotation.
- [Proton Android setup](https://proton.me/support/pass-setup-android) and the pinned provider constraints in `browser-autofill-integration.md`.
