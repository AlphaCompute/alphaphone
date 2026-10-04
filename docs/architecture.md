# Architecture and ownership

Alpha Phone is an independent Android product. `apps/app` owns its renderer,
navigation, presentation, capability policy and storage configuration. Shared
runtime, browser features, native plugins and OS tooling come from the exact
revision in `upstream.lock.json` and `vendor/eliza`.

## Source boundaries

| Path | Responsibility |
| --- | --- |
| `apps/app/src` | Alpha UI, product policy and adapters to shared features |
| `android` | Product identity, Activity, permissions, resources and standalone/HOME packaging |
| `app.config.json` | Package ID, display name, version and orientation |
| `backend` | Development runtime composition, character and permitted model/actions |
| `vendor/eliza` | Pinned shared platform source; never modified by consumer builds |
| `scripts` | Consumer build orchestration and product acceptance scenarios |
| `design` | Requirements and visual references, not executable instructions |

Maps, Files and Notes implementations are copied from authenticated upstream
source into a generated cache outside the submodule. Product wrappers inject
presentation, device configuration and installed storage identities. Resident
runtime preparation also uses the locked upstream source without patch replay.
Native staging verifies source and generated hashes and applies only explicit
host identity/resource/environment configuration.

Generic behavior belongs upstream with configurable host inputs. Product names,
package IDs, storage namespaces, view allowlists and approval policy stay here.
Do not import another product's UI or turn Alpha-specific restrictions into
universal platform defaults. Use existing upstream schedulers, credential
providers and stores rather than introducing competing implementations.

## Runtime and permissions

The primary agent runs on Android. Local orchestration, durable state and tool
approvals are separate from model inference: hosted inference requires explicit
configuration and outbound-context policy. Cloud/remote pairing is an optional
path. Debug host forwarding is development infrastructure, not evidence of a
resident runtime or production authentication.

Third-party web content runs in an isolated native browser surface; it must not
receive the application's Capacitor bridge. Origin, context revision, consent,
sensitive fields and cancellation remain bound to each action. Credentials use
Android Keystore-backed storage in the no-backup directory. Renderer preferences
hold nonsecret selections and identifiers. Backup remains disabled until its
key and retention policy is defined.

Standalone and launcher APKs share `ai.elizaresearch.alphaphone` and replace one
another. Only the launcher variant declares HOME. Release outputs require
controlled signing. System installation alone does not grant protected roles or
permissions. OS staging admits the product APK separately from Eliza's full app;
release provisioning owns default roles, signing, update compatibility and
recovery policy.

## Changing shared code

1. Implement and test reusable behavior in a dedicated Eliza branch and submit
   a PR against `develop`.
2. Publish a retrievable reviewed revision. Update the submodule and lock
   together; preserve the current source-admission checks.
3. Run `npm run verify` and `npm run android:build` for both distributions.
4. Exercise the changed native/renderer contract, including installed-data and
   identity preservation where relevant.

APK builds, emulator bridge/HOME tests, full AOSP image boot, real integrations,
and physical-device/user acceptance are separate gates. See
[mvp-current-status.md](mvp-current-status.md) for their current limits. A source
pin rollback does not by itself establish APK or OS rollback compatibility.
