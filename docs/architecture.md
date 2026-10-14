# Architecture and ownership

Alpha Phone is an independent Android product. `apps/app` owns its renderer,
navigation, presentation, capability policy and storage configuration. Shared
runtime, browser features, native plugins and OS tooling come from the exact
revision in `upstream.lock.json` and `vendor/eliza`.

## October 12 approved runtime and distribution policy

[Owner decisions](decisions.md#october-12-owner-decisions) and the
[implementation plan](implementation-plan.md) govern pending changes. Only a local
resident agent is allowed; no hosted-agent connection, creation, pairing or fallback.
Eliza Cloud supplies text inference, subscriptions, Gmail and shared Maps services.
All STT/TTS is on-device through native Eliza inference/llama.cpp integration;
Cloud speech is retired policy and its current code must be migrated, not claimed local.

AOSP targets Pixel 10a / Android 17. Phone, Contacts and SMS are AOSP-only and need
an image capability distinct from the launcher flavor. Wallet is outside MVP.
The isolated always-on listener is an AOSP MVP requirement and the narrowly scoped
exception to nonprivileged packaging; the main app stays nonprivileged. Shared
engine/JNI work goes upstream; product policy remains in Alpha.

Subscription authorization is asynchronously refreshed and cached, with server-side
bounded quotas on existing service requests. Local speech has no billing dependency.
Photos offers full permitted library access to the local agent; resets erase Alpha
private state without implying remote/provider or device-wide media deletion.
No app-data backup/import/export/transfer feature is planned.

Reset Alpha data uses a native disclosure followed by fresh Android device-credential
confirmation. The renderer cannot supply reset authority. Before dispatch, Alpha
persists a device-protected request and retries it before runtime callbacks or upkeep
on a subsequent launch. Android's own `clearApplicationUserData()` scopes deletion
to this package/user, force-stops package processes, cancels its jobs/alarms and
notifications, clears private app data and its UID Keystore namespace. Alpha does
not enumerate or delete shared media, another app's storage, remote Gmail/Cloud
data or subscriptions. It does not report a returned request as completed deletion.
The pending marker covers interruption before dispatch; it is itself app data and
is not a guarantee of atomic filesystem deletion or recovery from power loss midway
through Android's clear operation. Installed self-clear acceptance must be observed
externally on a disposable package/user, since the reset kills its own instrumentation.
The separate AOSP listener uses the reset contract below; native image qualification
remains required before shipping it.

Production Notes and vault migration controls are disabled, including their native
entry points. Damaged-data notices retain saved bytes and drafts without backup or
per-store reset controls; fitting Notes edits still recover through the existing
merge path. Explicit test-mocks builds retain migration fixtures. Ordinary Files,
Gmail attachments and PDF file creation remain available.


## Source boundaries

| Path | Responsibility |
| --- | --- |
| `apps/app/src` | Alpha UI, product policy and adapters to shared features |
| `android` | Product identity, Activity, permissions, resources and standalone/HOME packaging |
| `android/sense`, `android/aosp/listener` | AOSP-image-only privileged, network-less always-on listener and its image configuration ([ADR 0001](adr/0001-privileged-listener.md)); never in the standalone or launcher APK |
| `app.config.json` | Package ID, display name, version and orientation |
| `backend` | Development runtime composition, character and permitted model/actions |
| `vendor/eliza` | Pinned shared platform source; never modified by consumer builds |
| `scripts` | Consumer build orchestration and product acceptance scenarios |
| `design` | Requirements and visual references, not executable instructions |

Maps, Files and Notes implementations are copied from authenticated upstream
source into a generated cache outside the submodule. Gradle includes the shared
password manager directly from the reviewed pin. The secure store and notification ledger use explicit
reviewed patches in `patches/eliza/native-manifest.json`: admission authenticates the pin,
patch digest, target before/after hashes and complete staged module inventory. Gradle
compiles the generated copy under `.eliza/patched-native`, never a modified submodule.
No source patch is applied during client, worker or resident-runtime builds. Photo edits, capture publication, the opt-in notification mirror and the delivery-receipt
ledger for Alpha's own workflow and approval notices (`NoticeDelivery`, configured by
`WorkflowNoticeDelivery`) also use shared native modules. Alpha wrappers retain installed storage names, media paths and Android components.
Browser policy helpers are staged from the same authenticated pin. Gradle writes shared
library outputs under the host build directory, outside the immutable vendor checkout.
Product wrappers inject presentation, device configuration and installed storage identities. Resident
runtime preparation also uses the locked upstream source without patch replay.
Native staging verifies source and generated hashes and applies only explicit
host identity/resource/environment configuration.

Generic behavior belongs upstream with configurable host inputs. Product names,
package IDs, storage namespaces, view allowlists and approval policy stay here.
Do not import another product's UI or turn Alpha-specific restrictions into
universal platform defaults. Use existing upstream schedulers, credential
providers and stores rather than introducing competing implementations.

`base/` is retired; the original app baseline remains recorded in
[its provenance file](eliza-app-baseline-provenance.json). There is one product renderer
in `apps/app`. The remaining `backend` files compose a development host from shared
runtime packages; the product character, allowed views and proposal-only behavior
stay here. Product build admission and acceptance campaigns also stay in `scripts`.
Moving those directories intact would move product policy into the shared platform.

## Build surfaces

The web build (`npm run build` → `web-dist/`) is a development and preview surface and
the payload packaged into the APKs; it is not a standalone product distribution. The
product ships as the standalone and launcher APKs.

One build-time switch, the upstream name `ELIZA_DEV_ALLOW_TEST_MOCKS`, gates every mock,
fixture and developer surface. It is off unless set to exactly `1`. The renderer reads
it only through `apps/app/src/build-flags.ts` (`testMocksEnabled`, and
`devSurfacesEnabled` for development-server-only surfaces); Vite folds it to a constant
and, when off, replaces the prototype fixture module with an empty module. Android
receives it as `-PELIZA_DEV_ALLOW_TEST_MOCKS=1`, exposes
`BuildConfig.ELIZA_DEV_ALLOW_TEST_MOCKS`, and attaches the `src/testMocks` source set
(development agent and voice plugins, synthetic autofill, loopback cleartext config,
fixture-package visibility) to debug variants only when on. Development behavior keys
on that field, not on `BuildConfig.DEBUG`. The switch is on for `npm run dev`,
Playwright and explicit test-mocks builds, and off for `npm run build`,
`npm run android:sync` and `npm run android:build`. No `ALPHA_*` switch or widened
`ELIZA_` env prefix is used.

## Runtime and permissions

The primary agent runs on Android. Local orchestration, durable state and tool
approvals are separate from model inference: hosted inference requires explicit
configuration and outbound-context policy. Production builds do not accept remote pairing or hosted-agent provisioning, discovery, adoption or restore. Cloud sign-in authorizes
billed inference for the resident agent; it does not select a hosted agent. Existing
remote credentials and history are retained without automatically reconnecting.
Remote browser transports are available only with the explicit test-mocks switch and remain non-product development infrastructure.
The production AlphaConnection boundary admits exact managed-service origin and path/method pairs for account sign-in, identity, balance, self-revocation and owner Gmail. Dedicated hosts and agent/provisioning paths on the Cloud API origin are refused before network dispatch. Native resident inference remains on its separately admitted provider route; new Maps or billing APIs require explicit service-route review. Debug host forwarding (the DevelopmentAgent bridge, present only in test-mocks
builds) is development infrastructure, not evidence of a resident runtime or
production authentication.

Third-party web content runs in an isolated native browser surface; it must not
receive the application's Capacitor bridge. Origin, context revision, consent,
sensitive fields and cancellation remain bound to each action. Credentials use
Android Keystore-backed storage in the no-backup directory. The renderer bridge
and background consumers use upstream `JsonCredentialSlots` through
`AlphaCredentialStore`, sharing one process-wide lock and compare-and-exchange.
Alpha owns the installed alias, directory, per-slot byte limits and renderer
namespace restrictions. Saved passwords use the separate authentication-bound vault of
the shared password plugin; see [password-provider-setup.md](password-provider-setup.md). The ciphertext frame, hashed filename and slot AAD remain
unchanged; writers in separate Android processes are outside this contract. Renderer preferences
hold nonsecret selections and identifiers. Backup remains disabled by the reset-only policy; no app-data transfer is planned.

Standalone and launcher APKs share `ai.elizaresearch.alphaphone` and replace one
another. Only the launcher variant declares HOME. Release outputs require
controlled signing through the upstream `ELIZAOS_KEYSTORE_PATH`,
`ELIZAOS_KEYSTORE_PASSWORD`, `ELIZAOS_KEY_ALIAS` and `ELIZAOS_KEY_PASSWORD` values;
without all four the build emits unsigned release APKs. System installation alone does not grant protected roles or
permissions. OS staging admits the product APK separately from Eliza's full app;
release provisioning owns default roles, signing, update compatibility and
recovery policy.

Phone, Contacts and SMS exist only on the Alpha AOSP image (decision P-36). The image
capability is decided natively by `AlphaImageCapability`: the launcher build without test
mocks, installed from a system partition (`FLAG_SYSTEM`), with the `<package>.aosp_image`
system feature that `scripts/stage-aosp.mjs` declares in the image product. The launcher
flavor, test mocks, URLs and saved state never establish it. Only then does `MainActivity`
register `AlphaTelephonyPlugin` (read-only contacts through upstream `ContactsReader`, role
and SIM status, dialer and SMS handoffs, SMS/MMS provider reads and reviewed native sends); the
renderer reads its presence from the injected plugin headers (`apps/app/src/runtime/aosp-image.ts`). Standalone APKs declare no contacts or
phone-state permission. Gmail is available in both distributions through Eliza Cloud, with
read access first and one incremental change grant (`apps/app/src/runtime/gmail-grants.ts`).

Native reminders use the shared `plugin-native-reminders` engine and bridge.
`AlphaReminders` supplies the product's existing encrypted store, preference and
channel names, receiver/Activity identities and intent routes. `DailyApps` keeps
its public Capacitor name and inherits the reminder methods. Reminder test access
lives only in the instrumentation source set; it delegates to the shared engine
rather than keeping a second implementation.

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

The AOSP telephony contract additionally requires the canonical production image admission
(`AlphaImageCapabilities`): release launcher, system install and the product-partition RRO.
The feature XML is an additional telephony contract marker, never an alternative admission path.
Contacts uses the bounded AlphaContacts adapter and its native capability response; Phone and SMS
views remain deferred. Telephony contact reads recheck permission, unlock and lifecycle state
before and after asynchronous provider reads.

### SMS/MMS on the image (#421)

Text messaging has no account or OAuth grant: identity is the device's active subscriptions and
Android roles. Only the launcher manifest declares `READ_SMS` and `SEND_SMS` (both hard-restricted,
so an ordinary sideloaded install cannot hold them) and the non-exported `AlphaSmsSendReceiver`;
the standalone manifest removes them and `scripts/apk.mjs` checks the packaged permissions per flavor.
`AlphaTelephonyPlugin` adds, behind the same image capability and unlocked-foreground check:

- `listThreads`/`listMessages`: bounded pages (50 rows, 2000 characters per body, 20 addresses) from
  the Telephony SMS, MMS and conversation providers with `READ_SMS`, cancelled and fenced like Contacts.
  IDs are `thread:<row>`, `sms:<row>`, `mms:<row>`. Direction is incoming/outgoing; status is
  received/read or pending/sent/failed/delivered. "delivered" requires the provider's complete delivery
  report and is never claimed for MMS. Drafts and attachment bytes are not read (`SmsRecords`).
- `observeMessages`: a ContentObserver on the SMS, MMS and conversation URIs while Alpha is unlocked in
  the foreground, coalesced to one content-free `messagesChanged` notice per 750 ms; the renderer
  re-reads a bounded page. Pause, lock and screen-off unregister it.
- `sendSms`/`smsSendResult`: a reviewed native send when `status.sendMode` is `direct` (`SEND_SMS` held,
  directly or through the SMS role, and the SIM list readable). Alpha's own native dialog shows the exact
  recipients, SIM, part count and text; conditions are rechecked at the Send decision. The result follows
  the shared `sms.send.v1` contract (elizaOS/eliza#36178): the operation ID is the idempotency key and a
  repeat only reads `SmsSendJournal`; the binding hash covers recipients, text and SIM. The journal is
  written before the first `SmsManager` call (`createForSubscriptionId`, `divideMessage`, one immutable,
  package-explicit sent and delivery PendingIntent per part). "sent" comes only from `RESULT_OK` sent
  callbacks and "delivered" only from delivery reports whose provider row reads complete; an interrupted
  dispatch or callbacks lost to a restart read "unknown". Nothing is ever resent automatically, and the
  body is not stored. The journal keeps 200 records; when full it drops the oldest (closed first) and
  keeps a tombstone of each dropped operation ID, which is then refused rather than sent again; evidence
  is awaited for at most seven days. Otherwise `composeSms` remains the handoff fallback and never reports a send.

Delivery outcome is read from the provider row the platform writes for a non-default SMS app's send
(matched by address, Alpha as creator, a date after the journal entry and body hash), because an
immutable delivery PendingIntent cannot carry the status-report PDU. Each part's report overwrites the
one row of a multipart message, so multipart delivery stays "unknown" and only single-part messages can
read "delivered". The Messages
view, agent `sms_send` proposals and the `sms.send.v1` device capability stay unavailable until the
shared contract is in the reviewed pin. JVM and renderer tests cover the journal, mapping and contract;
grants on the image, real provider rows, carrier delivery reports and owned SMS/MMS endpoints remain
image/device qualification for #421.

### Reset and the image listener

Before dispatching Android's package-data clear, a pending Alpha reset asks the
same-signed image listener to erase its consent/settings through its existing
signature-protected control provider. Missing listeners are allowed; an installed
listener with a signer/permission mismatch, failed write, missing provider or
ambiguous acknowledgement keeps the reset marker and stops Alpha until retry.
The listener serializes revocation with consent writes and rejects permission
callbacks whose consent request predates reset. It invalidates queued recognition,
clears its settings durably and
requests microphone-service stop. A successful retry may clear a previous storage
failure, but never grants consent or resumes listening. Device-wide files and
other applications are outside this contract.

Focused JVM tests cover durable revocation, invalidated recognition tickets,
failed-write retry and admission before app initialization. These are source-level
checks; actual microphone release, provider IPC, process interruption and both
image distributions still require native qualification for #409/#424.
Because the reset fails closed, an installed listener that cannot acknowledge it
(signer mismatch, LISTENER_CONTROL not granted, missing provider) keeps every Alpha
main-process launch stopping before initialization. Before stopping, a main process
started for an activity (or for a reason Android does not report; `ApplicationStartInfo`
on API 35+) opens `ResetRecoveryActivity`; one started for a job, alarm, broadcast,
push, provider or bound service stops without taking the screen from the app in front.
The recovery activity runs in its own `:reset_recovery` process, which installs
none of Alpha's content providers (no WorkManager or startup initializers) and starts
no agent, renderer or notification code. It states that the reset has not finished
and Alpha's local data was not deleted, and offers Try reset again (always a fresh
listener-then-Android attempt), the listener's settings, Phone and Android Settings.
Automatic attempts at launch are bounded (three per minute; unreadable attempt state
defers them until the user retries), so Android relaunching HOME no longer repeats
listener IPC silently. The marker and all Alpha data stay until the listener
acknowledges and Android accepts the package clear; a new confirmed reset starts a
fresh budget, and a late failure after Android finished cannot recreate reset state.
Settings > Clear storage is not a recovery path for this state: it would clear Alpha
without revoking listener consent. JVM tests cover the relaunch sequence, recovery-
process admission, bounded attempts, acknowledged-then-refused interruption and
package-scoped clearing; Android actually resuming the recovery task instead of
relaunching HOME, the background-start exemption it relies on, and both image
distributions still require native qualification.
A consent permission request pending while ConsentActivity is recreated
(for example on rotation) is restored only within the same process, so a request made
before a restart can never match the listener's fresh reset generation.
