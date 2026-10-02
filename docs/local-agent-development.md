# Local agent setup

Alpha uses a local Eliza runtime in both environments. Android runs the process in `ElizaAgentService` inside the app's sandbox and communicates over authenticated native socket IPC. Browser development runs the same composed Eliza source on the development computer, with a private Vite bridge. Neither path requires Nitro, enclave admission, or Cloud sign-in.

This first implementation uses **hosted Cerebras inference**. The agent, conversation database, approvals and receipts are local; prompts and selected context go to Cerebras. This is not an offline language model. Existing on-device speech is a separate integration.

## Browser development

Use Node 24 and Bun 1.4.2, then:

```sh
npm ci
npm run agent:prepare
npm run agent:test
npm run dev:local
```

Before starting, configure `CEREBRAS_API_KEY` in the host environment or the owner-only file `~/.config/alphaphone/cerebras-key`. Do not put it in a `VITE_` variable, checked-in file, browser field, URL or command-line argument. The existing private key file is supported. The current model defaults to `qwen-3.8-27b`.

Open `http://127.0.0.1:5317`, choose **Start local agent**, then chat normally. Reloading reconnects the selected local runtime. Conversation history comes from its local database. `npm run dev` remains the renderer-only development command; it does not silently start an agent.

`dev:local` owns the host and Vite child processes and stops them on Ctrl-C. It refuses an occupied agent port or a live process already using its profile. Its default profile is `~/.local/share/alphaphone/browser-agent`, with owner-only credentials, logs and browser action journal. `ALPHA_REMOTE_PROFILE` and `ALPHA_REMOTE_PORT` permit a separate profile/port. `ALPHA_ELIZA_SOURCE` is an explicit development override; evidence for one source snapshot does not qualify another.

The bridge accepts same-origin requests from the loopback development page only. It allows the conversation, device-action and workflow APIs, injects a host-owned machine session, and removes the upstream session ID because that ID is itself a bearer token. Credentials are not embedded in the web bundle. Device enrollment keys and durable action receipts are kept in the private development profile. Browser development advertises its implemented Notes capability, not Android Calendar/Reminders or native permission access.

The development host launches Bun with `--conditions=eliza-source` and `--no-install`, matching upstream's source-checkout resolution. Alpha explicitly opts into workflows within the lean chat plugin set using the tested `lean-chat-workflows.patch`; coding, terminal, browser automation and wallet exclusions remain in force. An explicit workflow disable in the private profile still takes precedence. `agent:test` checks those selection boundaries against the prepared source. Existing profiles and their schedule settings are preserved.

Workflow drafts in local browser development persist in the private host profile, separately scoped to the selected owner/agent. Atomic compare-and-exchange rejects stale-tab changes. These development drafts are not encrypted; the editor says so. Android continues to use its encrypted native draft store. Draft storage does not save or execute a workflow on the agent until the separate reviewed submission.

## Android setup

Prepare the runtime and stage its mobile payload:

```sh
npm run agent:prepare
npm run agent:stage-android
```

The staging command builds the Android mobile agent bundle, runs upstream's host-Bun module initialization check, and stages pinned ARM64 and x86_64 Bun/musl/runtime artifacts. Executables are packaged as extracted JNI libraries for an ordinary APK; it does not require root, writable-directory execution or disabling SELinux. The upstream staging step includes its small embedding artifact, not an offline text-generation model. Generated assets and binaries are ignored by Git and reproducible from the checked-in scripts and manifests.

When an APK build is wanted, `npm run android:build:local` performs preparation, staging and the existing build/verification of both standalone and launcher variants. The ordinary `android:build` uses whatever payload has already been staged; an APK without the runtime payload reports that it must be staged rather than pretending a host-forwarded agent is running on the phone.

In the Android connection chooser, expand **Model provider**, enter a Cerebras key and model, and save. The native bridge stores the configuration encrypted with Android Keystore and injects it into the child process environment at startup. It never returns the provider key to the renderer. Then select **Start local agent**. **Stop local agent** explicitly stops it; disconnecting the UI alone does not imply background execution has stopped. Changed provider settings take effect after a stop/start.

The native bridge enrolls and verifies its own local owner session. Conversation, workflow and device-action calls retain the existing review, selected-context, journal, receipt and reconciliation boundaries. Both environments select the upstream store capability policy, independently of build-channel selection. Browser development uses the lean plugin profile; Android uses the mobile allow-list. Desktop coding/PTY surfaces are excluded. Runtime location does not waive action approvals or provider consent.

## Reproducible source boundaries

- `vendor/eliza` stays pinned and unchanged at the repository's `upstream.lock.json` revision. Its Android lifecycle sources are generated into Gradle's ignored build directory with Alpha's identity and socket namespace. A generated SHA-256 manifest records inputs and outputs.
- The existing 35-patch MVP series reproduces against `4573712ebf0466daa4dfadaa4482704c209d9b8c`, which differs from the vendor pin. `agent:prepare` creates an isolated checkout in `artifacts/local-agent-source`, checks every patch hash, applies the exact series, and checks all recorded output hashes. It then applies the Android secure-store socket and lean workflow patches listed in `android-local-runtime-source.json`, checking their recorded output hashes too.
- Cached preparations are checked for changed recorded files and unexpected tracked changes. Preparation never resets or overwrites a mismatched checkout. `ALPHA_RUNTIME_GIT_CACHE` may point to an existing Git repository containing the recorded base, avoiding a network fetch; it does not change the required commit.
- Runtime preparation skips the unrelated fused local language-model engine setup. The mobile bundler and staged artifact manifest retain their own validation/provenance.

## Verification and remaining acceptance

The implementation has a real browser/local Eliza/Cerebras chat result, synthetic HTTP security/lifecycle tests, durable development journal tests, a successful mobile bundle module-load smoke, and Java compilation for both Android distribution variants. These are different evidence classes.

A native APK installation and real on-device Bun process/chat run, process-death/reboot recovery, battery/thermal qualification and physical-device acceptance are still required. Android APK assembly/install was not performed in this browser-focused pass. Cancellation immediately detaches the UI and aborts browser transport; an already-dispatched native action may still complete and must be reconciled from receipts. Buffered chat is implemented; token streaming is not yet exposed by this consumer bridge.

Powered-off-phone execution is unavailable with a device-only executor. Persisted schedules, explicit missed-occurrence policy and catch-up need their own acceptance; no browser check proves them. Cloud-backed Inbox/account integrations still require separate sign-in and live acceptance. Moving the agent does not complete every item in the broader MVP report.

The current mobile bundler stubs the workflow package and its mobile plugin collector excludes it. Browser development's workflow opt-in fixes the host profile only; Android workflow execution still needs an implemented and qualified mobile dependency closure. The presence of native workflow forwarding does not prove that a workflow engine is packaged.

Local evidence for this pass is retained in `test-results/local-agent-qualification/`: repository verification passed 39 tests; the clean browser suite passed 74 tests; both native Java variants compiled; mobile staging and its module-load smoke passed. The final live privacy copy was inspected separately after that browser suite. Against the prepared source, the real browser returned `72` for `8 × 9`, proposed and saved the synthetic **Local runtime check** note only after approval, and retained exactly one note plus its successful journal entry after reload. No provider credential is included in these evidence files.
