# Architecture and ownership

October 1 architecture change: the user has selected an **Android-resident agent instead of Nitro/TEE hosting**. The [on-device agent plan](on-device-agent-plan.md) supersedes cloud-only and enclave-primary requirements below. Agent execution and model inference are separate decisions; inference placement remains pending. Historical evidence is retained. Powered-off-phone execution needs explicit scope reconciliation.

September 30 scope update: the [MVP report](mvp-scope-and-gap-report.md) and [completion plan](mvp-completion-plan.md) govern current priority. Earlier cloud-only/local-model statements do not waive the supplied DoD's on-device STT/TTS requirement; offline LLM and external-versus-TEE inference remain explicitly reconciled there.

Status: daily-tool implementation in progress. Cloud and remote authentication adapters are implemented; the actual local Eliza/Cerebras protocol has been exercised. Live Cloud services, enclave deployment and device acceptance remain incomplete. Cloud service identity is independent of the selected agent target; see `agent-integration.md` and the flow verification record for exact scope.

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

The active shell derives its Capacitor activity lifecycle, splash installation, mixed-content policy and HOME back behavior from Eliza's `packages/app/scripts/mobile/android/templates/main-activity.ts`. It compiles the actual `plugins/plugin-native-system/android` source as a Gradle project and imports its browser-safe TypeScript entry. Product bridges include `DeviceApps` for launcher enumeration/open and build identity, and `DailyApps` for native intent handoffs, document selection and device-local reminders. `DevelopmentAgent` exists only in debug source sets and uses a fixed loopback service through emulator port forwarding; it is not production account authentication. No agent, wallet, credential manager or whole `@elizaos/ui` barrel is bundled into the renderer.

## Decisions

**ADR-01: pin source, do not publish the whole monorepo.** Each product has its own `vendor/eliza` Git submodule and exact lock. This makes unpublished native/OS fixes available while retaining reproducibility. Eliza packages contain workspace protocols, relative build scripts and native asset assumptions; a blanket `npm publish` is neither necessary nor validated. The shell's small registry dependency set has its own npm lock. A future package release needs consumer tests outside the monorepo, rewritten workspace protocols, browser-safe exports, native source packaging and a version compatibility matrix before replacing source pins.

**ADR-02: separate UI, shared platform contracts.** No cross-product imports. Each product owns layouts, tokens, routes, branding, package ID and store/OS metadata. Generic transport, platform capability checks, redaction, task/approval protocol and native plugins belong upstream. Product task policy must be supplied explicitly, not hard-coded into the shared agent.

**ADR-03: two install modes.** `standalone` is an ordinary app with MAIN/LAUNCHER and no HOME filter. `launcher` adds MAIN/HOME/DEFAULT and handles Back/Home at its root. Both use the same product package ID so they are alternate installations, not two simultaneous apps. Alpha and senior-care package IDs are different and can coexist. Debug APKs are signed locally; release outputs are unsigned until controlled signing. The signed launcher APK is prepared for import as a nonprivileged presigned AOSP product app; a full image build and boot remain unverified. System installation alone does not grant accessibility, overlay, dialer, SMS, assistant or signature permissions.

**ADR-04: no implicit privileged bundle.** The new OS staging tool admits a custom APK separately from Eliza's full local-agent system APK. It emits an additive Soong module and product fragment after hash/signer/HOME checks. It does not replace Eliza, Launcher3, SystemUI or Chromium. Device enrollment chooses the default HOME role; production selection/rollback policy is a release gate. Do not remove the stock recovery launcher before that gate.

**ADR-05: execution boundary (revised October 1).** The primary agent runs on the Android device, replacing the earlier cloud-only/Nitro direction. Reuse the existing Eliza mobile runtime and native IPC subject to Alpha packaging, lifecycle and permission qualification. Keep orchestration, durable state and tool approvals local; model inference location is a separate pending decision. Hosted inference, if selected, must be explicit about outbound context. Cloud/remote pairing remains an optional path. The existing debug host-forwarded transport is not an on-device runtime. See [implementation and acceptance changes](on-device-agent-plan.md).

**ADR-06: browser independence.** Assistance to third-party websites needs the isolated native browser surface or approved Chromium bridge; never expose the Capacitor bridge to arbitrary remote web content. Origin identity, observation version, consent and sensitive-field boundaries must survive every navigation. A stock launcher Activity alone cannot keep a side panel above every app. System-wide assistance needs the separate window/accessibility capability spike in the plan.

## Updating Eliza

1. Make generic changes in a dedicated `codex/` branch of the Eliza source and retain targeted tests.
2. Publish the commit so a clean clone can retrieve it. Prefer a reviewed upstream PR before release.
3. Update the submodule and `upstream.lock.json` together. Keep the baseline import immutable; re-import intentionally with a new manifest if needed.
4. Run source-pin verification, product typecheck/tests/build, both APK flavors and emulator bridge/HOME tests. Upgrade one product at a time.
5. Before production, run upstream required root checks, the real auth/agent suite, signed-image build and physical-device acceptance. Reverting the submodule pin is the source rollback; installed APK/OS rollback must separately respect signing identity and Android versionCode rules.

No production secrets or signing keys belong in these repos. Account credentials are encrypted with Android Keystore AES-GCM in the app no-backup directory. Renderer preferences contain only nonsecret connection selection and conversation identifiers. Cloud voice requests bind to a specific saved credential generation. Platform backup remains disabled until retention/key ownership is specified.
