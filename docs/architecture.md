# Architecture and ownership

Status: buildable product-shell foundation; agent integration is deliberately unconfigured.

## Repository boundaries

| Path | Responsibility |
| --- | --- |
| `apps/app/src` | Entire alphaphone UI and interaction source; independent of the other product |
| `android` | Capacitor Activity, native app launcher bridge, standalone/HOME flavors |
| `app.config.json` | Product package identity, display name, version, orientation |
| `vendor/eliza` | Commit-pinned agent, UI helpers, native plugins and OS tooling |
| `base/eliza-app` | Pristine copied app source for migration and comparison |
| `design` | Original product/design evidence and exact hashes |
| `scripts` | Reproducible build, APK inspection, emulator smoke and AOSP staging |
| `docs` | PRD, architecture decisions, implementation/test traceability |

The active shell derives its Capacitor activity lifecycle, splash installation, mixed-content policy and HOME back behavior from Eliza's `packages/app/scripts/mobile/android/templates/main-activity.ts`. It compiles the actual `plugins/plugin-native-system/android` source as a Gradle project and imports its browser-safe TypeScript entry. It adds only `DeviceApps` for launcher enumeration/open and build identity. No agent, wallet, credential manager or whole `@elizaos/ui` barrel is bundled into the renderer.

## Decisions

**ADR-01: pin source, do not publish the whole monorepo.** Each product has its own `vendor/eliza` Git submodule and exact lock. This makes unpublished native/OS fixes available while retaining reproducibility. Eliza packages contain workspace protocols, relative build scripts and native asset assumptions; a blanket `npm publish` is neither necessary nor validated. The shell's small registry dependency set has its own npm lock. A future package release needs consumer tests outside the monorepo, rewritten workspace protocols, browser-safe exports, native source packaging and a version compatibility matrix before replacing source pins.

**ADR-02: separate UI, shared platform contracts.** No cross-product imports. Each product owns layouts, tokens, routes, branding, package ID and store/OS metadata. Generic transport, platform capability checks, redaction, task/approval protocol and native plugins belong upstream. Product task policy must be supplied explicitly, not hard-coded into the shared agent.

**ADR-03: two install modes.** `standalone` is an ordinary app with MAIN/LAUNCHER and no HOME filter. `launcher` adds MAIN/HOME/DEFAULT and handles Back/Home at its root. Both use the same product package ID so they are alternate installations, not two simultaneous apps. Alpha and senior-care package IDs are different and can coexist. Debug APKs are signed locally; release outputs are unsigned until controlled signing. A signed launcher APK also works as a nonprivileged presigned AOSP product app. System installation alone does not grant accessibility, overlay, dialer, SMS, assistant or signature permissions.

**ADR-04: no implicit privileged bundle.** The new OS staging tool admits a custom APK separately from Eliza's full local-agent system APK. It emits an additive Soong module and product fragment after hash/signer/HOME checks. It does not replace Eliza, Launcher3, SystemUI or Chromium. Device enrollment chooses the default HOME role; production selection/rollback policy is a release gate. Do not remove the stock recovery launcher before that gate.

**ADR-05: execution boundary.** Alpha is cloud-only under the reviewed Alpha issues. Reuse existing Eliza account/pairing and approved Alpha endpoint routing; do not package local model payloads. A live agent will be introduced behind explicit owner/agent scoped transport. The current UI truthfully reports it is not connected. There is no fabricated chat response, OAuth login, bill payment or hidden credential collection.

**ADR-06: browser independence.** Assistance to third-party websites needs the isolated native browser surface or approved Chromium bridge; never expose the Capacitor bridge to arbitrary remote web content. Origin identity, observation version, consent and sensitive-field boundaries must survive every navigation. A stock launcher Activity alone cannot keep a side panel above every app. System-wide assistance needs the separate window/accessibility capability spike in the plan.

## Updating Eliza

1. Make generic changes in a dedicated `codex/` branch of the Eliza source and retain targeted tests.
2. Publish the commit so a clean clone can retrieve it. Prefer a reviewed upstream PR before release.
3. Update the submodule and `upstream.lock.json` together. Keep the baseline import immutable; re-import intentionally with a new manifest if needed.
4. Run source-pin verification, product typecheck/tests/build, both APK flavors and emulator bridge/HOME tests. Upgrade one product at a time.
5. Before production, run upstream required root checks, the real auth/agent suite, signed-image build and physical-device acceptance. Reverting the submodule pin is the source rollback; installed APK/OS rollback must separately respect signing identity and Android versionCode rules.

No production secrets or signing keys belong in these repos. Development app data contains no saved account credentials. Platform backup is disabled for the shell until retention/key ownership is specified.
